(() => {
  'use strict';

  const faNumber = new Intl.NumberFormat('fa-IR');
  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

  function fmtFa(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '';
    return faNumber.format(x);
  }

  function normalizeDigitsToAscii(s) {
    return String(s ?? '')
      .replace(/[۰-۹]/g, (ch) => String(FA_DIGITS.indexOf(ch)))
      .replace(/[٠-٩]/g, (ch) => String(AR_DIGITS.indexOf(ch)));
  }

  function parseDistanceFromValue(raw) {
    const ascii = normalizeDigitsToAscii(raw).replace(/[^\d]/g, '');
    if (!ascii) return NaN;
    return parseInt(ascii, 10);
  }

  // function normalizeArabic(text) {
  //   if (!text) return '';
  //   return text
  //     .replace(/[\u064B-\u065F]/g, '')
  //     .replace(/ٰ+[أإآاٱٰ]/g, 'اا')     // superscript alef(s) + alef → اا (يَٰٰأَيُّهَا → یاایها)
  //     .replace(/ٰ+/g, 'ا')              // remaining superscript alef(s) → alef (الانسان)
  //     .replace(/[أإآاٱٰ]/g, 'ا')
  //     .replace(/[يیى]/g, 'ی')
  //     .replace(/[كک]/g, 'ک')
  //     .replace(/ة/g, 'ه')
  //     .replace(/ئ/g, 'ء');
  // }
  function normalizeArabic(text) {
    if (!text) return '';
  
    return text
      .normalize('NFC')
      // 1) remove tatweel
      .replace(/\u0640/g, '')
      // 2) remove harakat + common Qur'anic annotation marks (BUT keep dagger alif U+0670 for now)
      .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '')
      // 3) dagger alif: collapse one-or-more (ٰ or ٰٰ) into ONE "ا"
      .replace(/\u0670+/g, 'ا')
      // 4) normalize alef forms to ا
      .replace(/[أإآٱا]/g, 'ا')
      // 5) hamza forms: for search, usually best to drop hamza “shape”
      // .replace(/ء/g, '')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ی')
      // 6) Persian-friendly letter unification (optional but matches what you typed)
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه');
  }
  

  // ---- Stats (same logic as search.html) ----
  const STATS_ALPHA = 0.5;

  function computePerSuraMetrics(cSura, cAll, N_s, totalTokens, vocabularySize) {
    const alpha = STATS_ALPHA;
    const V = Math.max(1, vocabularySize || 1);
    const N_sura = Math.max(1, N_s || 1);
    const N_total = Math.max(1, totalTokens || 1);
    const N_else = Math.max(1, N_total - N_sura);
    const c_else = Math.max(0, cAll - cSura);
    const p_s = (cSura + alpha) / (N_sura + alpha * V);
    const p_e = (c_else + alpha) / (N_else + alpha * V);
    const ratio = p_e > 0 ? (p_s / p_e) : 0;
    const kl = (p_e > 0 && p_s > 0) ? (p_s * Math.log(p_s / p_e)) : 0;
    const q = (cAll + alpha) / (N_total + alpha * V);
    const m = q > 0 ? (cSura * p_s / q) : 0;
    return { relInSura: cSura / N_sura, ratio, kl, m, pSura: p_s, pElse: p_e };
  }

  /** Build universe cache from morphologyData { sura: { ayah: { wordIndex: { root, lemma, text } } } } */
  function buildStatsUniverseCache(morphologyData) {
    const cache = {
      totalWordTokens: 0,
      totalRootTokens: 0,
      totalLemmaTokens: 0,
      wordTokensBySura: {},
      rootTokensBySura: {},
      lemmaTokensBySura: {},
      rootVocabularySize: 0,
      lemmaVocabularySize: 0,
      wordVocabularySize: 0
    };
    const rootCounts = {};
    const lemmaCounts = {};
    const wordCounts = {};

    for (const suraKey of Object.keys(morphologyData)) {
      const suraNum = parseInt(suraKey, 10);
      if (!Number.isFinite(suraNum)) continue;
      const suraData = morphologyData[suraKey];
      for (const ayahKey of Object.keys(suraData)) {
        const ayahData = suraData[ayahKey] || {};
        for (const wi of Object.keys(ayahData)) {
          const w = ayahData[wi];
          if (!w || !w.text) continue;
          cache.totalWordTokens++;
          cache.wordTokensBySura[suraNum] = (cache.wordTokensBySura[suraNum] || 0) + 1;
          const nw = normalizeArabic(w.text);
          if (nw) wordCounts[nw] = (wordCounts[nw] || 0) + 1;
          if (w.root) {
            cache.totalRootTokens++;
            cache.rootTokensBySura[suraNum] = (cache.rootTokensBySura[suraNum] || 0) + 1;
            rootCounts[w.root] = (rootCounts[w.root] || 0) + 1;
          }
          if (w.lemma) {
            cache.totalLemmaTokens++;
            cache.lemmaTokensBySura[suraNum] = (cache.lemmaTokensBySura[suraNum] || 0) + 1;
            lemmaCounts[w.lemma] = (lemmaCounts[w.lemma] || 0) + 1;
          }
        }
      }
    }
    cache.rootVocabularySize = Object.keys(rootCounts).length;
    cache.lemmaVocabularySize = Object.keys(lemmaCounts).length;
    cache.wordVocabularySize = Object.keys(wordCounts).length;
    return cache;
  }

  /** Full-universe stats for itemType: 'root' | 'lemma' | 'lem' | 'word' | 'text' */
  function resolveStatsUniverse(cache, itemType) {
    if (itemType === 'root') {
      return {
        totalTokens: cache.totalRootTokens || 1,
        tokensBySura: cache.rootTokensBySura || {},
        vocabularySize: cache.rootVocabularySize || 1
      };
    }
    if (itemType === 'lemma' || itemType === 'lem') {
      return {
        totalTokens: cache.totalLemmaTokens || 1,
        tokensBySura: cache.lemmaTokensBySura || {},
        vocabularySize: cache.lemmaVocabularySize || 1
      };
    }
    return {
      totalTokens: cache.totalWordTokens || 1,
      tokensBySura: cache.wordTokensBySura || {},
      vocabularySize: cache.wordVocabularySize || 1
    };
  }

  /**
   * Scoped universe resolver used by both search.html and desktop.js.
   * selectedSuras: null/empty => full universe, otherwise totalTokens is scoped.
   */
  function resolveStatsUniverseScoped(cache, itemType, selectedSuras, debugMeta) {
    const full = resolveStatsUniverse(cache, itemType);
    if (!Array.isArray(selectedSuras) || selectedSuras.length === 0) {
      console.log('[stats-io] resolveStatsUniverseScoped', {
        source: debugMeta && debugMeta.source ? debugMeta.source : 'unknown',
        itemType,
        selectedSuras: null,
        output: {
          totalTokens: full.totalTokens,
          vocabularySize: full.vocabularySize
        }
      });
      return full;
    }
    let total = 0;
    for (const s of selectedSuras) total += full.tokensBySura[s] || 0;
    const scoped = {
      totalTokens: total || 1,
      tokensBySura: full.tokensBySura,
      vocabularySize: full.vocabularySize
    };
    console.log('[stats-io] resolveStatsUniverseScoped', {
      source: debugMeta && debugMeta.source ? debugMeta.source : 'unknown',
      itemType,
      selectedSuras,
      output: {
        totalTokens: scoped.totalTokens,
        vocabularySize: scoped.vocabularySize
      }
    });
    return scoped;
  }

  /**
   * Compute per-sura stats rows for one item.
   * @param {Array<{sura: number, ayah?: number, wordIndex?: number}>} matches
   * @param {string} itemType - 'root' | 'lemma' | 'word' | 'text'
   * @param {{ totalTokens, tokensBySura, vocabularySize }} universe
   * @param {string|null} focusedLem - if set, use lemma universe (root+lem case)
   * @returns {Array<{ sura, count, relInSura, ratio, kl, m }>}
   */
  function computeStatsRowsForItem(matches, itemType, universe, focusedLem) {
    if (!matches || !matches.length) return [];
    const countsBySura = {};
    for (const m of matches) {
      const s = Number(m.sura);
      if (!Number.isFinite(s)) continue;
      countsBySura[s] = (countsBySura[s] || 0) + 1;
    }
    const totalMatchCount = matches.length;
    const suras = Object.keys(countsBySura).map(Number).sort((a, b) => a - b);
    const rows = suras.map(sura => {
      const cSura = countsBySura[sura] || 0;
      const N_s = universe.tokensBySura[sura] || 1;
      const metrics = computePerSuraMetrics(cSura, totalMatchCount, N_s, universe.totalTokens, universe.vocabularySize);
      return {
        sura,
        count: cSura,
        relInSura: metrics.relInSura,
        ratio: metrics.ratio,
        kl: metrics.kl,
        m: metrics.m
      };
    });
    console.log('[stats-io] computeStatsRowsForItem', {
      itemType,
      focusedLem: focusedLem || null,
      matchCount: totalMatchCount,
      universe: {
        totalTokens: universe.totalTokens,
        vocabularySize: universe.vocabularySize
      },
      rowCount: rows.length,
      firstRow: rows[0] || null
    });
    return rows;
  }

  /**
   * Parse morphology text file into morphologyData for stats (buildStatsUniverseCache).
   * Uses convertBuckwalterToArabic (passed or window.convertBuckwalterToArabic).
   * @returns {{ [sura]: { [ayah]: { [wordIndex]: { root, lemma, text } } } }
   */
  function parseMorphologyForStats(text, convertBuckwalterToArabicFn) {
    const toArabic = convertBuckwalterToArabicFn || (typeof window !== 'undefined' && window.convertBuckwalterToArabic) || (function(s) { return s; });
    const morphologyData = {};
    const lines = text.split('\n');
    const wordSegments = {};

    for (const line of lines) {
      if (!line || line.startsWith('#') || line.startsWith('LOCATION')) continue;
      const parts = line.split('\t');
      if (parts.length < 3) continue;
      const location = parts[0];
      const wordText = parts[1];
      const features = parts[3] || '';
      const locMatch = location.match(/\((\d+):(\d+):(\d+):(\d+)\)/);
      if (!locMatch) continue;
      const sura = parseInt(locMatch[1], 10);
      const ayah = parseInt(locMatch[2], 10);
      const wordIndex = parseInt(locMatch[3], 10);
      const segment = parseInt(locMatch[4], 10);
      const key = sura + ':' + ayah + ':' + wordIndex;
      if (!wordSegments[key]) wordSegments[key] = { sura, ayah, wordIndex, segments: [] };
      wordSegments[key].segments.push({ segment, text: wordText, features });
    }

    for (const key of Object.keys(wordSegments)) {
      const { sura, ayah, wordIndex, segments } = wordSegments[key];
      segments.sort((a, b) => (a.segment - b.segment));
      const fullWordBuckwalter = segments.map(s => s.text).join('');
      const arabicWord = toArabic(fullWordBuckwalter);
      let root = null;
      let lemma = null;
      for (const seg of segments) {
        if (!root) {
          const rootMatch = (seg.features || '').match(/ROOT:([^\|]+)/);
          if (rootMatch) root = toArabic(rootMatch[1]);
        }
        if (!lemma) {
          const lemmaMatch = (seg.features || '').match(/LEM:([^\|]+)/);
          if (lemmaMatch) lemma = toArabic(lemmaMatch[1]);
        }
      }
      if (!morphologyData[sura]) morphologyData[sura] = {};
      if (!morphologyData[sura][ayah]) morphologyData[sura][ayah] = {};
      morphologyData[sura][ayah][wordIndex] = { root, lemma, text: arabicWord };
    }
    return morphologyData;
  }

  /** Same format as search.html buildSearchDetails for root+lems line. */
  function buildSearchDetailsLineForRoot(root, selectedLemNames, selectedCount, totalCount) {
    const names = Array.isArray(selectedLemNames) ? selectedLemNames.join('، ') : String(selectedLemNames || '');
    return 'ریشه: ' + root + ' (' + names + ' [' + fmtFa(selectedCount) + '/' + fmtFa(totalCount) + '])';
  }

  /** Build the exact same payload object that search window postMessages for "root with one lemma". */
  function buildAddSearchItemPayloadForRootWithLemma(root, lemma, regions) {
    return {
      display: root,
      items: [{ type: 'root', value: root }],
      itemCheckedState: [true],
      distance: 0,
      crossSura: false,
      statsRows: null,
      searchDetails: buildSearchDetailsLineForRoot(root, [lemma], 1, 1),
      regions: Array.isArray(regions) ? regions : null,
      root: root,
      lemma: lemma
    };
  }

  window.SearchShared = {
    fmtFa,
    normalizeDigitsToAscii,
    parseDistanceFromValue,
    normalizeArabic,
    STATS_ALPHA,
    computePerSuraMetrics,
    buildStatsUniverseCache,
    resolveStatsUniverse,
    resolveStatsUniverseScoped,
    computeStatsRowsForItem,
    parseMorphologyForStats,
    buildSearchDetailsLineForRoot,
    buildAddSearchItemPayloadForRootWithLemma
  };
})();
