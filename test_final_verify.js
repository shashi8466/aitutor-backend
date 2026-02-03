
const extractOptionsFromLine = (text) => {
    const options = [];
    let remainingText = text;
    const optRegex = /(?:^|[\s(])([A-Ja-j])[\s]*[).][\s]*/g;
    const matches = [...text.matchAll(optRegex)];
    if (matches.length > 0) {
        const firstMatch = matches[0];
        remainingText = text.substring(0, firstMatch.index).trim();
        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index + matches[i][0].length;
            const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
            let val = text.substring(start, end).trim();
            if (val.endsWith('\\)') && !val.includes('\\(')) {
                val = val.substring(0, val.length - 2).trim();
            }
            const openParens = (val.match(/\(/g) || []).length;
            const closeParens = (val.match(/\)/g) || []).length;
            if (val.endsWith(')') && closeParens > openParens) {
                val = val.substring(0, val.length - 1).trim();
            } else if (val.endsWith('.') && !/\d\.$/.test(val)) {
                val = val.replace(/\.$/, '').trim();
            }
            if (val) options.push(val);
        }
    }
    return { remainingText, options };
};

const finalizeQuestion = (q) => {
    q.options = (q.options || []).map(opt => opt.trim()).filter(opt => opt.length > 0);
    if (q.options.length > 4) {
        q.options = q.options.filter(opt => {
            const isExplanation = /^(is|was)\s+(incorrect|correct|the\s+answer|right|wrong)/i.test(opt) ||
                /^Choice\s+[A-J]\s+is/i.test(opt) ||
                opt.length > 300;
            return !isExplanation;
        });
    }
    if (q.options.length >= 2) q.type = 'mcq'; else q.type = 'short_answer';
    return q;
};

// TEST CASES
const test1 = "Which equation represents this situation? A)3w + 5r = 14";
const test2 = "Which system of equations? A)(3,100) B)(3,3) C)(3,10) D)(3,70)";
const test3 = "A) val A B) val B C) val C D) val D F) is incorrect. G) is incorrect.";

console.log("TEST 1:");
console.log(JSON.stringify(extractOptionsFromLine(test1), null, 2));

console.log("\nTEST 2:");
console.log(JSON.stringify(extractOptionsFromLine(test2), null, 2));

console.log("\nTEST 3 (Pruning):");
const q3 = { options: extractOptionsFromLine(test3).options };
console.log(JSON.stringify(finalizeQuestion(q3), null, 2));
