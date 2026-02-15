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
  

  window.SearchShared = {
    fmtFa,
    normalizeDigitsToAscii,
    parseDistanceFromValue,
    normalizeArabic
  };
})();
