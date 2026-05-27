# ped-git.github.io

Quran text-analysis tools (Persian/Arabic UI). The main pages are:

- `search.html` — search the Quran by root / similar-root / exact word / text, with
  multi-item co-occurrence search, region grouping, and per-sura statistics.
- `simple.html`, `hadith.html`, `stat.html`, `commentary.html`, `list.html`,
  `yasir.html` — related viewers and tools.
- `data/` — morphology, similarity and related JSON data.
- `js/`, `src/`, `Yasir/` — shared scripts and assets.

---

## How search works in `search.html`

All search logic is in the inline `<script>` of `search.html`. The entry point is
[`performSearch()`](search.html#L3107) (`search.html:3107`). It reads the list of
selected items (`selectedItems`) and the distance window
(`getDistanceValueClamped()`), and returns an array of result **groups** with extra
statistics metadata attached.

There are three execution paths:

1. **Focus mode** — a single item/lemma is highlighted (`highlightedItem`).
2. **Single item** — exactly one checked item (`n === 1`).
3. **Multiple items** — two or more checked items (`n >= 2`). This is the
   interesting case described below.

### The problem (multiple search items)

When more than one search item is active, the question is **not** "where does each
item occur" but:

> Find every window of consecutive ayahs (at most `distance` ayahs wide) in which
> **all** selected items occur together.

`distance` is the maximum allowed ayah span of a window. By default a window may not
cross a sura boundary; the **cross-sura** toggle (`crossSura`) lifts that limit.
Positions are measured as a single global ayah index over the whole Quran (cumulative
ayah count), so "distance" is just a difference of integers — see
[`buildGlobalAyahCache()`](search.html#L3045) and
[`getGlobalAyahPosition()`](search.html#L3069).

### Steps and the name of each step's result

The algorithm (in [`performSearch()`](search.html#L3107)) proceeds as follows. Each
row gives the step, what it does, and the **variable that holds its result**.

| # | Step | What it computes | Result variable |
|---|------|------------------|-----------------|
| 0 | Setup | Distance window size; whether windows may cross suras | `distance`, `crossSura` |
| 0 | Active items | Indices of checked (active) items, and their count | `checkedIndices`, `n` |
| 1 | Per-item matches | For each active item, all matching words, sorted by position (via [`findMatchingWords()`](search.html#L2950)) | `matchesByItem` (`matchesByItem[i]` = matches of item *i*) |
| 1 | Per-item ayahs | For each item, the sorted **unique** global ayah positions that contain a match | `M` (`M[i]`) |
| 1 | Candidate starts | The sorted union of all ayah positions of all items — every possible window start | `startCandidates` |
| 2 | Window validation (the AND / co-occurrence test) | For each `startCandidate` position `cPos`, check whether **every** item has at least one match inside `[cPos, min(cPos + distance, sura end)]` (binary search via `collectInRange` / `hasAnyInRange`). A candidate passes only if all items are present. | `ok` (per candidate); diagnostics in `candidateChecks` → `candidateDebug` |
| 3 | Build intervals | For each passing candidate: record its start ayah per sura, gather **all** matches from all items inside the window, and emit one interval `{ startPos, endPos, matches }` | `intervals`; start ayahs in `combinedStartAyahBySura`; diagnostics in `matchedByItem` → `combinedStartDebug` |
| 4 | Sort intervals | Sort the intervals by their start position | `intervals` (now sorted) |
| 5 | Merge intervals | Merge overlapping / touching intervals and de-duplicate their matches | `mergedIntervals` |
| 6 | Convert to groups | Turn each interval into one display **group** per sura (`{ sura, startAyah, endAyah, matches, intervalId, groupKey, isMultiSura, ... }`) via [`convertIntervalsToGroups()`](search.html#L3572). Intervals that span suras become several groups sharing one `intervalId`. | `groups` |
| 7 | Per-sura counts | For each sura, the count and the sorted list of valid window-start ayahs (the *c<sub>s</sub>* used by the statistics view), and their total | `csBySura`, `startsBySura`, `totalCS` |
| 7 | Attach metadata | Stats metadata is attached to the returned `groups` array | `groups.__combinedCSBySura`, `groups.__combinedStartAyahsBySura`, `groups.__combinedStartDebug`, `groups.__combinedTotalCS`, `groups.__combinedEligible`, `groups.__statsInput` |

The function returns `groups` (the array of regions plus the `__combined*` metadata).

### The other two paths (for reference)

- **Single item** (`n === 1`): no co-occurrence test is needed. The item's matches
  are grouped into regions directly with
  [`groupMatchesByRegion()`](search.html#L4403), which starts a new region whenever
  the next match is in a different sura or more than `distance` ayahs away. Result:
  `groups` (with empty `__combined*` metadata, `__combinedEligible = false`).

- **Focus mode** (`highlightedItem` set): only the highlighted item / lemma /
  similar-root is searched (`findMatchingWords(...)` with `focusedLem` /
  `focusedRelatedRoot` / `ignoreFilters`), then grouped with
  `groupMatchesByRegion()`. Result: `groups` for that single focused selection.

### Root items: 3-level selection tree

A `root` search item expands into a tree the user can check/uncheck at any level:

1. **root** (level 1)
2. **lemma** (level 2) — `rootLemData[root].lems`
3. **word-form / stem** (level 3) — `lem.words`, the distinct text of the *root-bearing
   segment* of each occurrence (e.g. for `(54:37:9:2) nu*uri … ROOT:n*r` the word-form is
   `نُذُرِ`, not the whole word `وَنُذُرِ`).

The stem text is captured by `corpus.js` (`parseMorphologyText` stores `stem` =
`toArabic(rootSegment.text)`). `getLemsForRoot()` groups occurrences into
lemma → word-form. Selection is authoritative at the **word level**; a lemma is "active"
if any of its words is selected, and its checkbox shows checked / indeterminate /
unchecked accordingly (same cascade as the existing levels). `findMatchingWords()` filters
occurrences by the selected `(lemma, stem)` pairs (`getAllowedRootWords()`), and word-level
selection is serialized into the URL/history (`serializeRootLemmaSelection()` →
`lemma: 'all' | [words]`, backward-compatible with the old `[lemmas]` format). Clicking a
word row focuses just that word-form (`highlightedItem.type === 'word'`).

### Match types

[`findMatchingWords()`](search.html#L2950) (`search.html:2950`) produces the raw
matches for one item and supports four item types:

- `root` — all words of a root, optionally filtered to the selected lemmas.
- `similar-root` — words of roots related to the given root (similarity data).
- `word` — exact word-text match.
- text (default) — partial single-word match, or a multi-word **phrase** search via
  `findPhraseMatches()`.

### Rendering

The grouped results are rendered by `renderResults(...)`. The view can be `regions`
(default), `stats`, or `charts`, controlled by `searchResultsView` and persisted in
`localStorage`.

### Audio playback (words + ayahs)

Search results support recitation playback, ported from `simple.html`:

- **Word**: clicking a word opens its popup; the play button sits on the first line, to
  the left of the word translation (`buildWordTooltipContent()`). It plays the
  word-by-word audio (`playWordAudio()` → `buildWordAudioUrl()`, `audio.qurancdn.com/wbw`).
- **Ayah**: clicking an ayah reference opens an ayah popup (`showAyahPopup()`) showing the
  ayah translation (description) with a play button and a link to open it in the viewer.
  The play button plays the full-ayah recitation (`playAyahAudio()` →
  `resolveAyahAudioUrl()`, quran.com API or tanzil.net depending on the reciter).
- A single shared `Audio` element with a small state machine drives all the play buttons
  (`refreshAudioButtons()`); a floating stop button (`#audio-stop-btn`) stops playback.
- **Reciter selection** lives in the settings menu (`#reciter-select`, quran.com + tanzil
  groups). The choice is stored under `localStorage['simple_reciter']` — **the same key
  `simple.html` uses**, so the reciter is shared across the whole site.

When the **quran.com (QCF) font** is active, result words are joined with `<wbr>` instead
of a space (`highlightMatches()`): the QCF glyphs carry their own spacing, so this avoids
an extra gap while still allowing lines to wrap.

---

## Terminology (multi-item search)

| Term | Meaning | In code |
|------|---------|---------|
| **search item** | one query entry the user added (active = checked) | `selectedItems[i]` / `checkedIndices` |
| **sub-item** | a constituent of a search item: a root's lemmas (level 2) → word-forms/stems (level 3), a similar-root's related roots, a phrase's words | inside `findMatchingWords()` |
| **occurrence** | one word-position hit of a search item (via any sub-item) | an entry of `matchesByItem[i]` |
| **occurrence ayah** | the ayah of an occurrence | `M[i]` |
| **window size** | the allowed ayah distance | `distance` |
| **anchor** | an occurrence ayah used as the start of a forward window | `startCandidates` (`cPos`) |
| **window** | `[anchor, anchor + distance]` (capped at the sura unless cross-sura) | `[cPos, hi]` |
| **co-occurrence test** | every active search item has ≥1 occurrence inside the window | the `ok` flag |
| **matching range** | for a passing anchor, the span from earliest to latest occurrence, with its matches | `interval` `{ startPos, endPos, matches }` |
| **region** | a matching range after merging overlapping ranges (shown as one result block / "بازه") | `mergedIntervals` → `groups` |

Pipeline: occurrences → anchors → windows → co-occurrence test → **matching ranges** → merge → **regions**.

### Three different counts

- **occurrence count** — how many occurrences a single item has (token-level); ignores the other items and the distance.
- **matching-range count** — how many matching ranges exist *before* merging (= passing anchors); per sura this is `__combinedCSBySura`, total `__combinedTotalCS`.
- **region count** — how many remain *after* merging; this is the "بازه" total shown at the top of the results and the number of result blocks. **Not** the sum of per-item occurrence counts.

For a multi-item search, "number of matches" should mean **region count** — the only count consistent with both the algorithm and the displayed blocks.

## Stats / chart view (tabular)

The stats table and chart are produced by `performItemSuraStatsSearch()` →
`renderStatsResults()` / `renderStatsCharts()`. The **تعداد** column always counts
**occurrences** (word tokens), never ayahs/anchors — consistent for one or many items.
The `تطابق` toggle (`statsMatchMode`) changes *which* occurrences. The toggle currently
offers two modes (default **همه**); **`separated`/مجزا is temporarily disabled** via
`STATS_MATCH_MODES` (kept in the code to re-enable later — single-item searches still use
that per-item path internally):

| Mode | `تعداد` counts | Universe (denominator) |
|------|----------------|------------------------|
| **همه** (`all`, default) | occurrences of all items that fall **inside the co-occurrence regions**, per sura | word-token universe |
| **هر کدام** (`any-total`) | all items' occurrences summed (x+y+…), per sura | word-token universe |
| _(مجزا / `separated`, disabled)_ | each item's own occurrences, per sura | that item's type-token universe |

Hovering the **تعداد** and **بازه** cells shows a mode-aware tooltip
(`statsCountTooltipHtml()` / `statsRangeTooltipHtml()`) explaining what the number means
in the current mode.

The **بازه** column always shows the **merged region count** per sura (`computeRegionsBySura()`),
independent of mode. So for the بشر+نذر example in Furqan (distance 5): `همه` shows
`تعداد=5` (3 بشر + 2 نذر inside the one region) and `بازه=1`; the old "4 anchors" number is
no longer displayed. Combined-mode frequencies are now token-based (`occurrences / words`),
so `فراوانی` can no longer exceed 100%.

Clicking a `تعداد` cell filters the search to that sura and switches to the regions view,
keeping the full search (all items / co-occurrence) — i.e. "search that sura".

The card/chart title (`getStatsItemTitle()`) shows the plain item name when all of an
item's sub-items are selected; when only some are selected it shows them (max two, then
`+N`), e.g. `ربب: a، b +3`.

Columns / chart series: **تعداد** (occurrence count), **بازه** (region count, per sura —
from `computeRegionsBySura()`), **فراوانی**, **تمایز**, **KL**, **N²/N**.

- The **بازه** column/series reports the region count per sura, derived from the rendered
  `groups` (counts distinct `intervalId`s touching each sura).
- In the **chart**, measures can be toggled on/off via the Plotly legend; the choice is
  saved to `localStorage` (`searchChartHiddenMeasures`) and **persists across searches**
  and is mirrored across the per-item charts.

> Known caveat: in `any-total` mode the frequency/ratio columns mix token counts
> (numerator) with ayah counts (denominator), so `فراوانی` can exceed 100%. The
> `separated` mode is unit-consistent.

## Browser history & URL state

The committed search state is serialized (`buildSearchStatePayload()` →
`encodeSearchStatePayload()`) into the `state` URL param and into `history.state`.
The payload covers: search items (with sub-item/lemma selection and checked flags),
suras, distance, cross-sura, **view** (regions/stats/charts) and **sort**.

- A back/forward **history step is pushed** (`maybePushSearchHistory()`) whenever the
  committed state changes: adding/removing a search item, changing a sub-item
  selection, changing suras/distance, or switching view/sort. Duplicate states are
  de-duplicated, and focus highlighting (which isn't part of the state) never pushes.
- **Chart measure visibility is deliberately excluded** from the state, so toggling a
  measure in the chart legend does not create a history step.
- `popstate` restores the corresponding state (`applySearchStatePayload()` + a
  re-search), guarded by `isRestoringHistory` so restoring never pushes a new step.
- On load, `initSearchHistoryBaseline()` records the starting entry so the first change
  has something to return to.
