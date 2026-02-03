import AdmZip from 'adm-zip';
import { DOMParser } from 'xmldom';
import pdf from 'pdf-parse';
import { convertToLatex } from '../../utils/omml2latex.js';
import path from 'path';
import { Buffer } from 'buffer';
import fs from 'fs';

const SAT_TOPICS = [
  "Craft and Structure", "Information and Ideas", "Standard English Conventions",
  "Expression of Ideas", "Words in Context", "Command of Evidence", "Inferences",
  "Central Ideas and Details", "Text Structure", "Purpose", "Algebra", "Advanced Math",
  "Linear equations in one variable", "Linear equations in two variables", "Linear functions",
  "Systems of two linear equations", "Linear inequalities", "Nonlinear functions",
  "Quadratic equations", "Exponential functions", "Polynomials", "Radicals",
  "Rational exponents", "Problem-Solving and Data Analysis",
  "Ratios, rates, proportional relationships", "Percentages", "One-variable data",
  "Two-variable data", "Probability", "Conditional probability",
  "Inference from sample statistics", "Evaluating statistical claims",
  "Geometry and Trigonometry", "Geometry & Trigonometry", "Area and volume",
  "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles",
  "Equivalent expressions", "Nonlinear equations in one variable and systems of equations in two variables",
  "in two variables", "in one variable",
  "Ratios rates proportional relationships and units", "Two-variable data: models and scatterplots",
  "Ratios, rates, proportional relationships and units",
  "Problem Solving & Data Analysis", "Systems of two linear equations in two variables",
  "Lines angles and triangles", "in one or two variables"
];
SAT_TOPICS.sort((a, b) => b.length - a.length);

/**
 * Robustly extracts options from a line of text, handling both single and multiple options.
 * Now takes currentOptionsCount to ensure sequential detection (A, B, C...)
 */
const extractOptionsFromLine = (text, currentOptionsCount = 0) => {
  const options = [];
  let remainingText = text;

  // Stricter regex for SAT: Only A-E
  // Must be Uppercase. 
  // Must be at start of line OR preceded by 2+ spaces.
  const optRegex = /(?:^|[\s\t]{2,})([A-E])[\s]*[).][\s]*/g;
  const matches = [...text.matchAll(optRegex)];

  if (matches.length > 0) {
    let nextExpectedIndex = currentOptionsCount;
    let firstValidMatchIdx = -1;

    for (let i = 0; i < matches.length; i++) {
      const letter = matches[i][1].toUpperCase();
      const letterIndex = letter.charCodeAt(0) - 65;

      // Check if this matches our sequence (A if first, then B, C, D...)
      if (letterIndex === nextExpectedIndex) {
        if (firstValidMatchIdx === -1) {
          firstValidMatchIdx = i;
          remainingText = text.substring(0, matches[i].index).trim();
        }

        const start = matches[i].index + matches[i][0].length;
        const end = (i + 1 < matches.length) ? matches[i + 1].index : text.length;
        options.push(text.substring(start, end).trim());
        nextExpectedIndex++;
      } else if (firstValidMatchIdx !== -1) {
        break;
      }
    }
  }

  return {
    remainingText: options.length > 0 ? remainingText : text,
    options
  };
};

/**
 * Main entry point - NOW WITH ROBUST ERROR HANDLING
 */
export const parseDocument = async (file, rawTextOnly = false) => {
  const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
  const fileType = file.originalname.split('.').pop().toLowerCase();
  let text = '';
  let extractedImages = [];

  try {
    if (!buffer) {
      throw new Error('File buffer missing. Unable to read uploaded file.');
    }
    if (fileType === 'docx') {
      const result = await extractDocxWithMath(buffer);
      text = result.text;
      extractedImages = result.images || [];
    } else if (fileType === 'txt') {
      text = buffer.toString('utf-8');
    } else if (fileType === 'pdf') {
      const data = await pdf(buffer);
      text = data.text;
    } else {
      throw new Error(`Unsupported file type: .${fileType}`);
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Could not extract any text from the document.");
    }

  } catch (err) {
    console.error("Parser Error:", err);
    throw new Error(`Text extraction failed: ${err.message}`);
  }

  if (rawTextOnly) {
    return text.trim();
  }

  try {
    const questions = parseTextToQuestions(text);
    return { questions, images: extractedImages };
  } catch (parseErr) {
    console.error("Question parsing error:", parseErr);
    return { questions: [], images: [] };
  }
};

/**
 * DOCX Extraction
 */
const extractDocxWithMath = async (buffer) => {
  try {
    const zip = new AdmZip(buffer);
    const docEntry = zip.getEntry("word/document.xml");
    if (!docEntry) throw new Error("Invalid DOCX file");

    const xmlContent = zip.readAsText("word/document.xml");
    const doc = new DOMParser().parseFromString(xmlContent, "text/xml");

    const relMap = {};
    const relEntry = zip.getEntry("word/_rels/document.xml.rels");
    if (relEntry) {
      const relXml = zip.readAsText("word/_rels/document.xml.rels");
      const relDoc = new DOMParser().parseFromString(relXml, "text/xml");
      const relNodes = relDoc.getElementsByTagName("Relationship");
      for (let i = 0; i < relNodes.length; i++) {
        const rel = relNodes[i];
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target && (target.includes("media/") || target.includes("embeddings/"))) {
          relMap[id] = "word/" + target.replace(/^(\.\.\/)+/, "");
        }
      }
    }

    const extractedImages = [];
    const findEmbedId = (node) => {
      const getAttr = (el, attrName) => {
        const namespaces = [
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "http://schemas.microsoft.com/office/2006/relationships"
        ];
        for (const ns of namespaces) {
          const val = el.getAttributeNS(ns, attrName);
          if (val) return val;
        }
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (attr.localName === attrName || attr.name.endsWith(":" + attrName)) return attr.value;
        }
        return el.getAttribute(attrName);
      };
      const blips = node.getElementsByTagName("a:blip");
      if (blips.length > 0) return getAttr(blips[0], "embed");
      const imagedata = node.getElementsByTagName("v:imagedata");
      if (imagedata.length > 0) return getAttr(imagedata[0], "id");
      return null;
    };

    const processParagraph = (pNode) => {
      const walk = (node) => {
        if (!node) return "";
        if (node.nodeType === 3) return node.nodeValue || "";
        const tagName = node.nodeName.split(':').pop();
        if (tagName === 'drawing' || tagName === 'pict') {
          const embedId = findEmbedId(node);
          if (embedId && relMap[embedId]) {
            try {
              const imgEntry = zip.getEntry(relMap[embedId]);
              if (imgEntry) {
                const imageBuffer = imgEntry.getData();
                const imageExt = path.extname(imgEntry.entryName).substring(1);
                extractedImages.push({ id: embedId, extension: imageExt, buffer: imageBuffer, name: `image_${Date.now()}_${embedId}.${imageExt}` });
                return ` [IMAGE: ${embedId}.${imageExt}] `;
              }
            } catch (e) { }
          }
          return "";
        }
        if (tagName === 'oMath' || tagName === 'oMathPara') {
          const rawText = node.textContent || "";
          const spaceCount = (rawText.match(/\s/g) || []).length;
          const hasMathOperators = /[=+\-*/^]/.test(rawText);
          const letterCount = (rawText.match(/[a-zA-Z]/g) || []).length;

          // Heuristic: If it has spaces, OR if it has many letters but no math symbols,
          // it's almost certainly text typed in the equation editor.
          if (spaceCount >= 1 || (letterCount > 10 && !hasMathOperators)) {
            return " " + rawText + " ";
          }

          try { return convertToLatex(node); } catch (e) { return " [Equation] "; }
        }
        if (tagName === 't') return node.textContent || "";
        if (tagName === 'br') return "\n";
        let res = "";
        if (node.childNodes) {
          for (let i = 0; i < node.childNodes.length; i++) res += walk(node.childNodes[i]);
        }
        return res;
      };
      return walk(pNode);
    };

    let fullText = "";
    const bodyContainer = doc.getElementsByTagName("w:body")[0];
    const topLevelNodes = bodyContainer.childNodes;
    for (let i = 0; i < topLevelNodes.length; i++) {
      const node = topLevelNodes[i];
      if (node.nodeName === "w:p") {
        const pText = processParagraph(node);
        if (pText.trim()) fullText += pText + "\n\n";
      } else if (node.nodeName === "w:tbl") {
        const rows = node.getElementsByTagName("w:tr");
        let tableHtml = '<table class="docx-table" style="width:100%; border-collapse:collapse; margin:15px 0; border:1px solid #ddd;">';
        for (let r = 0; r < rows.length; r++) {
          tableHtml += '<tr>';
          const cells = rows[r].getElementsByTagName("w:tc");
          for (let c = 0; c < cells.length; c++) {
            const cellParagraphs = cells[c].getElementsByTagName("w:p");
            let cellContent = "";
            for (let p = 0; p < cellParagraphs.length; p++) cellContent += processParagraph(cellParagraphs[p]) + " ";
            tableHtml += `<td style="border:1px solid #ddd; padding:8px; vertical-align:top;">${cellContent.trim()}</td>`;
          }
          tableHtml += '</tr>';
        }
        fullText += tableHtml + '</table>\n\n';
      }
    }
    return { text: fullText, images: extractedImages };
  } catch (err) {
    throw new Error(`DOCX extraction failed: ${err.message}`);
  }
};

const parseTextToQuestions = (text) => {
  const questions = [];
  try {
    const cleanText = text.replace(/\u2013|\u2014|\u2212/g, '-').replace(/\u00F7/g, '/');
    const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    let currentQuestion = null;

    const normalizeForTopic = (str) => {
      return str.replace(/\\\(|\\\)|\\\[|\\\]/g, '').replace(/&/g, 'and').replace(/[,\s.:-]+/g, ' ').trim().toLowerCase();
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const questionMatch = line.match(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*(.*)/i);
      const explicitTopicMatch = line.match(/^Topic:\s*(.*)/i);
      let foundTopicStart = null;
      if (!questionMatch && !explicitTopicMatch) {
        const normalizedLine = normalizeForTopic(line);
        foundTopicStart = SAT_TOPICS.find(t => normalizedLine.startsWith(t.toLowerCase()));
      }

      if (questionMatch || explicitTopicMatch || foundTopicStart) {
        if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));
        let qText = "";
        let detectedTopic = "";

        if (questionMatch) {
          qText = questionMatch[2].trim();

          // First, check if there's a colon-based topic (e.g., "Linear equations in two variable:")
          const colonMatch = qText.match(/^([^:]+):\s*(.*)/);
          if (colonMatch) {
            const potentialTopic = colonMatch[1].trim();
            const remainingText = colonMatch[2].trim();

            // Check if this matches any SAT topic (case-insensitive)
            const matchedTopic = SAT_TOPICS.find(t =>
              normalizeForTopic(potentialTopic) === normalizeForTopic(t) ||
              normalizeForTopic(potentialTopic).startsWith(normalizeForTopic(t))
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
              const normQText = normalizeForTopic(qText);
              const normTopic = normalizeForTopic(satTopic);

              if (normQText.startsWith(normTopic)) {
                // Find the exact character position where the topic ends
                let charCount = 0;
                let normalizedSoFar = '';

                for (let i = 0; i < qText.length; i++) {
                  normalizedSoFar = normalizeForTopic(qText.substring(0, i + 1));

                  // Check if we've matched the full topic
                  if (normalizedSoFar === normTopic || normalizedSoFar.startsWith(normTopic + ' ')) {
                    charCount = i + 1;
                    break;
                  }
                }

                if (charCount > 0) {
                  detectedTopic = satTopic;
                  qText = qText.substring(charCount).replace(/^[,\s.:-]+/, '').trim();

                  // Check for sub-topic in remaining text
                  for (const subTopic of SAT_TOPICS) {
                    if (subTopic === satTopic) continue;

                    const normRemainingText = normalizeForTopic(qText);
                    const normSubTopic = normalizeForTopic(subTopic);

                    if (normRemainingText.startsWith(normSubTopic)) {
                      let subCharCount = 0;
                      let subNormalizedSoFar = '';

                      for (let i = 0; i < qText.length; i++) {
                        subNormalizedSoFar = normalizeForTopic(qText.substring(0, i + 1));

                        if (subNormalizedSoFar === normSubTopic || subNormalizedSoFar.startsWith(normSubTopic + ' ')) {
                          subCharCount = i + 1;
                          break;
                        }
                      }

                      if (subCharCount > 0) {
                        detectedTopic = `${satTopic} - ${subTopic}`;
                        qText = qText.substring(subCharCount).replace(/^[,\s.:-]+/, '').trim();
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
          let topicEndIndex = -1;
          let currentTest = "";
          for (let charIdx = 0; charIdx < line.length; charIdx++) {
            currentTest += line[charIdx];
            if (normalizeForTopic(currentTest) === foundTopicStart.toLowerCase()) { topicEndIndex = charIdx + 1; break; }
          }
          qText = topicEndIndex !== -1 ? line.substring(topicEndIndex).replace(/^[,\s.:-]+/, '').trim() : line.substring(foundTopicStart.length).replace(/^[,\s.:-]+/, '').trim();
        }

        currentQuestion = { question: qText, topic: detectedTopic || null, options: [], correctAnswer: '', explanation: null, level: null };
        if (line.toLowerCase().includes('[easy]')) currentQuestion.level = 'Easy';
        if (line.toLowerCase().includes('[hard]')) currentQuestion.level = 'Hard';
        continue;
      }

      if (!currentQuestion) continue;

      const answerMatch = line.match(/^(Answer|Ans|Correct Answer|Correct|Correct Option)[\s:.-]*\s*(.*)/i);
      const explanationMatch = line.match(/^(Explanation|Sol|Solution|Reason|Note|Hint)[\s:.-]*\s*(.*)/i);
      const choiceExpMatch = line.match(/^(Choice\s+[A-E]\s+is\s+correct|Choice\s+[A-E]\s+is\s+incorrect)/i);

      if (answerMatch) {
        let rawContent = answerMatch[2].trim();
        const splitMatch = rawContent.match(/^([A-E])(?:\)|\.|:|-|\s)\s*(.*)/i);
        if (splitMatch) {
          currentQuestion.correctAnswer = splitMatch[1].toUpperCase();
          if (splitMatch[2] && currentQuestion.explanation === null) currentQuestion.explanation = splitMatch[2].trim();
        } else {
          currentQuestion.correctAnswer = /^[A-E]$/i.test(rawContent) ? rawContent.toUpperCase() : rawContent;
        }
        continue;
      }

      if (explanationMatch || choiceExpMatch) {
        const expText = explanationMatch ? explanationMatch[2].trim() : line;

        // Filter out generic/unhelpful explanations
        const isGenericExplanation = /^Choice\s+[A-E]\s+is\s+(incorrect|correct)\s+(and\s+may\s+result\s+from|This\s+is\s+the\s+value\s+of)/i.test(expText) ||
          /^Choice\s+[A-E]\s+is\s+incorrect\.?$/i.test(expText) ||
          (expText.length < 30 && /incorrect|correct/i.test(expText) && !/because|since|as|therefore|thus/i.test(expText));

        if (!isGenericExplanation) {
          if (currentQuestion.explanation === null) currentQuestion.explanation = expText;
          else currentQuestion.explanation += ' ' + expText;
        }
        continue;
      }

      const { remainingText: lineAfterOptionExtraction, options: extractedFromLine } = extractOptionsFromLine(line, currentQuestion.options.length);
      if (extractedFromLine.length > 0) {
        if (currentQuestion.options.length === 0 && lineAfterOptionExtraction) currentQuestion.question += (currentQuestion.question ? ' ' : '') + lineAfterOptionExtraction;
        currentQuestion.options.push(...extractedFromLine);
        continue;
      }

      if (currentQuestion.explanation !== null) {
        currentQuestion.explanation += ' ' + line;
      } else if (currentQuestion.options.length === 0 && !currentQuestion.correctAnswer) {
        if (currentQuestion.question) {
          const needsNewline = line.includes('$') || line.includes('\\(') || line.match(/\[IMAGE\s*:\s*[^\]]+\]/i);
          currentQuestion.question += (needsNewline ? '\n' : ' ') + line;
        } else currentQuestion.question = line;
      } else if (currentQuestion.options.length > 0) {
        currentQuestion.options[currentQuestion.options.length - 1] += ' ' + line;
      }
    }
    if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));
  } catch (err) { console.error(err); }
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
  q.options = (q.options || []).map(opt => opt.trim()).filter(opt => opt.length > 0);
  if (q.options.length > 4) {
    q.options = q.options.filter(opt => {
      const isExp = /^(is|was)\s+(incorrect|correct|the\s+answer|right|wrong)/i.test(opt) || /^Choice\s+[A-J]\s+is/i.test(opt) || opt.length > 300;
      return !isExp;
    });
  }
  const isEnglishStyle = /(Which choice|logical and precise word|completes the text|best describes|main purpose)/i.test(q.question);
  if (q.options.length >= 2 || isEnglishStyle) q.type = 'mcq';
  else {
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
    q.options = [];
  }
  const text = (q.question + ' ' + q.explanation).toLowerCase();
  if (['standard english', 'grammar', 'punctuation'].some(k => text.includes(k))) q.section = 'writing';
  else if (['main purpose', 'summarizes', 'completes the text'].some(k => text.includes(k))) q.section = 'reading';
  else q.section = 'math';
  return q;
};