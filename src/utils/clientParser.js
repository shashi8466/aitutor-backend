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
  "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"
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

  try {
    if (fileType === 'docx') {
      const res = await parseDocx(file);
      text = res.text;
    } else if (fileType === 'txt') {
      text = await file.text();
    } else if (fileType === 'pdf') {
      const res = await parsePdf(file);
      text = res.text;
    } else {
      throw new Error(`Unsupported file type: .${fileType}. Please use .pdf, .docx, or .txt`);
    }
  } catch (err) {
    console.error("File parsing error:", err);
    throw new Error(`File parsing failed: ${err.message}`);
  }

  // If we just want text (e.g. for Smart Content Tutor)
  if (rawTextOnly) {
    return { text };
  }

  // Otherwise, parse for questions (e.g. for Course Uploads)
  return parseTextToQuestions(text);
};

/**
 * ------------------------------------------------------------------
 * PDF Parsing Logic
 * ------------------------------------------------------------------
 */
const parsePdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  if (!fullText.trim()) {
    throw new Error("PDF appears to be empty or scanned (image-only). Please use a text-based PDF.");
  }

  return { text: fullText };
};

/**
 * ------------------------------------------------------------------
 * DOCX Parsing Logic
 * ------------------------------------------------------------------
 */
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
    // Explicit newline for each paragraph to preserve structure
    fullText += paraText + "\n";
  }

  if (!fullText || fullText.trim().length === 0) {
    throw new Error("The document appears to be empty.");
  }

  return { text: fullText };
};

/**
 * ------------------------------------------------------------------
 * Question Extraction Logic (Ported from Server)
 * ------------------------------------------------------------------
 */
const parseTextToQuestions = (text) => {
  const questions = [];
  const cleanText = text
    .replace(/\u2013|\u2014|\u2212/g, '-')
    .replace(/\u00F7/g, '/');

  const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
  let currentQuestion = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Question Start
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
        // Extract text after question number and normalize whitespace
        qText = questionMatch[2].replace(/\s+/g, ' ').trim();

        // First, check if there's a colon-based topic (e.g., "Linear equations in two variable:")
        const colonMatch = qText.match(/^([^:]+):\s*(.*)/);
        if (colonMatch) {
          const potentialTopic = colonMatch[1].trim();
          const remainingText = colonMatch[2].trim();

          // Check if this matches any SAT topic (case-insensitive)
          const matchedTopic = SAT_TOPICS.find(t =>
            potentialTopic.toLowerCase() === t.toLowerCase() ||
            potentialTopic.toLowerCase().startsWith(t.toLowerCase())
          );

          if (matchedTopic) {
            detectedTopic = matchedTopic;
            qText = remainingText;
          } else {
            // If no exact match, use the text before colon as topic anyway
            detectedTopic = potentialTopic;
            qText = remainingText;
          }
        }

        // If no colon-based topic found, try to find and remove topic from the beginning
        // Iterate through all SAT topics (already sorted by length, longest first)
        if (!detectedTopic) {
          for (const satTopic of SAT_TOPICS) {
            const normQText = qText.toLowerCase();
            const normTopic = satTopic.toLowerCase();

            if (normQText.startsWith(normTopic)) {
              // Find the exact character position where the topic ends
              let charCount = 0;
              let normalizedSoFar = '';

              for (let i = 0; i < qText.length; i++) {
                normalizedSoFar = qText.substring(0, i + 1).toLowerCase();

                // Check if we've matched the full topic
                if (normalizedSoFar === normTopic || normalizedSoFar.startsWith(normTopic + ' ') || normalizedSoFar.startsWith(normTopic + ',')) {
                  charCount = i + 1;
                  break;
                }
              }

              if (charCount > 0) {
                detectedTopic = satTopic;
                qText = qText.substring(charCount).replace(/^[,\\s.:-]+/, '').trim();

                // Check for sub-topic in remaining text
                for (const subTopic of SAT_TOPICS) {
                  if (subTopic === satTopic) continue;

                  const normRemainingText = qText.toLowerCase();
                  const normSubTopic = subTopic.toLowerCase();

                  if (normRemainingText.startsWith(normSubTopic)) {
                    let subCharCount = 0;
                    let subNormalizedSoFar = '';

                    for (let i = 0; i < qText.length; i++) {
                      subNormalizedSoFar = qText.substring(0, i + 1).toLowerCase();

                      if (subNormalizedSoFar === normSubTopic || subNormalizedSoFar.startsWith(normSubTopic + ' ') || subNormalizedSoFar.startsWith(normSubTopic + ',')) {
                        subCharCount = i + 1;
                        break;
                      }
                    }

                    if (subCharCount > 0) {
                      detectedTopic = `${satTopic} - ${subTopic}`;
                      qText = qText.substring(subCharCount).replace(/^[,\\s.:-]+/, '').trim();
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
        // Extract question text after topic, removing any separators (comma, period, colon, dash)
        qText = line.substring(foundTopicStart.length).replace(/^[,\s.:-]+/, '').trim();

        // Check for sub-topic
        const subTopic = SAT_TOPICS.find(t => t !== foundTopicStart && qText.startsWith(t));
        if (subTopic) {
          detectedTopic = `${foundTopicStart} - ${subTopic}`;
          qText = qText.substring(subTopic.length).replace(/^[,\s.:-]+/, '').trim();
        }
      }

      // Store topic separately, don't prepend it to question text
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

    // Passage detection
    if (line.match(/^Passage\s*\/\s*Sentence:/i)) {
      currentQuestion.question += '\n\n' + line.replace(/^Passage\s*\/\s*Sentence:\s*/i, '');
      continue;
    }

    if (line.match(/^Options:/i)) continue;

    // Detect Options (A. ...)
    const optionMatch = line.match(/^(\$?[A-Da-d])[.):-]\s*(.*)/);
    if (optionMatch) {
      currentQuestion.options.push(optionMatch[2].trim());
      continue;
    }

    // Detect Inline Options
    const inlineOptions = line.match(/([A-D])\)\s*([^A-D\n]+)/g);
    if (inlineOptions && inlineOptions.length > 1) {
      inlineOptions.forEach(opt => {
        const parts = opt.match(/([A-D])\)\s*(.*)/);
        if (parts) currentQuestion.options.push(parts[2].trim());
      });
      continue;
    }

    // Detect Answer
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

    // Detect Explanation
    const explanationMatch = line.match(/^(Explanation|Sol|Solution|Reason|Note|Hint)[\s:.-]*\s*(.*)/i);
    if (explanationMatch) {
      const expText = explanationMatch[2].trim();

      // Filter out generic/unhelpful explanations
      const isGenericExplanation = /^Choice\s+[A-E]\s+is\s+(incorrect|correct)\s+(and\s+may\s+result\s+from|This\s+is\s+the\s+value\s+of)/i.test(expText) ||
        /^Choice\s+[A-E]\s+is\s+incorrect\.?$/i.test(expText) ||
        (expText.length < 30 && /incorrect|correct/i.test(expText) && !/because|since|as|therefore|thus/i.test(expText));

      if (!isGenericExplanation) {
        currentQuestion.explanation = expText;
      }
      continue;
    }

    // Continuation
    if (currentQuestion.explanation !== null) {
      currentQuestion.explanation += ' ' + line;
    } else if (currentQuestion.options.length === 0 && !currentQuestion.correctAnswer) {
      currentQuestion.question += ' ' + line;
    } else if (currentQuestion.options.length > 0) {
      const lastOptIdx = currentQuestion.options.length - 1;
      currentQuestion.options[lastOptIdx] += ' ' + line;
    }
  }

  if (currentQuestion) {
    questions.push(finalizeQuestion(currentQuestion));
  }

  return questions;
};

const extractAnswerFromExplanation = (explanation) => {
  if (!explanation) return null;
  const patterns = [
    /(?:Therefore|Thus|Hence|So|Consequently)[^.]*?(?:is|=)\s*([-]?\d+(?:\.\d+)?)/i,
    /(?:answer|value|result|length|radius|coordinate)[^.]*?(?:is|=)\s*([-]?\d+(?:\.\d+)?)/i,
    /(\d+)\s*\.$/
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
    // 1. Map Letter -> Option Value
    if (q.options.length > 0 && /^[A-E]$/i.test(q.correctAnswer)) {
      const idx = q.correctAnswer.toUpperCase().charCodeAt(0) - 65;
      if (q.options[idx]) {
        q.correctAnswer = q.options[idx];
      }
    }
    // 2. Fallback: Extract from Explanation
    if (/^[A-E]$/i.test(q.correctAnswer) && q.explanation) {
      const extracted = extractAnswerFromExplanation(q.explanation);
      if (extracted) {
        q.correctAnswer = extracted;
      }
    }

    if (q.options.length === 1 && !q.correctAnswer) q.correctAnswer = q.options[0];
    if (q.type === 'short_answer') q.options = [];
  }
  return q;
};