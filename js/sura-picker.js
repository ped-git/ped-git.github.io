/**
 * Sura (and optional ayah) picker module.
 * Depends on: js/sura-data.js (SURA_NAMES, SURA_AYAT).
 * Usage: SuraPicker.open({ currentSura: 1, currentAyah: 5, onSelect: function(sura, ayah) {} })
 * - One search box: filter by sura name or number; can type "سوره آیه" (e.g. بقره ۲۵۵) then click card to go to that ayah.
 * - Enter: if input parses as sura+ayah or sura only, calls onSelect and closes.
 */
(function(global) {
    'use strict';

    var SURA_NAMES = typeof global.SURA_NAMES !== 'undefined' ? global.SURA_NAMES : {};
    var SURA_AYAT = typeof global.SURA_AYAT !== 'undefined' ? global.SURA_AYAT : {};

    function fmtFa(n) {
        var x = Number(n);
        if (!Number.isFinite(x)) return '';
        return String(x).replace(/[0-9]/g, function(d) { return String.fromCharCode(0x06F0 + parseInt(d, 10)); });
    }

    function getSuraName(num) {
        return SURA_NAMES[num] ? SURA_NAMES[num] : ('سوره ' + fmtFa(num));
    }

    function escapeHtml(s) {
        if (!s) return '';
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    function getMaxAyah(sura) {
        return (SURA_AYAT[sura] != null) ? SURA_AYAT[sura] : 286;
    }

    /** Normalize Persian/Arabic digits to Latin for parsing */
    function digitsToLatin(str) {
        if (!str) return '';
        return String(str).replace(/[\u06F0-\u06F9]/g, function(c) { return String(c.charCodeAt(0) - 0x06F0); })
            .replace(/[\u0660-\u0669]/g, function(c) { return String(c.charCodeAt(0) - 0x0660); });
    }

    /** Match trailing digits (Latin, Persian, Arabic) for splitting "suraname۲۵۵" */
    function splitTrailingDigits(str) {
        var s = String(str).trim();
        if (!s) return { suraPart: '', ayahPart: '' };
        var m = s.match(/^(.+?)([\d\u06F0-\u06F9\u0660-\u0669]+)$/);
        if (m) return { suraPart: m[1].trim(), ayahPart: digitsToLatin(m[2]) };
        return { suraPart: s, ayahPart: '' };
    }

    /**
     * Parse "SURENAME AYENUMBER" or "SURA_NUM AYENUMBER" or "SURENAME۲۵۵" (no space) or just "SURENAME" / "SURA_NUM".
     * Returns { sura: number, ayah: number | undefined } or null if invalid.
     */
    function parseSuraAyahInput(text) {
        var t = String(text).trim();
        if (!t) return null;
        var normalized = digitsToLatin(t);
        var parts = normalized.split(/\s+/);
        var suraPart = (parts[0] || '').trim();
        var ayahPart = (parts[1] || '').trim();
        if (!ayahPart && parts.length === 1 && parts[0]) {
            var split = splitTrailingDigits(t);
            suraPart = split.suraPart;
            ayahPart = split.ayahPart;
        }
        var sura = null;
        var num = parseInt(digitsToLatin(suraPart), 10);
        if (Number.isFinite(num) && num >= 1 && num <= 114) {
            sura = num;
        } else {
            var q = suraPart.toLowerCase();
            for (var i = 1; i <= 114; i++) {
                var name = (SURA_NAMES[i] || '').toLowerCase();
                if (name && (name === q || name.indexOf(q) !== -1 || q.indexOf(name) !== -1)) {
                    sura = i;
                    break;
                }
            }
        }
        if (sura == null) return null;
        var ayah = undefined;
        if (ayahPart) {
            var a = parseInt(ayahPart, 10);
            if (Number.isFinite(a)) {
                var max = getMaxAyah(sura);
                ayah = Math.max(1, Math.min(max, a));
            }
        }
        return { sura: sura, ayah: ayah };
    }

    var overlay = null;
    var currentOnSelect = null;
    var searchInputRef = null;

    var PICKER_CSS =
        '#sura-picker-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;visibility:hidden;transition:opacity .2s,visibility .2s}' +
        '#sura-picker-overlay.visible{opacity:1;visibility:visible}' +
        '#sura-picker-modal{background:#fff;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,0.15);max-width:90vw;width:520px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden}' +
        '.sura-picker-header{padding:16px 20px;border-bottom:1px solid #e8e6e2;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}' +
        '.sura-picker-title{margin:0;font-size:1.25rem;color:#2c3e50}' +
        '.sura-picker-search{flex:1;min-width:160px;max-width:320px;padding:8px 12px;border:1px solid #ccc;border-radius:8px;font-size:.95rem;direction:rtl}' +
        '.sura-picker-close{width:36px;height:36px;border:none;border-radius:8px;background:#f0e6e0;color:#8b6914;font-size:1.2rem;cursor:pointer;flex-shrink:0}' +
        '.sura-picker-inferred{font-size:.9rem;color:#475569;white-space:nowrap}' +
        '.sura-picker-inferred strong{color:#0f172a}' +
        '.sura-picker-body{overflow-y:auto;padding:16px 20px 20px}' +
        '.sura-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}' +
        '.sura-picker-card{padding:12px 10px;border-radius:12px;background:#faf8f5;border:1px solid #e8e6e2;cursor:pointer;text-align:center;transition:background .15s,border-color .15s}' +
        '.sura-picker-card:hover{background:#f0ebe4;border-color:#c4bfb4}' +
        '.sura-picker-card.current{background:#e8e6e2;border-color:#2c3e50}' +
        '.sura-picker-card .sura-picker-name{font-weight:bold;font-size:1rem;color:#2c3e50;margin-bottom:2px}' +
        '.sura-picker-card .sura-picker-num{font-size:.8rem;color:#555}' +
        '.sura-picker-card.hidden{display:none}';

    function injectStyles() {
        if (document.getElementById('sura-picker-styles')) return;
        var style = document.createElement('style');
        style.id = 'sura-picker-styles';
        style.textContent = PICKER_CSS;
        (document.head || document.documentElement).appendChild(style);
    }

    function createPicker() {
        if (overlay) return overlay;
        injectStyles();
        overlay = document.createElement('div');
        overlay.id = 'sura-picker-overlay';
        var modal = document.createElement('div');
        modal.id = 'sura-picker-modal';
        var header = document.createElement('div');
        header.className = 'sura-picker-header';
        var title = document.createElement('h2');
        title.className = 'sura-picker-title';
        title.textContent = 'انتخاب سوره';
        var search = document.createElement('input');
        search.type = 'text';
        search.className = 'sura-picker-search';
        search.placeholder = 'جستجو یا نام سوره و شماره آیه (مثلاً بقره ۲۵۵)';
        search.setAttribute('aria-label', 'جستجو یا نام سوره و شماره آیه');
        searchInputRef = search;
        var inferredEl = document.createElement('span');
        inferredEl.className = 'sura-picker-inferred';
        inferredEl.id = 'sura-picker-inferred';
        inferredEl.setAttribute('aria-live', 'polite');
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'sura-picker-close';
        closeBtn.textContent = '\u00D7';
        closeBtn.addEventListener('click', hide);

        function updateInferred() {
            var raw = search.value.trim();
            var parsed = parseSuraAyahInput(raw);
            if (parsed && parsed.ayah != null) {
                inferredEl.innerHTML = 'آیه\u00A0<strong>' + escapeHtml(fmtFa(parsed.ayah)) + '</strong>';
                inferredEl.style.display = '';
            } else {
                inferredEl.textContent = '';
                inferredEl.style.display = 'none';
            }
        }
        search.addEventListener('input', function() {
            updateInferred();
        });

        header.appendChild(title);
        header.appendChild(search);
        header.appendChild(inferredEl);
        header.appendChild(closeBtn);

        var body = document.createElement('div');
        body.className = 'sura-picker-body';
        var grid = document.createElement('div');
        grid.className = 'sura-picker-grid';
        grid.id = 'sura-picker-grid';
        for (var i = 1; i <= 114; i++) {
            var card = document.createElement('div');
            card.className = 'sura-picker-card';
            card.setAttribute('data-sura', i);
            var nameStr = getSuraName(i);
            card.setAttribute('data-name', nameStr);
            card.setAttribute('data-num', String(i));
            card.innerHTML = '<div class="sura-picker-name">' + escapeHtml(nameStr) + '</div><div class="sura-picker-num">' + fmtFa(i) + '</div>';
            card.addEventListener('click', function() {
                var num = parseInt(this.getAttribute('data-sura'), 10);
                var parsed = searchInputRef ? parseSuraAyahInput(searchInputRef.value) : null;
                var ayah = undefined;
                if (parsed && parsed.sura === num && parsed.ayah != null) ayah = parsed.ayah;
                if (currentOnSelect) currentOnSelect(num, ayah);
                hide();
            });
            grid.appendChild(card);
        }
        search.addEventListener('input', function() {
            var raw = this.value.trim();
            var parsed = parseSuraAyahInput(raw);
            var parts = raw.split(/\s+/);
            var filterPart = (parts[0] || '').trim();
            var q = filterPart.toLowerCase();
            var qNum = digitsToLatin(filterPart);
            var cards = grid.querySelectorAll('.sura-picker-card');
            for (var j = 0; j < cards.length; j++) {
                var c = cards[j];
                var name = (c.getAttribute('data-name') || '').toLowerCase();
                var num = c.getAttribute('data-num') || '';
                var match = !filterPart || name.indexOf(q) !== -1 || num === qNum || (parsed && String(parsed.sura) === num);
                c.classList.toggle('hidden', !match);
            }
        });
        search.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                var parsed = parseSuraAyahInput(this.value);
                if (parsed && currentOnSelect) {
                    currentOnSelect(parsed.sura, parsed.ayah);
                    hide();
                }
            }
        });

        body.appendChild(grid);
        modal.appendChild(header);
        modal.appendChild(body);
        overlay.appendChild(modal);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) hide();
        });
        document.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape' && overlay && overlay.classList.contains('visible')) hide();
        });
        document.body.appendChild(overlay);
        return overlay;
    }

    function hide() {
        if (overlay) overlay.classList.remove('visible');
    }

    /**
     * Open the sura picker.
     * @param {Object} opts
     * @param {number} opts.currentSura - Sura number to mark as current (1-114).
     * @param {number} [opts.currentAyah] - Optional ayah (for hadith/page context).
     * @param {function(number, number|undefined)} opts.onSelect - Called when user selects: (sura, ayah). ayah is undefined when only sura was chosen.
     */
    function open(opts) {
        var onSelect = opts && typeof opts.onSelect === 'function' ? opts.onSelect : function() {};
        var currentSura = opts && opts.currentSura != null ? Math.max(1, Math.min(114, parseInt(opts.currentSura, 10))) : 1;
        currentOnSelect = onSelect;
        createPicker();
        var grid = document.getElementById('sura-picker-grid');
        if (grid) {
            grid.querySelectorAll('.sura-picker-card').forEach(function(card) {
                card.classList.toggle('current', parseInt(card.getAttribute('data-sura'), 10) === currentSura);
            });
        }
        var search = overlay.querySelector('.sura-picker-search');
        if (search) { search.value = ''; search.dispatchEvent(new Event('input')); }
        overlay.classList.add('visible');
        if (search) search.focus();
    }

    global.SuraPicker = { open: open, hide: hide };
})(typeof window !== 'undefined' ? window : this);
