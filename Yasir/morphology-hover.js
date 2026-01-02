// Morphology Hover Tooltip Script for Surah Noor
// This script loads morphology data and displays root and lemma on word hover

const morphologyData = {};
(function() {
    'use strict';

    // Morphology data structure: {ayah: {wordIndex: {root, lemma}}}
    let dataLoaded = false;
    
    // Root to words map: {root: [{ayah, wordIndex}, ...]}
    const rootToWordsMap = {};
    
    // Highlighted roots: {root: {colorIndex, color}}
    const highlightedRoots = {};
    let nextColorIndex = 1;
    
    // Currently searched root and selected word
    let currentSearchedRoot = null;
    let currentSelectedWord = null; // {ayah, wordIndex}
    
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
            
            // Build root-to-words map
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
            const response = await fetch('../data/quranic-corpus-morphology-0.4.txt');
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
            if (!hasArabic && word.length < 2) {
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
        // This ensures we process all words sequentially, regardless of container boundaries
        processNodeRecursive(document.querySelector('sure'), state);
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

    // Create and show tooltip with morphology data
    function showTooltip(element, ayah, wordIndex) {
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
            position: absolute;
            background: #2c3e50;
            color: white;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            font-family: Arial, sans-serif;
            direction: rtl;
            text-align: right;
            line-height: 1.4;
            max-width: 200px;
        `;

        let content = '';
        if (morphData.root) {
            content += `<div style="margin-bottom: 3px;"><span style="color: #ecf0f1; font-size: 10px;">ریشه:</span> <span style="font-weight: bold;">${morphData.root}</span></div>`;
        }
        if (morphData.root && morphData.lemma) {
            content += '<div style="border-top: 1px solid rgba(255,255,255,0.2); margin: 3px 0; padding-top: 3px;"></div>';
        }
        if (morphData.lemma) {
            content += `<div><span style="color: #ecf0f1; font-size: 10px;">مصدر:</span> <span style="font-weight: bold;">${morphData.lemma}</span></div>`;
        }
        tooltip.innerHTML = content;

        document.body.appendChild(tooltip);

        // Position tooltip near the element
        // getBoundingClientRect() gives viewport coordinates, but we need to add scroll offset
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const scrollX = window.scrollX || window.pageXOffset || 0;
        const scrollY = window.scrollY || window.pageYOffset || 0;
        
        // Calculate position relative to document (add scroll offset)
        let top = rect.top + scrollY - tooltipRect.height - 6;
        let left = rect.left + scrollX + (rect.width / 2) - (tooltipRect.width / 2);

        // Adjust if tooltip goes off screen (viewport check)
        const viewportTop = rect.top - tooltipRect.height - 6;
        if (viewportTop < 0) {
            // Show below instead
            top = rect.bottom + scrollY + 6;
        }
        
        // Check horizontal boundaries
        if (rect.left + (rect.width / 2) - (tooltipRect.width / 2) < 8) {
            left = rect.left + scrollX + 8;
        }
        if (rect.left + scrollX + (rect.width / 2) + (tooltipRect.width / 2) > window.innerWidth - 8) {
            left = rect.left + scrollX + rect.width - tooltipRect.width - 8;
        }

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
        document.addEventListener('mouseover', function(e) {
            if (e.target.classList.contains('morph-word')) {
                // Read ayah and word number from the span
                const ayah = parseInt(e.target.getAttribute('data-ayah'));
                const wordIndex = parseInt(e.target.getAttribute('data-word-index'));
                
                if (ayah && wordIndex) {
                    // Highlight all spans with the same ayah and word index
                    highlightMatchingWords(ayah, wordIndex);
                    
                    // Show tooltip with morphology data
                    showTooltip(e.target, ayah, wordIndex);
                }
            }
        });

        document.addEventListener('mouseout', function(e) {
            if (e.target.classList.contains('morph-word')) {
                // Remove highlights
                removeHighlights();
                // Hide tooltip
                hideTooltip();
            }
        });
        
        // Click handler for root highlighting
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('morph-word')) {
                const ayah = parseInt(e.target.getAttribute('data-ayah'));
                const wordIndex = parseInt(e.target.getAttribute('data-word-index'));
                
                if (ayah && wordIndex && dataLoaded) {
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
    
    // Create panel for showing highlighted roots
    function createHighlightedRootsPanel() {
        // Check if panel already exists
        let panel = document.getElementById('highlighted-roots-panel');
        if (panel) return panel;
        
        // Calculate position - place root panel below minimap (stacked)
        const surahHeader = getSurahHeader();
        let topPosition = 420;
        if (surahHeader) {
            const rect = surahHeader.getBoundingClientRect();
            // Will be positioned below minimap dynamically
            topPosition = rect.bottom + 10;
        }
        
        // Calculate responsive width and max height for root list
        const windowWidth = calculateWindowWidth();
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - topPosition - 20; // Leave 20px margin at bottom
        // Allow root list to use remaining space, but cap at reasonable max
        const rootListMaxHeight = Math.min(400, availableHeight - 10); // Leave 10px margin
        
        panel = document.createElement('div');
        panel.id = 'highlighted-roots-panel';
        panel.style.cssText = `
            position: fixed;
            top: ${topPosition}px;
            left: 10px;
            width: ${windowWidth}px;
            max-height: ${rootListMaxHeight}px;
            background: #f5f5f5;
            border: 1px solid #aaa;
            border-radius: 4px;
            padding: 3px;
            z-index: 9998;
            overflow-y: auto;
            overflow-x: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
            direction: rtl;
            font-family: Arial, sans-serif;
            font-size: 9px;
            box-sizing: border-box;
            display: none;
        `;
        
        const content = document.createElement('div');
        content.id = 'highlighted-roots-content';
        content.style.cssText = 'display: flex; flex-wrap: wrap; gap: 2px;';
        panel.appendChild(content);
        
        document.body.appendChild(panel);
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
                // Normal mode, scroll window
                const scrollY = window.scrollY || window.pageYOffset;
                const targetY = scrollY + rect.top;
                window.scrollTo({ top: targetY, behavior: 'smooth' });
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
        updateHighlightedRootsPanel();
    }
    
    // Update the highlighted roots panel
    function updateHighlightedRootsPanel() {
        const content = document.getElementById('highlighted-roots-content');
        if (!content) return;
        
        const roots = Object.keys(highlightedRoots);
        if (roots.length === 0) {
            content.innerHTML = '<div style="color: #999; font-style: italic; text-align: center; padding: 3px; width: 100%; font-size: 8px;">ریشه‌ای مشخص نشده</div>';
            return;
        }
        
        // Clear existing content
        content.innerHTML = '';
        
        // Add button to unhighlight currently selected word
        const unhighlightBtn = document.createElement('button');
        unhighlightBtn.textContent = 'لغو برجسته‌سازی';
        unhighlightBtn.style.cssText = `
            width: 100%;
            padding: 4px;
            margin-bottom: 4px;
            font-size: 9px;
            cursor: pointer;
            background: #ff8800;
            color: white;
            border: none;
            border-radius: 2px;
            font-family: Arial, sans-serif;
        `;
        unhighlightBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            unhighlightCurrentSelection();
        });
        content.appendChild(unhighlightBtn);
        
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
                selectNextWordForRoot(root, e.shiftKey ? 'previous' : 'next');
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
            rootText.textContent = root;
            rootText.style.cssText = 'font-weight: bold;';
            
            const countText = document.createElement('span');
            countText.textContent = `(${wordCount})`;
            countText.style.cssText = 'color: #666; font-size: 7px;';
            
            rootDiv.appendChild(colorBox);
            rootDiv.appendChild(rootText);
            rootDiv.appendChild(countText);
            content.appendChild(rootDiv);
        });
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
    
    // Mobile mode state
    let isMobileMode = false;
    let mobileContentWrapper = null;
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
        
        toggleBtn.addEventListener('click', toggleMinimapAndRootList);
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
        
        mobileToggleBtn.addEventListener('click', toggleMobileMode);
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
        setTimeout(() => {
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

            const windowWidth = isMobileMode ? calculateWindowWidthForMobile() : calculateWindowWidth();
            minimap.style.width = windowWidth + 'px';
            minimap.style.flex = `0 0 ${windowWidth}px`;
            minimap.style.maxWidth = `${windowWidth}px`;
            minimap._availableWidth = windowWidth;


            updateMinimap(minimap, document.getElementById('minimap-content'), wordRects, document.getElementById('minimap-visible-highlight'));
            updateVisibleHighlight();
        }, 100);
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
            
            // In flex container, use flex-basis with fixed width and let root panel take remaining space
            const fixedWidth = calculateWindowWidth();
            minimap.style.width = `${fixedWidth}px`;
            minimap.style.flex = `0 0 ${fixedWidth}px`; // flex-grow: 0, flex-shrink: 0, flex-basis: fixedWidth
            minimap.style.maxWidth = `${fixedWidth}px`; // Prevent growing beyond fixed width
            minimap.style.height = `${availableHeight}px`;
            minimap.style.maxHeight = `${availableHeight}px`;
            minimap.style.minHeight = `${availableHeight}px`;
            minimap.style.margin = '0';
            minimap.style.display = 'block'; // Ensure it's visible

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
            rootPanel.style.flex = '1 1 auto'; // Take remaining space after minimap
            rootPanel.style.minWidth = '0'; // Allow shrinking if needed
            rootPanel.style.height = `${availableHeight}px`;
            rootPanel.style.maxHeight = `${availableHeight}px`;
            rootPanel.style.minHeight = `${availableHeight}px`;
            rootPanel.style.margin = '0';
            rootPanel.style.display = 'block'; // Ensure it's visible
            
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
                setTimeout(() => {
                    updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                }, 50);
            }
        }
        
        // Add scroll listener to mobile content wrapper
        if (mobileContentWrapper) {
            let scrollTimeout;
            function handleMobileScroll() {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(updateVisibleHighlight, 10);
            }
            mobileContentWrapper.addEventListener('scroll', handleMobileScroll, { passive: true });
        }
    }
    
    // Disable mobile mode: restore original layout
    function disableMobileMode() {
        const body = document.body;
        const bottomRow = document.getElementById('mobile-bottom-row');
        
        // First, extract minimap and root panel from bottom row BEFORE removing it
        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        
        if (bottomRow) {
            // Remove minimap and root panel from bottom row and append to body
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
        
        // Restore minimap and root panel to fixed positioning
        const surahHeader = getSurahHeader();
        
        if (minimap) {
            body.appendChild(minimap);

            minimap.style.position = 'fixed';
            minimap.style.width = calculateWindowWidth() + 'px';
            minimap.style.maxWidth = ''; // Clear maxWidth from mobile mode
            minimap.style.maxHeight = '300px';
            minimap.style.minHeight = '';
            minimap.style.height = 'auto';
            minimap.style.margin = '';
            minimap.style.flexShrink = '';

            let topPosition = 10;
            if (surahHeader) {
                const rect = surahHeader.getBoundingClientRect();
                const scrollY = window.scrollY || window.pageYOffset || 0;
                topPosition = rect.bottom + scrollY + 10;
                // console.log('topPosition: ', topPosition, 'scrollY: ', scrollY, 'rect.bottom: ', rect.bottom, surahHeader.getBoundingClientRect(), surahHeader);
            }
            minimap.style.top = topPosition + 'px';
            minimap.style.left = '10px';
            // error('topPosition: ', topPosition, 'scrollY: ', scrollY, 'rect.bottom: ', rect.bottom, surahHeader.getBoundingClientRect(), surahHeader);
            
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
                setTimeout(() => {
                    updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                }, 50);
            }
        }
        
        if (rootPanel) {
            body.appendChild(rootPanel);
            rootPanel.style.position = 'fixed';
            rootPanel.style.width = calculateWindowWidth() + 'px';
            rootPanel.style.maxHeight = '400px';
            rootPanel.style.minHeight = '';
            rootPanel.style.height = 'auto';
            rootPanel.style.margin = '';
            rootPanel.style.flexShrink = '';
            
            let topPosition = 10;
            if (surahHeader) {
                const rect = surahHeader.getBoundingClientRect();
                topPosition = rect.bottom + 10;
            }
            if (minimap) {
                setTimeout(() => {
                    const minimapHeight = minimap.offsetHeight || 300;
                    rootPanel.style.top = (topPosition + minimapHeight + 10) + 'px';
                }, 50);
            } else {
                rootPanel.style.top = topPosition + 'px';
            }
            rootPanel.style.left = '10px';
            
            // Preserve visibility state
            const wasVisible = rootPanel.style.display !== 'none' && rootPanel.style.display !== '';
            if (!wasVisible) {
                rootPanel.style.display = 'none';
            } else {
                rootPanel.style.display = 'block';
            }
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
        
        if (!minimap || !rootPanel || !toggleBtn) return;
        
        const isVisible = minimap.style.display !== 'none' && minimap.style.display !== '';
        
        if (isVisible) {
            minimap.style.display = 'none';
            rootPanel.style.display = 'none';
            // toggleBtn.textContent = 'نمایش نقشه';
        } else {
            // In mobile mode, just show them (they're already positioned in bottom row)
            if (isMobileMode) {
                minimap.style.display = 'block';
                rootPanel.style.display = 'block';
            } else {
                // Update positions in case the header moved or on first show
                const surahHeader = getSurahHeader();
                if (surahHeader) {
                    const rect = surahHeader.getBoundingClientRect();
                    const topPosition = rect.bottom + 10;
                    const windowWidth = calculateWindowWidth();
                    
                    minimap.style.top = topPosition + 'px';
                    minimap.style.width = windowWidth + 'px';
                    
                    // Show minimap first to calculate its height
                    minimap.style.display = 'block';
                    
                    // Update root panel position below minimap (stacked)
                    setTimeout(() => {
                        const minimapHeight = minimap.offsetHeight || 300;
                        const rootListTop = topPosition + minimapHeight + 10;
                        rootPanel.style.top = rootListTop + 'px';
                        rootPanel.style.left = '10px'; // Same left as minimap
                        rootPanel.style.width = windowWidth + 'px';
                        
                        // Recalculate max-height for root list to allow scrolling
                        const viewportHeight = window.innerHeight;
                        const availableHeight = viewportHeight - rootListTop - 20; // Leave 20px margin at bottom
                        const rootListMaxHeight = Math.min(400, availableHeight);
                        rootPanel.style.maxHeight = rootListMaxHeight + 'px';
                        
                        // Update minimap content positions
                        const minimapContent = document.getElementById('minimap-content');
                        const visibleHighlight = document.getElementById('minimap-visible-highlight');
                        const wordRects = minimap._wordRects;
                        if (minimapContent && visibleHighlight && wordRects) {
                            updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                        }
                        
                        rootPanel.style.display = 'block';
                    }, 10);
                } else {
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
        
        // Calculate new scaling factors based on current window width
        // In mobile mode, use the actual minimap width (50% of bottom row)
        let minimapWindowWidth;
        if (isMobileMode && minimap.parentElement && minimap.parentElement.id === 'mobile-bottom-row') {
            // Get actual width of minimap in mobile mode (50% of bottom row minus gap)
            const bottomRow = minimap.parentElement;
            const bottomRowWidth = bottomRow.offsetWidth || window.innerWidth;
            const gap = 5;
            // minimapWindowWidth = Math.floor((bottomRowWidth - gap) / 2); // Half width minus half gap
            minimapWindowWidth = calculateWindowWidthForMobile();
        } else {
            minimapWindowWidth = calculateWindowWidth();
        }
        const containerPadding = 12; // 6px padding on each side
        const availableWidth = minimapWindowWidth - containerPadding - extraSpace; // Content area width
        
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
        minimap.style.width = (minimapWindowWidth) + 'px';
        
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

    // Create minimap showing all words as small rectangles
    function createMinimap() {
        // Remove existing minimap if it exists
        const existingMinimap = document.getElementById('morphology-minimap');
        const existingRootPanel = document.getElementById('highlighted-roots-panel');
        let wasMinimapVisible = false;
        let wasRootPanelVisible = false;
        if (existingMinimap) {
            wasMinimapVisible = existingMinimap.style.display !== 'none' && existingMinimap.style.display !== '';
            existingMinimap.remove();
        }
        if (existingRootPanel) {
            wasRootPanelVisible = existingRootPanel.style.display !== 'none' && existingRootPanel.style.display !== '';
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


        minimap.style.cssText = `
            position: fixed;
            top: ${topPosition}px;
            left: 10px;
            width: ${windowWidth}px;
            max-height: ${maxHeight}px;
            height: auto;
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
                // Calculate ayah number width based on text measurement
                const ayahText = String(wordRect.ayah);
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
        document.body.appendChild(minimap);
        
        // Update minimap positions (will be called on resize)
        updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
        
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
        
        // Update root list panel position to be below minimap
        // Use requestAnimationFrame to ensure minimap is rendered first
        requestAnimationFrame(() => {
            setTimeout(() => {
                const rootPanel = document.getElementById('highlighted-roots-panel');
                if (rootPanel) {
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
                }
            }, 50);
        });

        // Update on scroll
        let scrollTimeout;
        function handleScroll() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(updateVisibleHighlight, 10);
        }
        
        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleScroll, { passive: true });

        // Click handler to scroll to clicked position
        minimapContent.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent event bubbling
            
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
                // Scroll so that the clicked point is in the middle of the viewport
                const viewportHeight = window.innerHeight;
                const centeredScrollTop = targetScrollTop - (viewportHeight / 2);
                
                // Scroll to the calculated position
                window.scrollTo({
                    top: Math.max(0, centeredScrollTop),
                    behavior: 'smooth'
                });
            }
            
            // The scroll event will trigger updateVisibleHighlight automatically
        });

        // Initial update
        setTimeout(updateVisibleHighlight, 200);

        // Store references for cleanup if needed
        minimap.wordRects = wordRects;
        minimap.updateHighlight = updateVisibleHighlight;
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
        addStyles();
        
        // Create toggle button
        createToggleButton();
        
        // First, wrap words with ayah and word index attributes
        wrapWordsInSpans();
        
        // Create minimap after words are wrapped
        setTimeout(() => {
            createMinimap();
        }, 100);
        
        // Then load morphology data and add it to words
        loadMorphologyData(sureNumber).then(() => {
            if (dataLoaded) {
                // Add morphology data attributes to words based on their ayah and word index
                // addMorphologyDataToWords();
                // Attach hover listeners
                attachHoverListeners();
                // Create highlighted roots panel
                createHighlightedRootsPanel();
                updateHighlightedRootsPanel();
                
                // Add resize event listener to update minimap
                let resizeTimeout;
                window.addEventListener('resize', function() {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(function() {
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
                        
                        // Only update if minimap is visible
                        const minimap = document.getElementById('morphology-minimap');
                        const rootPanel = document.getElementById('highlighted-roots-panel');
                        const wasMinimapVisible = minimap && minimap.style.display !== 'none' && minimap.style.display !== '';
                        const wasRootPanelVisible = rootPanel && rootPanel.style.display !== 'none' && rootPanel.style.display !== '';
                        
                        if (wasMinimapVisible && minimap) {
                            const minimapContent = document.getElementById('minimap-content');
                            const visibleHighlight = document.getElementById('minimap-visible-highlight');
                            const wordRects = minimap._wordRects;
                            if (minimapContent && visibleHighlight && wordRects) {
                                updateMinimap(minimap, minimapContent, wordRects, visibleHighlight);
                            }
                            
                            // Update root panel position after minimap is updated
                            setTimeout(function() {
                                const newMinimap = document.getElementById('morphology-minimap');
                                const newRootPanel = document.getElementById('highlighted-roots-panel');
                                if (newMinimap) {
                                    const surahHeader = getSurahHeader();
                                    const scrollY = window.scrollY || window.pageYOffset || 0;
                                    let minimapBottom = newMinimap.offsetHeight + newMinimap.offsetTop;
                                    // if (surahHeader) {
                                    //     const rect = surahHeader.getBoundingClientRect();
                                    //     topPosition = rect.bottom + 10;
                                    //     console.log('topPosition: ', topPosition, 'rect.bottom: ', rect.bottom, surahHeader.getBoundingClientRect(), surahHeader);
                                    // }
                                    const windowWidth = calculateWindowWidth();

                                    console.log('minimapBottom: ', minimapBottom);
                                    
                                    if (newRootPanel && wasRootPanelVisible) {
                                        const rootListTop = minimapBottom + 10;
                                        newRootPanel.style.top = rootListTop + 'px';
                                        newRootPanel.style.width = windowWidth + 'px';
                                        
                                        const viewportHeight = window.innerHeight;
                                        const availableHeight = viewportHeight - rootListTop - 20;
                                        const rootListMaxHeight = Math.min(400, availableHeight);
                                        newRootPanel.style.maxHeight = rootListMaxHeight + 'px';
                                    }
                                }
                            }, 100);
                        }
                    }, 100); // Debounce resize events
                });
            }
        });
    }

    // Run when DOM is loaded
    // sureNumber should be defined in the HTML before this script
    const sureNum = sureNumber;
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            init(sureNum);
        });
    } else {
        init(sureNum);
    }
})();

