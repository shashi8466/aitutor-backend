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
  "Lines, angles, and triangles", "Right triangles and trigonometry", "Circles"
];
SAT_TOPICS.sort((a, b) => b.length - a.length);

/**
 * Main entry point - NOW WITH ROBUST ERROR HANDLING
 */
export const parseDocument = async (file, rawTextOnly = false) => {
  // Support both memory and disk storage uploads by ensuring we always have a buffer
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

    // Validate extracted text
    if (!text || text.trim().length === 0) {
      throw new Error("Could not extract any text from the document. The file may be corrupted or empty.");
    }

  } catch (err) {
    console.error("Parser Error:", err);
    throw new Error(`Text extraction failed: ${err.message}`);
  }

  if (rawTextOnly) {
    return text.trim();
  }

  // Parse into structured questions with error handling
  try {
    const questions = parseTextToQuestions(text);
    // Return both questions and extracted images
    return { questions, images: extractedImages };
  } catch (parseErr) {
    console.error("Question parsing error:", parseErr);
    // Return empty array instead of crashing
    return { questions: [], images: [] };
  }
};

/**
 * DOCX Extraction - ENHANCED ERROR HANDLING
 */
const extractDocxWithMath = async (buffer) => {
  try {
    const zip = new AdmZip(buffer);

    // Check if document.xml exists
    const docEntry = zip.getEntry("word/document.xml");
    if (!docEntry) {
      throw new Error("Invalid DOCX file: word/document.xml not found");
    }

    const xmlContent = zip.readAsText("word/document.xml");
    if (!xmlContent) {
      throw new Error("Document XML is empty");
    }

    const doc = new DOMParser().parseFromString(xmlContent, "text/xml");

    // Check for parsing errors
    const parserError = doc.getElementsByTagName("parsererror")[0];
    if (parserError) {
      throw new Error("XML parsing failed: " + parserError.textContent);
    }

    // Build relationship map for images (r:embed -> media path)
    const relMap = {};
    const relEntry = zip.getEntry("word/_rels/document.xml.rels");
    if (relEntry) {
      try {
        const relXml = zip.readAsText("word/_rels/document.xml.rels");
        const relDoc = new DOMParser().parseFromString(relXml, "text/xml");
        const relNodes = relDoc.getElementsByTagName("Relationship");
        for (let i = 0; i < relNodes.length; i++) {
          const rel = relNodes[i];
          const id = rel.getAttribute("Id");
          const target = rel.getAttribute("Target");
          // Be more flexible with the target path (e.g., media/image1.png)
          if (id && target && (target.includes("media/") || target.includes("embeddings/"))) {
            relMap[id] = "word/" + target.replace(/^(\.\.\/)+/, ""); // Fix relative paths
          }
        }
        console.log(`📑 [PARSER] Loaded ${Object.keys(relMap).length} image relationships`);
      } catch (relErr) {
        console.warn("Failed to parse relationships for images:", relErr.message);
      }
    }

    const paragraphs = doc.getElementsByTagName("w:p");
    if (!paragraphs || paragraphs.length === 0) {
      throw new Error("No paragraphs found in document");
    }

    let fullText = "";
    const extractedImages = [];

    // Helper to find embed ID in a node recursively (more robust)
    const findEmbedId = (node) => {
      const getAttr = (el, attrName) => {
        // Try standard namespaces
        const namespaces = [
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
          "http://schemas.microsoft.com/office/2006/relationships"
        ];
        for (const ns of namespaces) {
          const val = el.getAttributeNS(ns, attrName);
          if (val) return val;
        }
        // Fallback: search all attributes for one that matches local name
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          if (attr.localName === attrName || attr.name.endsWith(":" + attrName)) {
            return attr.value;
          }
        }
        return el.getAttribute(attrName);
      };

      // Try a:blip (Standard Drawing)
      const blips = node.getElementsByTagName("a:blip");
      if (blips.length > 0) return getAttr(blips[0], "embed");

      // Try v:imagedata (Legacy Picture/Shape)
      const imagedata = node.getElementsByTagName("v:imagedata");
      if (imagedata.length > 0) return getAttr(imagedata[0], "id");

      // Try v:fill (Sometimes used in shapes)
      const fills = node.getElementsByTagName("v:fill");
      if (fills.length > 0) return getAttr(fills[0], "relid") || getAttr(fills[0], "id");

      return null;
    };

    const processParagraph = (pNode) => {
      let text = "";
      const childNodes = pNode.childNodes;

      // First, extract all text from w:r/w:t as usual
      for (let j = 0; j < childNodes.length; j++) {
        const node = childNodes[j];
        if (node.nodeName === "w:r") {
          const textNodes = node.getElementsByTagName("w:t");
          for (let t = 0; t < textNodes.length; t++) {
            text += textNodes[t].textContent;
          }
        } else if (node.nodeName.endsWith("oMath") || node.nodeName.endsWith("oMathPara")) {
          try {
            text += convertToLatex(node);
          } catch (e) { text += " [Equation] "; }
        }
      }

      // Second, extract ALL images/diagrams from the entire paragraph scope (not just runs)
      // This catches floating drawings and anchored objects.
      const drawings = pNode.getElementsByTagName("w:drawing");
      const picts = pNode.getElementsByTagName("w:pict");

      const processImgNode = (imgNode) => {
        const embedId = findEmbedId(imgNode);
        if (embedId && relMap[embedId]) {
          try {
            const imgEntry = zip.getEntry(relMap[embedId]);
            if (imgEntry) {
              const imageBuffer = imgEntry.getData();
              const imageExt = path.extname(imgEntry.entryName).substring(1);
              const imageName = `image_${Date.now()}_${embedId}.${imageExt}`;
              extractedImages.push({
                id: embedId,
                extension: imageExt,
                buffer: imageBuffer,
                name: imageName
              });
              text += ` [IMAGE: ${embedId}.${imageExt}] `;
              console.log(`📸 [PARSER] Extracted image ${embedId} from paragraph`);
            }
          } catch (e) {
            console.warn("Image extraction failed", e);
          }
        }
      };

      for (let d = 0; d < drawings.length; d++) processImgNode(drawings[d]);
      for (let p = 0; p < picts.length; p++) processImgNode(picts[p]);

      return text;
    };

    // Use a unified loop for paragraphs and tables
    const bodyContainer = doc.getElementsByTagName("w:body")[0];
    const topLevelNodes = bodyContainer.childNodes;

    for (let i = 0; i < topLevelNodes.length; i++) {
      const node = topLevelNodes[i];
      if (node.nodeName === "w:p") {
        const pText = processParagraph(node);
        if (pText.trim()) {
          fullText += pText + "\n\n";
        }
      } else if (node.nodeName === "w:tbl") {
        const rows = node.getElementsByTagName("w:tr");
        let tableHtml = '<table class="docx-table" style="width:100%; border-collapse:collapse; margin:15px 0; border:1px solid #ddd;">';
        for (let r = 0; r < rows.length; r++) {
          tableHtml += '<tr>';
          const cells = rows[r].getElementsByTagName("w:tc");
          for (let c = 0; c < cells.length; c++) {
            // Process paragraphs inside table cell (no double newline in cells)
            const cellParagraphs = cells[c].getElementsByTagName("w:p");
            let cellContent = "";
            for (let p = 0; p < cellParagraphs.length; p++) {
              cellContent += processParagraph(cellParagraphs[p]) + " ";
            }
            tableHtml += `<td style="border:1px solid #ddd; padding:8px; vertical-align:top;">${cellContent.trim()}</td>`;
          }
          tableHtml += '</tr>';
        }
        tableHtml += '</table>\n\n';
        fullText += tableHtml;
      }
    }

    if (!fullText || fullText.trim().length === 0) {
      throw new Error("No text content extracted from document");
    }

    return { text: fullText, images: extractedImages };

  } catch (err) {
    console.error("DOCX extraction error:", err);
    throw new Error(`Failed to read DOCX file: ${err.message}. The file may be corrupted or password-protected.`);
  }
};

/**
 * Question Parsing - SAFE VERSION
 */
const parseTextToQuestions = (text) => {
  const questions = [];

  try {
    const cleanText = text
      .replace(/\u2013|\u2014|\u2212/g, '-')
      .replace(/\u00F7/g, '/');

    const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    let currentQuestion = null;

    for (let i = 0; i < lines.length; i++) {
      try {
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
            level: null
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

        // Detect Options
        const optionMatch = line.match(/^(\$?[A-Da-d])[.):-]\s*(.*)/);
        if (optionMatch) {
          currentQuestion.options.push(optionMatch[2].trim());
          continue;
        }

        // Inline Options
        const inlineOptions = line.match(/([A-D])\)\s*([^A-D\n]+)/g);
        if (inlineOptions && inlineOptions.length > 1) {
          inlineOptions.forEach(opt => {
            const parts = opt.match(/([A-D])\)\s*(.*)/);
            if (parts) currentQuestion.options.push(parts[2].trim());
          });
          continue;
        }

        // Answer
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

        // Explanation
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

      } catch (lineErr) {
        console.warn("Error processing line:", lineErr.message);
        continue;
      }
    }

    if (currentQuestion) {
      questions.push(finalizeQuestion(currentQuestion));
    }

  } catch (err) {
    console.error("Question parsing failed:", err);
    throw err;
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
  try {
    if (q.explanation === null) q.explanation = '';

    const isEnglishStyle = /(Which choice|logical and precise word|completes the text|best describes|main purpose)/i.test(q.question);

    if (q.options.length >= 2 || isEnglishStyle) {
      q.type = 'mcq';
    } else {
      q.type = 'short_answer';

      if (q.options.length > 0 && /^[A-E]$/i.test(q.correctAnswer)) {
        const idx = q.correctAnswer.toUpperCase().charCodeAt(0) - 65;
        if (q.options[idx]) {
          q.correctAnswer = q.options[idx];
        }
      }

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
  } catch (err) {
    console.warn("Error finalizing question:", err.message);
    return q;
  }
};