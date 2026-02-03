
const SAT_TOPICS = ["Linear equations in two variables", "Nonlinear equations in one variable and systems of equations in two variables"];

const extractOptionsFromLine = (text) => {
    const options = [];
    let remainingText = text;

    // Stricter regex: Letter followed by ) or . or :
    // Must be preceded by start of line or space/(
    const optRegex = /(?:^|[\s(])([A-Ja-j])[\s]*[).][\s]*/g;
    const matches = [...text.matchAll(optRegex)];

    if (matches.length > 0) {
        // If we only find one match, and it's NOT at the start of the line, 
        // it MUST be followed by something that looks like an option value.
        // And if it's just 'a)', it's risky. But 'A)' is usually an option.

        // Split the text at the first candidate option marker
        const firstMatch = matches[0];
        remainingText = text.substring(0, firstMatch.index).trim();

        for (let i = 0; i < matches.length; i++) {
            const start = matches[i].index + matches[i][0].length;
            const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
            let val = text.substring(start, end).trim();
            val = val.replace(/\\?\)?\s*$/, '').trim();
            options.push(val);
        }
    }
    return { remainingText, options };
};

// TEST CASES
const test1 = "Jay walks at a speed of 3 miles per hour and runs at a speed of 5 miles per hour. He walks for w hours and runs for r hours for a combined total of 14 miles. Which equation represents this situation? A)3w + 5r = 14";
const test2 = "x + 7 = 10 (x + 7)^2 = y Which ordered pair (x, y) is a solution to the given system of equations? A)(3,100) B)(3,3) C)(3,10) D)(3,70)";

console.log("TEST 1:");
console.log(JSON.stringify(extractOptionsFromLine(test1), null, 2));

console.log("\nTEST 2:");
console.log(JSON.stringify(extractOptionsFromLine(test2), null, 2));
