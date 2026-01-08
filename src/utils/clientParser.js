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
        qText = questionMatch[2];
      } else if (explicitTopicMatch) {
        detectedTopic = explicitTopicMatch[1].trim();
        qText = line.replace(/^Topic:\s*/i, '').trim();
      } else if (foundTopicStart) {
        detectedTopic = foundTopicStart;
        qText = line.substring(foundTopicStart.length).replace(/^[,\s:-]+/, '').trim();
      }

      if (detectedTopic) qText = `**Topic: ${detectedTopic}**\n\n${qText}`;

      currentQuestion = {
        question: qText || line,
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
         if(parts) currentQuestion.options.push(parts[2].trim());
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
      currentQuestion.explanation = explanationMatch[2].trim();
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