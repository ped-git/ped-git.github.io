// Buckwalter to Arabic conversion
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

// Convert Buckwalter transliteration to Arabic
function convertBuckwalterToArabic(text) {
    if (!text) return '';
    
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        // Convert character
        if (buckwalterToArabic[char] !== undefined && buckwalterToArabic[char] !== '') {
            result += buckwalterToArabic[char];
        } else if (buckwalterToArabic[char] === '') {
            // Skip characters mapped to empty string
            continue;
        } else {
            // Keep unknown characters as-is (might already be Arabic)
            result += char;
        }
    }
    return result;
}

// Convert Arabic to Buckwalter transliteration
function convertArabicToBuckwalter(text) {
    if (!text) return '';
    
    let result = '';
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const bwChar = arabicToBuckwalter[char];
        result += bwChar || char;
    }
    return result;
}
