
const SAT_TOPICS = [
    "Craft and Structure", "Information and Ideas", "Standard English Conventions",
    "Problem-Solving and Data Analysis", "Problem Solving & Data Analysis"
];

const normalizeForTopic = (str) => {
    return str.replace(/\\\(|\\\)|\\\[|\\\]/g, '').replace(/&/g, 'and').replace(/[,\s.:-]+/g, ' ').trim().toLowerCase();
};

const testString = "1 problem solving & data Analysis: An airplane descends from an altitude of 9,500 feet.";

console.log("Testing string:", testString);

// Simulate the parser logic
const questionMatch = testString.match(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*(.*)/i);

if (questionMatch) {
    let qText = questionMatch[2].trim();
    console.log("Extracted qText:", qText);

    const colonMatch = qText.match(/^([^:]+):\s*(.*)/);
    if (colonMatch) {
        console.log("Colon match found!");
        const potentialTopic = colonMatch[1].trim();
        const remainingText = colonMatch[2].trim();
        console.log("Potential Topic:", potentialTopic);
        console.log("Remaining Text:", remainingText);

        const normPot = normalizeForTopic(potentialTopic);
        console.log("Normalized Potential:", normPot);

        const matchedTopic = SAT_TOPICS.find(t => {
            const normT = normalizeForTopic(t);
            // console.log(`Checking vs ${t} -> ${normT}`);
            return normPot === normT || normPot.startsWith(normT);
        });

        if (matchedTopic) {
            console.log("✅ MATCHED TOPIC:", matchedTopic);
            console.log("Final Question Text:", remainingText);
        } else {
            console.log("⚠️ No exact topic match, but would use potentialTopic anyway:", potentialTopic);
        }
    } else {
        console.log("❌ No colon match found.");
    }
} else {
    console.log("❌ No question match found.");
}
