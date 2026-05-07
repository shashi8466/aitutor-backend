const rawText = `### STRUCTURED SAT DATA (PRIMARY — read this first)
STUDENT NAME: Student
TOTAL SAT SCORE: 515/1600
READING & WRITING SCORE: 262/800
MATH SCORE: 253/800
TOTAL QUESTIONS: 98
CORRECT ANSWERS: 11
INCORRECT ANSWERS: Not available
ACCURACY: 11%
TOTAL TIME: 1m 1s
AVG TIME PER QUESTION: 1s
READING & WRITING TIME: 0m 33s
MATH TIME: 0m 27s

WEAK TOPICS:
- Not available

STRONG TOPICS:
- Not available

RAW PDF TEXT:
(Not available — graphical PDF)`;

const headerBlock = rawText.match(/###\s*STRUCTURED[\s\S]*?(?=RAW PDF TEXT:)/i)?.[0] || '';

const pick = (pattern) => {
    const m = (headerBlock || '').match(pattern) || rawText.match(pattern);
    return m ? m[1].trim() : null;
};

const hintTime    = pick(/TOTAL\s+TIME\s*(?:SPENT)?\s*[:\|-]+\s*([^\n#]+)/i);
const hintAvgQ    = pick(/AVG\s+TIME\s+PER\s+QUESTION\s*[:\|-]+\s*([^\n#]+)/i);
const hintRWTime  = pick(/READING\s*(?:&|AND|\+)?\s*WRITING\s+TIME\s*[:\|-]+\s*([^\n#]+)/i);
const hintMathTime= pick(/MATH\s+TIME\s*[:\|-]+\s*([^\n#]+)/i);

console.log({hintTime, hintAvgQ, hintRWTime, hintMathTime});

const weakBlock   = (headerBlock || rawText).match(/WEAK\s+TOPICS[\s\S]*?(?=STRONG\s+TOPICS|###|$)/i)?.[0] || '';
const extractTopicList = (block) =>
    block.split('\n')
    .filter(l => l.includes('-') || l.includes(':'))
    .map(l => l.replace(/^[-*•\s]+/, '').split(/[:(]/)[0].trim())
    .filter(t => t.length > 3 && !/weak|strong|topic|correct|incorrect|extract|raw|available|none/i.test(t));

const weakTopics = extractTopicList(weakBlock);
console.log({weakTopics});
