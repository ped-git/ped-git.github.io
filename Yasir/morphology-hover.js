// Morphology Hover Tooltip Script for Surah Noor
// This script loads morphology data and displays root and lemma on word hover

const morphologyData = {};
(function() {
    'use strict';

    const IS_DESKTOP_HOST = !!window.__DESKTOP_HOST__;
    function faNum(n) {
        return (typeof Intl !== 'undefined' && Intl.NumberFormat)
            ? new Intl.NumberFormat('fa-IR').format(Number(n))
            : String(n);
    }
    
    function recomputeMinimapGeometry() {
        if (!minimap) return;
        let wordRects = calculateWordRects();
        const minTop = wordRects.length > 0 ? Math.min(...wordRects.map(w => w.top)) : 0;
        const maxBottom = wordRects.length > 0 ? Math.max(...wordRects.map(w => w.bottom)) : documentHeight;
        const minLeft = wordRects.length > 0 ? Math.min(...wordRects.map(w => w.left)) : 0;
        const maxRight = wordRects.length > 0 ? Math.max(...wordRects.map(w => w.right)) : documentWidth;
        const contentHeight = maxBottom - minTop;
        const contentWidth = (maxRight - minLeft);

        minimap._wordRects = wordRects;
        minimap._minTop = minTop;
        minimap._minLeft = minLeft;
        minimap._contentWidth = contentWidth;
        minimap._contentHeight = contentHeight;

        // In desktop host mode, the minimap width is controlled by the container (CSS/flex),
        // so don't override it with JS. Just read the current size.
        if (IS_DESKTOP_HOST) {
            minimap._availableWidth = minimap.getBoundingClientRect().width || minimap.clientWidth || window.innerWidth;
        } else {
            const windowWidth = isMobileMode ? calculateWindowWidthForMobile() : calculateWindowWidth();
            minimap.style.width = windowWidth + 'px';
            minimap.style.flex = `0 0 ${windowWidth}px`;
            minimap.style.maxWidth = `${windowWidth}px`;
            minimap._availableWidth = windowWidth;
        }

        const minimapContent = document.getElementById('minimap-content');
        const visibleHighlight = document.getElementById('minimap-visible-highlight');
        if (minimapContent && visibleHighlight && wordRects) {
            updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
        }
        updateVisibleHighlight();
    }

    // Morphology data structure: {ayah: {wordIndex: {root, lemma}}}
    let dataLoaded = false;
    
    // Root to words map: {root: [{ayah, wordIndex}, ...]}
    const rootToWordsMap = {};
    
    // Highlighted roots: {root: {colorIndex, color}}
    const highlightedRoots = {};
    let nextColorIndex = 1;
    
    // Selected search items (from embed search modal): { display, items, distance, crossSura, stats? }
    let selectedSearchItems = [];
    
    // Currently searched root and selected word
    let currentSearchedRoot = null;
    let currentSelectedWord = null; // {ayah, wordIndex}
    let currentSearchedSearchItemIndex = null;
    
    // Roots frequency data
    let rootsFreqData = null;
    // Store roots data for current sura
    let currentSuraTopRoots = null;
    let currentSuraDistinctiveRoots = null;
    let currentSuraHighKlRoots = null;
    let currentSuraN2NRoots = null;
    
    // Color palette for highlighting (using distinct colors)
    const highlightColors = [
        '#FFE5E5', // Light red
        '#E5F3FF', // Light blue
        '#E5FFE5', // Light green
        '#FFF5E5', // Light orange
        '#F0E5FF', // Light purple
        '#FFE5F5', // Light pink
        '#E5FFFF', // Light cyan
        '#FFFFE5', // Light yellow
        '#FFE5CC', // Light peach
        '#E5E5FF', // Light indigo
        '#FFCCE5', // Light rose
        '#E5FFCC', // Light lime
        '#CCE5FF', // Light sky blue
        '#FFCCCC', // Light coral
        '#E5E5CC', // Light beige
        '#FFE5FF', // Light magenta
        '#CCFFE5', // Light mint
        '#E5CCFF', // Light lavender
        '#FFCCFF', // Light fuchsia
        '#CCFFCC', // Light pale green
        '#FFE5D4', // Light apricot
        '#D4E5FF', // Light periwinkle
        '#E5FFD4', // Light spring green
        '#FFD4E5', // Light salmon
        '#D4FFE5', // Light seafoam
        '#E5D4FF', // Light violet
        '#FFD4CC', // Light peach pink
        '#CCE5E5', // Light turquoise
        '#E5CCE5', // Light plum
        '#CCFFE5', // Light aquamarine
    ];

    // Buckwalter transliteration to Arabic conversion map
    // Based on official Buckwalter transliteration table from:
    // https://corpus.quran.com/java/buckwalter.jsp
    // Each English character maps to a unique Arabic character
    const buckwalterToArabic = {
        // Hamza and Alif variants
        '\'': 'ء',  // U+0621 Hamza
        '>': 'أ',   // U+0623 Alif + HamzaAbove
        '&': 'ؤ',   // U+0624 Waw + HamzaAbove
        '<': 'إ',   // U+0625 Alif + HamzaBelow
        '}': 'ئ',   // U+0626 Ya + HamzaAbove
        'A': 'ا',   // U+0627 Alif
        '{': 'ا',   // U+0671 Alif + HamzatWasl (extended)
        
        // Consonants
        'b': 'ب',   // U+0628 Ba
        'p': 'ة',   // U+0629 TaMarbuta
        't': 'ت',   // U+062A Ta
        'v': 'ث',   // U+062B Tha
        'j': 'ج',   // U+062C Jeem
        'H': 'ح',   // U+062D HHa
        'x': 'خ',   // U+062E Kha
        'd': 'د',   // U+062F Dal
        '*': 'ذ',   // U+0630 Thal
        'r': 'ر',   // U+0631 Ra
        'z': 'ز',   // U+0632 Zain
        's': 'س',   // U+0633 Seen
        '$': 'ش',   // U+0634 Sheen
        'S': 'ص',   // U+0635 Sad
        'D': 'ض',   // U+0636 DDad
        'T': 'ط',   // U+0637 TTa
        'Z': 'ظ',   // U+0638 DTha
        'E': 'ع',   // U+0639 Ain
        'g': 'غ',   // U+063A Ghain
        'f': 'ف',   // U+0641 Fa
        'q': 'ق',   // U+0642 Qaf
        'k': 'ك',   // U+0643 Kaf
        'l': 'ل',   // U+0644 Lam
        'm': 'م',   // U+0645 Meem
        'n': 'ن',   // U+0646 Noon
        'h': 'ه',   // U+0647 Ha
        'w': 'و',   // U+0648 Waw
        'Y': 'ى',   // U+0649 AlifMaksura
        'y': 'ي',   // U+064A Ya
        
        // Diacritics
        'F': 'ً',   // U+064B Fathatan
        'N': 'ٌ',   // U+064C Dammatan
        'K': 'ٍ',   // U+064D Kasratan
        'a': 'َ',   // U+064E Fatha
        'u': 'ُ',   // U+064F Damma
        'i': 'ِ',   // U+0650 Kasra
        '~': 'ّ',   // U+0651 Shadda
        'o': 'ْ',   // U+0652 Sukun
        '^': 'ٰ',   // U+0653 Maddah (extended)
        '#': 'ٔ',   // U+0654 HamzaAbove (extended)
        '`': 'ٰ',   // U+0670 AlifKhanjareeya (extended)
        
        // Extended characters (Quranic symbols - ignore in conversion)
        '|': '',    // Not in standard Buckwalter (only in FEATURES column)
        ']': '',    // U+06ED SmallLowMeem (extended)
        '[': '',    // U+06E2 SmallHighMeemIsolatedForm (extended)
        '@': '',    // U+06DF SmallHighRoundedZero (extended)
        ':': '',    // U+06DC SmallHighSeen (extended)
        ';': '',    // U+06E3 SmallLowSeen (extended)
        ',': '',    // U+06E5 SmallWaw (extended)
        '.': '',    // U+06E6 SmallYa (extended)
        '!': '',    // U+06E8 SmallHighNoon (extended)
        '-': '',    // U+06EA EmptyCentreLowStop (extended)
        '+': '',    // U+06EB EmptyCentreHighStop (extended)
        '%': '',    // U+06EC RoundedHighStopWithFilledCentre (extended)
        '"': '',    // U+06E0 SmallHighUprightRectangularZero (extended)
        '_': ''     // U+0640 Tatweel (extended)
    };

    // Create reverse mapping from Arabic to Buckwalter
    const arabicToBuckwalter = {};
    for (const [buckwalter, arabic] of Object.entries(buckwalterToArabic)) {
        if (arabic && arabic !== '') {
            // Handle multiple Buckwalter chars mapping to same Arabic (like 'A' and '{' both map to 'ا')
            if (!arabicToBuckwalter[arabic]) {
                arabicToBuckwalter[arabic] = buckwalter;
            }
        }
    }
    
    // Convert Arabic to Buckwalter transliteration
    function convertArabicToBuckwalter(text) {
        if (!text) return '';
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const buckwalterChar = arabicToBuckwalter[char];
            if (buckwalterChar) {
                result += buckwalterChar;
            } else {
                // If no mapping found, keep original character
                result += char;
            }
        }
        return result;
    }
    
    // Convert Buckwalter transliteration to Arabic
    function convertBuckwalterToArabic(text) {
        if (!text) return '';
        
        let result = '';
        let i = 0;
        
        while (i < text.length) {
            const char = text[i];
            // const nextChar = i + 1 < text.length ? text[i + 1] : null;
            
            // if (char === '^') {
            //     console.log('Character: ', char, 'Result: ', buckwalterToArabic[char], buckwalterToArabic[char].length);
            // }
            // Convert character
            let arabicChar = '';
            if (buckwalterToArabic[char] !== undefined && buckwalterToArabic[char] !== '') {
                arabicChar = buckwalterToArabic[char];
            }

            // Add the character if we found a mapping
            if (arabicChar) {
                result += arabicChar;
            } else {
                result += char;
            }
            i++;
        }
        return result;
    }

    // Parse morphology line and extract root and lemma
    function parseMorphologyLine(line, sureNumber, wordIndexFixOffset) {
        const parts = line.split('\t');
        if (parts.length < 4) return { wordIndexFixOffset: wordIndexFixOffset };

        const location = parts[0].trim();
        const features = parts[3].trim();
        const text = parts[1].trim();

        // Extract location: (24:ayah:word:segment)
        const match = location.match(/^\(\d+:(\d+):(\d+):(\d+)\)$/);
        if (!match) {
            console.log('Invalid location: ', location);
            return { wordIndexFixOffset: wordIndexFixOffset };
        }

        // if (match[1] == 22) {
        //     console.log('Line', line, match);
        // }

        // console.log('Resetting word index fix offset to 0', line, match);
        if (match[2] == '1' && match[3] == '1') {
            wordIndexFixOffset = 0;
        }

        const ayah = parseInt(match[1]);
        const wordIndex = parseInt(match[2]) + wordIndexFixOffset;

        // Extract ROOT and LEM from features
        const rootMatch = features.match(/ROOT:([^|]+)/);
        const lemMatch = features.match(/LEM:([^|]+)/);

        // Convert transliterated root and lemma to Arabic
        const root = rootMatch ? convertBuckwalterToArabic(rootMatch[1]) : null;
        const lemma = lemMatch ? convertBuckwalterToArabic(lemMatch[1]) : null;

        // Only store if we have root or lemma
        if (root || lemma) {
            if (!morphologyData[ayah]) {
                morphologyData[ayah] = {};
            }
            // Store the first occurrence for each word (some words have multiple segments)
            if (!morphologyData[ayah][wordIndex]) {
                morphologyData[ayah][wordIndex] = { root: root, lemma: lemma };
            } else {
                // Merge if we have better data
                if (root && !morphologyData[ayah][wordIndex].root) {
                    morphologyData[ayah][wordIndex].root = root;
                }
                if (lemma && !morphologyData[ayah][wordIndex].lemma) {
                    morphologyData[ayah][wordIndex].lemma = lemma;
                }
            }
            
            // Build root-to-words map (root is already in Arabic from line 230)
            if (root) {
                if (!rootToWordsMap[root]) {
                    rootToWordsMap[root] = [];
                }
                // Add this word to the root's list if not already present
                const wordKey = `${ayah}-${wordIndex}`;
                if (!rootToWordsMap[root].some(w => w.ayah === ayah && w.wordIndex === wordIndex)) {
                    rootToWordsMap[root].push({ ayah, wordIndex });
                }
            }
        }

        if (text.startsWith('ya`')) {
            wordIndexFixOffset++;
        }

        return { ayah, wordIndex, root, lemma, wordIndexFixOffset };
    }

    // Load morphology data from file
    async function loadMorphologyData(sureNumber) {
        try {
            const response = await fetch('data/quranic-corpus-morphology-0.4.txt');
            if (!response.ok) {
                console.error('Failed to load morphology data');
                return;
            }

            const text = await response.text();
            const lines = text.split('\n');
            let wordIndexFixOffset = 0;

            // Skip header line
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line && line.startsWith('(' + sureNumber + ':')) {
                    // console.log(line);
                    let lineInfo = parseMorphologyLine(line, sureNumber, wordIndexFixOffset);
                    wordIndexFixOffset = lineInfo.wordIndexFixOffset;
                }
            }

            dataLoaded = true;
            console.log('Morphology data loaded for Surah ' + sureNumber);
        } catch (error) {
            console.error('Error loading morphology data:', error);
        }
    }

    // Extract ayah number from a paragraph element
    function getAyahNumber(element) {
        // Look for superscript with ayah number
        const sup = element.querySelector('sup');
        if (sup) {
            // Extract Persian/Arabic numerals and convert
            const text = sup.textContent.trim();
            // Convert Persian numerals to Arabic/English
            const persianToEnglish = {
                '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
                '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
            };
            let numStr = '';
            for (let char of text) {
                if (persianToEnglish[char]) {
                    numStr += persianToEnglish[char];
                } else if (char >= '0' && char <= '9') {
                    numStr += char;
                }
            }
            return parseInt(numStr) || null;
        }
        return null;
    }

    // // Split text into words (Arabic text)
    // function splitIntoWords(text) {
    //     // Split by spaces and filter empty strings
    //     // Keep Arabic characters together, handle punctuation
    //     const words = text.split(/\s+/).filter(w => {
    //         const trimmed = w.trim();
    //         // Keep if it has Arabic characters or is meaningful punctuation
    //         return trimmed.length > 0 && (trimmed.match(/[أ-ي]/) || trimmed.length > 1);
    //     });
    //     return words;
    // }

    function splitIntoWordsAndSpaces(text) {
        let words = [];
        let lastClass = null;
        for (let i = 0; i < text.length; i++) {
            let c = /\s/.test(text[i]);
            // console.log('Character: ', text[i], 'Class: ', c);
            if (c == lastClass) {
                words[words.length - 1] += text[i];
            } else {
                words.push(text[i]);
                lastClass = c;
            }
        }
        for (let i = 0; i < words.length; i++) {
            if (words[i].trim() === '') {
                words[i] = ' ';
            }
        }
        return words;
    }

    // Process text segment for a specific ayah
    function processTextSegment(text, state) {

        const words = splitIntoWordsAndSpaces(text);
        // console.log('Processing text segment for ayah ' + state.currentAyah + ' starting with word index ' + state.wordIndex, "'" + text + "'", words);
        if (words.length === 0) return { fragment: null };

        const fragment = document.createDocumentFragment();

        words.forEach((word, idx) => {
            if (word === ' ') {
                const space = document.createTextNode(' ');
                fragment.appendChild(space);
                if (state.active) {
                    state.active = false;
                    state.wordIndex++;
                }
                return;
            }


            // Skip if word is just punctuation or very short (but keep Arabic words)
            const hasArabic = /[أ-ي]/.test(word);
            // Count Arabic letters in the word
            let arabicLetterCount = 0;
            for (let j = 0; j < word.length; j++) {
                if (word[j].match(/[أ-ي]/)) arabicLetterCount++;
            }
            if (!hasArabic && word.length < 2 || arabicLetterCount == 0) {
                fragment.appendChild(document.createTextNode(word + (idx < words.length - 1 ? ' ' : '')));
                // console.log('Skipping word: ', "'" + word + "'", word.length);
                return;
            }

            const span = document.createElement('span');
            span.className = 'morph-word';
            
            // Only add ayah and word index attributes during parsing
            // Morphology data will be added later in a separate function
            span.setAttribute('data-ayah', state.currentAyah);
            span.setAttribute('data-word-index', state.wordIndex);
            
            span.textContent = word;
            
            // Add space after word (except last)
            // if (idx < words.length - 1) {
            //     const space = document.createTextNode(' ');
            //     fragment.appendChild(span);
            //     fragment.appendChild(space);
            // } else {
            fragment.appendChild(span);
            // }
            state.active = true;

            // Only increment word index for words that might have morphology data
            // if (hasArabic || word.length > 1) {
            //     wordIndex++;
            // }
        });

        return { fragment };
    }

    // Recursive function to process all nodes and find words
    // This function walks through the DOM tree in document order and processes text nodes
    function processNodeRecursive(node, state) {
        if (!node) return;
        // console.log('Processing node: ', node, node.nodeType, state.currentAyah, morphologyData[state.currentAyah]);

        // Handle element nodes
        if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if this is a sup element (ayah marker)
            if (node.tagName === 'SUP') {
                const ayahNum = getAyahNumberFromSup(node);
                if (ayahNum) {
                    state.currentAyah = ayahNum + 1;
                    state.wordIndex = 1; // Reset word index for new ayah
                    state.active = false;
                }
                return; // Don't process sup elements or their children
            }

            if (node.tagName === 'P') {
                if (state.active) {
                    state.active = false;
                    state.wordIndex++;
                }
            }
            
            // Skip elements that shouldn't be processed (already wrapped words, boxed spans)
            if (node.classList && 
                (node.classList.contains('morph-word') || 
                 false || //node.classList.contains('boxed'))) {
                 false || //node.classList.contains('sup')) {
                 false || //node.classList.contains('sub')) {
                 false || //node.classList.contains('small-bullet-far')) {
                 false || //node.classList.contains('small-bullet-near')) {
                 false || //node.classList.contains('small-bullet-near-2')) {
                 false || //node.classList.contains('small-bullet-far-2')) {
                 false || //node.classList.contains('big-bullet-far')) {
                 false || //node.classList.contains('big-bullet-near')) {
                 false || //node.classList.contains('big-bullet-near-2')) {
                 false || //node.classList.contains('big-bullet-far-2')) {
                 false)) {
                return; // Skip this element and its children
            }
            
            // Process all child nodes in order
            // Use Array.from to create a snapshot since we might modify the DOM
            const children = Array.from(node.childNodes);
            for (let child of children) {
                processNodeRecursive(child, state);
            }

            if (node.tagName === 'P') {
                if (state.active) {
                    state.active = false;
                    state.wordIndex++;
                }
            }
            return;
        }
        
        // Handle text nodes
        if (node.nodeType === Node.TEXT_NODE) {
            // // Skip if already processed (parent is a morph-word span)
            // if (node.parentElement && node.parentElement.classList.contains('morph-word')) {
            //     return;
            // }
            
            // // Skip if parent is a boxed span or sup (these are special formatting)
            // if (node.parentElement && 
            //     (node.parentElement.classList.contains('boxed') ||
            //      node.parentElement.tagName === 'SUP')) {
            //     return;
            // }
            
            const text = node.textContent;
            if (!text) return;
            
            // Only process if we have a current ayah and morphology data for it
            // if (state.currentAyah && morphologyData[state.currentAyah]) {
                // const words = splitIntoWords(text);
                // const meaningfulWords = words.filter(w => {
                //     const hasArabic = /[أ-ي]/.test(w);
                //     return hasArabic || w.length > 1;
                // });
                
                // if (meaningfulWords.length > 0) {
                    // Process this text node and wrap words
                    const result = processTextSegment(text, state);
                    if (result.fragment) {
                        // Replace the text node with the fragment containing wrapped words
                        node.parentNode.replaceChild(result.fragment, node);
                        // Update word index for next text node
                        // state.wordIndex = result.nextWordIndex;
                    }
                // }
            // }
            return;
        }
    }

    // Wrap words in spans with ayah and word index attributes
    function wrapWordsInSpans() {
        // State object to track current ayah and word index across the entire document
        // This ensures word counting continues correctly even when ayahs span multiple containers
        const state = {
            currentAyah: 1,
            active: false, // when parts of a word of current word is printed, this is true. Used for words which are splitted between tags.
            wordIndex: 1
        };
        
        // Find initial ayah number from first paragraph if available
        // const firstPara = document.querySelector('p.ordinary-far, p.big-bullet-far, p.small-bullet-far, p.ordinary-near, p.big-bullet-near, p.small-bullet-near, p.small-bullet-near-2, p.small-bullet-far-2');
        // if (firstPara) {
        //     state.currentAyah = getAyahNumber(firstPara);
        // }
        
        // Process the entire body recursively in document order
        // On desktop, content is injected into #content; ensure we have a root (sure or #content)
        var root = document.querySelector('sure');
        if (!root && IS_DESKTOP_HOST) root = document.getElementById('content');
        processNodeRecursive(root, state);
        if (typeof console !== 'undefined' && console.log) {
            var n = document.querySelectorAll ? document.querySelectorAll('.morph-word').length : 0;
            console.log('[morph-hover] wrapWordsInSpans done, root=' + (root ? root.tagName || root.id || 'el' : 'null') + ', morph-word count: ' + n);
        }
    }

    
    // Extract ayah number from sup element
    function getAyahNumberFromSup(supElement) {
        const text = supElement.textContent.trim();
        const persianToEnglish = {
            '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
            '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
        };
        let numStr = '';
        for (let char of text) {
            if (persianToEnglish[char]) {
                numStr += persianToEnglish[char];
            } else if (char >= '0' && char <= '9') {
                numStr += char;
            }
        }
        return parseInt(numStr) || null;
    }

    // Highlight all spans with the same ayah and word index
    function highlightMatchingWords(ayah, wordIndex) {
        // Remove previous highlights
        const previousHighlights = document.querySelectorAll('.morph-word-highlighted');
        previousHighlights.forEach(span => {
            span.classList.remove('morph-word-highlighted');
        });

        // Find and highlight all matching spans
        const allWords = document.querySelectorAll('.morph-word');
        allWords.forEach(span => {
            const spanAyah = parseInt(span.getAttribute('data-ayah'));
            const spanWordIndex = parseInt(span.getAttribute('data-word-index'));
            
            if (spanAyah === ayah && spanWordIndex === wordIndex) {
                span.classList.add('morph-word-highlighted');
            }
        });
    }

    // Remove highlights from all words
    function removeHighlights() {
        const highlighted = document.querySelectorAll('.morph-word-highlighted');
        highlighted.forEach(span => {
            span.classList.remove('morph-word-highlighted');
        });
    }

    var morphTooltipHideTimer = null;
    function cancelMorphTooltipHide() {
        if (morphTooltipHideTimer) {
            clearTimeout(morphTooltipHideTimer);
            morphTooltipHideTimer = null;
        }
    }
    function scheduleMorphTooltipHide(delayMs) {
        cancelMorphTooltipHide();
        morphTooltipHideTimer = setTimeout(function() {
            morphTooltipHideTimer = null;
            var tooltipEl = document.getElementById('morph-tooltip');
            if (tooltipEl) {
                removeHighlights();
                hideTooltip();
            }
        }, delayMs || 250);
    }

    // Create and show tooltip with morphology data
    function showTooltip(element, ayah, wordIndex) {
        cancelMorphTooltipHide();
        // Remove existing tooltip
        const existing = document.getElementById('morph-tooltip');
        if (existing) {
            existing.remove();
        }

        // Get morphology data
        const morphData = morphologyData[ayah] && morphologyData[ayah][wordIndex];
        if (!morphData || (!morphData.root && !morphData.lemma)) {
            return; // No data to show
        }

        // console.log("showing tooltip for ayah " + ayah + " word index " + wordIndex, morphData);

        const tooltip = document.createElement('div');
        tooltip.id = 'morph-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            background: #2c3e50;
            color: white;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            z-index: 100000;
            pointer-events: auto;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            font-family: Arial, sans-serif;
            direction: rtl;
            text-align: right;
            line-height: 1.4;
            max-width: 200px;
        `;

        var searchBase = (window.location.pathname || '').indexOf('/Yasir/') !== -1 ? '../search.html' : 'search.html';
        function searchUrl(param, value) {
            return searchBase + '?' + param + '=' + encodeURIComponent(value);
        }

        var content = '';
        var btnStyle = 'color: #4ecdc4; text-decoration: none; font-size: 10px; cursor: pointer; flex-shrink: 0; width: 12px; height: 12px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #4ecdc4; border-radius: 2px; line-height: normal; box-sizing: border-box; padding: 0px 0px 2px 0px;';
        if (morphData.root) {
            var rootEsc = (morphData.root + '').replace(/"/g, '&quot;');
            content += '<div style="margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between; gap: 6px; direction: rtl; text-align: right;">';
            content += '<span style="display: inline-flex; align-items: center; gap: 3px;">';
            content += '<a href="' + searchUrl('root', morphData.root) + '" target="_top" style="' + btnStyle + '" title="جستجو در کل قرآن">&lt;</a>';
            content += '<span class="morph-tooltip-add-root" data-root="' + rootEsc + '" style="' + btnStyle + ' user-select: none;" title="افزودن به ریشه‌های انتخاب‌شده">+</span>';
            content += '</span>';
            content += '<span style="flex: 1; text-align: right;"><span style="color: #ecf0f1; font-size: 10px;">ریشه:</span> <span style="font-weight: bold;">' + (morphData.root) + '</span></span>';
            content += '</div>';
        }
        if (morphData.root && morphData.lemma) {
            content += '<div style="border-top: 1px solid rgba(255,255,255,0.2); margin: 3px 0; padding-top: 3px;"></div>';
        }
        if (morphData.lemma) {
            var lemEsc = (morphData.lemma + '').replace(/"/g, '&quot;');
            var rootEscLem = (morphData.root && morphData.root !== morphData.lemma) ? (morphData.root + '').replace(/"/g, '&quot;') : '';
            content += '<div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; direction: rtl; text-align: right;">';
            content += '<span style="display: inline-flex; align-items: center; gap: 3px;">';
            content += '<a href="' + searchUrl('lem', morphData.lemma) + '" target="_top" style="' + btnStyle + '" title="جستجو در کل قرآن">&lt;</a>';
            if (typeof IS_DESKTOP_HOST !== 'undefined' && IS_DESKTOP_HOST && morphData.root) {
                content += '<span class="morph-tooltip-add-lem" data-root="' + rootEscLem + '" data-lem="' + lemEsc + '" style="' + btnStyle + ' user-select: none;" title="افزودن ریشه با انتخاب فقط این مصدر">+</span>';
            }
            content += '</span>';
            content += '<span style="flex: 1; text-align: right;"><span style="color: #ecf0f1; font-size: 10px;">مصدر:</span> <span style="font-weight: bold;">' + (morphData.lemma) + '</span></span>';
            content += '</div>';
        }
        tooltip.innerHTML = content;

        document.body.appendChild(tooltip);

        tooltip.addEventListener('mouseenter', function() {
            cancelMorphTooltipHide();
        });
        tooltip.addEventListener('mouseleave', function() {
            removeHighlights();
            hideTooltip();
        });
        tooltip.addEventListener('click', function(e) {
            if (e.target.classList.contains('morph-tooltip-add-root')) {
                e.preventDefault();
                e.stopPropagation();
                var root = e.target.getAttribute('data-root');
                if (root && !highlightedRoots[root]) {
                    addRootHighlight(root);
                    updateHighlightedRootsPanel();
                }
                return;
            }
            if (e.target.classList.contains('morph-tooltip-add-lem')) {
                e.preventDefault();
                e.stopPropagation();
                var root = e.target.getAttribute('data-root');
                var lem = e.target.getAttribute('data-lem');
                if (!lem || !root) return;
                var suraNum = window.sureNumber != null ? Number(window.sureNumber) : null;
                var regions = buildRegionsForRootWithLemma(root, lem, suraNum);
                var payload;
                if (typeof window.SearchShared !== 'undefined' && window.SearchShared.buildAddSearchItemPayloadForRootWithLemma) {
                    payload = window.SearchShared.buildAddSearchItemPayloadForRootWithLemma(root, lem, regions);
                } else {
                    payload = { display: root, items: [{ type: 'root', value: root }], itemCheckedState: [true], distance: 0, crossSura: false, statsRows: null, searchDetails: 'ریشه: ' + root + ' (' + lem + ' [1/1])', regions: regions, root: root, lemma: lem };
                }
                if (payload && suraNum != null && Number.isFinite(suraNum)) payload.statsScopeSuras = [suraNum];
                if (payload) payload.preventDuplicate = true;
                if (payload) addSearchItemToSelected(payload);
            }
        });

        // Position tooltip near the element (viewport coords: works with scrollable content column on desktop)
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();

        let top = rect.top - tooltipRect.height - 2;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        if (top < 8) {
            top = rect.bottom + 2;
        }
        if (left < 8) {
            left = 8;
        }
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = window.innerWidth - tooltipRect.width - 8;
        }
        top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

        tooltip.style.top = top + 'px';
        tooltip.style.left = left + 'px';
    }

    // Hide tooltip
    function hideTooltip() {
        const tooltip = document.getElementById('morph-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    // Add event listeners to word spans
    function attachHoverListeners() {
        // Use event delegation for better performance
        // On desktop: tooltip shows on click only; on standalone: tooltip shows on hover
        if (!IS_DESKTOP_HOST) {
            document.addEventListener('mouseover', function(e) {
                if (e.target.classList.contains('morph-word')) {
                    if (typeof console !== 'undefined' && console.log && !window._morphHoverFirst) {
                        window._morphHoverFirst = true;
                        console.log('[morph-hover] first word hover');
                    }
                    const ayah = parseInt(e.target.getAttribute('data-ayah'));
                    const wordIndex = parseInt(e.target.getAttribute('data-word-index'));
                    if (ayah && wordIndex) {
                        highlightMatchingWords(ayah, wordIndex);
                        showTooltip(e.target, ayah, wordIndex);
                    }
                }
            });
        }

        document.addEventListener('mouseout', function(e) {
            if (e.target.classList.contains('morph-word')) {
                var tooltipEl = document.getElementById('morph-tooltip');
                if (e.relatedTarget && tooltipEl && tooltipEl.contains(e.relatedTarget)) {
                    cancelMorphTooltipHide();
                    return;
                }
                scheduleMorphTooltipHide(IS_DESKTOP_HOST ? 0 : 280);
            }
        });
        document.addEventListener('mouseover', function(e) {
            if (e.target.closest && e.target.closest('#morph-tooltip')) {
                cancelMorphTooltipHide();
            }
        });
        
        // Click handler: on desktop show tooltip (no root toggle); on standalone toggle root
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('morph-word')) {
                const ayah = parseInt(e.target.getAttribute('data-ayah'));
                const wordIndex = parseInt(e.target.getAttribute('data-word-index'));
                if (!ayah || !wordIndex) return;
                if (IS_DESKTOP_HOST) {
                    highlightMatchingWords(ayah, wordIndex);
                    showTooltip(e.target, ayah, wordIndex);
                    return;
                }
                if (dataLoaded) {
                    const wordData = morphologyData[ayah] && morphologyData[ayah][wordIndex];
                    if (wordData && wordData.root) {
                        toggleRootHighlight(wordData.root);
                    }
                }
            }
        });
    }
    
    // Toggle root highlighting
    function toggleRootHighlight(root) {
        if (highlightedRoots[root]) {
            // Root is already highlighted, remove it
            removeRootHighlight(root);
        } else {
            // Root is not highlighted, add it
            addRootHighlight(root);
        }
        updateHighlightedRootsPanel();
    }
    
    // Add root highlight
    function addRootHighlight(root) {
        // Find next available color index
        const usedIndices = Object.values(highlightedRoots).map(r => r.colorIndex);
        let colorIndex = 1;
        while (usedIndices.includes(colorIndex) && colorIndex <= highlightColors.length) {
            colorIndex++;
        }
        
        if (colorIndex > highlightColors.length) {
            // Reuse colors if we run out
            colorIndex = ((nextColorIndex - 1) % highlightColors.length) + 1;
        }
        
        const color = highlightColors[colorIndex - 1];
        highlightedRoots[root] = { colorIndex, color };
        nextColorIndex = colorIndex + 1;
        
        // Apply highlight to all words with this root
        applyRootHighlight(root, color);
    }
    
    // Remove root highlight
    function removeRootHighlight(root) {
        if (!highlightedRoots[root]) return;
        
        // Remove highlight from all words with this root
        removeRootHighlightFromWords(root);
        
        // Remove selection if this root was being searched
        if (currentSearchedRoot === root && currentSelectedWord) {
            const { ayah, wordIndex } = currentSelectedWord;
            const wordElements = document.querySelectorAll(
                `.morph-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
            );
            wordElements.forEach(el => {
                el.classList.remove('root-selected-word');
                el.style.outline = '';
            });
            currentSearchedRoot = null;
            currentSelectedWord = null;
        }
        
        // Remove from highlighted roots
        delete highlightedRoots[root];
    }
    
    // Convert RGB to HSL
    function rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        
        return [h * 360, s * 100, l * 100];
    }
    
    // Convert HSL to RGB
    function hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
    
    // Increase contrast of a color for minimap visibility
    // Preserves hue (color identity) while darkening and increasing saturation
    function increaseContrast(color, backgroundColor = '#cccccc') {
        // Convert hex to RGB
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Convert to HSL to preserve color identity
        const [h, s, l] = rgbToHsl(r, g, b);
        
        // Adjust: reduce lightness significantly, increase saturation
        // Target lightness: 30-40% (dark enough to contrast with gray #ccc)
        const newLightness = Math.max(25, Math.min(45, l * 0.4));
        
        // Increase saturation to make colors more vibrant and distinguishable
        // Minimum saturation: 60%, maximum: 100%
        const newSaturation = Math.min(100, Math.max(60, s * 1.5 + 40));
        
        // Keep hue unchanged to preserve color identity (pink stays pink, green stays green)
        const [newR, newG, newB] = hslToRgb(h, newSaturation, newLightness);
        
        // Convert back to hex
        return '#' + [newR, newG, newB].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    
    // Apply highlight color to all words with a given root
    function applyRootHighlight(root, color) {
        const words = rootToWordsMap[root] || [];
        // Create high-contrast version for minimap (against gray #ccc background)
        const contrastColor = increaseContrast(color, '#cccccc');
        
        words.forEach(({ ayah, wordIndex }) => {
            // Highlight main text words
            const wordSpans = document.querySelectorAll(
                `.morph-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
            );
            wordSpans.forEach(span => {
                span.style.backgroundColor = color;
                span.classList.add('root-highlighted');
            });
            
            // Highlight minimap word boxes with darker color
            const minimapWords = document.querySelectorAll(
                `.minimap-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
            );
            minimapWords.forEach(minimapWord => {
                minimapWord.style.backgroundColor = contrastColor;
                minimapWord.classList.add('root-highlighted');
            });
        });
    }
    
    // Remove highlight from all words with a given root
    function removeRootHighlightFromWords(root) {
        const words = rootToWordsMap[root] || [];
        words.forEach(({ ayah, wordIndex }) => {
            // Remove highlight from main text words
            const wordSpans = document.querySelectorAll(
                `.morph-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
            );
            wordSpans.forEach(span => {
                span.style.backgroundColor = '';
                span.classList.remove('root-highlighted');
            });
            
            // Remove highlight from minimap word boxes
            const minimapWords = document.querySelectorAll(
                `.minimap-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
            );
            minimapWords.forEach(minimapWord => {
                minimapWord.style.backgroundColor = '#ccc'; // Reset to default minimap color
                minimapWord.classList.remove('root-highlighted');
            });
        });
    }
    
    // Search-item highlight colors (one per item, cycle), rendered as composable overlays.
    const SEARCH_REGION_HIGHLIGHT_COLORS = [
        'rgba(78, 205, 196, 0.5)',
        'rgba(255, 183, 77, 0.55)',
        'rgba(129, 199, 132, 0.5)',
        'rgba(149, 117, 205, 0.5)',
        'rgba(77, 208, 225, 0.5)',
        'rgba(239, 154, 154, 0.5)',
        'rgba(178, 223, 219, 0.55)',
        'rgba(255, 224, 178, 0.55)'
    ];
    
    function clearSearchRegionHighlights() {
        document.querySelectorAll('.morph-word.search-region-highlight').forEach(function(w) {
            w.style.boxShadow = '';
            w.classList.remove('search-region-highlight', 'search-region-first', 'search-region-middle', 'search-region-last');
            w.removeAttribute('data-search-item-index');
        });
        document.querySelectorAll('.minimap-word.search-region-highlight').forEach(function(w) {
            w.style.boxShadow = '';
            w.classList.remove('search-region-highlight');
            w.removeAttribute('data-search-item-index');
        });
    }

    const SEARCH_STRIPE_PX_TEXT = 6;
    const SEARCH_STRIPE_PX_MINIMAP = 3;

    function buildSearchOverlayBoxShadow(colors, stripePx) {
        if (!Array.isArray(colors) || colors.length === 0) return '';
        var shadows = [];
        stripePx = Number(stripePx) || SEARCH_STRIPE_PX_TEXT;
        for (var i = 0; i < colors.length; i++) {
            shadows.push('inset 0 -' + String((i + 1) * stripePx) + 'px 0 0 ' + colors[i]);
        }
        shadows.push('inset 0 0 0 1px rgba(0,0,0,0.08)');
        return shadows.join(', ');
    }
    
    function applySearchItemHighlights(suraNum) {
        clearSearchRegionHighlights();
        suraNum = suraNum != null ? Number(suraNum) : (window.sureNumber != null ? Number(window.sureNumber) : null);
        if (!suraNum || !selectedSearchItems.length) return;
        
        var overlaysByWord = new Map();
        var allMorph = Array.from(document.querySelectorAll('.morph-word'));
        selectedSearchItems.forEach(function(entry, searchItemIndex) {
            const regions = entry.regions;
            if (!Array.isArray(regions) || regions.length === 0) return;
            const color = SEARCH_REGION_HIGHLIGHT_COLORS[searchItemIndex % SEARCH_REGION_HIGHLIGHT_COLORS.length];
            
            regions.forEach(function(region) {
                const regionSura = Number(region.sura);
                if (regionSura !== suraNum) return;
                const matches = (region.matches || []).filter(function(m) { return Number(m.sura) === suraNum; });
                if (matches.length === 0) return;
                matches.sort(function(a, b) { return (Number(a.ayah) - Number(b.ayah)) || (Number(a.wordIndex) - Number(b.wordIndex)); });

                var startAyah = Number(region.startAyah);
                var endAyah = Number(region.endAyah);
                if (!Number.isFinite(startAyah)) startAyah = Number(matches[0].ayah);
                if (!Number.isFinite(endAyah)) endAyah = Number(matches[matches.length - 1].ayah);
                if (endAyah < startAyah) {
                    var tmp = startAyah;
                    startAyah = endAyah;
                    endAyah = tmp;
                }

                var startWord = null;
                var endWord = null;
                var startAyahWords = matches
                    .filter(function(m) { return Number(m.ayah) === startAyah; })
                    .map(function(m) { return Number(m.wordIndex); })
                    .filter(function(v) { return Number.isFinite(v); });
                var endAyahWords = matches
                    .filter(function(m) { return Number(m.ayah) === endAyah; })
                    .map(function(m) { return Number(m.wordIndex); })
                    .filter(function(v) { return Number.isFinite(v); });
                if (startAyahWords.length > 0) startWord = Math.min.apply(null, startAyahWords);
                if (endAyahWords.length > 0) endWord = Math.max.apply(null, endAyahWords);

                var regionEls = allMorph.filter(function(w) {
                    var ay = Number(w.getAttribute('data-ayah'));
                    var wi = Number(w.getAttribute('data-word-index'));
                    if (!Number.isFinite(ay) || !Number.isFinite(wi)) return false;
                    if (ay < startAyah || ay > endAyah) return false;
                    if (ay === startAyah && startWord != null && wi < startWord) return false;
                    if (ay === endAyah && endWord != null && wi > endWord) return false;
                    return true;
                });

                if (regionEls.length === 0) {
                    // Fallback: at least highlight exact matched words if boundaries are not usable.
                    regionEls = matches.map(function(m) {
                        return document.querySelector('.morph-word[data-ayah="' + String(m.ayah) + '"][data-word-index="' + String(m.wordIndex) + '"]');
                    }).filter(Boolean);
                }

                var seen = new Set();
                for (var i = 0; i < regionEls.length; i++) {
                    var w = regionEls[i];
                    var ayahAttr = w.getAttribute('data-ayah') || '';
                    var wordIndexAttr = w.getAttribute('data-word-index') || '';
                    var key = ayahAttr + ':' + wordIndexAttr;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    if (!overlaysByWord.has(key)) overlaysByWord.set(key, { el: w, colors: [], indices: [] });
                    var info = overlaysByWord.get(key);
                    if (info.indices.indexOf(searchItemIndex) === -1) {
                        info.indices.push(searchItemIndex);
                        info.colors.push(color);
                    }
                }
            });
        });
        overlaysByWord.forEach(function(info) {
            var w = info.el;
            w.classList.add('search-region-highlight');
            w.style.boxShadow = buildSearchOverlayBoxShadow(info.colors, SEARCH_STRIPE_PX_TEXT);
            w.setAttribute('data-search-item-index', info.indices.join(','));

            var ayahAttr = w.getAttribute('data-ayah');
            var wordIndexAttr = w.getAttribute('data-word-index');
            if (ayahAttr != null && wordIndexAttr != null) {
                var minimapWords = document.querySelectorAll('.minimap-word[data-ayah="' + ayahAttr + '"][data-word-index="' + wordIndexAttr + '"]');
                minimapWords.forEach(function(minimapWord) {
                    minimapWord.classList.add('search-region-highlight');
                    minimapWord.style.boxShadow = buildSearchOverlayBoxShadow(info.colors, SEARCH_STRIPE_PX_MINIMAP);
                    minimapWord.setAttribute('data-search-item-index', info.indices.join(','));
                });
            }
        });
    }
    
    // Load roots frequency data from JSON
    async function loadRootsFreqData() {
        if (rootsFreqData) return rootsFreqData; // Already loaded
        
        try {
            const response = await fetch('data/roots-freq.json');
            if (!response.ok) {
                console.warn('Could not load roots-freq.json');
                return null;
            }
            rootsFreqData = await response.json();
            return rootsFreqData;
        } catch (error) {
            console.warn('Error loading roots-freq.json:', error);
            return null;
        }
    }
    
    // Create panel for showing highlighted roots
    function createHighlightedRootsPanel() {
        // Check if panel already exists
        let panel = document.getElementById('highlighted-roots-panel');
        if (panel) return panel;
        
        // Calculate position - in desktop mode, it's inside wrapper; in mobile mode, it's standalone
        const surahHeader = getSurahHeader();
        let topPosition = 420;
        if (surahHeader) {
            const rect = surahHeader.getBoundingClientRect();
            topPosition = rect.bottom + 10;
        }
        
        // Calculate responsive width and max height for root list
        const windowWidth = calculateWindowWidth();
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - topPosition - 20; // Leave 20px margin at bottom
        // Allow root list to use remaining space, but cap at reasonable max
        const rootListMaxHeight = Math.min(400, availableHeight - 10); // Leave 10px margin
        
        // Get or create wrapper for desktop mode
        const wrapper = createCombinedPanelWrapper();
        
        panel = document.createElement('div');
        panel.id = 'highlighted-roots-panel';
        panel.style.cssText = `
            ${wrapper ? 'position: relative;' : 'position: fixed;'}
            ${wrapper ? '' : `top: ${topPosition}px;`}
            ${wrapper ? '' : 'left: 10px;'}
            ${wrapper ? 'width: 100%;' : `width: ${windowWidth}px;`}
            ${wrapper ? 'flex: 0 0 50%;' : `max-height: ${rootListMaxHeight}px;`}
            ${wrapper ? 'height: 50%;' : ''}
            ${wrapper ? 'max-height: none; top: auto;' : ''}
            min-height: 0;
            background: #f5f5f5;
            border: 1px solid #aaa;
            border-radius: 4px;
            padding: 3px;
            z-index: 9998;
            overflow-y: auto;
            overflow-x: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
            direction: rtl;
            ${IS_DESKTOP_HOST ? '' : 'font-family: Arial, sans-serif;'}
            font-size: 9px;
            box-sizing: border-box;
            display: block;
        `;
        
        // Explicitly remove top and max-height if in wrapper (to override any previous inline styles)
        if (wrapper) {
            panel.style.removeProperty('top');
            panel.style.removeProperty('max-height');
        }
        
        const content = document.createElement('div');
        content.id = 'highlighted-roots-content';
        content.style.cssText = 'display: flex; flex-direction: column; gap: 5px;';
        panel.appendChild(content);
        
        // Create sections for top roots, selective roots, and third section
        // These will be added inside the content div
        
        // Append to wrapper if in desktop mode, otherwise to body
        if (wrapper) {
            wrapper.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }
        return panel;
    }
    
    // Find all words with a given root, sorted in RTL order (by ayah and wordIndex)
    function findAllWordsWithRoot(root) {
        const words = rootToWordsMap[root] || [];
        
        // Sort by ayah first, then by wordIndex (RTL order - as they appear in text)
        const sortedWords = [...words].sort((a, b) => {
            if (a.ayah !== b.ayah) {
                return a.ayah - b.ayah;
            }
            return a.wordIndex - b.wordIndex;
        });
        
        return sortedWords;
    }
    
    // Find visible words with a given root in the viewport
    function findVisibleWordsWithRoot(root) {
        const words = rootToWordsMap[root] || [];
        const visibleWords = [];
        
        // Get viewport dimensions
        let viewportTop, viewportBottom, viewportLeft, viewportRight;
        if (isMobileMode && mobileContentWrapper) {
            const wrapperRect = mobileContentWrapper.getBoundingClientRect();
            viewportTop = wrapperRect.top;
            viewportBottom = wrapperRect.bottom;
            viewportLeft = wrapperRect.left;
            viewportRight = wrapperRect.right;
        } else {
            viewportTop = 0;
            viewportBottom = window.innerHeight;
            viewportLeft = 0;
            viewportRight = window.innerWidth;
        }
        
        words.forEach(({ ayah, wordIndex }) => {
            const wordElements = document.querySelectorAll(
                `.morph-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
            );
            
            wordElements.forEach(element => {
                const rect = element.getBoundingClientRect();
                
                // Check if element is visible in viewport
                if (rect.top >= viewportTop && rect.bottom <= viewportBottom &&
                    rect.left >= viewportLeft && rect.right <= viewportRight &&
                    rect.width > 0 && rect.height > 0) {
                    visibleWords.push({ ayah, wordIndex, element, rect });
                }
            });
        });
        
        // Sort by position in RTL order (ayah, then wordIndex)
        visibleWords.sort((a, b) => {
            if (a.ayah !== b.ayah) {
                return a.ayah - b.ayah;
            }
            return a.wordIndex - b.wordIndex;
        });
        
        return visibleWords;
    }
    
    // Select and highlight a word, scroll it to top
    function selectWord(ayah, wordIndex, root) {
        // Remove previous selection (if any)
        if (currentSelectedWord) {
            const prevAyah = currentSelectedWord.ayah;
            const prevWordIndex = currentSelectedWord.wordIndex;
            const prevElements = document.querySelectorAll(
                `.morph-word[data-ayah="${prevAyah}"][data-word-index="${prevWordIndex}"]`
            );
            prevElements.forEach(el => {
                el.classList.remove('root-selected-word');
                el.style.outline = '';
            });
        }
        
        // Add selection to current word
        currentSearchedRoot = root;
        currentSelectedWord = { ayah, wordIndex };
        const wordElements = document.querySelectorAll(
            `.morph-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
        );
        
        wordElements.forEach(el => {
            el.classList.add('root-selected-word');
            el.style.outline = '1px dotted red';
            // el.style.borderRadius = '2px';
            
            // Scroll to top of viewport (handle mobile mode)
            const rect = el.getBoundingClientRect();
            if (isMobileMode && mobileContentWrapper) {
                // In mobile mode, scroll the wrapper
                const wrapperRect = mobileContentWrapper.getBoundingClientRect();
                const relativeTop = rect.top - wrapperRect.top + mobileContentWrapper.scrollTop;
                mobileContentWrapper.scrollTo({ top: relativeTop, behavior: 'smooth' });
            } else {
                const desktopWrapper = document.getElementById('desktop-content-wrapper');
                if (desktopWrapper) {
                    const wrapperRect = desktopWrapper.getBoundingClientRect();
                    const relativeTop = rect.top - wrapperRect.top + desktopWrapper.scrollTop;
                    desktopWrapper.scrollTo({ top: relativeTop, behavior: 'smooth' });
                } else {
                    // Normal mode, scroll window
                    const scrollY = window.scrollY || window.pageYOffset;
                    const targetY = scrollY + rect.top;
                    window.scrollTo({ top: targetY, behavior: 'smooth' });
                }
            }
        });
        
        // Update panel to show which root is being searched
        updateHighlightedRootsPanel();
    }
    
    // Find and select next word for a root (RTL search - circular, starting from viewport)
    function selectNextWordForRoot(root, direction = 'next') {
        const allWords = findAllWordsWithRoot(root);
        if (allWords.length === 0) return;

        // find first visible word


        function getVisibleMorphWordRange() {
            const spans = document.querySelectorAll('span.morph-word');
        
            let firstAyah = Infinity, firstWord = Infinity;
            let lastAyah = -Infinity, lastWord = -Infinity;
        
            const vh = window.innerHeight;
            const vw = window.innerWidth;
        
            for (const el of spans) {
                const rect = el.getBoundingClientRect();
        
                const isVisible =
                    rect.bottom > 0 &&
                    rect.top < vh &&
                    rect.right > 0 &&
                    rect.left < vw;
        
                if (!isVisible) continue;
        
                const ayah = Number(el.dataset.ayah);
                const word = Number(el.dataset.wordIndex);
        
                if (ayah < firstAyah || (ayah === firstAyah && word < firstWord)) {
                    firstAyah = ayah;
                    firstWord = word;
                }
                if (ayah > lastAyah || (ayah === lastAyah && word > lastWord)) {
                    lastAyah = ayah;
                    lastWord = word;
                }
            }
        
            if (firstAyah === Infinity) return null; // nothing visible
            return { firstAyah, firstWord, lastAyah, lastWord };
        }
        
        
        let nextWord;
        
        if (currentSearchedRoot === root && currentSelectedWord) {

            if (direction === 'next') {
                const nextIndex = allWords.findIndex(
                        w => w.ayah === currentSelectedWord.ayah && w.wordIndex > currentSelectedWord.wordIndex || 
                        w.ayah > currentSelectedWord.ayah
                    );
                nextWord = nextIndex >= 0 ? allWords[nextIndex] : allWords[0];
            } else {
                const nextIndex = allWords.findIndex(
                    w => w.ayah === currentSelectedWord.ayah && w.wordIndex === currentSelectedWord.wordIndex
                );
                nextWord = nextIndex > 0 ? allWords[nextIndex - 1] : allWords[allWords.length - 1];
            }
            
            // if (currentIndex >= 0) {
            //     // Select next word (circular - wrap to beginning if at end)
            //     const nextIndex = (currentIndex + 1) % allWords.length;
            //     nextWord = allWords[nextIndex];
            // } else {
            //     // Current selection not found in all words, start from visible words
            //     const visibleWords = findVisibleWordsWithRoot(root);
            //     if (visibleWords.length > 0) {
            //         nextWord = visibleWords[0];
            //     } else {
            //         nextWord = allWords[0];
            //     }
            // }

            // // Check if current selection is visible
            // const currentWordElements = document.querySelectorAll(
            //     `.morph-word[data-ayah="${currentSelectedWord.ayah}"][data-word-index="${currentSelectedWord.wordIndex}"]`
            // );
            // let isCurrentVisible = false;
            // let viewportTop, viewportBottom, viewportLeft, viewportRight;
            
            // if (isMobileMode && mobileContentWrapper) {
            //     const wrapperRect = mobileContentWrapper.getBoundingClientRect();
            //     viewportTop = wrapperRect.top;
            //     viewportBottom = wrapperRect.bottom;
            //     viewportLeft = wrapperRect.left;
            //     viewportRight = wrapperRect.right;
            // } else {
            //     viewportTop = 0;
            //     viewportBottom = window.innerHeight;
            //     viewportLeft = 0;
            //     viewportRight = window.innerWidth;
            // }
            
            // for (let el of currentWordElements) {
            //     const rect = el.getBoundingClientRect();
            //     if (rect.top >= viewportTop && rect.bottom <= viewportBottom &&
            //         rect.left >= viewportLeft && rect.right <= viewportRight &&
            //         rect.width > 0 && rect.height > 0) {
            //         isCurrentVisible = true;
            //         break;
            //     }
            // }
            
            // if (isCurrentVisible) {
            //     // Current is visible, find next word after it (RTL order)
            //     const currentIndex = allWords.findIndex(
            //         w => w.ayah === currentSelectedWord.ayah && w.wordIndex === currentSelectedWord.wordIndex
            //     );
                
            //     if (currentIndex >= 0) {
            //         // Select next word (circular - wrap to beginning if at end)
            //         const nextIndex = (currentIndex + 1) % allWords.length;
            //         nextWord = allWords[nextIndex];
            //     } else {
            //         // Current selection not found in all words, start from visible words
            //         const visibleWords = findVisibleWordsWithRoot(root);
            //         if (visibleWords.length > 0) {
            //             nextWord = visibleWords[0];
            //         } else {
            //             nextWord = allWords[0];
            //         }
            //     }
            // } else {
            //     // Current is not visible, start from visible words in viewport
            //     const visibleWords = findVisibleWordsWithRoot(root);
            //     if (visibleWords.length > 0) {
            //         nextWord = visibleWords[0];
            //     } else {
            //         // No visible words, continue from current position
            //         const currentIndex = allWords.findIndex(
            //             w => w.ayah === currentSelectedWord.ayah && w.wordIndex === currentSelectedWord.wordIndex
            //         );
            //         if (currentIndex >= 0) {
            //             const nextIndex = (currentIndex + 1) % allWords.length;
            //             nextWord = allWords[nextIndex];
            //         } else {
            //             nextWord = allWords[0];
            //         }
            //     }
            // }
        } else {
            // // Different root or no current selection, start from visible words in viewport
            // const visibleWords = findVisibleWordsWithRoot(root);
            // if (visibleWords.length > 0) {
            //     nextWord = visibleWords[0];
            // } else {
            //     // No visible words, start from beginning of all words
            //     nextWord = allWords[0];
            // }
            let ayah, wordIndex;
            if (currentSelectedWord) {
                ayah = currentSelectedWord.ayah;
                wordIndex = currentSelectedWord.wordIndex;
            } else {
                const { firstAyah, firstWord, lastAyah, lastWord } = getVisibleMorphWordRange();
                ayah = firstAyah;
                wordIndex = firstWord;
            }
            const nextIndex = allWords.findIndex(
                w => w.ayah === ayah && w.wordIndex >= wordIndex || 
                w.ayah > ayah
            );
            nextWord = nextIndex >= 0 ? allWords[nextIndex] : allWords[0];

        }
        
        selectWord(nextWord.ayah, nextWord.wordIndex, root);
        currentSearchedSearchItemIndex = null;
    }

    function getRegionFirstHighlightedWord(region, suraNum) {
        if (!region) return null;
        const targetSura = Number(suraNum);
        if (!Number.isFinite(targetSura) || Number(region.sura) !== targetSura) return null;
        const matches = Array.isArray(region.matches) ? region.matches : [];
        const localMatches = matches
            .filter(function(m) { return Number(m.sura) === targetSura; })
            .map(function(m) { return { ayah: Number(m.ayah), wordIndex: Number(m.wordIndex) }; })
            .filter(function(m) { return Number.isFinite(m.ayah) && Number.isFinite(m.wordIndex); })
            .sort(function(a, b) { return (a.ayah - b.ayah) || (a.wordIndex - b.wordIndex); });
        if (localMatches.length === 0) return null;

        let startAyah = Number(region.startAyah);
        if (!Number.isFinite(startAyah)) startAyah = localMatches[0].ayah;
        const startAyahMatches = localMatches.filter(function(m) { return m.ayah === startAyah; });
        if (startAyahMatches.length > 0) {
            const minWord = Math.min.apply(null, startAyahMatches.map(function(m) { return m.wordIndex; }));
            return { ayah: startAyah, wordIndex: minWord };
        }
        return localMatches[0];
    }

    function findSearchItemRegionAnchors(searchItemIndex, suraNum) {
        const entry = selectedSearchItems[searchItemIndex];
        if (!entry || !Array.isArray(entry.regions)) return [];
        const anchors = [];
        const seen = new Set();
        entry.regions.forEach(function(region) {
            const ref = getRegionFirstHighlightedWord(region, suraNum);
            if (!ref) return;
            const selector = '.morph-word[data-ayah="' + String(ref.ayah) + '"][data-word-index="' + String(ref.wordIndex) + '"]';
            if (!document.querySelector(selector)) return;
            const key = String(ref.ayah) + ':' + String(ref.wordIndex);
            if (seen.has(key)) return;
            seen.add(key);
            anchors.push(ref);
        });
        anchors.sort(function(a, b) { return (a.ayah - b.ayah) || (a.wordIndex - b.wordIndex); });
        return anchors;
    }

    function selectNextRegionForSearchItem(searchItemIndex, direction = 'next') {
        const suraNum = window.sureNumber != null ? Number(window.sureNumber) : null;
        if (!suraNum) return;
        const anchors = findSearchItemRegionAnchors(searchItemIndex, suraNum);
        if (!anchors.length) return;

        let nextAnchor = null;
        if (currentSearchedSearchItemIndex === searchItemIndex && currentSelectedWord) {
            const currentIdx = anchors.findIndex(function(w) {
                return w.ayah === currentSelectedWord.ayah && w.wordIndex === currentSelectedWord.wordIndex;
            });
            if (currentIdx >= 0) {
                if (direction === 'previous') {
                    nextAnchor = anchors[currentIdx > 0 ? currentIdx - 1 : anchors.length - 1];
                } else {
                    nextAnchor = anchors[(currentIdx + 1) % anchors.length];
                }
            }
        }
        if (!nextAnchor) {
            const ayah = currentSelectedWord ? Number(currentSelectedWord.ayah) : null;
            const wordIndex = currentSelectedWord ? Number(currentSelectedWord.wordIndex) : null;
            const startIdx = (Number.isFinite(ayah) && Number.isFinite(wordIndex))
                ? anchors.findIndex(function(w) { return (w.ayah > ayah) || (w.ayah === ayah && w.wordIndex >= wordIndex); })
                : -1;
            if (direction === 'previous') {
                nextAnchor = (startIdx > 0) ? anchors[startIdx - 1] : anchors[anchors.length - 1];
            } else {
                nextAnchor = (startIdx >= 0) ? anchors[startIdx] : anchors[0];
            }
        }
        if (!nextAnchor) return;
        currentSearchedSearchItemIndex = searchItemIndex;
        selectWord(nextAnchor.ayah, nextAnchor.wordIndex, null);
    }
    
    // Unhighlight currently selected word (but keep root in list)
    function unhighlightCurrentSelection() {
        if (currentSelectedWord) {
            const { ayah, wordIndex } = currentSelectedWord;
            const wordElements = document.querySelectorAll(
                `.morph-word[data-ayah="${ayah}"][data-word-index="${wordIndex}"]`
            );
            wordElements.forEach(el => {
                el.classList.remove('root-selected-word');
                el.style.border = '';
            });
        }
        currentSearchedRoot = null;
        currentSelectedWord = null;
        currentSearchedSearchItemIndex = null;
        updateHighlightedRootsPanel();
    }
    
    function getSearchEmbedUrl(extraParams) {
        var base = (window.location.pathname || '').indexOf('/Yasir/') !== -1 ? '../search.html' : 'search.html';
        var sure = window.sureNumber != null ? window.sureNumber : 1;
        var url = base + '?embed=1&sure=' + sure;
        if (extraParams && typeof extraParams === 'object') {
            if (extraParams.lem) url += '&lem=' + encodeURIComponent(extraParams.lem);
            if (extraParams.root) url += '&root=' + encodeURIComponent(extraParams.root);
        }
        return url;
    }
    function openSearchModal(initialParams) {
        if (document.getElementById('search-embed-modal-overlay')) return;
        var overlay = document.createElement('div');
        overlay.id = 'search-embed-modal-overlay';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999999; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box;';
        var box = document.createElement('div');
        box.style.cssText = 'background: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 95%; max-height: 90%; width: 900px; height: 80vh; display: flex; flex-direction: column; overflow: hidden; position: relative;';
        var closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'position: absolute; top: 8px; left: 8px; z-index: 10; width: 32px; height: 32px; border: none; background: #eee; border-radius: 4px; font-size: 20px; cursor: pointer; line-height: 1;';
        closeBtn.addEventListener('click', closeSearchModal);
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeSearchModal();
        });
        var iframe = document.createElement('iframe');
        iframe.src = getSearchEmbedUrl(initialParams);
        iframe.style.cssText = 'flex: 1; width: 100%; border: none; border-radius: 0 0 8px 8px;';
        box.appendChild(closeBtn);
        box.appendChild(iframe);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }
    function closeSearchModal() {
        var el = document.getElementById('search-embed-modal-overlay');
        if (el) el.remove();
    }
    function afterSearchItemAdded() {
        currentSearchedRoot = null;
        currentSearchedSearchItemIndex = null;
        currentSelectedWord = null;
        updateHighlightedRootsPanel();
        var suraForHighlight = window.sureNumber != null ? Number(window.sureNumber) : null;
        setTimeout(function() { applySearchItemHighlights(suraForHighlight); }, 100);
    }

    /**
     * Add a search item to the selected roots list. Single entry point for both search window and lemma +.
     * @param {Object} data - payload (same shape as search postMessage: display, items, itemCheckedState, distance, crossSura, statsRows, searchDetails, regions; optional root, lemma)
     */
    function addSearchItemToSelected(data) {
        if (!data || data.display == null) return;
        if (data.preventDuplicate && data.root != null && data.lemma != null && selectedSearchItems.some(function(entry) { return entry.root === data.root && entry.lemma === data.lemma; })) return;
        var items = Array.isArray(data.items) ? data.items : [];
        var entry = {
            display: data.display,
            items: items,
            itemCheckedState: Array.isArray(data.itemCheckedState) ? data.itemCheckedState : [],
            distance: data.distance,
            crossSura: data.crossSura,
            stats: Array.isArray(data.stats) ? data.stats : (Array.isArray(data.statsRows) ? data.statsRows : null),
            searchDetails: typeof data.searchDetails === 'string' ? data.searchDetails : null,
            regions: Array.isArray(data.regions) ? data.regions : null
        };
        if (Array.isArray(data.statsScopeSuras)) entry.statsScopeSuras = data.statsScopeSuras.slice();
        else if (data.statsScopeSuras === null) entry.statsScopeSuras = null;
        if (data.root != null) entry.root = data.root;
        if (data.lemma != null) entry.lemma = data.lemma;
        else if (items.length === 1 && items[0] && items[0].type === 'root') entry.root = items[0].value;
        selectedSearchItems.push(entry);
        afterSearchItemAdded();
    }

    /** Build regions for root+lemma in current sura (morphologyData is local). Then use shared payload builder. */
    function buildRegionsForRootWithLemma(root, lemma, suraNum) {
        if (!morphologyData || !suraNum) return null;
        var matches = [];
        for (var ayah in morphologyData) {
            if (!Object.prototype.hasOwnProperty.call(morphologyData, ayah)) continue;
            for (var wi in morphologyData[ayah]) {
                if (!Object.prototype.hasOwnProperty.call(morphologyData[ayah], wi)) continue;
                var d = morphologyData[ayah][wi];
                if (d && d.root === root && d.lemma === lemma) matches.push({ sura: suraNum, ayah: Number(ayah), wordIndex: Number(wi) });
            }
        }
        matches.sort(function(a, b) { return (a.ayah - b.ayah) || (a.wordIndex - b.wordIndex); });
        return matches.length > 0 ? matches.map(function(m) { return { sura: suraNum, startAyah: m.ayah, endAyah: m.ayah, matches: [m] }; }) : null;
    }
    
    // Update the highlighted roots panel
    function updateHighlightedRootsPanel() {
        const content = document.getElementById('highlighted-roots-content');
        if (!content) return;
        
        // Clear existing content
        content.innerHTML = '';
        
        // Section 1: Selected roots
        const selectedSection = document.createElement('div');
        selectedSection.style.cssText = 'margin-bottom: 8px;';
        
        const selectedTitle = document.createElement('div');
        selectedTitle.style.cssText = `
            font-weight: bold;
            margin-bottom: 3px;
            padding: 2px;
            border-bottom: 1px solid #ccc;
            font-size: 9px;
            line-height: 100%;
            display: flex;
            align-items: center;
            gap: 4px;
        `;
        const selectedTitleText = document.createElement('span');
        selectedTitleText.textContent = 'عبارت‌های انتخاب شده';
        selectedSection.appendChild(selectedTitle);
        selectedTitle.appendChild(selectedTitleText);
        if (IS_DESKTOP_HOST) {
            const addSearchBtn = document.createElement('button');
            addSearchBtn.textContent = '+';
            addSearchBtn.title = 'افزودن جستجوی ترکیبی';
            addSearchBtn.style.cssText = 'width: 10px; height: 10px; padding: 2px 0px 0px 0px; font-size: 10px; line-height: normal; border: 1px solid #4ecdc4; border-radius: 2px; background: transparent; color: #4ecdc4; cursor: pointer; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;';
            addSearchBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                openSearchModal();
            });
            selectedTitle.appendChild(addSearchBtn);
            const clearSearchBtn = document.createElement('button');
            clearSearchBtn.textContent = '✕';
            clearSearchBtn.title = 'پاک کردن همهٔ جستجوها و ریشه‌های انتخاب شده';
            clearSearchBtn.style.cssText = 'width: 10px; height: 10px; padding: 2px 0px 0px 0px; font-size: 10px; line-height: normal; border: 1px solid #4ecdc4; border-radius: 2px; background: transparent; color: #4ecdc4; cursor: pointer; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;';
            clearSearchBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                selectedSearchItems.length = 0;
                currentSearchedSearchItemIndex = null;
                currentSearchedRoot = null;
                currentSelectedWord = null;
                Object.keys(highlightedRoots).slice().forEach(function(r) { removeRootHighlight(r); });
                updateHighlightedRootsPanel();
                applySearchItemHighlights();
                if (typeof window.__hideSelectedRootTooltip === 'function') window.__hideSelectedRootTooltip();
            });
            selectedTitle.appendChild(clearSearchBtn);
        }
        
        const selectedContent = document.createElement('div');
        selectedContent.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
        
        const roots = Object.keys(highlightedRoots);
        if (roots.length === 0 && selectedSearchItems.length === 0) {
            if (typeof window.__hideSelectedRootTooltip === 'function') window.__hideSelectedRootTooltip();
        }
        if (roots.length === 0 && selectedSearchItems.length === 0) {
            selectedContent.innerHTML = '<div style="color: #999; font-style: italic; text-align: center; padding: 3px; width: 100%; font-size: 8px;">ریشه‌ای مشخص نشده</div>';
        } else if (roots.length > 0) {
            roots.forEach(root => {
                const { colorIndex, color } = highlightedRoots[root];
                const wordCount = rootToWordsMap[root] ? rootToWordsMap[root].length : 0;
                const isBeingSearched = currentSearchedRoot === root;
                
                const rootDiv = document.createElement('div');
                rootDiv.setAttribute('data-root', root);
                rootDiv.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    background: ${color};
                    border: ${isBeingSearched ? '2px solid red' : '1px solid #ccc'};
                    border-radius: 2px;
                    cursor: pointer;
                    padding: 1px 3px;
                    font-size: 8px;
                    line-height: 1.1;
                `;
                
                // Make root div clickable to search for next instance
                rootDiv.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (e.ctrlKey) {
                        toggleRootHighlight(root);
                    } else {
                        selectNextWordForRoot(root, e.shiftKey ? 'previous' : 'next');
                    }
                });
                
                const colorBox = document.createElement('span');
                colorBox.style.cssText = `
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    background: ${color};
                    border: 1px solid #666;
                    border-radius: 1px;
                    flex-shrink: 0;
                `;

                // colorBox.addEventListener('click', function(e) {
                //     e.stopPropagation();
                //     removeRootHighlight(root);
                // });

                const rootText = document.createElement('span');
                rootText.textContent = convertBuckwalterToArabic(root);
                rootText.style.cssText = 'font-weight: bold;';
                
                const countText = document.createElement('span');
                countText.textContent = `(${wordCount})`;
                countText.style.cssText = 'color: #666; font-size: 7px;';
                
                rootDiv.appendChild(colorBox);
                rootDiv.appendChild(rootText);
                rootDiv.appendChild(countText);
                selectedContent.appendChild(rootDiv);
            });
        }
        selectedSearchItems.forEach(function(entry, idx) {
            const chip = document.createElement('div');
            chip.setAttribute('data-search-item-index', String(idx));
            const isBeingSearched = currentSearchedSearchItemIndex === idx;
            chip.style.cssText = 'display: inline-flex; align-items: center; gap: 2px; background: #e8f4f8; border: ' + (isBeingSearched ? '2px solid red' : '1px solid #4ecdc4') + '; border-radius: 2px; cursor: pointer; padding: 1px 4px; font-size: 8px; line-height: 1.1; margin: 1px 0;';
            chip.textContent = entry.display || 'جستجو';
            chip.title = ''; /* tooltip shown by desktop.js hover */
            chip.addEventListener('click', function(e) {
                if (e.ctrlKey) {
                    e.stopPropagation();
                    selectedSearchItems.splice(idx, 1);
                    if (currentSearchedSearchItemIndex === idx) {
                        currentSearchedSearchItemIndex = null;
                        currentSelectedWord = null;
                    } else if (currentSearchedSearchItemIndex != null && currentSearchedSearchItemIndex > idx) {
                        currentSearchedSearchItemIndex -= 1;
                    }
                    updateHighlightedRootsPanel();
                    applySearchItemHighlights();
                    if (typeof window.__hideSelectedRootTooltip === 'function') window.__hideSelectedRootTooltip();
                } else {
                    e.stopPropagation();
                    selectNextRegionForSearchItem(idx, e.shiftKey ? 'previous' : 'next');
                }
            });
            selectedContent.appendChild(chip);
        });
        
        selectedSection.appendChild(selectedContent);
        content.appendChild(selectedSection);
        
        // Section 2: Top roots (if data is loaded)
        if (currentSuraTopRoots) {
            const topRootsSection = createRootListSection('top-roots-section', 'ریشه‌های پرتکرار', currentSuraTopRoots, 'top_roots');
            content.appendChild(topRootsSection);
        }
        
        // Section 3: Distinctive roots (if data is loaded)
        if (currentSuraDistinctiveRoots) {
            const distinctiveRootsSection = createRootListSection('selective-roots-section', 'ریشه‌های متمایز', currentSuraDistinctiveRoots, 'distinctive_roots');
            content.appendChild(distinctiveRootsSection);
        }
        
        // Section 4: High KL roots (if data is loaded)
        if (currentSuraHighKlRoots) {
            const highKlRootsSection = createRootListSection('high-kl-roots-section', 'ریشه‌های با KL بالا', currentSuraHighKlRoots, 'high_kl_roots');
            content.appendChild(highKlRootsSection);
        }
        
        // Section 5: N2N roots (if data is loaded)
        if (currentSuraN2NRoots) {
            const n2nRootsSection = createRootListSection('n2n-roots-section', 'ریشه‌های N2N', currentSuraN2NRoots, 'n2_N_roots');
            content.appendChild(n2nRootsSection);
        }
    }
    
    // Format tooltip text for root data
    function formatRootTooltip(rootData, sectionType) {
        if (!rootData || typeof rootData === 'string') {
            return '';
        }
        
        let tooltip = '';
        
        if (sectionType === 'top_roots') {
            // top_roots: root, count, rel_in_sura
            tooltip = `تعداد: ${rootData.count || 0}\n`;
            if (rootData.rel_in_sura !== undefined) {
                tooltip += `نسبت در سوره: ${(rootData.rel_in_sura * 100).toFixed(2)}%`;
            }
        } else if (sectionType === 'distinctive_roots') {
            // distinctive_roots: root, count, rel_in_sura, rel_elsewhere, ratio, log_ratio
            tooltip = `تعداد: ${rootData.count || 0}\n`;
            if (rootData.rel_in_sura !== undefined) {
                tooltip += `نسبت در سوره: ${(rootData.rel_in_sura * 100).toFixed(2)}%\n`;
            }
            if (rootData.rel_elsewhere !== undefined) {
                tooltip += `نسبت در جاهای دیگر: ${(rootData.rel_elsewhere * 100).toFixed(4)}%\n`;
            }
            if (rootData.ratio !== undefined) {
                tooltip += `نسبت: ${rootData.ratio.toFixed(2)}\n`;
            }
            if (rootData.log_ratio !== undefined) {
                tooltip += `لگاریتم نسبت: ${rootData.log_ratio.toFixed(2)}`;
            }
        } else if (sectionType === 'high_kl_roots') {
            // high_kl_roots: root, count, p_sura, p_else, kl
            tooltip = `تعداد: ${rootData.count || 0}\n`;
            if (rootData.p_sura !== undefined) {
                tooltip += `احتمال در سوره: ${(rootData.p_sura * 100).toFixed(4)}%\n`;
            }
            if (rootData.p_else !== undefined) {
                tooltip += `احتمال در جاهای دیگر: ${(rootData.p_else * 100).toFixed(4)}%\n`;
            }
            if (rootData.kl !== undefined) {
                tooltip += `KL: ${rootData.kl.toFixed(4)}`;
            }
        } else if (sectionType === 'n2_N_roots') {
            // n2_N_roots: root, count, global, m
            tooltip = `تعداد: ${rootData.count || 0}\n`;
            if (rootData.global !== undefined) {
                tooltip += `تعداد کل: ${rootData.global}\n`;
            }
            if (rootData.p !== undefined) {
                tooltip += `احتمال در سوره: ${(rootData.p * 100).toFixed(4)}%\n`;
            }
            if (rootData.q !== undefined) {
                tooltip += `احتمال کل: ${(rootData.q * 100).toFixed(4)}%\n`;
            }
            if (rootData.m !== undefined) {
                tooltip += `m: ${(rootData.m).toFixed(2)}`;
            }
        }
        
        return tooltip.trim();
    }
    
    // Create a root list section (for top roots, selective roots, etc.)
    function createRootListSection(sectionId, title, roots, sectionType = null) {
        const limitedRoots = applyRootLimit(roots, sectionType);
        const section = document.createElement('div');
        section.id = sectionId;
        section.style.cssText = 'margin-bottom: 8px;';
        
        // Add title
        const titleDiv = document.createElement('div');
        titleDiv.textContent = title;
        titleDiv.style.cssText = `
            font-weight: bold;
            margin-bottom: 3px;
            padding: 2px;
            border-bottom: 1px solid #ccc;
            font-size: 9px;
            line-height: 100%;
        `;
        section.appendChild(titleDiv);
        
        // Add content container
        const contentDiv = document.createElement('div');
        contentDiv.id = sectionId + '-content';
        contentDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
        section.appendChild(contentDiv);
        
        // Populate with roots
        if (!limitedRoots || limitedRoots.length === 0) {
            contentDiv.innerHTML = '<div style="color: #999; font-style: italic; text-align: center; padding: 3px; width: 100%; font-size: 8px;">ریشه‌ای یافت نشد</div>';
        } else {
            limitedRoots.forEach((rootData) => {
                const root = typeof rootData === 'string' ? rootData : rootData.root;
                const count = rootData.count || 0;
                // Convert root to Arabic for lookup (rootToWordsMap stores roots in Arabic)
                // If root is already in Arabic, convertArabicToBuckwalter will return the original
                // If root is in Buckwalter, we need to convert it to Arabic
                const arabicRoot = convertBuckwalterToArabic(root);
                // Also try the root as-is in case it's already in Arabic
                const wordsInMap = rootToWordsMap[arabicRoot] || rootToWordsMap[root];
                const wordCount = wordsInMap ? wordsInMap.length : 0;
                
                // Debug: log if root is not found
                if (!wordsInMap && dataLoaded) {
                    console.warn('Root from JSON not found in rootToWordsMap:', root, 'Arabic version:', arabicRoot, 'Available roots:', Object.keys(rootToWordsMap).slice(0, 10));
                }
                
                const rootDiv = document.createElement('div');
                // Store Arabic root in data attribute for lookups
                rootDiv.setAttribute('data-root', arabicRoot);
                
                // Add tooltip with root data information
                if (sectionType && typeof rootData === 'object') {
                    const tooltipText = formatRootTooltip(rootData, sectionType);
                    if (tooltipText) {
                        rootDiv.setAttribute('title', tooltipText);
                    }
                }
                
                rootDiv.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    background: #e8e8e8;
                    border: 1px solid #ccc;
                    border-radius: 2px;
                    cursor: pointer;
                    padding: 1px 3px;
                    font-size: 8px;
                    line-height: 1.1;
                `;
                
                // Make root div clickable to add to highlighted roots
                rootDiv.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // Get the root from data attribute to ensure we use the correct format
                    const clickedRoot = rootDiv.getAttribute('data-root');
                    if (!highlightedRoots[clickedRoot]) {
                        // Check if root exists in rootToWordsMap
                        if (!rootToWordsMap[clickedRoot] || rootToWordsMap[clickedRoot].length === 0) {
                            console.warn('Root not found in rootToWordsMap:', clickedRoot);
                            // Still add it to highlighted roots, but don't highlight words
                            const colorIndex = nextColorIndex % highlightColors.length;
                            const color = highlightColors[colorIndex];
                            highlightedRoots[clickedRoot] = { colorIndex, color };
                            nextColorIndex++;
                        } else {
                            // Add root to highlighted roots
                            const colorIndex = nextColorIndex % highlightColors.length;
                            const color = highlightColors[colorIndex];
                            highlightedRoots[clickedRoot] = { colorIndex, color };
                            nextColorIndex++;
                            
                            // Apply highlight
                            applyRootHighlight(clickedRoot, color);
                        }
                        updateHighlightedRootsPanel();
                    }
                });
                
                const rootText = document.createElement('span');
                // Display root in Arabic (it's already converted or was already Arabic)
                rootText.textContent = arabicRoot;
                rootText.style.cssText = 'font-weight: bold;';
                
                const countText = document.createElement('span');
                // Use wordCount from rootToWordsMap if available, otherwise use count from JSON
                // This ensures we show the actual number of words in the text
                const displayCount = wordCount > 0 ? wordCount : (count > 0 ? count : 0);
                countText.textContent = `(${displayCount})`;
                countText.style.cssText = 'color: #666; font-size: 7px;';
                
                rootDiv.appendChild(rootText);
                rootDiv.appendChild(countText);
                contentDiv.appendChild(rootDiv);
            });
        }
        
        return section;
    }

    function applyRootLimit(roots, sectionType) {
        if (!roots || !sectionType) return roots;
        const limit = getRootLimitFromStorage(sectionType);
        if (!Number.isInteger(limit)) return roots;
        if (limit <= 0) return [];
        return roots.slice(0, limit);
    }

    function getRootLimitFromStorage(sectionType) {
        try {
            const raw = localStorage.getItem('desktopRootLimits');
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            const value = parsed ? parsed[sectionType] : null;
            return Number.isInteger(value) ? value : null;
        } catch (error) {
            return null;
        }
    }
    
    // Expose remove function globally for onclick handlers
    window.morphologyHoverRemoveRoot = function(root) {
        removeRootHighlight(root);
        updateHighlightedRootsPanel();
    };
    
    // Get the first div (surah header)
    function getSurahHeader() {
        // Try to find by id first (for backward compatibility)
        let header = document.getElementById('header');
        if (header) return header;
        
        // Otherwise, find the first div in body
        const body = document.body;
        if (body) {
            const firstDiv = body.querySelector('div');
            return firstDiv;
        }
        return null;
    }
    
    // Sura names mapping (number to Arabic name)
    // This will be populated from the current page and file names
    const suraNames = {
        1: 'الفاتحة', 2: 'البقرة', 3: 'آل عمران', 4: 'النساء', 5: 'المائدة',
        6: 'الأنعام', 7: 'الأعراف', 8: 'الأنفال', 9: 'التوبة', 10: 'يونس',
        11: 'هود', 12: 'يوسف', 13: 'الرعد', 14: 'إبراهيم', 15: 'الحجر',
        16: 'النحل', 17: 'الإسراء', 18: 'الكهف', 19: 'مريم', 20: 'طه',
        21: 'الأنبياء', 22: 'الحج', 23: 'المؤمنون', 24: 'النور', 25: 'الفرقان',
        26: 'الشعراء', 27: 'النمل', 28: 'القصص', 29: 'العنكبوت', 30: 'الروم',
        31: 'لقمان', 32: 'السجدة', 33: 'الأحزاب', 34: 'سبأ', 35: 'فاطر',
        36: 'يس', 37: 'الصافات', 38: 'ص', 39: 'الزمر', 40: 'غافر',
        41: 'فصلت', 42: 'الشورى', 43: 'الزخرف', 44: 'الدخان', 45: 'الجاثية',
        46: 'الأحقاف', 47: 'محمد', 48: 'الفتح', 49: 'الحجرات', 50: 'ق',
        51: 'الذاريات', 52: 'الطور', 53: 'النجم', 54: 'القمر', 55: 'الرحمن',
        56: 'الواقعة', 57: 'الحديد', 58: 'المجادلة', 59: 'الحشر', 60: 'الممتحنة',
        61: 'الصف', 62: 'الجمعة', 63: 'المنافقون', 64: 'التغابن', 65: 'الطلاق',
        66: 'التحريم', 67: 'الملك', 68: 'القلم', 69: 'الحاقة', 70: 'المعارج',
        71: 'نوح', 72: 'الجن', 73: 'المزمل', 74: 'المدثر', 75: 'القيامة',
        76: 'الإنسان', 77: 'المرسلات', 78: 'النبأ', 79: 'النازعات', 80: 'عبس',
        81: 'التكوير', 82: 'الانفطار', 83: 'المطففين', 84: 'الانشقاق', 85: 'البروج',
        86: 'الطارق', 87: 'الأعلى', 88: 'الغاشية', 89: 'الفجر', 90: 'البلد',
        91: 'الشمس', 92: 'الليل', 93: 'الضحى', 94: 'الشرح', 95: 'التين',
        96: 'العلق', 97: 'القدر', 98: 'البينة', 99: 'الزلزلة', 100: 'العاديات',
        101: 'القارعة', 102: 'التكاثر', 103: 'العصر', 104: 'الهمزة', 105: 'الفيل',
        106: 'قريش', 107: 'الماعون', 108: 'الكوثر', 109: 'الكافرون', 110: 'النصر',
        111: 'المسد', 112: 'الإخلاص', 113: 'الفلق', 114: 'الناس'
    };
    
    // Get sura name from current page
    function getCurrentSuraName() {
        const header = getSurahHeader();
        if (header) {
            return header.textContent.trim();
        }
        return null;
    }
    
    // Sura number to filename mapping
    const suraFileNames = {
        1: '001_Fatiha_html.html', 2: '002_Baqarah_html.html', 3: '003_AleImran_html.html',
        4: '004_Nissa_html.html', 5: '005_Maedah_html.html', 6: '006_Anaam_html.html',
        7: '007_Araf_html.html', 8: '008_Anfal_html.html', 9: '009_Tawbah_html.html',
        10: '010_Yunus_html.html', 11: '011_Hud_html.html', 12: '012_Yusof_html.html',
        13: '013_Raad_html.html', 14: '014_Ibrahim_html.html', 15: '015_Hejr_html.html',
        16: '016_Nahl_html.html', 17: '017_Esra_html.html', 18: '018_Kahf_html.html',
        19: '019_Maryam_html.html', 20: '020_Taha_html.html', 21: '021_Anbia_html.html',
        22: '022_Haj_html.html', 23: '023_Momenun_html.html', 24: '024_Noor_html.html',
        25: '025_Forqan_html.html', 26: '026_Shoara_html.html', 27: '027_Naml_html.html',
        28: '028_Qasas_html.html', 29: '029_Ankabut_html.html', 30: '030_Rum_html.html',
        31: '031_Loqman_html.html', 32: '032_Sajda_html.html', 33: '033_Ahzab_html.html',
        34: '034_Saba_html.html', 35: '035_Fater_html.html', 36: '036_Yasin_html.html',
        37: '037_Saffat_html.html', 38: '038_Saad_html.html', 39: '039_Zomar_html.html',
        40: '040_Ghafer_html.html', 41: '041_Fussilat_html.html', 42: '042_Showra_html.html',
        43: '043_Zokhrof_html.html', 44: '044_Dokhan_html.html', 45: '045_Jathiah_html.html',
        46: '046_Ahqaf_html.html', 47: '047_Muhammad_html.html', 48: '048_Fath_html.html',
        49: '049_Hojorat_html.html', 50: '050_Qaf_html.html', 51: '051_Zariyat_html.html',
        52: '052_Tur_html.html', 53: '053_Najm_html.html', 54: '054_Qamar_html.html',
        55: '055_AlRahman_html.html', 56: '056_Waqea_html.html', 57: '057_Hadid_html.html',
        58: '058_Mojadala_html.html', 59: '059_Hashr_html.html', 60: '060_Momtahena_html.html',
        61: '061_Saff_html.html', 62: '062_Jome_html.html', 63: '063_Monafequn_html.html',
        64: '064_Taqabon_html.html', 65: '065_Talaq_html.html', 66: '066_Tahrim_html.html',
        67: '067_Molk_html.html', 68: '068_Qalam_html.html', 69: '069_Haqqa_html.html',
        70: '070_Maarij_html.html', 71: '071_Nuh_html.html', 72: '072_Jin_html.html',
        73: '073_Mozamel_html.html', 74: '074_Modathir_html.html', 75: '075_Qiyamah_html.html',
        76: '076_Ensan_html.html', 77: '077_Morsalat_html.html', 78: '078_Nabaa_html.html',
        79: '079_Nazeat_html.html', 80: '080_Abas_html.html', 81: '081_Takwir_html.html',
        82: '082_Enfetar_html.html', 83: '083_Motafefin_html.html', 84: '084_Ensheqaq_html.html',
        85: '085_Boruj_html.html', 86: '086_Tareq_html.html', 87: '087_Aala_html.html',
        88: '088_Qashiya_html.html', 89: '089_Fajr_html.html', 90: '090_Balad_html.html',
        91: '091_Shams_html.html', 92: '092_Layl_html.html', 93: '093_Dhoha_html.html',
        94: '094_Sharh_html.html', 95: '095_Tin_html.html', 96: '096_Alaq_html.html',
        97: '097_Qadr_html.html', 98: '098_Bayyenah_html.html', 99: '099_Zelzelah_html.html',
        100: '100_Aadiyat_html.html', 101: '101_Qareah_html.html', 102: '102_Takathor_html.html',
        103: '103_Aasr_html.html', 104: '104_Homazah_html.html', 105: '105_Fil_html.html',
        106: '106_Qoraysh_html.html', 107: '107_Maaun_html.html', 108: '108_Kawthar_html.html',
        109: '109_Kaferun_html.html', 110: '110_Nasr_html.html', 111: '111_Masad_html.html',
        112: '112_Ekhlas_html.html', 113: '113_Falaq_html.html', 114: '114_Nas_html.html'
    };
    
    // Get sura file name from sura number
    function getSuraFileName(suraNumber) {
        return suraFileNames[suraNumber] || null;
    }
    
    // Create sura selection menu
    function createSuraSelectionMenu() {
        // Check if menu already exists
        let menu = document.getElementById('sura-selection-menu');
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
            if (menu.style.display === 'block') {
                updateSuraMenu();
            }
            return menu;
        }
        
        const currentSura = sureNumber || parseInt(window.location.pathname.match(/(\d+)_/)?.[1]) || 1;
        
        menu = document.createElement('div');
        menu.id = 'sura-selection-menu';
        menu.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            max-width: 90vw;
            max-height: 80vh;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10001;
            display: flex;
            flex-direction: column;
            direction: rtl;
            font-family: Arial, sans-serif;
        `;
        
        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute;
            top: 5px;
            left: 5px;
            width: 30px;
            height: 30px;
            border: none;
            background: #f44336;
            color: white;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            z-index: 10002;
        `;
        closeBtn.addEventListener('click', () => {
            menu.style.display = 'none';
        });
        menu.appendChild(closeBtn);
        
        // Title
        const title = document.createElement('div');
        title.textContent = 'انتخاب سوره';
        title.style.cssText = `
            padding: 15px;
            font-size: 18px;
            font-weight: bold;
            text-align: center;
            border-bottom: 1px solid #ddd;
            background: #f5f5f5;
        `;
        menu.appendChild(title);
        
        // Search box
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = 'padding: 10px; border-bottom: 1px solid #ddd;';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'جستجوی سوره...';
        searchInput.id = 'sura-search-input';
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px;
            font-size: 14px;
            border: 1px solid #ccc;
            border-radius: 4px;
            direction: rtl;
            box-sizing: border-box;
        `;
        searchContainer.appendChild(searchInput);
        menu.appendChild(searchContainer);
        
        // Sura list container
        const listContainer = document.createElement('div');
        listContainer.id = 'sura-list-container';
        listContainer.style.cssText = `
            overflow-y: auto;
            flex: 1;
            max-height: calc(80vh - 150px);
        `;
        menu.appendChild(listContainer);
        
        document.body.appendChild(menu);
        
        // Populate sura list
        updateSuraMenu();
        
        // Add search functionality
        searchInput.addEventListener('input', function() {
            filterSuraList(this.value);
        });
        
        // Close on outside click
        menu.addEventListener('click', function(e) {
            if (e.target === menu) {
                menu.style.display = 'none';
            }
        });
        
        return menu;
    }
    
    // Update sura menu list
    function updateSuraMenu() {
        const listContainer = document.getElementById('sura-list-container');
        if (!listContainer) return;
        
        const currentSura = sureNumber || parseInt(window.location.pathname.match(/(\d+)_/)?.[1]) || 1;
        
        listContainer.innerHTML = '';
        
        // Create sura list items
        for (let i = 1; i <= 114; i++) {
            const suraName = suraNames[i] || `سوره ${i}`;
            const suraItem = document.createElement('div');
            suraItem.className = 'sura-menu-item';
            suraItem.setAttribute('data-sura-number', i);
            suraItem.style.cssText = `
                padding: 10px 15px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
                transition: background-color 0.2s;
                ${i === currentSura ? 'background: #e3f2fd; font-weight: bold;' : ''}
            `;
            
            suraItem.innerHTML = `
                <span>${faNum(i)}. ${suraName}</span>
            `;
            
            suraItem.addEventListener('mouseenter', function() {
                if (i !== currentSura) {
                    this.style.background = '#f5f5f5';
                }
            });
            
            suraItem.addEventListener('mouseleave', function() {
                if (i !== currentSura) {
                    this.style.background = '';
                }
            });
            
            suraItem.addEventListener('click', function() {
                navigateToSura(i);
            });
            
            listContainer.appendChild(suraItem);
        }
        
        // Scroll to current sura
        const currentItem = listContainer.querySelector(`[data-sura-number="${currentSura}"]`);
        if (currentItem) {
            currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    // Filter sura list based on search
    function filterSuraList(searchText) {
        const listContainer = document.getElementById('sura-list-container');
        if (!listContainer) return;
        
        const items = listContainer.querySelectorAll('.sura-menu-item');
        if (!searchText || searchText.trim() === '') {
            items.forEach(item => {
                item.style.display = 'flex';
            });
            return;
        }
        
        // Convert Persian/Arabic numbers to English for search
        const persianToEnglish = {
            '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
            '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
            'ي': 'ی', 'ك': 'ک', 'إ': 'ا', 'أ': 'ا', 'ؤ': 'و', 'ئ': 'ء',
            'ة': 'ه', '‌': ' '
            
        };
        const normalizedSearch = searchText.split('').map(char => persianToEnglish[char] || char).join('').toLowerCase();
        
        items.forEach(item => {
            const text = item.textContent;
            // Normalize text for comparison
            const normalizedText = text.split('').map(char => persianToEnglish[char] || char).join('').toLowerCase();
            const matches = normalizedText.includes(normalizedSearch);
            item.style.display = matches ? 'flex' : 'none';
        });
    }
    
    // Navigate to a sura
    function navigateToSura(suraNumber) {
        const fileName = getSuraFileName(suraNumber);
        if (fileName) {
            // Get current directory
            const currentPath = window.location.pathname;
            const baseDir = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
            window.location.href = baseDir + fileName;
        } else {
            console.warn('Could not find filename for sura:', suraNumber);
        }
    }
    
    // Make sura header clickable
    function makeSuraHeaderClickable() {
        const header = getSurahHeader();
        if (!header) return;
        
        // Check if already made clickable
        if (header.hasAttribute('data-clickable')) return;
        header.setAttribute('data-clickable', 'true');
        
        // Make header look clickable
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        
        // Add hover effect
        const originalBg = header.style.backgroundColor || 'rgb(220,220,220)';
        header.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgb(200,200,200)';
        });
        header.addEventListener('mouseleave', function() {
            this.style.backgroundColor = originalBg;
        });
        
        // Add click handler
        header.addEventListener('click', function(e) {
            e.stopPropagation();
            const menu = createSuraSelectionMenu();
            menu.style.display = 'block';
        });
    }
    
    // Mobile/desktop layout state
    let isMobileMode = false;
    let mobileContentWrapper = null;
    let desktopLayout = null;
    let desktopContentWrapper = null;
    let desktopLeftColumn = null;
    let visibleHighlight = null, minimap = null;

    // Create toggle button and add it to the first div
    function createToggleButton() {
        const surahHeader = getSurahHeader();
        if (!surahHeader) return;
        
        // Check if button already exists
        if (document.getElementById('toggle-minimap-btn')) return;
        
        // Make sure the header has position relative
        const currentPosition = window.getComputedStyle(surahHeader).position;
        if (currentPosition === 'static') {
            surahHeader.style.position = 'relative';
        }
        
        // Create minimap toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-minimap-btn';
        toggleBtn.textContent = 'نقشه';
        toggleBtn.style.cssText = `
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            z-index: 10000;
        `;
        
        toggleBtn.addEventListener('click', function(e) { 
            e.stopPropagation(); // prevents bubbling up to the div
            toggleMinimapAndRootList();
        });
        surahHeader.appendChild(toggleBtn);
        
        // Create mobile mode toggle button
        const mobileToggleBtn = document.createElement('button');
        mobileToggleBtn.id = 'toggle-mobile-mode-btn';
        mobileToggleBtn.textContent = 'کوچک';
        mobileToggleBtn.style.cssText = `
            position: absolute;
            left: 70px;
            top: 50%;
            transform: translateY(-50%);
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
            background: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            z-index: 10000;
        `;
        
        mobileToggleBtn.addEventListener('click', function(e) { 
            e.stopPropagation(); // prevents bubbling up to the div
            toggleMobileMode();
        });
        surahHeader.appendChild(mobileToggleBtn);
    }
    
    // Toggle mobile mode
    function toggleMobileMode() {
        isMobileMode = !isMobileMode;
        const mobileToggleBtn = document.getElementById('toggle-mobile-mode-btn');
        
        if (isMobileMode) {
            enableMobileMode();
            if (mobileToggleBtn) {
                // mobileToggleBtn.textContent = 'حالت عادی';
                // mobileToggleBtn.style.background = '#FF9800';
            }
        } else {
            disableMobileMode();
            if (mobileToggleBtn) {
                // mobileToggleBtn.textContent = 'حالت موبایل';
                // mobileToggleBtn.style.background = '#2196F3';
            }
        }
        recomputeMinimapGeometry();
    }
    
    // Enable mobile mode: wrap content in top row, position minimap/roots in bottom row
    function enableMobileMode() {
        // Create wrapper for main content (top row)
        if (!mobileContentWrapper) {
            mobileContentWrapper = document.createElement('div');
            mobileContentWrapper.id = 'mobile-content-wrapper';
            
            // Get header height to position content below it
            // const surahHeader = getSurahHeader();
            // let headerHeight = 0;
            // if (surahHeader) {
            //     const rect = surahHeader.getBoundingClientRect();
            //     headerHeight = rect.height;
            // }
            
            mobileContentWrapper.style.cssText = `
                position: fixed;
                top: ${0}px;
                left: 0;
                right: 0;
                bottom: 120px;
                overflow-y: auto;
                overflow-x: auto;
                z-index: 1;
                background: white;
            `;
            
            // Get all body children except the header, minimap, root panel, and buttons
            const minimap = document.getElementById('morphology-minimap');
            const rootPanel = document.getElementById('highlighted-roots-panel');
            const body = document.body;
            
            // Move all children except header, minimap, root panel, and mobile containers into wrapper
            const childrenToMove = [];
            for (let i = 0; i < body.children.length; i++) {
                const child = body.children[i];
                //child !== surahHeader &&
                if ( child !== minimap && child !== rootPanel && 
                    child.id !== 'mobile-content-wrapper' && child.id !== 'mobile-bottom-row' &&
                    !child.id.includes('toggle-')) {
                    childrenToMove.push(child);
                }
            }
            
            childrenToMove.forEach(child => {
                mobileContentWrapper.appendChild(child);
            });
            
            body.appendChild(mobileContentWrapper);
        }
        
        // Create bottom row container for minimap and roots
        let bottomRow = document.getElementById('mobile-bottom-row');
        if (!bottomRow) {
            const body = document.body;
            bottomRow = document.createElement('div');
            bottomRow.id = 'mobile-bottom-row';
            const bottomRowHeight = 120;
            bottomRow.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: ${bottomRowHeight}px;
                background: #f0f0f0;
                border-top: 2px solid #ccc;
                display: flex;
                flex-direction: row;
                gap: 5px;
                padding: 5px;
                box-sizing: border-box;
                z-index: 10000;
                overflow: hidden;
            `;
            body.appendChild(bottomRow);
        }
        
        // Move minimap and root panel to bottom row
        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        const bottomRowHeight = 120;
        const bottomRowPadding = 5;
        const gap = 5;
        const availableHeight = bottomRowHeight - (bottomRowPadding * 2);
        
        if (minimap) {
            // Remove from current parent if it exists
            if (minimap.parentElement && minimap.parentElement !== bottomRow) {
                minimap.parentElement.removeChild(minimap);
            }
            
            // Apply mobile mode styles
            minimap.style.position = 'relative';
            minimap.style.top = 'auto';
            minimap.style.left = 'auto';
            
            // In flex container, use flex-basis with fixed width
            const fixedWidth = calculateWindowWidth();
            minimap.style.width = `${fixedWidth}px`;
            minimap.style.flex = `0 0 ${fixedWidth}px`;
            minimap.style.maxWidth = `${fixedWidth}px`;
            minimap.style.height = `${availableHeight}px`;
            minimap.style.maxHeight = `${availableHeight}px`;
            minimap.style.minHeight = `${availableHeight}px`;
            minimap.style.margin = '0';
            minimap.style.display = 'block';

            // Append to bottom row if not already there
            if (!bottomRow.contains(minimap)) {
                bottomRow.appendChild(minimap);
            }
        }
        
        if (rootPanel) {
            // Remove from current parent if it exists
            if (rootPanel.parentElement && rootPanel.parentElement !== bottomRow) {
                rootPanel.parentElement.removeChild(rootPanel);
            }
            
            // Apply mobile mode styles
            rootPanel.style.position = 'relative';
            rootPanel.style.top = 'auto';
            rootPanel.style.left = 'auto';
            rootPanel.style.flex = '1 1 auto'; // Take remaining space after minimap and other panels
            rootPanel.style.minWidth = '0';
            rootPanel.style.height = `${availableHeight}px`;
            rootPanel.style.maxHeight = `${availableHeight}px`;
            rootPanel.style.minHeight = `${availableHeight}px`;
            rootPanel.style.margin = '0';
            rootPanel.style.display = 'block';
            
            // Append to bottom row if not already there
            if (!bottomRow.contains(rootPanel)) {
                bottomRow.appendChild(rootPanel);
            }
        }
        
        // Update minimap content if needed
        if (minimap) {
            const minimapContent = document.getElementById('minimap-content');
            const visibleHighlight = document.getElementById('minimap-visible-highlight');
            const wordRects = minimap._wordRects;
            if (minimapContent && visibleHighlight && wordRects) {
                updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
            }
        }
        
        // Add scroll listener to mobile content wrapper
        if (mobileContentWrapper) {
            let rafPending = false;
            function handleMobileScroll() {
                if (rafPending) return;
                rafPending = true;
                requestAnimationFrame(() => {
                    rafPending = false;
                    updateVisibleHighlight();
                });
            }
            mobileContentWrapper.addEventListener('scroll', handleMobileScroll, { passive: true });
        }
    }
    
    // Disable mobile mode: restore original layout
    function disableMobileMode() {
        const body = document.body;
        const bottomRow = document.getElementById('mobile-bottom-row');
        
        // First, extract minimap and all root panels from bottom row BEFORE removing it
        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        const topRootsPanel = document.getElementById('top-roots-panel');
        const selectiveRootsPanel = document.getElementById('selective-roots-panel');
        const thirdRootsPanel = document.getElementById('third-roots-panel');
        
        if (bottomRow) {
            // Remove minimap and all root panels from bottom row and append to body
            if (minimap && bottomRow.contains(minimap)) {
                bottomRow.removeChild(minimap);
                // body.appendChild(minimap);
            }
            if (rootPanel && bottomRow.contains(rootPanel)) {
                bottomRow.removeChild(rootPanel);
                // body.appendChild(rootPanel);
            }
            // Now remove the bottom row container
            bottomRow.remove();
        }
        
        // Restore content from wrapper back to body
        if (mobileContentWrapper) {
            const childrenToRestore = [];
            for (let i = 0; i < mobileContentWrapper.children.length; i++) {
                childrenToRestore.push(mobileContentWrapper.children[i]);
            }
            
            childrenToRestore.forEach(child => {
                body.appendChild(child);
            });
            
            mobileContentWrapper.remove();
            mobileContentWrapper = null;
        }
        
        // Restore minimap and root panel to wrapper (desktop mode)
        const surahHeader = getSurahHeader();
        // Get or create wrapper - if it exists, we'll reuse it; otherwise create new one
        let wrapper = document.getElementById('morphology-combined-panel');
        if (!wrapper) {
            wrapper = createCombinedPanelWrapper();
        }
        
        if (minimap && wrapper) {
            // Add minimap to wrapper
            wrapper.appendChild(minimap);

            const windowWidth = calculateWindowWidth();
            const viewportHeight = window.innerHeight;
            let topPosition = 10;
            if (surahHeader) {
                const rect = surahHeader.getBoundingClientRect();
                // Use viewport-relative position (getBoundingClientRect is already viewport-relative)
                // If header is visible in viewport (even partially), position below it
                if (rect.bottom > 0 && rect.bottom < window.innerHeight) {
                    topPosition = rect.bottom + 10;
                } else {
                    // Header is scrolled off-screen - use minimum position
                    topPosition = 10;
                }
                // Ensure minimum top position
                topPosition = Math.max(10, topPosition);
            }
            // Ensure availableHeight doesn't exceed viewport and is positive
            const availableHeight = Math.max(200, Math.min(viewportHeight - topPosition - 20, viewportHeight - 30));

            // First, remove ALL mobile-specific properties to ensure clean state
            minimap.style.removeProperty('flex');
            minimap.style.removeProperty('max-width');
            minimap.style.removeProperty('min-width');
            minimap.style.removeProperty('height');
            minimap.style.removeProperty('max-height');
            minimap.style.removeProperty('min-height');
            
            // Then set desktop mode properties explicitly
            minimap.style.position = 'relative';
            minimap.style.top = '';
            minimap.style.left = '';
            minimap.style.width = windowWidth + 'px';
            minimap.style.flex = '0 0 50%';
            minimap.style.maxWidth = '';
            minimap.style.maxHeight = '';
            minimap.style.minHeight = '0';
            minimap.style.height = '50%';
            minimap.style.margin = '';
            minimap.style.flexShrink = '';
            
            // Preserve visibility state
            const wasVisible = minimap.style.display !== 'none' && minimap.style.display !== '';
            if (!wasVisible) {
                minimap.style.display = 'none';
            } else {
                minimap.style.display = 'block';
            }
            
            // Update minimap content
            const minimapContent = document.getElementById('minimap-content');
            const visibleHighlight = document.getElementById('minimap-visible-highlight');
            const wordRects = minimap._wordRects;
            
            if (minimapContent && visibleHighlight && wordRects) {
                updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                // Ensure flex and other properties are still correct after updateMinimap
                // Use double requestAnimationFrame to ensure DOM is fully updated
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        minimap.style.flex = '0 0 50%';
                        minimap.style.height = '50%';
                        minimap.style.removeProperty('max-width');
                        minimap.style.removeProperty('min-width');
                    });
                });
            } else {
                // Even if minimap content isn't ready, ensure flex is set correctly
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        minimap.style.flex = '0 0 50%';
                        minimap.style.height = '50%';
                    });
                });
            }
        }
        
        if (rootPanel && wrapper) {
            // Add root panel to wrapper
            wrapper.appendChild(rootPanel);
            
            const windowWidth = calculateWindowWidth();
            const viewportHeight = window.innerHeight;
            let topPosition = 10;
            if (surahHeader) {
                const rect = surahHeader.getBoundingClientRect();
                // Use viewport-relative position (getBoundingClientRect is already viewport-relative)
                // If header is visible in viewport (even partially), position below it
                if (rect.bottom > 0 && rect.bottom < window.innerHeight) {
                    topPosition = rect.bottom + 10;
                } else {
                    // Header is scrolled off-screen - use minimum position
                    topPosition = 10;
                }
                // Ensure minimum top position
                topPosition = Math.max(10, topPosition);
            }
            // Ensure availableHeight doesn't exceed viewport and is positive
            const availableHeight = Math.max(200, Math.min(viewportHeight - topPosition - 20, viewportHeight - 30));
            
            rootPanel.style.position = 'relative';
            rootPanel.style.top = '';
            rootPanel.style.left = '';
            rootPanel.style.width = windowWidth + 'px';
            rootPanel.style.maxHeight = '';
            rootPanel.style.minHeight = '0';
            rootPanel.style.height = '50%';
            rootPanel.style.margin = '';
            rootPanel.style.flexShrink = '';
            rootPanel.style.flex = '0 0 50%';
            // Explicitly remove any mobile-specific or leftover properties
            rootPanel.style.removeProperty('top');
            rootPanel.style.removeProperty('max-height');
            rootPanel.style.removeProperty('min-width');
            rootPanel.style.removeProperty('max-width');
            
            // Preserve visibility state
            const wasVisible = rootPanel.style.display !== 'none' && rootPanel.style.display !== '';
            if (!wasVisible) {
                rootPanel.style.display = 'none';
            } else {
                rootPanel.style.display = 'block';
            }
            
            // Update wrapper position and size with safe constraints
            wrapper.style.top = topPosition + 'px';
            wrapper.style.width = windowWidth + 'px';
            wrapper.style.height = availableHeight + 'px';
            wrapper.style.maxHeight = availableHeight + 'px';
            wrapper.style.display = (minimap && minimap.style.display !== 'none') ? 'flex' : 'none';
        }
        
    }
    
    // Calculate responsive width for windows (minimum 120px, responsive to viewport)
    function calculateWindowWidth() {
        const viewportWidth = window.innerWidth;
        const minWidth = 120;
        const maxWidth = 180;
        // Scale from minWidth to maxWidth based on viewport width
        // For viewport < 600px: use minWidth
        // For viewport > 1200px: use maxWidth
        // Linear interpolation between
        if (viewportWidth <= 600) {
            return minWidth;
        } else if (viewportWidth >= 1200) {
            return maxWidth;
        } else {
            const ratio = (viewportWidth - 600) / (1200 - 600);
            return Math.round(minWidth + (maxWidth - minWidth) * ratio);
        }
    }
    function calculateWindowWidthForMobile() {
        const viewportWidth = window.innerWidth;
        const minWidth = 120;
        const maxWidth = 180;
        const space = 10;
        const ratio = (viewportWidth - 2*minWidth - space) / (2*maxWidth + space);
        const c = minWidth + space + ratio * (2*maxWidth + space);
        if (c > maxWidth) {
            return maxWidth;
        } else if (c < minWidth) {
            return minWidth;
        }
        return c;
    }

    // Toggle minimap and root list visibility
    function toggleMinimapAndRootList() {
        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        const toggleBtn = document.getElementById('toggle-minimap-btn');
        const wrapper = document.getElementById('morphology-combined-panel');
        
        if (!minimap || !rootPanel || !toggleBtn) return;
        
        // In desktop mode, check wrapper visibility; in mobile mode, check individual panels
        const isVisible = isMobileMode 
            ? (minimap.style.display !== 'none' && minimap.style.display !== '')
            : (wrapper && wrapper.style.display !== 'none' && wrapper.style.display !== '');
        
        if (isVisible) {
            if (isMobileMode) {
                minimap.style.display = 'none';
                rootPanel.style.display = 'none';
            } else {
                if (wrapper) wrapper.style.display = 'none';
            }
            // toggleBtn.textContent = 'نمایش نقشه';
        } else {
            // In mobile mode, just show them (they're already positioned in bottom row)
            if (isMobileMode) {
                minimap.style.display = 'block';
                rootPanel.style.display = 'block';
            } else {
                // In desktop mode, show the wrapper (which contains both panels)
                if (wrapper) {
                    // Update wrapper position in case header moved
                    const surahHeader = getSurahHeader();
                    let topPosition = 10;
                    if (surahHeader) {
                        const rect = surahHeader.getBoundingClientRect();
                        // Use viewport-relative position (getBoundingClientRect is already viewport-relative)
                        // If header is visible in viewport (even partially), position below it
                        if (rect.bottom > 0 && rect.bottom < window.innerHeight) {
                            topPosition = rect.bottom + 10;
                        } else {
                            // Header is scrolled off-screen - use minimum position
                            topPosition = 10;
                        }
                        // Ensure minimum top position
                        topPosition = Math.max(10, topPosition);
                    }
                    wrapper.style.top = topPosition + 'px';
                    
                    // Also update height to match viewport
                    const viewportHeight = window.innerHeight;
                    const availableHeight = Math.max(200, Math.min(viewportHeight - topPosition - 20, viewportHeight - 30));
                    wrapper.style.height = availableHeight + 'px';
                    wrapper.style.maxHeight = availableHeight + 'px';
                    
                    const windowWidth = calculateWindowWidth();
                    wrapper.style.width = windowWidth + 'px';
                    
                    // Update minimap content positions
                    const minimapContent = document.getElementById('minimap-content');
                    const visibleHighlight = document.getElementById('minimap-visible-highlight');
                    const wordRects = minimap._wordRects;
                    if (minimapContent && visibleHighlight && wordRects) {
                        updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                    }
                    
                    // Show wrapper (which contains both minimap and root panel)
                    wrapper.style.display = 'flex';
                    
                    // Show and position three new root panels below highlighted roots panel
                    if (topRootsPanel) topRootsPanel.style.display = 'block';
                    if (selectiveRootsPanel) selectiveRootsPanel.style.display = 'block';
                    if (thirdRootsPanel) thirdRootsPanel.style.display = 'block';
                    positionRootPanels();
                } else {
                    // Fallback: show individual panels
                    minimap.style.display = 'block';
                    rootPanel.style.display = 'block';
                }
            }
            // toggleBtn.textContent = 'پنهان کردن نقشه';
        }
    }

    // Function to update visible area highlight
    function updateVisibleHighlight() {
        if (!visibleHighlight || !minimap) return;
        
        // Use stored values from minimap object (which get updated on resize)
        const currentScaleFactor = minimap._scaleFactor || scaleFactor;
        const currentMinTop = minimap._minTop || minTop;
        const currentContentHeight = minimap._contentHeight || contentHeight;
        const currentAvailableWidth = minimap._availableWidth || availableWidth;
        const currentScaledHeight = currentContentHeight * currentScaleFactor;
        const currentScaledContentWidth = minimap._contentWidth * currentScaleFactor;

        let surahHeader = getSurahHeader();
        const surahHeaderHeight = surahHeader ? surahHeader.offsetHeight : 0;
        // console.log('surahHeaderHeight: ', surahHeaderHeight);

        
        // In mobile mode, use the content wrapper's scroll position
        let scrollTop, viewportHeight, viewportBottom;
        if (isMobileMode && mobileContentWrapper) {
            const wrapperScrollTop = mobileContentWrapper.scrollTop - (surahHeader ? surahHeader.offsetHeight + surahHeaderHeight : 0) || 0;
            // console.log('wrapperScrollTop: ', mobileContentWrapper.scrollTop, 'surahHeaderHeight: ', surahHeaderHeight);
            viewportHeight = mobileContentWrapper.clientHeight;
            
            // Find the first word element to calculate the offset
            if (minimap._wordRects && minimap._wordRects.length > 0) {
                const firstWordElement = minimap._wordRects[0].element;
                if (firstWordElement && mobileContentWrapper.contains(firstWordElement)) {
                    // Get current positions
                    const wrapperRect = mobileContentWrapper.getBoundingClientRect();
                    const firstWordRect = firstWordElement.getBoundingClientRect();
                    
                    // Calculate the offset of the first word from the wrapper top
                    // When scrollTop = 0, this offset tells us where content starts
                    const currentOffset = firstWordRect.top - wrapperRect.top;
                    
                    // The first word's document position is currentMinTop
                    // When wrapper scrolls by wrapperScrollTop, the visible content in document coordinates
                    // starts at: currentMinTop + (wrapperScrollTop - initialOffset)
                    // But we need to find the initial offset
                    // When scrollTop = 0, firstWordRect.top - wrapperRect.top = initialOffset
                    // So: scrollTop = currentMinTop + wrapperScrollTop - currentOffset
                    // But that's not quite right either...
                    
                    // Simpler: The wrapper scrollTop tells us how much content we've scrolled
                    // The first word is at currentMinTop in document coordinates
                    // When we scroll the wrapper, we're scrolling the content
                    // So visible area starts at: currentMinTop + wrapperScrollTop
                    scrollTop = currentMinTop + wrapperScrollTop;
                } else {
                    // Fallback: use wrapper scroll + minTop
                    scrollTop = currentMinTop + wrapperScrollTop;
                }
            } else {
                scrollTop = currentMinTop + wrapperScrollTop;
            }
            viewportBottom = scrollTop + viewportHeight;
        } else {
            scrollTop = window.scrollY || window.pageYOffset || 0;
            viewportHeight = window.innerHeight;
            viewportBottom = scrollTop + viewportHeight;
        }
        const extraSpace = minimap._extraSpace || 5;
        
        // Calculate visible area position in minimap using the current scale factor
        // The viewport shows content from scrollTop to viewportBottom
        // In minimap coordinates, this maps to:
        const visibleTop = Math.max(0, (scrollTop - currentMinTop) * currentScaleFactor);
        const visibleBottom = Math.min(currentScaledHeight, (viewportBottom - currentMinTop) * currentScaleFactor);
        const visibleHeight = Math.max(10, visibleBottom - visibleTop);
        
        // Width should match the scaled content width
        // This ensures the highlight aligns with the words
        const visibleLeft = 0; // Start from left edge of minimapContent
        const visibleWidth = Math.min(currentScaledContentWidth + extraSpace, (currentAvailableWidth + extraSpace)); // Match the actual content width, don't exceed availableWidth
        
        // Update white rectangle overlay
        visibleHighlight.style.top = visibleTop + 'px';
        visibleHighlight.style.left = (visibleLeft) + 'px';
        visibleHighlight.style.width = visibleWidth + 'px';
        visibleHighlight.style.height = visibleHeight + 'px';
    }


    // Update minimap content - calculate positions and sizes of boxes
    function updateMinimap(minimap, minimapContent, wordRects, visibleHighlight) {
        // Get stored values
        const minTop = minimap._minTop;
        const minLeft = minimap._minLeft;
        const contentWidth = minimap._contentWidth;
        const contentHeight = minimap._contentHeight;
        const extraSpace = minimap._extraSpace || 5;
        
        // Calculate new scaling factors based on available width.
        // In desktop host mode, the minimap width is controlled by CSS, so read it.
        let minimapWindowWidth;
        let containerPadding;
        if (IS_DESKTOP_HOST) {
            const rect = minimap.getBoundingClientRect();
            minimapWindowWidth = rect.width || minimap.clientWidth || window.innerWidth;
            const cs = window.getComputedStyle(minimap);
            const pl = parseFloat(cs.paddingLeft) || 0;
            const pr = parseFloat(cs.paddingRight) || 0;
            containerPadding = pl + pr;
        } else if (isMobileMode && minimap.parentElement && minimap.parentElement.id === 'mobile-bottom-row') {
            minimapWindowWidth = calculateWindowWidthForMobile();
            containerPadding = 12; // 6px padding on each side
        } else {
            minimapWindowWidth = calculateWindowWidth();
            containerPadding = 12; // 6px padding on each side
        }

        const availableWidth = Math.max(0, minimapWindowWidth - containerPadding - extraSpace); // Content area width
        
        // In mobile mode, also consider the available height for scaling
        let availableHeightForScaling = 400; // Default
        if (isMobileMode && minimap.parentElement && minimap.parentElement.id === 'mobile-bottom-row') {
            const bottomRowHeight = 120;
            const bottomRowPadding = 5;
            availableHeightForScaling = bottomRowHeight - (bottomRowPadding * 2) - containerPadding;
        }
        
        // Calculate scale factors to fit in minimap
        // In mobile mode, use the available height from bottom row; otherwise use default
        const scaleY = Math.max(0.3, (availableHeightForScaling - 20) / contentHeight); // max-height minus some padding
        const scaleX = availableWidth / contentWidth; // Scale to fit in content area
        const scaleFactor = Math.min(scaleX, scaleY); // Use smaller scale to ensure fit

        const _c = document.createElement("canvas");
        const _ctx = _c.getContext("2d");
      
        function textWidthPx(text, { fontSize = 16, fontFamily = "Arial", fontWeight = "normal", fontStyle = "normal" } = {}) {
          _ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
          const metrics = _ctx.measureText(String(text));
          // Calculate height from bounding box metrics
          // Use actualBoundingBox if available, otherwise fall back to fontBoundingBox
          const height = (metrics.actualBoundingBoxAscent || metrics.fontBoundingBoxAscent || 0) + 
                         (metrics.actualBoundingBoxDescent || metrics.fontBoundingBoxDescent || 0);
          return [metrics.width, height];
        }

        let ayeNumberFontSize = null;
        
        // Update existing divs - reposition and resize them
        wordRects.forEach((wordRect, index) => {
            // Check if we need to update ayah number
            if (index == wordRects.length - 1 || (wordRect.ayah !== wordRects[index + 1].ayah)) {
                // Find existing ayah number div
                const ayahDiv = minimapContent.querySelector(
                    `.minimap-word[data-ayah="${wordRect.ayah}"][data-word-index="number"][data-is-ayah-number="true"]`
                );
                if (ayahDiv) {
                    const ayahText = String(wordRect.ayah);
                    const height = Math.max(1, wordRect.height * scaleFactor);
                    
                    if (ayeNumberFontSize === null) {
                        ayeNumberFontSize = 8;
                        let [measuredWidth, measuredHeight] = textWidthPx(ayahText, { fontSize: ayeNumberFontSize, fontFamily: "Arial", fontWeight: "bold", fontStyle: "normal" });
                        // console.log('measuredHeight: ', measuredHeight, 'height: ', height);
                        while (measuredHeight > height && ayeNumberFontSize > 1) {
                            ayeNumberFontSize--;
                            [measuredWidth, measuredHeight] = textWidthPx(ayahText, { fontSize: ayeNumberFontSize, fontFamily: "Arial", fontWeight: "bold", fontStyle: "normal" });
                        }
                        // console.log('ayeNumberFontSize: ', ayeNumberFontSize);
                    }
                    const fontSize = ayeNumberFontSize;
                    const [measuredWidth, measuredHeight] = textWidthPx(ayahText, { fontSize: fontSize, fontFamily: "Arial", fontWeight: "bold", fontStyle: "normal" });

                    const top = (wordRect.top - minTop) * scaleFactor;
                    let left = (wordRect.left - minLeft) * scaleFactor - measuredWidth;
                    let width = measuredWidth;
                    
                    ayahDiv.style.top = top + 'px';
                    ayahDiv.style.left = (left + extraSpace) + 'px';
                    ayahDiv.style.width = width + 'px';
                    ayahDiv.style.height = height + 'px';
                    ayahDiv.style.lineHeight = height + 'px';
                    ayahDiv.style.fontSize = fontSize + 'px';
                }
            }

            // Update existing word div
            const wordDivs = minimapContent.querySelectorAll(
                `.minimap-word[data-ayah="${wordRect.ayah}"][data-word-index="${wordRect.wordIndex}"]:not([data-is-ayah-number])`
            );
            wordDivs.forEach((wordDiv) => {
                const top = (wordRect.top - minTop) * scaleFactor;
                let left = (wordRect.left - minLeft) * scaleFactor;
                let width = Math.max(1, wordRect.width * scaleFactor);
                const height = Math.max(1, wordRect.height * scaleFactor);
                
                // Ensure words don't exceed the minimapContent width
                const maxRight = availableWidth;
                if (left + width > maxRight) {
                    width = Math.max(1, maxRight - left);
                }
                
                wordDiv.style.top = top + 'px';
                wordDiv.style.left = (left + extraSpace) + 'px';
                wordDiv.style.width = width + 'px';
                wordDiv.style.height = height + 'px';
            });
        });
        
        // Update minimap content height and width based on scaled content
        const scaledHeight = contentHeight * scaleFactor;
        minimapContent.style.height = scaledHeight + 'px';
        minimapContent.style.width = (availableWidth + extraSpace) + 'px';
        if (!IS_DESKTOP_HOST) {
            minimap.style.width = (minimapWindowWidth) + 'px';
        }
        
        // Update stored values
        minimap._scaleFactor = scaleFactor;
        minimap._availableWidth = availableWidth;
        // updateVisibleHighlight();
    }

    function calculateWordRects() {
        // Try to find sure element, fallback to body
        let sureElement = document.querySelector('sure');
        if (!sureElement) {
            sureElement = document.body;
        }
        if (!sureElement) return;
        
        // Get all words and ayah markers from sure element
        const allWords = sureElement.querySelectorAll('.morph-word');
        const allAyahs = sureElement.querySelectorAll('sup');
        const wordRects = [];
        const ayahMarkers = [];
        let currentLineTop = null;
        let lineBreak = false;
        
        // Collect ayah positions
        allAyahs.forEach((sup, index) => {
            const ayahNum = getAyahNumberFromSup(sup);
            if (ayahNum) {
                const rect = sup.getBoundingClientRect();
                const scrollY = window.scrollY || window.pageYOffset || 0;
                const scrollX = window.scrollX || window.pageXOffset || 0;
                
                ayahMarkers.push({
                    element: sup,
                    ayah: ayahNum,
                    top: rect.top + scrollY,
                    bottom: rect.bottom + scrollY,
                    left: rect.left + scrollX,
                    right: rect.right + scrollX,
                    height: rect.height,
                    width: rect.width, 
                    index: index
                });
            }
        });
        
        // First pass: collect word positions and detect lines
        allWords.forEach((word, index) => {
            const rect = word.getBoundingClientRect();
            const scrollY = window.scrollY || window.pageYOffset || 0;
            const scrollX = window.scrollX || window.pageXOffset || 0;
            
            const wordTop = rect.top + scrollY;
            const wordBottom = rect.bottom + scrollY;
            
            // Get ayah number for this word
            const wordAyah = parseInt(word.getAttribute('data-ayah'));
            
            // Detect line breaks (significant vertical change)
            if (currentLineTop === null) {
                currentLineTop = wordTop;
            } else if (Math.abs(wordTop - currentLineTop) > rect.height * 0.5) {
                lineBreak = true;
                currentLineTop = wordTop;
            } else {
                lineBreak = false;
            }
            
            const wordIndex = parseInt(word.getAttribute('data-word-index'));
            wordRects.push({
                element: word,
                top: wordTop,
                bottom: wordBottom,
                left: rect.left + scrollX,
                right: rect.right + scrollX,
                height: rect.height,
                width: rect.width,
                lineBreak: lineBreak,
                index: index,
                ayah: wordAyah,
                wordIndex: wordIndex,
                index: index
            });
        });

        return wordRects;
    }

    // Create or get the combined panel wrapper (desktop mode only)
    function createCombinedPanelWrapper() {
        // Only create wrapper in desktop mode
        if (isMobileMode) return null;
        
        let wrapper = document.getElementById('morphology-combined-panel');
        if (wrapper) return wrapper;
        
        // Calculate position below the surah header
        const surahHeader = getSurahHeader();
        let topPosition = 10;
        if (surahHeader) {
            const rect = surahHeader.getBoundingClientRect();
            // Use viewport-relative position (getBoundingClientRect is already viewport-relative)
            // If header is visible in viewport, position below it
            if (rect.bottom > 0 && rect.bottom < window.innerHeight) {
                topPosition = rect.bottom + 10;
            } else if (rect.bottom <= 0) {
                // Header is scrolled above viewport - use document position
                const scrollY = window.scrollY || window.pageYOffset || 0;
                const headerBottom = rect.bottom + scrollY + surahHeader.offsetHeight;
                // For fixed positioning, we need viewport position, so use current scroll position
                // If header is above viewport, position at top with some margin
                topPosition = 10;
            } else {
                // Header is below viewport - position at top
                topPosition = 10;
            }
            // Ensure minimum top position
            topPosition = Math.max(10, topPosition);
        }
        
        const windowWidth = calculateWindowWidth();
        const viewportHeight = window.innerHeight;
        // Ensure availableHeight doesn't exceed viewport and is positive
        // Leave 20px margin at bottom, but ensure minimum height of 200px
        const availableHeight = Math.max(200, Math.min(viewportHeight - topPosition - 20, viewportHeight - 30));
        
        wrapper = document.createElement('div');
        wrapper.id = 'morphology-combined-panel';
        wrapper.style.cssText = `
            position: fixed;
            top: ${topPosition}px;
            left: 10px;
            width: ${windowWidth}px;
            height: ${availableHeight}px;
            max-height: ${availableHeight}px;
            background: transparent;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        `;
        
        document.body.appendChild(wrapper);
        return wrapper;
    }
    
    // Create minimap showing all words as small rectangles
    function createMinimap() {
        // Remove existing minimap if it exists
        const existingMinimap = document.getElementById('morphology-minimap');
        const existingRootPanel = document.getElementById('highlighted-roots-panel');
        const existingWrapper = document.getElementById('morphology-combined-panel');
        let wasMinimapVisible = false;
        let wasRootPanelVisible = false;
        if (existingMinimap) {
            wasMinimapVisible = existingMinimap.style.display !== 'none' && existingMinimap.style.display !== '';
            existingMinimap.remove();
        }
        if (existingRootPanel) {
            wasRootPanelVisible = existingRootPanel.style.display !== 'none' && existingRootPanel.style.display !== '';
        }
        // Remove wrapper if it exists (will be recreated)
        if (existingWrapper && !isMobileMode) {
            existingWrapper.remove();
        }

        let wordRects = calculateWordRects();
        
        // Create minimap container
        minimap = document.createElement('div');
        minimap.id = 'morphology-minimap';
        // Calculate position below the first div (surah header)
        const surahHeader = getSurahHeader();
        let topPosition = 10;
        if (surahHeader) {
            const rect = surahHeader.getBoundingClientRect();
            const scrollY = window.scrollY || window.pageYOffset || 0;
            topPosition = rect.bottom + scrollY + 10;
            // // Use absolute position (rect.top + scrollY) to get document position
            // // But for fixed positioning, we need viewport position, so use rect.bottom directly
            // const headerBottom = rect.bottom;
            // // Ensure it's within viewport bounds
            // if (headerBottom > 0 && headerBottom < window.innerHeight) {
            //     topPosition = headerBottom + 10; // Position 10px below the header
            // } else if (headerBottom <= 0) {
            //     // Header is above viewport, position at top
            //     topPosition = 10;
            // } else {
            //     // Header is below viewport, position at top
            //     topPosition = 10;
            // }
            // console.log('topPosition: ', topPosition, 'scrollY: ', scrollY, 'rect.bottom: ', rect.bottom, surahHeader.getBoundingClientRect(), surahHeader);
        }
        
        // Calculate responsive width and max height
        const windowWidth = calculateWindowWidth();
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - topPosition - 20; // Leave 20px margin at bottom
        const maxHeight = Math.min(300, Math.floor(availableHeight / 2) - 15); // Half for each, minus spacing

        // Create or get wrapper for desktop mode
        const wrapper = createCombinedPanelWrapper();

        minimap.style.cssText = `
            ${wrapper ? 'position: relative;' : 'position: fixed;'}
            ${wrapper ? '' : `top: ${topPosition}px;`}
            ${wrapper ? '' : 'left: 10px;'}
            width: ${windowWidth}px;
            ${wrapper ? 'flex: 0 0 50%;' : `max-height: ${maxHeight}px; height: auto;`}
            ${wrapper ? 'height: 50%;' : ''}
            ${wrapper ? 'min-height: 0;' : ''}
            background: #e3e3e3;
            border: 1px solid #aaa;
            border-radius: 4px;
            padding: 6px;
            z-index: 9999;
            overflow-y: auto;
            overflow-x: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
            direction: rtl;
            font-size: 0;
            line-height: 1.5px;
            box-sizing: border-box;
            display: block;
        `;

        // Create minimap content container
        const minimapContent = document.createElement('div');
        minimapContent.id = 'minimap-content';
        minimapContent.style.cssText = `
            position: relative;
            min-height: 100px;
            word-wrap: break-word;
            overflow-wrap: break-word;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            overflow: hidden;
            cursor: pointer;
        `;

        // console.log(wordRects);

        // Create visible area highlight overlay
        // Note: This must be appended AFTER word divs so it appears on top, OR use higher z-index
        visibleHighlight = document.createElement('div');
        visibleHighlight.id = 'minimap-visible-highlight';
        visibleHighlight.style.cssText = `
            position: absolute;
            background: rgba(255, 255, 255, 0.6);
            border: 1px solid #999;
            pointer-events: none;
            z-index: 2;
            opacity: 0.8;
        `;

        // Calculate scaling factors to create boxes
        const minimapWindowWidth = calculateWindowWidth();
        const containerPadding = 12; // 6px padding on each side
        const extraSpace = 10;
        const availableWidth = minimapWindowWidth - containerPadding - extraSpace; // Content area width
        
        // Calculate document dimensions
        const documentHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight
        );
        const documentWidth = Math.max(
            document.body.scrollWidth,
            document.documentElement.scrollWidth
        );
        
        // Find min/max positions for scaling
        const minTop = wordRects.length > 0 ? Math.min(...wordRects.map(w => w.top)) : 0;
        const maxBottom = wordRects.length > 0 ? Math.max(...wordRects.map(w => w.bottom)) : documentHeight;
        const minLeft = wordRects.length > 0 ? Math.min(...wordRects.map(w => w.left)) : 0;
        const maxRight = wordRects.length > 0 ? Math.max(...wordRects.map(w => w.right)) : documentWidth;
        
        // const minimapOffsetLeft = 15;
        const contentHeight = maxBottom - minTop;
        const contentWidth = (maxRight - minLeft);
        
        // Calculate scale factors to fit in minimap
        const scaleY = Math.max(0.3, (400 - 20) / contentHeight); // max-height minus some padding
        const scaleX = availableWidth / contentWidth; // Scale to fit in content area
        const scaleFactor = Math.min(scaleX, scaleY); // Use smaller scale to ensure fit

        const _c = document.createElement("canvas");
        const _ctx = _c.getContext("2d");
      
        function textWidthPx(text, { fontSize = 16, fontFamily = "Arial", fontWeight = "normal", fontStyle = "normal" } = {}) {
          _ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
          return _ctx.measureText(String(text)).width;
        }
        
        // Create divs for each word - create them once
        wordRects.forEach((wordRect, index) => {
            // Check if we need to add ayah number
            let bg_color = '#ccc';
            if (index == wordRects.length - 1 || (wordRect.ayah !== wordRects[index + 1].ayah)) {
                // Calculate ayah number width based on text measurement (Persian digits)
                const ayahText = faNum(wordRect.ayah);
                const fontSize = 8;
                const measuredWidth = textWidthPx(ayahText, { fontSize: fontSize, fontFamily: "Arial", fontWeight: "bold", fontStyle: "normal" });

                // Create div for ayah number positioned absolutely
                const wordDiv = document.createElement('div');
                wordDiv.className = 'minimap-word';
                wordDiv.setAttribute('data-ayah', wordRect.ayah);
                wordDiv.setAttribute('data-word-index', "number");
                wordDiv.setAttribute('data-is-ayah-number', 'true');
                wordDiv.setAttribute('data-index', wordRect.index);

                // Calculate position and size based on wordRect
                const top = (wordRect.top - minTop) * scaleFactor;
                let left = (wordRect.left - minLeft) * scaleFactor - measuredWidth;
                let width = measuredWidth;
                const height = Math.max(1, wordRect.height * scaleFactor);
                
                wordDiv.style.cssText = `
                    position: absolute;
                    top: ${top}px;
                    left: ${left+extraSpace}px;
                    width: ${width}px;
                    height: ${height}px;
                    font-size: ${fontSize}px;
                    font-family: "Arial", sans-serif;
                    font-style: normal;
                    font-weight: bold;
                    background: rgba(0, 200, 200, 0.5);
                    z-index: 5;
                    text-align: center;
                    line-height: ${Math.max(1, wordRect.height * scaleFactor)}px;
                    direction: rtl;
                    overflow: hidden;
                    white-space: nowrap;
                    box-sizing: border-box;
                    padding: 0px 0px;
                `;
                wordDiv.textContent = ayahText;

                minimapContent.appendChild(wordDiv);
            }

            // Create div for this word positioned absolutely
            const wordDiv = document.createElement('div');
            wordDiv.className = 'minimap-word';
            
            // Calculate position and size based on wordRect
            const top = (wordRect.top - minTop) * scaleFactor;
            let left = (wordRect.left - minLeft) * scaleFactor;
            let width = Math.max(1, wordRect.width * scaleFactor);
            const height = Math.max(1, wordRect.height * scaleFactor);
            
            // Ensure words don't exceed the minimapContent width
            const maxRight = availableWidth;
            if (left + width > maxRight) {
                width = Math.max(1, maxRight - left);
            }
            
            wordDiv.style.cssText = `
                position: absolute;
                top: ${top}px;
                left: ${left+extraSpace}px;
                width: ${width}px;
                height: ${height}px;
                background: ${bg_color};
                z-index: 3;
            `;
            wordDiv.setAttribute('data-ayah', wordRect.ayah);
            wordDiv.setAttribute('data-word-index', wordRect.wordIndex);
            
            minimapContent.appendChild(wordDiv);
        });
        
        // Append visible highlight AFTER all word divs so it appears on top
        minimapContent.appendChild(visibleHighlight);
        
        // Set minimap content height and width based on scaled content
        const scaledHeight = contentHeight * scaleFactor;
        minimapContent.style.height = scaledHeight + 'px';
        minimapContent.style.width = (availableWidth + extraSpace) + 'px';
        
        // Store data for later use
        minimap._wordRects = wordRects;
        minimap._minTop = minTop;
        minimap._minLeft = minLeft;
        minimap._contentWidth = contentWidth;
        minimap._contentHeight = contentHeight;
        minimap._scaleFactor = scaleFactor;
        minimap._availableWidth = availableWidth;
        // minimap._minimapOffsetLeft = minimapOffsetLeft;
        minimap._extraSpace = extraSpace;

        minimap.appendChild(minimapContent);
        
        // Append to wrapper if in desktop mode, otherwise to body
        if (wrapper) {
            wrapper.appendChild(minimap);
        } else {
            document.body.appendChild(minimap);
        }
        
        // Update minimap positions (will be called on resize)
        updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);

        // Minimap words are recreated here; restore active root/search highlights onto new elements.
        Object.keys(highlightedRoots).forEach(function(root) {
            const info = highlightedRoots[root];
            if (info && info.color) applyRootHighlight(root, info.color);
        });
        applySearchItemHighlights(window.sureNumber != null ? Number(window.sureNumber) : null);
        
        // Show root panel if it was visible before
        if (wasRootPanelVisible) {
            const rootPanel = document.getElementById('highlighted-roots-panel');
            if (rootPanel) {
                rootPanel.style.display = 'block';
            }
        }
        
        // Function to recalculate minimap content scale and reposition elements
        // minimap.recalculateScale = function(newAvailableWidth) {
        //     const wordRects = this._wordRects;
        //     const minTop = this._minTop;
        //     const minLeft = this._minLeft;
        //     const contentWidth = this._contentWidth;
        //     const contentHeight = this._contentHeight;
            
        //     // Recalculate scale factors
        //     const scaleY = Math.max(0.3, (400 - 20) / contentHeight);
        //     const scaleX = newAvailableWidth / contentWidth;
        //     const newScaleFactor = Math.min(scaleX, scaleY);
            
        //     const minimapContent = document.getElementById('minimap-content');
        //     if (!minimapContent) return;
            
        //     // Update all word divs using data attributes
        //     wordRects.forEach((wordRect) => {
        //         const wordDiv = minimapContent.querySelector(
        //             `.minimap-word[data-ayah="${wordRect.ayah}"][data-word-index="${wordRect.wordIndex}"]`
        //         );
        //         if (!wordDiv) return;
                
        //         const top = (wordRect.top - minTop) * newScaleFactor;
        //         let left = (wordRect.left - minLeft) * newScaleFactor;
        //         let width = Math.max(1, wordRect.width * newScaleFactor);
        //         const height = Math.max(1, wordRect.height * newScaleFactor);
                
        //         // Ensure words don't exceed the minimapContent width
        //         const maxRight = newAvailableWidth;
        //         if (left + width > maxRight) {
        //             width = Math.max(1, maxRight - left);
        //         }
                
        //         wordDiv.style.top = top + 'px';
        //         wordDiv.style.left = left + 'px';
        //         wordDiv.style.width = width + 'px';
        //         wordDiv.style.height = height + 'px';
        //     });
            
        //     // Update all ayah labels
        //     const ayahLabels = minimapContent.querySelectorAll('[data-ayah-label]');
        //     ayahLabels.forEach((ayahLabel) => {
        //         const ayahNum = parseInt(ayahLabel.getAttribute('data-ayah-num'));
        //         const wordRect = wordRects.find(w => w.ayah === ayahNum);
        //         if (!wordRect) return;
                
        //         const ayahTop = (wordRect.top - minTop) * newScaleFactor;
        //         const ayahHeight = Math.max(1, wordRect.height * newScaleFactor);
        //         const wordLeftScaled = (wordRect.left - minLeft) * newScaleFactor;
                
        //         // Recalculate ayah number width
        //         const ayahText = String(ayahNum);
        //         const fontSize = 8;
        //         const _c = document.createElement("canvas");
        //         const _ctx = _c.getContext("2d");
        //         _ctx.font = `normal bold ${fontSize}px Arial`;
        //         const measuredWidth = _ctx.measureText(ayahText).width;
        //         const ayeNumberWidthScaled = Math.max(measuredWidth + 4, 12);
        //         const ayahLeft = Math.max(0, wordLeftScaled - ayeNumberWidthScaled);
                
        //         ayahLabel.style.top = ayahTop + 'px';
        //         ayahLabel.style.left = ayahLeft + 'px';
        //         ayahLabel.style.height = ayahHeight + 'px';
        //         ayahLabel.style.width = ayeNumberWidthScaled + 'px';
        //     });
            
        //     // Update minimap content dimensions
        //     const scaledHeight = contentHeight * newScaleFactor;
        //     minimapContent.style.height = scaledHeight + 'px';
        //     minimapContent.style.width = newAvailableWidth + 'px';
            
        //     // Update stored values
        //     this._scaleFactor = newScaleFactor;
        //     this._availableWidth = newAvailableWidth;
            
        //     // Update visible highlight if it exists
        //     if (this.updateHighlight) {
        //         this.updateHighlight();
        //     }
        // };
        
        // Update root list panel position to be below minimap (only if NOT in wrapper)
        // If in wrapper, flexbox handles positioning automatically
        const rootPanelWrapper = document.getElementById('morphology-combined-panel');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        if (rootPanel && !rootPanelWrapper) {
            // Only position separately if not in wrapper (old behavior for backward compatibility)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const windowWidth = calculateWindowWidth();
                    const minimapRect = minimap.getBoundingClientRect();
                    const minimapHeight = minimapRect.height || minimap.offsetHeight || 300;
                    const minimapTop = minimapRect.top;
                    const rootListTop = minimapTop + minimapHeight + 10;
                    
                    // Ensure root panel is within viewport
                    if (rootListTop > 0 && rootListTop < window.innerHeight) {
                        rootPanel.style.top = rootListTop + 'px';
                    } else {
                        // Fallback: position below minimap using topPosition
                        rootPanel.style.top = (topPosition + minimapHeight + 10) + 'px';
                    }
                    
                    rootPanel.style.width = windowWidth + 'px';
                    rootPanel.style.display = 'block'; // Make it visible
                    
                    // Recalculate max-height for root list to allow scrolling
                    const viewportHeight = window.innerHeight;
                    const finalTop = parseFloat(rootPanel.style.top) || rootListTop;
                    const availableHeight = viewportHeight - finalTop - 20; // Leave 20px margin at bottom
                    const rootListMaxHeight = Math.min(400, Math.max(100, availableHeight));
                    rootPanel.style.maxHeight = rootListMaxHeight + 'px';
                });
            });
        } else if (rootPanel && rootPanelWrapper) {
            // If in wrapper, ensure styles are correct (flexbox handles layout)
            rootPanel.style.removeProperty('top');
            rootPanel.style.removeProperty('max-height');
            rootPanel.style.removeProperty('width');
        }

        // Update on scroll/resize (skip in desktop host; desktop.js handles minimap highlight)
        if (!IS_DESKTOP_HOST) {
            let rafPending = false;
            function handleScroll() {
                if (rafPending) return;
                rafPending = true;
                requestAnimationFrame(() => {
                    rafPending = false;
                    updateVisibleHighlight();
                });
            }
            window.addEventListener('scroll', handleScroll, { passive: true });
            window.addEventListener('resize', handleScroll, { passive: true });
        }

        // Click handler to scroll to clicked position (capture phase so it runs before root-panel handlers)
        minimapContent.addEventListener('click', function(e) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            // Ignore if click was not actually on the minimap (e.g. delegated from elsewhere)
            if (!e.target || !minimap.contains(e.target)) return;
            
            // Get click position relative to minimapContent
            // Account for minimap container's scroll position if it's scrollable
            const minimapScrollTop = minimap.scrollTop || 0;
            const rect = minimapContent.getBoundingClientRect();
            const minimapRect = minimap.getBoundingClientRect();
            
            // Calculate click position relative to minimapContent's top-left corner
            // Account for minimap's internal scroll
            const clickX = e.clientX - minimapRect.left - 6; // Subtract container padding (6px)
            const clickY = (e.clientY - minimapRect.top - 6) + minimapScrollTop; // Add minimap scroll offset, subtract padding
            
            // Use stored values from minimap object
            const currentScaleFactor = minimap._scaleFactor || scaleFactor;
            const currentMinTop = minimap._minTop || minTop;
            const currentContentHeight = minimap._contentHeight || contentHeight;
            const currentScaledHeight = currentContentHeight * currentScaleFactor;
            
            // Ensure click is within bounds
            if (clickY < 0 || clickY > currentScaledHeight) return;
            
            // Convert minimap Y position to document scroll position
            // clickY is in minimap coordinates, we need to convert to document coordinates
            // minimapY = (docY - minTop) * scaleFactor
            // Therefore: docY = minTop + (minimapY / scaleFactor)
            const targetScrollTop = currentMinTop + (clickY / currentScaleFactor);
            
            // In mobile mode, scroll the content wrapper; otherwise scroll the window
            if (isMobileMode && mobileContentWrapper) {
                // Center the viewport on the clicked position
                const viewportHeight = mobileContentWrapper.clientHeight;
                const surahHeader = getSurahHeader();
                let headerHeight = 0;
                if (surahHeader) {
                    const rect = surahHeader.getBoundingClientRect();
                    headerHeight = rect.height;
                }
                // Adjust targetScrollTop to account for header
                const adjustedTargetScrollTop = targetScrollTop - headerHeight;
                const centeredScrollTop = adjustedTargetScrollTop - (viewportHeight / 2);
                
                mobileContentWrapper.scrollTo({
                    top: Math.max(0, centeredScrollTop),
                    behavior: 'smooth'
                });
            } else {
                // Center the viewport on the clicked position
                const desktopWrapper = document.getElementById('desktop-content-wrapper');
                if (desktopWrapper) {
                    const viewportHeight = desktopWrapper.clientHeight;
                    const centeredScrollTop = targetScrollTop - (viewportHeight / 2);
                    desktopWrapper.scrollTo({
                        top: Math.max(0, centeredScrollTop),
                        behavior: 'smooth'
                    });
                } else {
                    const viewportHeight = window.innerHeight;
                    const centeredScrollTop = targetScrollTop - (viewportHeight / 2);
                    window.scrollTo({
                        top: Math.max(0, centeredScrollTop),
                        behavior: 'smooth'
                    });
                }
            }
            
            // The scroll event will trigger updateVisibleHighlight automatically
        }, true);

        // Initial update
        updateVisibleHighlight();

        // Store references for cleanup if needed
        minimap.wordRects = wordRects;
        minimap.updateHighlight = updateVisibleHighlight;
        // Expose a relayout hook so desktop.js can force recomputation after its own layout settles
        minimap.forceRelayout = recomputeMinimapGeometry;
    }

    // Add CSS for word hover effect and minimap
    function addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .morph-word {
                cursor: help;
                transition: background-color 0.2s;
            }
            .morph-word:hover {
                background-color: rgba(255, 255, 0, 0.3);
            }
            .morph-word-highlighted {
                background-color: rgba(255, 255, 0, 0.5) !important;
            }
            .morph-word.search-region-highlight {
                padding: 0;
                margin-inline: 0;
            }
            /* RTL: first word = start of phrase (right); last = end (left). Round outer edges for band effect. */
            .morph-word.search-region-first {
                border-radius: 0 4px 4px 0;
            }
            .morph-word.search-region-last {
                border-radius: 4px 0 0 4px;
            }
            .morph-word.search-region-middle {
                border-radius: 0;
            }
            .minimap-word {
                transition: background-color 0.1s;
            }
            .minimap-word-visible {
                background-color: rgba(100, 150, 255, 0.6) !important;
            }
            #morphology-minimap::-webkit-scrollbar {
                width: 4px;
            }
            #morphology-minimap::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            #morphology-minimap::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    // Initialize when DOM is ready
    function init(sureNumber) {
        if (typeof console !== 'undefined' && console.log) console.log('[morph-hover] init sura', sureNumber);
        addStyles();
        if (IS_DESKTOP_HOST && !window._searchEmbedMessageListenerAdded) {
            window._searchEmbedMessageListenerAdded = true;
            window.__getSelectedSearchItemStats = function(index) {
                return selectedSearchItems[index] ? selectedSearchItems[index].stats : null;
            };
            window.__getSelectedSearchItemDetails = function(index) {
                return selectedSearchItems[index] ? selectedSearchItems[index].searchDetails : null;
            };
            window.__getSelectedSearchItemEntry = function(index) {
                return selectedSearchItems[index] || null;
            };
            window.addEventListener('message', function(e) {
                if (e.data && e.data.type === 'addSearchItem' && e.data.display != null) {
                    if (typeof console !== 'undefined' && console.log) {
                        console.log('[morph-hover] addSearchItem received, regions:', Array.isArray(e.data.regions) ? e.data.regions.length : 0);
                    }
                    addSearchItemToSelected(e.data);
                    closeSearchModal();
                }
            });
        }
        // Make sura header clickable
        makeSuraHeaderClickable();
        
        // Create toggle button
        createToggleButton();
        
        // First, wrap words with ayah and word index attributes
        wrapWordsInSpans();
        
        // Create minimap after words are wrapped
        // setTimeout(() => {
            createMinimap();
        // }, 100);
        
        // Then load morphology data and add it to words
        loadMorphologyData(sureNumber).then(() => {
            if (dataLoaded) {
                // Add morphology data attributes to words based on their ayah and word index
                // addMorphologyDataToWords();
                // Attach hover listeners
                attachHoverListeners();
                // Create highlighted roots panel
                createHighlightedRootsPanel();
                // Debug: pre-add a search item to test region highlighting (re-enable to use)
                // if (typeof IS_DESKTOP_HOST !== 'undefined' && IS_DESKTOP_HOST && !window._debugSearchItemAdded) {
                //     window._debugSearchItemAdded = true;
                //     selectedSearchItems.push({
                //         display: 'قوم+ملک C5',
                //         items: [],
                //         itemCheckedState: [],
                //         distance: 5,
                //         crossSura: false,
                //         stats: null,
                //         searchDetails: null,
                //         regions: [{
                //             sura: sureNumber,
                //             startAyah: 1,
                //             endAyah: 1,
                //             matches: [
                //                 { sura: sureNumber, ayah: 1, wordIndex: 1 },
                //                 { sura: sureNumber, ayah: 1, wordIndex: 6 }
                //             ]
                //         }]
                //     });
                // }
                updateHighlightedRootsPanel();
                applySearchItemHighlights(sureNumber);
                
                // Load and store root frequency data for current sura
                loadRootsFreqData().then((data) => {
                    if (data && data.suras && data.suras[sureNumber]) {
                        const suraData = data.suras[sureNumber];
                        
                        // Store roots data for use in updateHighlightedRootsPanel
                        currentSuraTopRoots = suraData.top_roots || null;
                        currentSuraDistinctiveRoots = suraData.distinctive_roots || null;
                        currentSuraHighKlRoots = suraData.high_kl_roots || null;
                        currentSuraN2NRoots = suraData.n2_N_roots || null;
                        
                        // Update the panel to include these sections
                        updateHighlightedRootsPanel();
                    }
                });
                
                // Add resize event listener to update minimap (skip in desktop host; desktop.js manages sizing)
                if (!IS_DESKTOP_HOST) {
                    let rafPending = false;
                    window.addEventListener('resize', function() {
                        if (rafPending) return;
                        rafPending = true;
                        requestAnimationFrame(function() {
                            rafPending = false;
                        // In mobile mode, update minimap content but keep positioning
                        if (isMobileMode) {
                            const minimap = document.getElementById('morphology-minimap');
                            if (minimap) {
                                const minimapContent = document.getElementById('minimap-content');
                                const visibleHighlight = document.getElementById('minimap-visible-highlight');
                                const wordRects = minimap._wordRects;
                                if (minimapContent && visibleHighlight && wordRects) {
                                    const windowWidth = calculateWindowWidthForMobile();
                                    minimap.style.width = windowWidth + 'px';
                                    minimap.style.flex = `0 0 ${windowWidth}px`;
                                    minimap.style.maxWidth = `${windowWidth}px`;
                                    minimap._availableWidth = windowWidth;
                                    updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                                }
                            }
                            return;
                        }
                        
                        // In desktop mode, update wrapper container (which contains both panels)
                        const wrapper = document.getElementById('morphology-combined-panel');
                        const minimap = document.getElementById('morphology-minimap');
                        const rootPanel = document.getElementById('highlighted-roots-panel');
                        const wasWrapperVisible = wrapper && wrapper.style.display !== 'none' && wrapper.style.display !== '';
                        
                        if (wasWrapperVisible && wrapper) {
                            // Update wrapper position and size
                            const surahHeader = getSurahHeader();
                            let topPosition = 10;
                            if (surahHeader) {
                                const rect = surahHeader.getBoundingClientRect();
                                // Use viewport-relative position (getBoundingClientRect is already viewport-relative)
                                // If header is visible in viewport (even partially), position below it
                                if (rect.bottom > 0 && rect.bottom < window.innerHeight) {
                                    topPosition = rect.bottom + 10;
                                } else {
                                    // Header is scrolled off-screen - use minimum position
                                    topPosition = 10;
                                }
                                // Ensure minimum top position
                                topPosition = Math.max(10, topPosition);
                            }
                            
                            const windowWidth = calculateWindowWidth();
                            const viewportHeight = window.innerHeight;
                            // Ensure availableHeight doesn't exceed viewport and is positive
                            const availableHeight = Math.max(200, Math.min(viewportHeight - topPosition - 20, viewportHeight - 30));
                            
                            // Update wrapper dimensions - flexbox will handle the 50/50 split automatically
                            wrapper.style.top = topPosition + 'px';
                            wrapper.style.width = windowWidth + 'px';
                            wrapper.style.height = availableHeight + 'px';
                            wrapper.style.maxHeight = availableHeight + 'px';
                            
                            // Update minimap width to match wrapper (height is handled by flex: 0 0 50%)
                            if (minimap) {
                                minimap.style.width = windowWidth + 'px';
                                
                                // Update minimap content
                                const minimapContent = document.getElementById('minimap-content');
                                const visibleHighlight = document.getElementById('minimap-visible-highlight');
                                const wordRects = minimap._wordRects;
                                if (minimapContent && visibleHighlight && wordRects) {
                                    updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                                }
                            }
                            
                            // Update root panel width to match wrapper (height is handled by flex: 0 0 50%)
                            if (rootPanel) {
                                rootPanel.style.width = windowWidth + 'px';
                            }
                        } else if (minimap && !wrapper) {
                            // Fallback: old behavior if wrapper doesn't exist (shouldn't happen in desktop mode)
                            const minimapContent = document.getElementById('minimap-content');
                            const visibleHighlight = document.getElementById('minimap-visible-highlight');
                            const wordRects = minimap._wordRects;
                            if (minimapContent && visibleHighlight && wordRects) {
                                updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                            }
                        }
                        });
                    });
                }
            }
        });
    }

    // Run when DOM is loaded
    // sureNumber: from window (desktop) or inline script (standalone), else from path e.g. /Yasir/036_... -> 36
    const sureNum = window.sureNumber != null ? window.sureNumber : (parseInt((window.location.pathname || '').match(/(\d+)_/)?.[1], 10) || 1);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            init(sureNum);
        });
    } else {
        init(sureNum);
    }
})();

