(() => {
  'use strict';

  const MORPHOLOGY_PATH = 'data/quranic-corpus-morphology-0.4.txt';
  const textPromiseCache = new Map();
  const parsedPromiseCache = new Map();

  function getPath(options = {}) {
    if (options.path) return options.path;
    const basePath = options.basePath || '';
    return basePath + MORPHOLOGY_PATH;
  }

  function getDefaultToArabic() {
    if (typeof window !== 'undefined' && typeof window.convertBuckwalterToArabic === 'function') {
      return window.convertBuckwalterToArabic;
    }
    return function identity(text) { return text || ''; };
  }

  function defaultNormalizeArabic(text) {
    return String(text || '')
      .normalize('NFC')
      .replace(/\u0640/g, '')
      .replace(/[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED]/g, '')
      .replace(/ا\u0670+/g, 'ا')
      .replace(/\u0670+/g, 'ا')
      .replace(/[أإآٱا]/g, 'ا')
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه');
  }

  function loadMorphologyText(options = {}) {
    const path = getPath(options);
    if (!options.forceReload && textPromiseCache.has(path)) {
      return textPromiseCache.get(path);
    }
    const promise = fetch(path).then((response) => {
      if (!response.ok) throw new Error(`Failed to load morphology data: HTTP ${response.status}`);
      return response.text();
    });
    if (!options.forceReload) textPromiseCache.set(path, promise);
    return promise;
  }

  function buildParsedCacheKey(options = {}) {
    return JSON.stringify({
      path: getPath(options),
      filterSura: Number.isFinite(Number(options.filterSura)) ? Number(options.filterSura) : null,
      includeText: options.includeText !== false,
      includeWordTextsMap: options.includeWordTextsMap === true
    });
  }

  function parseMorphologyText(text, options = {}) {
    const toArabic = options.toArabic || getDefaultToArabic();
    const normalizeArabic = options.normalizeArabic || defaultNormalizeArabic;
    const includeText = options.includeText !== false;
    const includeWordTextsMap = options.includeWordTextsMap === true;
    const parsedFilterSura = Number(options.filterSura);
    const filterSura = Number.isFinite(parsedFilterSura) ? parsedFilterSura : null;

    const morphologyData = {};
    const rootToWordsMap = {};
    const wordTextsMap = {};
    const wordSegments = {};
    const lines = String(text || '').split('\n');

    for (const line of lines) {
      if (!line || line.startsWith('#') || line.startsWith('LOCATION')) continue;
      const parts = line.replace(/[\s\r]+$/, '').split('\t');
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
      if (filterSura !== null && sura !== filterSura) continue;

      const key = `${sura}:${ayah}:${wordIndex}`;
      if (!wordSegments[key]) {
        wordSegments[key] = { sura, ayah, wordIndex, segments: [] };
      }
      wordSegments[key].segments.push({ segment, text: wordText, features });
    }

    for (const key of Object.keys(wordSegments)) {
      const { sura, ayah, wordIndex, segments } = wordSegments[key];
      segments.sort((a, b) => a.segment - b.segment);

      const fullWordBuckwalter = segments.map((segment) => segment.text).join('');
      const arabicWord = toArabic(fullWordBuckwalter);
      let root = null;
      let lemma = null;

      for (const segment of segments) {
        if (!root) {
          const rootMatch = (segment.features || '').match(/ROOT:([^\|]+)/);
          if (rootMatch) root = toArabic(rootMatch[1]);
        }
        if (!lemma) {
          const lemmaMatch = (segment.features || '').match(/LEM:([^\|]+)/);
          if (lemmaMatch) lemma = toArabic(lemmaMatch[1]);
        }
      }

      if (!morphologyData[sura]) morphologyData[sura] = {};
      if (!morphologyData[sura][ayah]) morphologyData[sura][ayah] = {};
      morphologyData[sura][ayah][wordIndex] = includeText
        ? { root, lemma, text: arabicWord }
        : { root, lemma };

      if (root) {
        if (!rootToWordsMap[root]) rootToWordsMap[root] = [];
        const locationInfo = filterSura === null ? { sura, ayah, wordIndex } : { ayah, wordIndex };
        const exists = rootToWordsMap[root].some((entry) =>
          entry.ayah === ayah && entry.wordIndex === wordIndex && (filterSura !== null || entry.sura === sura)
        );
        if (!exists) rootToWordsMap[root].push(locationInfo);
      }

      if (includeWordTextsMap) {
        const normalizedWord = normalizeArabic(arabicWord);
        if (normalizedWord.length > 1) {
          if (!wordTextsMap[normalizedWord]) wordTextsMap[normalizedWord] = [];
          wordTextsMap[normalizedWord].push({ sura, ayah, wordIndex, original: arabicWord });
        }
      }
    }

    return { morphologyData, rootToWordsMap, wordTextsMap };
  }

  function loadMorphologyData(options = {}) {
    const key = buildParsedCacheKey(options);
    if (!options.forceReload && parsedPromiseCache.has(key)) {
      return parsedPromiseCache.get(key);
    }
    const promise = loadMorphologyText(options).then((text) => parseMorphologyText(text, options));
    if (!options.forceReload) parsedPromiseCache.set(key, promise);
    return promise;
  }

  function clearCaches() {
    textPromiseCache.clear();
    parsedPromiseCache.clear();
  }

  window.CorpusData = {
    MORPHOLOGY_PATH,
    loadMorphologyText,
    parseMorphologyText,
    loadMorphologyData,
    clearCaches
  };
})();
