import JSZip from 'jszip';
import { convertToLatex } from './omml2latex';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for PDF.js (CDN fallback for browser environment)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const SAT_TOPICS = [
  "Craft and Structure", "Information and Ideas", "Standard English Conventions",
  "Expression of Ideas", "Words in Context", "Command of Evidence", "Inferences",
  "Central Ideas and Details", "Text Structure", "Purpose", "Algebra", "Advanced Math",
  "Linear equations in one variable", "Linear equations in two variables",
  "Linear functions", "Systems of two linear equations", "Linear inequalities",
  "Nonlinear functions", "Quadratic equations", "Exponential functions", "Polynomials",
  "Radicals", "Rational exponents", "Problem-Solving and Data Analysis",
  "Ratios, rates, proportional relationships", "Percentages", "One-variable data",
  "Two-variable data", "Probability", "Conditional probability",
  "Inference from sample statistics", "Evaluating statistical claims",
  "Geometry and Trigonometry", "Geometry & Trigonometry", "Area and volume",
  "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles",
  "Rhetorical Synthesis", "Transitions", "Form, Structure, and Sense",
  "Boundaries", "Form and Structure", "Heart of Algebra", "Problem Solving",
  "Passport to Advanced Math", "Data Analysis"
];
SAT_TOPICS.sort((a, b) => b.length - a.length);

/**
 * Main Client-Side Parser
 * Handles PDF, DOCX, and TXT directly in the browser.
 * Returns either raw text (for AI) or parsed questions (for Quizzes).
 */
export const parseDocumentClient = async (file, rawTextOnly = false) => {
  const fileType = file.name.split('.').pop().toLowerCase();
  let text = "";
  let structuredData = null;

  try {
    if (fileType === 'docx') {
      const res = await parseDocx(file);
      text = res.text;
    } else if (fileType === 'txt') {
      text = await file.text();
    } else if (fileType === 'pdf') {
      const res = await parsePdf(file);
      text = res.text;
      structuredData = res.structuredData;
    } else {
      throw new Error(`Unsupported file type: .${fileType}. Please use .pdf, .docx, or .txt`);
    }
  } catch (err) {
    console.error("File parsing error:", err);
    throw new Error(`File parsing failed: ${err.message}`);
  }

  // If we just want text (e.g. for Smart Content Tutor)
  if (rawTextOnly) {
    return { text, structuredData };
  }

  // Otherwise, parse for questions (e.g. for Course Uploads)
  return parseTextToQuestions(text);
};

// ------------------------------------------------------------------
// PDF Parsing Logic  (2-pass strategy)
// ------------------------------------------------------------------

const parsePdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let rawText = "";

  // ── PASS 1: build the raw text from all pages ─────────────────────
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Sort: top-to-bottom, then left-to-right (Y descending = top first in PDF coords)
    const items = [...textContent.items].sort((a, b) => {
      if (Math.abs(b.transform[5] - a.transform[5]) > 8) return b.transform[5] - a.transform[5];
      return a.transform[4] - b.transform[4];
    });

    let pageText = "";
    let lastY = -1;
    let lineItems = [];

    for (const item of items) {
      const str = item.str.trim();
      if (!str) continue;
      if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 8) {
        pageText += lineItems.join("  |  ") + "\n";
        lineItems = [];
      }
      lineItems.push(str);
      lastY = item.transform[5];
    }
    if (lineItems.length > 0) pageText += lineItems.join("  |  ") + "\n";
    rawText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  if (!rawText.trim()) {
    throw new Error("PDF appears to be empty or image-only. Please use a text-based PDF.");
  }

  // ── DEBUG: dump every line to console so we can see exact PDF text ──
  console.log('📄 [PDF RAW TEXT DUMP] ===========================');
  rawText.split('\n').forEach((line, i) => { if (line.trim()) console.log(`L${i}: ${line}`); });
  console.log('📄 [END PDF DUMP] =================================');

  // ── PASS 2: extract all SAT metrics from the completed raw text ───
  const structuredData = extractSATStructuredData(rawText);

  // ── Build the rich summary header the AI will read first ──────────
  const summaryHeader = buildSATSummaryHeader(structuredData);

  console.log("📊 [parsePdf] SAT data extracted:", {
    totalScore: structuredData.totalScore,
    rwScore: structuredData.rwScore,
    mathScore: structuredData.mathScore,
    studentName: structuredData.studentName,
    totalQ: structuredData.totalQuestions,
    correctQ: structuredData.correctAnswers,
    incorrectQ: structuredData.incorrectAnswers,
    accuracy: structuredData.accuracy,
    topicRows: structuredData.rows.length,
  });

  return {
    text: summaryHeader + "\n\nRAW PDF TEXT:\n" + rawText,
    structuredData
  };
};

/**
 * Comprehensive 2nd-pass extractor: pull every SAT metric
 * out of the joined raw text using robust patterns.
 */
const extractSATStructuredData = (text) => {
  const data = {
    studentName: null,
    totalScore: null,
    mathScore: null,
    rwScore: null,
    totalQuestions: null,
    correctAnswers: null,
    incorrectAnswers: null,
    accuracy: null,
    totalTime: null,
    sections: {},
    rows: [],
    incorrectTopics: {},
    correctTopics: {},
  };

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const fullText = lines.join(' ');
  const normalizedForSplitDigits = fullText
    // Collapse digit pipes/spaces often produced by PDF text extraction: "4 | 1 | 4" -> "414"
    .replace(/(\d)\s*(?:\||│|•|·|,)\s*(?=\d)/g, '$1')
    .replace(/(\d)\s+(?=\d)/g, '$1');

  // ── 0. METRICS EXTRACTION (Correct/Incorrect/Accuracy/Time) ─────────
  // These fields are required for the Smart AI Tutor "Test Report" analysis.
  // We parse them from the joined PDF text using robust heuristics.

  const extractPercent = () => {
    const m =
      fullText.match(/(?:OVERALL\s+)?ACCURACY\s*[-:]?\s*([\d.]+)\s*%/i) ||
      fullText.match(/ACCURACY\s*[-:]?\s*([\d.]+)\s*%/i);
    if (!m) return null;
    return String(m[1]).endsWith('%') ? String(m[1]) : `${m[1]}%`;
  };

  const extractCorrectIncorrect = () => {
    // Prefer fraction form like "Correct Answers: 22/98"
    const correctFrac =
      fullText.match(/CORRECT\s+ANSWERS?\s*[-:]?\s*(\d{1,4})\s*\/\s*(\d{1,4})/i) ||
      fullText.match(/CORRECT\s*[-:]?\s*(\d{1,4})\s*\/\s*(\d{1,4})/i);
    const incorrectFrac =
      fullText.match(/INCORRECT\s+ANSWERS?\s*[-:]?\s*(\d{1,4})\s*\/\s*(\d{1,4})/i) ||
      fullText.match(/INCORRECT\s*[-:]?\s*(\d{1,4})\s*\/\s*(\d{1,4})/i);

    // Simple counts (non-fraction)
    const correctSimple =
      fullText.match(/CORRECT\s+ANSWERS?\s*[-:]?\s*(\d{1,4})(?!\s*\/)/i);
    const incorrectSimple =
      fullText.match(/INCORRECT\s+ANSWERS?\s*[-:]?\s*(\d{1,4})(?!\s*\/)/i);

    const totalQuestionsMatch =
      fullText.match(/TOTAL\s+QUESTIONS?\s*[-:]?\s*(\d{1,4})/i) ||
      fullText.match(/TOTAL\s+ITEMS\s*[-:]?\s*(\d{1,4})/i);

    if (correctFrac) {
      data.correctAnswers = String(parseInt(correctFrac[1], 10));
      data.totalQuestions = data.totalQuestions || String(parseInt(correctFrac[2], 10));
    } else if (correctSimple && !data.correctAnswers) {
      data.correctAnswers = String(parseInt(correctSimple[1], 10));
    }

    if (incorrectFrac) {
      data.incorrectAnswers = String(parseInt(incorrectFrac[1], 10));
      data.totalQuestions = data.totalQuestions || String(parseInt(incorrectFrac[2], 10));
    } else if (incorrectSimple && !data.incorrectAnswers) {
      data.incorrectAnswers = String(parseInt(incorrectSimple[1], 10));
    }

    if (!data.totalQuestions && totalQuestionsMatch) {
      data.totalQuestions = String(parseInt(totalQuestionsMatch[1], 10));
    }

    // Derive missing values when possible
    const c = data.correctAnswers != null ? parseInt(data.correctAnswers, 10) : null;
    const w = data.incorrectAnswers != null ? parseInt(data.incorrectAnswers, 10) : null;
    const t = data.totalQuestions != null ? parseInt(data.totalQuestions, 10) : null;

    if (c != null && t != null && w == null) data.incorrectAnswers = String(Math.max(0, t - c));
    if (w != null && t != null && c == null) data.correctAnswers = String(Math.max(0, t - w));
    if (c != null && w != null && t == null) data.totalQuestions = String(c + w);

    const extractedAcc = extractPercent();
    if (extractedAcc) data.accuracy = extractedAcc;

    if (!data.accuracy && data.correctAnswers && data.incorrectAnswers) {
      const total = c + w;
      data.accuracy = total > 0 ? Math.round((c / total) * 100) + '%' : null;
    }
  };

  const extractTotalTime = () => {
    // Normalize common formats into a "NN minutes" style string when possible.

    // e.g. "Total Time: 2:20"
    const mmss = fullText.match(
      /(?:TOTAL\s+TIME|TEST\s+TIME|COMPLETION\s+TIME|SESSION\s+TIME)[^\d]{0,30}(\d{1,3})\s*[:.]\s*(\d{2})\b/i
    );
    if (mmss) {
      const minutes = parseInt(mmss[1], 10);
      const seconds = parseInt(mmss[2], 10);
      const totalMinutes = Math.round(minutes + seconds / 60);
      data.totalTime = `${totalMinutes} minutes`;
      return;
    }

    // e.g. "Total Time: 2 hours 20 minutes"
    const hourMin = fullText.match(
      /(?:TOTAL\s+TIME|TEST\s+TIME|COMPLETION\s+TIME|SESSION\s+TIME)[^\d]{0,30}(\d+)\s*hours?\s*(\d+)\s*minutes?/i
    );
    if (hourMin) {
      const hours = parseInt(hourMin[1], 10);
      const minutes = parseInt(hourMin[2], 10);
      const totalMinutes = hours * 60 + minutes;
      data.totalTime = `${totalMinutes} minutes`;
      return;
    }

    // e.g. "Total Time: 140 minutes"
    const minutesOnly = fullText.match(
      /(?:TOTAL\s+TIME|TEST\s+TIME|COMPLETION\s+TIME|SESSION\s+TIME)[^\d]{0,30}(\d{1,4})\s*(?:minutes?|mins?)/i
    );
    if (minutesOnly) {
      const minutes = parseInt(minutesOnly[1], 10);
      data.totalTime = `${minutes} minutes`;
      return;
    }

    // e.g. "2m 20s" (no keyword around it)
    const m20 = fullText.match(/(\d+)\s*m(?:in)?\s*(\d+)\s*s(?:ec)?/i);
    if (m20) {
      const minutes = parseInt(m20[1], 10);
      const seconds = parseInt(m20[2], 10);
      const totalMinutes = Math.round(minutes + seconds / 60);
      data.totalTime = `${totalMinutes} minutes`;
    }
  };

  extractCorrectIncorrect();
  extractTotalTime();

  // ── 1. SCORES EXTRACTION (Robust Heuristics) ──────────────────────
  
  // A. Look for "TOTAL SAT" or "TOTAL SCORE" rows
  for (const line of lines) {
    if (/(TOTAL\s+SAT|TOTAL\s+SCORE|YOUR\s+SCORE)/i.test(line)) {
      const nums = (line.match(/\d{3,4}/g) || []).map(Number);
      const score = nums.find(n => n >= 400 && n <= 1600);
      if (score && !data.totalScore) data.totalScore = String(score);
    }
    
    // Section specific keywords
    const isMath = /math/i.test(line) && !/reading|writing/i.test(line);
    const isRW   = /reading/i.test(line) && /writing/i.test(line);
    
    if (isMath || isRW) {
      const nums = (line.match(/\d{3}/g) || []).map(Number);
      const score = nums.find(n => n >= 200 && n <= 800);
      if (score) {
        if (isMath && !data.mathScore) data.mathScore = String(score);
        if (isRW && !data.rwScore) data.rwScore = String(score);
      }
    }
  }

  // B. Aggressive Full-Text Score Matcher (for visual dashboards)
  if (!data.totalScore) {
    // Match "Score 638" or "Total: 1200"
    const scoreMatches = [...fullText.matchAll(/(?:Score|Total|SAT)[\s|:]+(\d{3,4})/gi)];
    for (const match of scoreMatches) {
      const val = parseInt(match[1]);
      if (val >= 400 && val <= 1600) {
        data.totalScore = String(val);
        break;
      }
    }
  }

  // D. Split-digit fallback for OCR-like extracted text (e.g., "4 | 1 | 4")
  if (!data.totalScore) {
    const splitTotal =
      normalizedForSplitDigits.match(/(?:TOTAL\s+SAT|TOTAL\s+SCORE|YOUR\s+SCORE|SAT\s+SCORE)[^\d]{0,30}(\d{3,4})/i)?.[1] ||
      normalizedForSplitDigits.match(/\b(\d{3,4})\s*\/\s*1600\b/i)?.[1] ||
      null;
    if (splitTotal) data.totalScore = String(splitTotal);
  }
  if (!data.mathScore) {
    const splitMath =
      normalizedForSplitDigits.match(/MATH[^\d]{0,30}(\d{3})\b/i)?.[1] ||
      normalizedForSplitDigits.match(/\bMATH\b[^\d]{0,60}\b(\d{3})\s*\/\s*800\b/i)?.[1] ||
      null;
    if (splitMath) data.mathScore = String(splitMath);
  }
  if (!data.rwScore) {
    const splitRw =
      normalizedForSplitDigits.match(/(?:READING\s*&\s*WRITING|READING\s+AND\s+WRITING|R&W)[^\d]{0,30}(\d{3})\b/i)?.[1] ||
      normalizedForSplitDigits.match(/\b(?:READING|WRITING|R&W)\b[^\d]{0,80}\b(\d{3})\s*\/\s*800\b/i)?.[1] ||
      null;
    if (splitRw) data.rwScore = String(splitRw);
  }

  // C. Proximity Fallback: Look for 3-4 digit numbers near keywords
  if (!data.totalScore || !data.mathScore || !data.rwScore) {
    const tokens = fullText.split(/\s+|\|/);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i].replace(/[^\d]/g, '');
      if (token.length >= 3 && token.length <= 4) {
        const val = parseInt(token);
        const context = tokens.slice(Math.max(0, i - 10), i + 10).join(' ').toLowerCase();
        
        if (val >= 400 && val <= 1600 && !data.totalScore) {
          if (context.includes('total') || context.includes('score') || context.includes('sat')) {
            data.totalScore = String(val);
          }
        } else if (val >= 200 && val <= 800) {
          if (context.includes('math') && !data.mathScore) {
            data.mathScore = String(val);
          } else if ((context.includes('reading') || context.includes('writing') || context.includes('r&w')) && !data.rwScore) {
            data.rwScore = String(val);
          }
        }
      }
    }
  }

  // ── 2. STUDENT NAME ──────────────────────────────────────────────
  const SKIP_NAME = /score|date|test|page|digital|sat|prep|platform|standard|pace|module|reading|writing|math|history|summary|answer|correct|incorrect|prepared|version|student/i;
  
  // Try aggressive full-text match for name patterns (e.g. "Name: John Doe" or "DEMO STUDENT | Score")
  const explicitName = fullText.match(/(?:Name|Candidate|Student)[\s|:]+([A-Z][a-zA-Z\s]{2,30})/i);
  if (explicitName && !SKIP_NAME.test(explicitName[1])) {
    data.studentName = explicitName[1].trim();
  } else {
    // Look for ALL CAPS name
    const capsName = fullText.match(/([A-Z][A-Z\s]{4,30})\s*\|/);
    if (capsName && !SKIP_NAME.test(capsName[1])) {
      data.studentName = capsName[1].trim();
    } else {
      for (const line of lines) {
        const clean = line.replace(/[|│]/g, '').trim();
        // Pattern: ALL CAPS line that looks like a name
        if (/^[A-Z][A-Z\s]{3,30}$/.test(clean) && !SKIP_NAME.test(clean) && clean.split(' ').length >= 2) {
          data.studentName = clean;
          break;
        }
      }
    }
  }

  // Fallback to "Student" if none found to satisfy AI
  if (!data.studentName) data.studentName = 'Student';

  // ── 3. TOPIC ANALYSIS (Flexible even without |) ──────────────────
  let correctCount = 0;
  let incorrectCount = 0;

  for (const line of lines) {
    // A. Detect topic from the line using the global SAT_TOPICS list
    const lineLower = line.toLowerCase();
    const matchedTopic = SAT_TOPICS.find(topic => lineLower.includes(topic.toLowerCase()));

    if (!matchedTopic) continue;

    // B. Detect result (Correct/Incorrect)
    const isIncorrect = /(incorrect|wrong|mistake|✗|\bX\b|unanswered)/i.test(line);
    const isCorrect   = /(correct|right|✓|✔)/i.test(line);

    if (isIncorrect || isCorrect) {
      data.rows.push({ topic: matchedTopic, result: isIncorrect ? 'Incorrect' : 'Correct' });
      if (isIncorrect) {
        const n =
          (line.match(/(\d+)\s*(?:incorrect|wrong|mistake|unanswered)\b/i)?.[1]) ||
          (line.match(/(?:incorrect|wrong|mistake|unanswered)\b\s*(\d+)/i)?.[1]) ||
          null;
        const add = n != null ? parseInt(n, 10) : 1;
        data.incorrectTopics[matchedTopic] = (data.incorrectTopics[matchedTopic] || 0) + add;
        incorrectCount += add;
      }
      if (isCorrect) {
        const n =
          (line.match(/(\d+)\s*(?:correct|right|✓|✔)\b/i)?.[1]) ||
          (line.match(/(?:correct|right|✓|✔)\b\s*(\d+)/i)?.[1]) ||
          null;
        const add = n != null ? parseInt(n, 10) : 1;
        data.correctTopics[matchedTopic] = (data.correctTopics[matchedTopic] || 0) + add;
        correctCount += add;
      }
    }
  }

  // ── 4. AGGREGATE TOTALS ──────────────────────────────────────────
  if ((!data.correctAnswers || !data.incorrectAnswers || !data.totalQuestions || !data.accuracy) && (correctCount > 0 || incorrectCount > 0)) {
    // Topic-derived totals are only a fallback when report metrics didn't parse.
    const totalDerived = correctCount + incorrectCount;
    if (!data.correctAnswers) data.correctAnswers = String(correctCount);
    if (!data.incorrectAnswers) data.incorrectAnswers = String(incorrectCount);
    if (!data.totalQuestions && totalDerived > 0) data.totalQuestions = String(totalDerived);
    if (!data.accuracy && totalDerived > 0) data.accuracy = Math.round((correctCount / totalDerived) * 100) + '%';
  }

  // Final cross-fill
  if (data.rwScore) data.sections['Reading & Writing'] = data.rwScore;
  if (data.mathScore) data.sections['Math'] = data.mathScore;

  return data;
};

const buildSATSummaryHeader = (d) => {
  const incorrectList = Object.entries(d.incorrectTopics || {})
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `  - ${t} (${c} incorrect)`)
    .join('\n') || '  - See raw text';

  const correctList = Object.entries(d.correctTopics || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t, c]) => `  - ${t} (${c} correct)`)
    .join('\n') || '  - See raw text';

  return `### VERIFIED SAT REPORT DATA — USE AS PRIMARY SOURCE ###
STUDENT NAME        : ${d.studentName || 'See raw text'}
TOTAL SAT SCORE     : ${d.totalScore   || 'See raw text'}
READING & WRITING   : ${d.rwScore      || d.sections?.['Reading & Writing'] || 'See raw text'}
MATH SCORE          : ${d.mathScore    || d.sections?.['Math'] || 'See raw text'}
TOTAL QUESTIONS     : ${d.totalQuestions  || 'See raw text'}
CORRECT ANSWERS     : ${d.correctAnswers  || 'See raw text'}
INCORRECT ANSWERS   : ${d.incorrectAnswers || 'See raw text'}
ACCURACY            : ${d.accuracy     || 'See raw text'}
TOTAL TIME SPENT    : ${d.totalTime    || 'See raw text'}

WEAK TOPICS:
${incorrectList}

STRONG TOPICS:
${correctList}
### END VERIFIED DATA ###`;
};

// ------------------------------------------------------------------
// DOCX Parsing Logic
// ------------------------------------------------------------------
const parseDocx = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlContent = await zip.file("word/document.xml").async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
  const paragraphs = xmlDoc.getElementsByTagName("w:p");

  let fullText = "";

  for (let i = 0; i < paragraphs.length; i++) {
    let paraText = "";
    const childNodes = paragraphs[i].childNodes;

    for (let j = 0; j < childNodes.length; j++) {
      const node = childNodes[j];
      const nodeName = node.nodeName;

      if (nodeName === "w:r") {
        const textNode = node.getElementsByTagName("w:t")[0];
        if (textNode) paraText += textNode.textContent;
      } else if (nodeName.endsWith("oMath") || nodeName.endsWith("oMathPara")) {
        paraText += convertToLatex(node);
      }
    }
    fullText += paraText + "\n";
  }

  if (!fullText || fullText.trim().length === 0) {
    throw new Error("The document appears to be empty.");
  }

  return { text: fullText };
};

// ------------------------------------------------------------------
// Question Extraction Logic (used for Course Uploads, not SAT reports)
// ------------------------------------------------------------------
const parseTextToQuestions = (text) => {
  const questions = [];
  const cleanText = text
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\u00F7/g, '/');

  const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const questionMatch = line.match(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*(.*)/i);
    const explicitTopicMatch = line.match(/^Topic:\s*(.*)/i);
    let foundTopicStart = null;

    if (!questionMatch && !explicitTopicMatch) {
      foundTopicStart = SAT_TOPICS.find(t => line.startsWith(t));
    }

    if (questionMatch || explicitTopicMatch || foundTopicStart) {
      if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));

      let qText = "";
      let detectedTopic = "";

      if (questionMatch) {
        qText = questionMatch[2].replace(/\s+/g, ' ').trim();

        const colonMatch = qText.match(/^([^:]+):\s*(.*)/);
        if (colonMatch) {
          const potentialTopic = colonMatch[1].trim();
          const remainingText = colonMatch[2].trim();
          const matchedTopic = SAT_TOPICS.find(t =>
            potentialTopic.toLowerCase() === t.toLowerCase() ||
            potentialTopic.toLowerCase().startsWith(t.toLowerCase())
          );
          if (matchedTopic) {
            detectedTopic = matchedTopic;
            qText = remainingText;
          } else {
            detectedTopic = potentialTopic;
            qText = remainingText;
          }
        }

        if (!detectedTopic) {
          for (const satTopic of SAT_TOPICS) {
            const normQText = qText.toLowerCase();
            const normTopic = satTopic.toLowerCase();
            if (normQText.startsWith(normTopic)) {
              let charCount = 0;
              for (let ci = 0; ci < qText.length; ci++) {
                const normalizedSoFar = qText.substring(0, ci + 1).toLowerCase();
                if (normalizedSoFar === normTopic || normalizedSoFar.startsWith(normTopic + ' ') || normalizedSoFar.startsWith(normTopic + ',')) {
                  charCount = ci + 1;
                  break;
                }
              }
              if (charCount > 0) {
                detectedTopic = satTopic;
                qText = qText.substring(charCount).replace(/^[,\s.:-]+/, '').trim();
                for (const subTopic of SAT_TOPICS) {
                  if (subTopic === satTopic) continue;
                  const normRemaining = qText.toLowerCase();
                  const normSub = subTopic.toLowerCase();
                  if (normRemaining.startsWith(normSub)) {
                    let subCount = 0;
                    for (let ci = 0; ci < qText.length; ci++) {
                      const s = qText.substring(0, ci + 1).toLowerCase();
                      if (s === normSub || s.startsWith(normSub + ' ') || s.startsWith(normSub + ',')) { subCount = ci + 1; break; }
                    }
                    if (subCount > 0) {
                      detectedTopic = `${satTopic} - ${subTopic}`;
                      qText = qText.substring(subCount).replace(/^[,\s.:-]+/, '').trim();
                    }
                    break;
                  }
                }
                break;
              }
            }
          }
        }
      } else if (explicitTopicMatch) {
        detectedTopic = explicitTopicMatch[1].trim();
        qText = line.replace(/^Topic:\s*/i, '').trim();
      } else if (foundTopicStart) {
        detectedTopic = foundTopicStart;
        qText = line.substring(foundTopicStart.length).replace(/^[,\s.:-]+/, '').trim();
        const subTopic = SAT_TOPICS.find(t => t !== foundTopicStart && qText.startsWith(t));
        if (subTopic) {
          detectedTopic = `${foundTopicStart} - ${subTopic}`;
          qText = qText.substring(subTopic.length).replace(/^[,\s.:-]+/, '').trim();
        }
      }

      currentQuestion = {
        question: qText || line,
        topic: detectedTopic || null,
        options: [],
        correctAnswer: '',
        explanation: null,
        level: 'Medium'
      };
      if (line.toLowerCase().includes('[easy]')) currentQuestion.level = 'Easy';
      if (line.toLowerCase().includes('[hard]')) currentQuestion.level = 'Hard';
      currentQuestion.question = currentQuestion.question.replace(/\[.*?\]/g, '').trim();
      continue;
    }

    if (!currentQuestion) continue;

    if (line.match(/^Passage\s*\/\s*Sentence:/i)) {
      currentQuestion.question += '\n\n' + line.replace(/^Passage\s*\/\s*Sentence:\s*/i, '');
      continue;
    }
    if (line.match(/^Options:/i)) continue;

    const optionMatch = line.match(/^([A-Ea-e])[\s]*[.):-]\s*(.*)/);
    if (optionMatch) { currentQuestion.options.push(optionMatch[2].trim()); continue; }

    const inlineOptions = line.match(/([A-D])\s*[.)]\s*(.*?)(?=\s+[A-D]\s*[.)]\s*|$)/g);
    if (inlineOptions && inlineOptions.length > 1) {
      inlineOptions.forEach(opt => {
        const parts = opt.match(/([A-D])\s*[.)]\s*(.*)/);
        if (parts) currentQuestion.options.push(parts[2].trim());
      });
      continue;
    }

    const answerMatch = line.match(/^(Answer|Ans|Correct Answer|Correct|Correct Option)[\s:.-]*\s*(.*)/i);
    if (answerMatch) {
      let rawContent = answerMatch[2].trim();
      const splitMatch = rawContent.match(/^([A-Ea-e])(?:\)|\.|:|-|\s)\s*(.*)/);
      if (splitMatch) {
        currentQuestion.correctAnswer = splitMatch[1].toUpperCase();
        if (splitMatch[2] && !currentQuestion.explanation) currentQuestion.explanation = splitMatch[2].trim();
      } else {
        currentQuestion.correctAnswer = /^[A-Ea-e]$/.test(rawContent) ? rawContent.toUpperCase() : rawContent;
      }
      continue;
    }

    const explanationMatch = line.match(/^(Explanation|Sol|Solution|Reason|Note|Hint)[\s:.-]*\s*(.*)/i);
    if (explanationMatch) {
      const expText = explanationMatch[2].trim();
      const isGeneric = /^Choice\s+[A-E]\s+is\s+(incorrect|correct)\s+(and\s+may\s+result|This\s+is\s+the\s+value)/i.test(expText)
        || /^Choice\s+[A-E]\s+is\s+incorrect\.?$/i.test(expText)
        || (expText.length < 30 && /incorrect|correct/i.test(expText) && !/because|since|as|therefore|thus/i.test(expText));
      if (!isGeneric) currentQuestion.explanation = expText;
      continue;
    }

    if (currentQuestion.explanation !== null) {
      currentQuestion.explanation += (currentQuestion.explanation ? '\n' : '') + line;
    } else if (currentQuestion.options.length === 0 && !currentQuestion.correctAnswer) {
      currentQuestion.question += (currentQuestion.question ? '\n' : '') + line;
    } else if (currentQuestion.options.length > 0) {
      currentQuestion.options[currentQuestion.options.length - 1] += '\n' + line;
    }
  }

  if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));
  return questions;
};

const extractAnswerFromExplanation = (explanation) => {
  if (!explanation) return null;
  const patterns = [
    /(?:Therefore|Thus|Hence|So|Consequently)[^.]*?(?:is|=)\s*([-]?\d+(?:\.\d+)?)/i,
    /(?:answer|value|result|length|radius|coordinate)[^.]*?(?:is|=)\s*([-]?\d+(?:\.\d+)?)/i,
    /([-]?\d+(?:\.\d+)?)\s*\.?$/
  ];
  for (const pattern of patterns) {
    const match = explanation.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
};

const finalizeQuestion = (q) => {
  if (q.explanation === null) q.explanation = '';
  const isEnglishStyle = /(Which choice|logical and precise word|completes the text|best describes|main purpose)/i.test(q.question);
  if (q.options.length >= 2 || isEnglishStyle) {
    q.type = 'mcq';
  } else {
    q.type = 'short_answer';
    if (q.options.length > 0 && /^[A-E]$/i.test(q.correctAnswer)) {
      const idx = q.correctAnswer.toUpperCase().charCodeAt(0) - 65;
      if (q.options[idx]) q.correctAnswer = q.options[idx];
    }
    if (/^[A-E]$/i.test(q.correctAnswer) && q.explanation) {
      const extracted = extractAnswerFromExplanation(q.explanation);
      if (extracted) q.correctAnswer = extracted;
    }
    if (q.options.length === 1 && !q.correctAnswer) q.correctAnswer = q.options[0];
    if (q.type === 'short_answer') q.options = [];
  }
  return q;
};
