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
        
        roots.forEach(root => {
            const { colorIndex, color } = highlightedRoots[root];
            const wordCount = rootToWordsMap[root] ? rootToWordsMap[root].length : 0;
            
            const rootDiv = document.createElement('div');
            rootDiv.setAttribute('data-root', root);
            rootDiv.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 2px;
                background: ${color};
                border: 1px solid #ccc;
                border-radius: 2px;
                cursor: pointer;
                padding: 1px 3px;
                font-size: 8px;
                line-height: 1.1;
            `;
            
            // Make entire div clickable
            rootDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                removeRootHighlight(root);
                updateHighlightedRootsPanel();
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
        let header = document.getElementById('surah-header');
        if (header) return header;
        
        // Otherwise, find the first div in body
        const body = document.body;
        if (body) {
            const firstDiv = body.querySelector('div');
            return firstDiv;
        }
        return null;
    }
    
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
        
        // Create button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'toggle-minimap-btn';
        toggleBtn.textContent = 'نمایش نقشه';
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
    
    // Update window sizes and positions on resize
    function updateWindowSizes() {
        const minimap = document.getElementById('morphology-minimap');
        const rootPanel = document.getElementById('highlighted-roots-panel');
        
        if (!minimap || !rootPanel) return;
        
        // Only update if windows are visible
        const isVisible = minimap.style.display !== 'none' && minimap.style.display !== '';
        if (!isVisible) return;
        
        // Get surah header position
        const surahHeader = getSurahHeader();
        let topPosition = 10;
        if (surahHeader) {
            const rect = surahHeader.getBoundingClientRect();
            topPosition = rect.bottom + 10;
        }
        
        // Calculate responsive width
        const windowWidth = calculateWindowWidth();
        
        // Update minimap position, width, and max-height
        const viewportHeight = window.innerHeight;
        const availableHeight = viewportHeight - topPosition - 20;
        const minimapMaxHeight = Math.min(300, Math.floor(availableHeight / 2) - 15);
        
        minimap.style.top = topPosition + 'px';
        minimap.style.width = windowWidth + 'px';
        minimap.style.maxHeight = minimapMaxHeight + 'px';
        
        // Update minimap content width and recalculate scale
        const minimapContent = document.getElementById('minimap-content');
        if (minimapContent && minimap.recalculateScale) {
            const containerPadding = 12;
            const availableWidth = windowWidth - containerPadding;
            minimap.recalculateScale(availableWidth);
        }
        
        // Update root list position, width, and max-height
        setTimeout(() => {
            const minimapHeight = minimap.offsetHeight || 300;
            const rootListTop = topPosition + minimapHeight + 10;
            const rootListMaxHeight = Math.min(400, viewportHeight - rootListTop - 20);
            
            rootPanel.style.top = rootListTop + 'px';
            rootPanel.style.width = windowWidth + 'px';
            rootPanel.style.maxHeight = rootListMaxHeight + 'px';
        }, 10);
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
            toggleBtn.textContent = 'نمایش نقشه';
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
                    
                    // Update minimap content width and recalculate scale
                    const minimapContent = document.getElementById('minimap-content');
                    if (minimapContent && minimap.recalculateScale) {
                        const containerPadding = 12;
                        const availableWidth = windowWidth - containerPadding;
                        minimap.recalculateScale(availableWidth);
                    }
                    
                    rootPanel.style.display = 'block';
                }, 10);
            } else {
                minimap.style.display = 'block';
                rootPanel.style.display = 'block';
            }
            toggleBtn.textContent = 'پنهان کردن نقشه';
        }
    }

    // Create minimap showing all words as small rectangles
    function createMinimap() {
        // Try to find sure element, fallback to body
        let sureElement = document.querySelector('sure');
        if (!sureElement) {
            sureElement = document.body;
        }
        if (!sureElement) return;

        // Create minimap container
        const minimap = document.createElement('div');
        minimap.id = 'morphology-minimap';
        // Calculate position below the first div (surah header)
        const surahHeader = getSurahHeader();
        let topPosition = 10;
        if (surahHeader) {
            const rect = surahHeader.getBoundingClientRect();
            topPosition = rect.bottom + 10; // Position 10px below the header
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
            display: none;
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
                    width: rect.width
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
                wordIndex: wordIndex
            });
        });

        // Calculate scaling factors
        // Use the calculated window width (responsive) instead of offsetWidth which may not be accurate yet
        const minimapWindowWidth = calculateWindowWidth();
        const containerPadding = 12; // 6px padding on each side
        const leftPadding = 0; // No extra padding needed - container already has padding
        const rightPadding = 0; // No extra padding needed - container already has padding
        const availableWidth = minimapWindowWidth - containerPadding; // Content area width
        
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
        
        const contentHeight = maxBottom - minTop;
        const contentWidth = maxRight - minLeft;
        
        // Calculate scale factors to fit in minimap
        // The minimapContent is inside a container with 6px padding
        // We want to scale contentWidth to fit in availableWidth
        const scaleY = Math.max(0.3, (400 - 20) / contentHeight); // max-height minus some padding
        const scaleX = availableWidth / contentWidth; // Scale to fit in 168px content area
        const scaleFactor = Math.min(scaleX, scaleY); // Use smaller scale to ensure fit

        // Create visible area highlight overlay
        // Note: This must be appended AFTER word divs so it appears on top, OR use higher z-index
        const visibleHighlight = document.createElement('div');
        visibleHighlight.id = 'minimap-visible-highlight';
        visibleHighlight.style.cssText = `
            position: absolute;
            background: rgba(255, 255, 255, 0.6);
            border: 1px solid #999;
            pointer-events: none;
            z-index: 2;
            opacity: 0.8;
        `;

        const _c = document.createElement("canvas");
        const _ctx = _c.getContext("2d");
      
        function textWidthPx(text, { fontSize = 16, fontFamily = "Arial", fontWeight = "normal", fontStyle = "normal" } = {}) {
          _ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
          return _ctx.measureText(String(text)).width;
        }

        // Create divs for each word based on their positions
        // let lastWordRect = null;
        
        wordRects.forEach((wordRect, index) => {
            // Check if we need to add ayah number
            if (index == wordRects.length - 1 || (wordRect.ayah !== wordRects[index + 1].ayah)) {
                // Calculate ayah number width based on text measurement
                const ayahText = String(wordRect.ayah);
                const fontSize = 8;
                const measuredWidth = textWidthPx(ayahText, { fontSize: fontSize, fontFamily: "Arial", fontWeight: "bold", fontStyle: "normal" });
                // Add padding (2px on each side) and ensure minimum width
                const ayeNumberWidthPx = Math.max(measuredWidth + 4, 12);
                // Scale the width for minimap
                const ayeNumberWidthScaled = ayeNumberWidthPx;
                
                // Add ayah number
                const ayahLabel = document.createElement('div');
                ayahLabel.setAttribute('data-ayah-label', 'true');
                ayahLabel.setAttribute('data-ayah-num', wordRect.ayah);
                const ayahTop = (wordRect.top - minTop) * scaleFactor;
                const ayahHeight = Math.max(1, wordRect.height * scaleFactor);
                // Calculate left position: position it to the left of the first word of this ayah
                // We need to subtract the scaled width from the word's left position
                const wordLeftScaled = (wordRect.left - minLeft) * scaleFactor;
                const ayahLeft = Math.max(0, wordLeftScaled - ayeNumberWidthScaled);
                
                ayahLabel.style.cssText = `
                    position: absolute;
                    top: ${ayahTop}px;
                    left: ${ayahLeft}px;
                    width: ${ayeNumberWidthScaled}px;
                    font-size: ${fontSize}px;
                    font-family: "Arial", sans-serif;
                    font-style: normal;
                    font-weight: bold;
                    color: #333;
                    text-align: center;
                    line-height: ${ayahHeight}px;
                    width: ${ayeNumberWidthScaled}px;
                    height: ${ayahHeight}px;
                    background: rgba(0, 200, 200, 0.5);
                    direction: rtl;
                    z-index: 5;
                    overflow: hidden;
                    white-space: nowrap;
                    box-sizing: border-box;
                    padding: 0px 0px;
                `;
                ayahLabel.textContent = ayahText;
                minimapContent.appendChild(ayahLabel);
            }

            // Create div for this word positioned absolutely
            const wordDiv = document.createElement('div');
            wordDiv.className = 'minimap-word';
            
            // Calculate position and size based on wordRect
            const top = (wordRect.top - minTop) * scaleFactor;
            // Position words from left edge of minimapContent (which is already inside padded container)
            // This aligns everything from the left, just like the text
            let left = (wordRect.left - minLeft) * scaleFactor;
            let width = Math.max(1, wordRect.width * scaleFactor);
            const height = Math.max(1, wordRect.height * scaleFactor);
            const bg_color = '#ccc';
            
            // Ensure words don't exceed the minimapContent width
            // The rightmost word's right edge should be at availableWidth, leaving space for container's right padding
            const maxRight = availableWidth;
            if (left + width > maxRight) {
                width = Math.max(1, maxRight - left);
            }
            
            wordDiv.style.cssText = `
                position: absolute;
                top: ${top}px;
                left: ${left}px;
                width: ${width}px;
                height: ${height}px;
                background: ${bg_color};
                z-index: 3;
            `;
            wordDiv.setAttribute('data-ayah', wordRect.ayah);
            wordDiv.setAttribute('data-word-index', wordRect.wordIndex);
            
            minimapContent.appendChild(wordDiv);
            // lastWordRect = wordRect;
        });
        
        // Append visible highlight AFTER all word divs so it appears on top
        // (Even though it has higher z-index, appending last ensures proper layering)
        minimapContent.appendChild(visibleHighlight);
        
        // Debug: Check the rightmost word's position
        if (wordRects.length > 0) {
            const rightmostWord = wordRects.reduce((max, w) => w.right > max.right ? w : max);
            const rightmostLeft = (rightmostWord.left - minLeft) * scaleFactor;
            const rightmostWidth = rightmostWord.width * scaleFactor;
            const rightmostRight = rightmostLeft + rightmostWidth;
            console.log('Rightmost word check:', {
                wordRect: { left: rightmostWord.left, right: rightmostWord.right, width: rightmostWord.width },
                scaled: { left: rightmostLeft, width: rightmostWidth, right: rightmostRight },
                expectedRight: availableWidth,
                contentWidth,
                scaleFactor,
                minLeft,
                maxRight
            });
        }
        
        // Set minimap content height and width based on scaled content
        // Width is constrained by container padding
        const scaledHeight = contentHeight * scaleFactor;
        const scaledContentWidth = contentWidth * scaleFactor; // Should equal availableWidth
        // Ensure width is exactly availableWidth to match container's content area
        minimapContent.style.height = scaledHeight + 'px';
        minimapContent.style.width = availableWidth + 'px'; // Use availableWidth to ensure exact fit
        
        // Verify: The rightmost word's right edge should be at leftPadding + contentWidth * scaleFactor
        // Which should equal 180 - rightPadding based on our scale calculation
        // This ensures proper spacing on the right

        minimap.appendChild(minimapContent);
        document.body.appendChild(minimap);
        
        // Store data needed for recalculation on resize
        minimap._wordRects = wordRects;
        minimap._minTop = minTop;
        minimap._minLeft = minLeft;
        minimap._contentWidth = contentWidth;
        minimap._contentHeight = contentHeight;
        minimap._scaleFactor = scaleFactor;
        minimap._availableWidth = availableWidth;
        
        // Function to recalculate minimap content scale and reposition elements
        minimap.recalculateScale = function(newAvailableWidth) {
            const wordRects = this._wordRects;
            const minTop = this._minTop;
            const minLeft = this._minLeft;
            const contentWidth = this._contentWidth;
            const contentHeight = this._contentHeight;
            
            // Recalculate scale factors
            const scaleY = Math.max(0.3, (400 - 20) / contentHeight);
            const scaleX = newAvailableWidth / contentWidth;
            const newScaleFactor = Math.min(scaleX, scaleY);
            
            const minimapContent = document.getElementById('minimap-content');
            if (!minimapContent) return;
            
            // Update all word divs using data attributes
            wordRects.forEach((wordRect) => {
                const wordDiv = minimapContent.querySelector(
                    `.minimap-word[data-ayah="${wordRect.ayah}"][data-word-index="${wordRect.wordIndex}"]`
                );
                if (!wordDiv) return;
                
                const top = (wordRect.top - minTop) * newScaleFactor;
                let left = (wordRect.left - minLeft) * newScaleFactor;
                let width = Math.max(1, wordRect.width * newScaleFactor);
                const height = Math.max(1, wordRect.height * newScaleFactor);
                
                // Ensure words don't exceed the minimapContent width
                const maxRight = newAvailableWidth;
                if (left + width > maxRight) {
                    width = Math.max(1, maxRight - left);
                }
                
                wordDiv.style.top = top + 'px';
                wordDiv.style.left = left + 'px';
                wordDiv.style.width = width + 'px';
                wordDiv.style.height = height + 'px';
            });
            
            // Update all ayah labels
            const ayahLabels = minimapContent.querySelectorAll('[data-ayah-label]');
            ayahLabels.forEach((ayahLabel) => {
                const ayahNum = parseInt(ayahLabel.getAttribute('data-ayah-num'));
                const wordRect = wordRects.find(w => w.ayah === ayahNum);
                if (!wordRect) return;
                
                const ayahTop = (wordRect.top - minTop) * newScaleFactor;
                const ayahHeight = Math.max(1, wordRect.height * newScaleFactor);
                const wordLeftScaled = (wordRect.left - minLeft) * newScaleFactor;
                
                // Recalculate ayah number width
                const ayahText = String(ayahNum);
                const fontSize = 8;
                const _c = document.createElement("canvas");
                const _ctx = _c.getContext("2d");
                _ctx.font = `normal bold ${fontSize}px Arial`;
                const measuredWidth = _ctx.measureText(ayahText).width;
                const ayeNumberWidthScaled = Math.max(measuredWidth + 4, 12);
                const ayahLeft = Math.max(0, wordLeftScaled - ayeNumberWidthScaled);
                
                ayahLabel.style.top = ayahTop + 'px';
                ayahLabel.style.left = ayahLeft + 'px';
                ayahLabel.style.height = ayahHeight + 'px';
                ayahLabel.style.width = ayeNumberWidthScaled + 'px';
            });
            
            // Update minimap content dimensions
            const scaledHeight = contentHeight * newScaleFactor;
            minimapContent.style.height = scaledHeight + 'px';
            minimapContent.style.width = newAvailableWidth + 'px';
            
            // Update stored values
            this._scaleFactor = newScaleFactor;
            this._availableWidth = newAvailableWidth;
            
            // Update visible highlight if it exists
            if (this.updateHighlight) {
                this.updateHighlight();
            }
        };
        
        // Update root list panel position to be below minimap
        setTimeout(() => {
            const rootPanel = document.getElementById('highlighted-roots-panel');
            if (rootPanel) {
                const windowWidth = calculateWindowWidth();
                const minimapHeight = minimap.offsetHeight || 300;
                const rootListTop = topPosition + minimapHeight + 10;
                rootPanel.style.top = rootListTop + 'px';
                rootPanel.style.width = windowWidth + 'px';
                
                // Recalculate max-height for root list to allow scrolling
                const viewportHeight = window.innerHeight;
                const availableHeight = viewportHeight - rootListTop - 20; // Leave 20px margin at bottom
                const rootListMaxHeight = Math.min(400, availableHeight);
                rootPanel.style.maxHeight = rootListMaxHeight + 'px';
            }
        }, 100);

        // Function to update visible area highlight
        function updateVisibleHighlight() {
            // Use stored values from minimap object (which get updated on resize)
            const currentScaleFactor = minimap._scaleFactor || scaleFactor;
            const currentMinTop = minimap._minTop || minTop;
            const currentContentHeight = minimap._contentHeight || contentHeight;
            const currentAvailableWidth = minimap._availableWidth || availableWidth;
            const currentScaledHeight = currentContentHeight * currentScaleFactor;
            const currentScaledContentWidth = minimap._contentWidth * currentScaleFactor;
            
            const scrollTop = window.scrollY || window.pageYOffset || 0;
            const viewportHeight = window.innerHeight;
            const viewportBottom = scrollTop + viewportHeight;
            
            // Calculate visible area position in minimap using the current scale factor
            // The viewport shows content from scrollTop to viewportBottom
            // In minimap coordinates, this maps to:
            const visibleTop = Math.max(0, (scrollTop - currentMinTop) * currentScaleFactor);
            const visibleBottom = Math.min(currentScaledHeight, (viewportBottom - currentMinTop) * currentScaleFactor);
            const visibleHeight = Math.max(10, visibleBottom - visibleTop);
            
            // Width should match the scaled content width
            // This ensures the highlight aligns with the words
            const visibleLeft = 0; // Start from left edge of minimapContent
            const visibleWidth = Math.min(currentScaledContentWidth, currentAvailableWidth); // Match the actual content width, don't exceed availableWidth
            
            // Update white rectangle overlay
            visibleHighlight.style.top = visibleTop + 'px';
            visibleHighlight.style.left = visibleLeft + 'px';
            visibleHighlight.style.width = visibleWidth + 'px';
            visibleHighlight.style.height = visibleHeight + 'px';
        }

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
            
            // Center the viewport on the clicked position
            // Scroll so that the clicked point is in the middle of the viewport
            const viewportHeight = window.innerHeight;
            const centeredScrollTop = targetScrollTop - (viewportHeight / 2);
            
            // Scroll to the calculated position
            window.scrollTo({
                top: Math.max(0, centeredScrollTop),
                behavior: 'smooth'
            });
            
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
                
                // Add resize event listener to update window sizes
                let resizeTimeout;
                window.addEventListener('resize', function() {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(updateWindowSizes, 100); // Debounce resize events
                });
            }
        });
    }

    // Run when DOM is loaded
    // sureNumber should be defined in the HTML before this script
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            const sureNum = sureNumber ; // default to 24 if not defined
            init(sureNum);
        });
    } else {
        const sureNum = sureNumber; // default to 24 if not defined
        init(sureNum);
    }
})();

