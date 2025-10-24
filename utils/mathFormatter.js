// server/utils/mathFormatter.js - Mathematical notation formatter

/**
 * Converts plain text math to proper Unicode/HTML representation
 */
export function formatMathAnswer(answer) {
    if (!answer) return answer;

    let formatted = answer;

    // Convert common fractions to Unicode
    const fractionMap = {
        '1/2': '½',
        '1/3': '⅓',
        '2/3': '⅔',
        '1/4': '¼',
        '3/4': '¾',
        '1/5': '⅕',
        '2/5': '⅖',
        '3/5': '⅗',
        '4/5': '⅘',
        '1/6': '⅙',
        '5/6': '⅚',
        '1/7': '⅐',
        '1/8': '⅛',
        '3/8': '⅜',
        '5/8': '⅝',
        '7/8': '⅞',
        '1/9': '⅑',
        '1/10': '⅒'
    };

    // Replace common fractions
    Object.keys(fractionMap).forEach(fraction => {
        const regex = new RegExp(fraction.replace('/', '\\/'), 'g');
        formatted = formatted.replace(regex, fractionMap[fraction]);
    });

    // Convert superscripts for powers
    const superscriptMap = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
    };

    // Replace x^2, x^3, etc. with superscripts
    formatted = formatted.replace(/\^(\d)/g, (match, digit) => superscriptMap[digit] || match);

    // Replace x2, x3 (without ^) with superscripts
    formatted = formatted.replace(/x(\d)(?!\d)/g, (match, digit) => 'x' + (superscriptMap[digit] || digit));

    // Ensure integral symbol
    formatted = formatted.replace(/\bintegral\b/gi, '∫');

    // Ensure proper spacing around operators
    formatted = formatted.replace(/([+\-*/])/g, ' $1 ');

    // Remove double spaces
    formatted = formatted.replace(/\s+/g, ' ').trim();

    return formatted;
}

/**
 * Converts fractions like "1/4x⁴" to proper format "(1/4)x⁴"
 */
export function normalizeFractionFormat(expression) {
    if (!expression) return expression;

    // Add parentheses around numerical fractions before variables
    return expression.replace(/(\d+\/\d+)([a-zא-ת])/gi, '($1)$2');
}

/**
 * Compares two mathematical expressions for equivalence
 * Handles different formats: 1/4 vs ¼, x^2 vs x², etc.
 */
export function compareMathExpressions(expr1, expr2) {
    if (!expr1 || !expr2) return false;

    // Normalize both expressions
    const normalize = (expr) => {
        let normalized = expr.toLowerCase().trim();

        // Convert Unicode fractions to numeric
        const unicodeToNumeric = {
            '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4',
            '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
            '⅙': '1/6', '⅚': '5/6', '⅐': '1/7',
            '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
            '⅑': '1/9', '⅒': '1/10'
        };

        Object.keys(unicodeToNumeric).forEach(unicode => {
            normalized = normalized.replace(new RegExp(unicode, 'g'), unicodeToNumeric[unicode]);
        });

        // Convert superscripts to ^ notation
        const superscriptToNormal = {
            '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
            '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9'
        };

        Object.keys(superscriptToNormal).forEach(sup => {
            normalized = normalized.replace(new RegExp(sup, 'g'), '^' + superscriptToNormal[sup]);
        });

        // Remove all spaces
        normalized = normalized.replace(/\s+/g, '');

        // Normalize fraction formats: (1/4) and 1/4 are same
        normalized = normalized.replace(/\(/g, '').replace(/\)/g, '');

        // Sort terms (basic - for additive expressions)
        // This is a simple approach - for complex cases, use a math parser

        return normalized;
    };

    const norm1 = normalize(expr1);
    const norm2 = normalize(expr2);

    return norm1 === norm2;
}

export default {
    formatMathAnswer,
    normalizeFractionFormat,
    compareMathExpressions
};