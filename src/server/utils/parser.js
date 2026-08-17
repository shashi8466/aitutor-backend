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
  "Rhetorical synthesis", "Text Structure and Purpose", "Transitions", "Boundaries",
  "Form, Structure, and Sense", "Cross-Text Connections", "Textual Evidence",
  "Command of textual evidence", "Command of quantitative evidence", "Quantitative evidence",
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
  "Ratios rates proportional relationships and units", "Two-variable data: models and scatterplots",
  "One-variable data distributions and measures of center and spread",
  "Ratios, rates, proportional relationships and units",
  "Problem Solving & Data Analysis", "Systems of two linear equations in two variables",
  "Lines angles and triangles"
];
SAT_TOPICS.sort((a, b) => b.length - a.length);

/**
 * Checks if a table HTML string is designed as a question template containing metadata cells.
 */
const isQuestionTable = (tableLine) => {
  if (!tableLine) return false;
  const cells = [...tableLine.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].trim());
  return cells.some(cell => {
    const cleanCell = cell.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return cleanCell.match(/^Domain\s+/i) || cleanCell.match(/^Skill\s+/i) || cleanCell.match(/^Difficulty\s*/i);
  });
};

/**
 * Robustly extracts options from a line of text, handling both single and multiple options.
 * Now takes currentOptionsCount to ensure sequential detection (A, B, C...)
 */
const extractOptionsFromLine = (text, currentOptionsCount = 0) => {
  const options = [];
  let remainingText = text;

  // Stricter regex for SAT: Only A-E
  // Must be Uppercase.
  // We now allow it anywhere in the line as long as it follows our sequence (A, B, C...)
  // Support A), A., (A)
  // The preceding-character class also allows sentence punctuation (.?!,;:) since a DOCX
  // question stem ending in "?" is often typed with no space directly before the first
  // option letter (e.g. "...phrase?A)theory") - without this, the whole A-D run was never
  // matched and stayed glued onto the question text instead of becoming separate options.
  const optRegex = /(?:^|[\s\t>\](.?!,;:])([A-E])[\s]*[).][\s]*/g;
  const matches = [...text.matchAll(optRegex)];

  if (matches.length > 0) {
    let nextExpectedIndex = currentOptionsCount;
    let firstValidMatchIdx = -1;

    // Count sequential matches starting from nextExpectedIndex
    let sequentialCount = 0;
    let tempExpectedIndex = nextExpectedIndex;
    for (let i = 0; i < matches.length; i++) {
      const letter = matches[i][1].toUpperCase();
      const letterIndex = letter.charCodeAt(0) - 65;
      if (letterIndex === tempExpectedIndex) {
        sequentialCount++;
        tempExpectedIndex++;
      }
    }

    for (let i = 0; i < matches.length; i++) {
      const letter = matches[i][1].toUpperCase();
      const letterIndex = letter.charCodeAt(0) - 65;

      // Check if this matches our sequence (A if first, then B, C, D...)
      if (letterIndex === nextExpectedIndex) {
        // SAFETY CHECK: If the first match is NOT at the start of the line (index > 0 after trimming leading spaces),
        // require at least 2 sequential options on this line to prevent false positives (like "point A. lies on circle O.").
        const isAtStart = matches[i].index === 0 || text.substring(0, matches[i].index).trim() === '';
        if (!isAtStart && sequentialCount < 2) {
          break;
        }

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
export const parseDocument = async (file, rawTextOnly = false, options = {}) => {
  const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
  const fileType = file.originalname.split('.').pop().toLowerCase();
  let text = '';
  let extractedImages = [];

  try {
    if (!buffer) {
      throw new Error('File buffer missing. Unable to read uploaded file.');
    }
    if (fileType === 'docx') {
      const result = await extractDocxWithMath(buffer, options);
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
/**
 * Reads word/numbering.xml (if present) and builds a lookup of
 * `${numId}:${ilvl}` -> Word's raw numFmt string (e.g. "bullet", "decimal",
 * "lowerLetter", "upperRoman"...) so list paragraphs can be rendered with the
 * same bullet/number style and nesting as the original document.
 */
const buildNumFormatMap = (zip) => {
  const numFormatMap = {};
  try {
    const numEntry = zip.getEntry("word/numbering.xml");
    if (!numEntry) return numFormatMap;

    const numXml = zip.readAsText("word/numbering.xml");
    const numDoc = new DOMParser().parseFromString(numXml, "text/xml");

    const getAttr = (node, name) => node.getAttribute(`w:${name}`) || node.getAttribute(name);
    const getChild = (node, tag) => node.getElementsByTagName(`w:${tag}`)[0] || node.getElementsByTagName(tag)[0];

    const numIdToAbstract = {};
    const numNodes = numDoc.getElementsByTagName("w:num");
    for (let i = 0; i < numNodes.length; i++) {
      const n = numNodes[i];
      const id = getAttr(n, "numId");
      const abstractNode = getChild(n, "abstractNumId");
      const abstractId = abstractNode ? getAttr(abstractNode, "val") : null;
      if (id && abstractId !== null) numIdToAbstract[id] = abstractId;
    }

    const abstractFormats = {};
    const abstractNodes = numDoc.getElementsByTagName("w:abstractNum");
    for (let i = 0; i < abstractNodes.length; i++) {
      const an = abstractNodes[i];
      const abstractId = getAttr(an, "abstractNumId");
      const lvlNodes = an.getElementsByTagName("w:lvl");
      const lvlMap = {};
      for (let l = 0; l < lvlNodes.length; l++) {
        const lvlNode = lvlNodes[l];
        const ilvl = getAttr(lvlNode, "ilvl");
        const fmtNode = getChild(lvlNode, "numFmt");
        const fmt = fmtNode ? (getAttr(fmtNode, "val") || "bullet") : "bullet";
        if (ilvl !== null) lvlMap[ilvl] = fmt;
      }
      abstractFormats[abstractId] = lvlMap;
    }

    Object.entries(numIdToAbstract).forEach(([numId, abstractId]) => {
      const lvlMap = abstractFormats[abstractId] || {};
      Object.entries(lvlMap).forEach(([ilvl, fmt]) => {
        numFormatMap[`${numId}:${ilvl}`] = fmt;
      });
    });
  } catch (e) { /* Numbering info is best-effort; fall back to plain paragraphs on failure */ }
  return numFormatMap;
};

// Maps Word's numFmt values to valid CSS list-style-type keywords. Most Word
// formats (decimal, lowerLetter, upperLetter, lowerRoman, upperRoman) already
// match CSS keywords exactly.
const numFmtToCssListStyle = (fmt) => {
  const known = ['decimal', 'lowerLetter', 'upperLetter', 'lowerRoman', 'upperRoman'];
  if (known.includes(fmt)) return fmt;
  return null; // bullet or unknown -> caller decides (disc/circle/square)
};

const extractDocxWithMath = async (buffer, options = {}) => {
  try {
    const zip = new AdmZip(buffer);
    const docEntry = zip.getEntry("word/document.xml");
    if (!docEntry) throw new Error("Invalid DOCX file");

    const xmlContent = zip.readAsText("word/document.xml");
    const doc = new DOMParser().parseFromString(xmlContent, "text/xml");
    const numFormatMap = buildNumFormatMap(zip);

    const getListInfo = (pNode) => {
      const pPr = pNode.getElementsByTagName ? (pNode.getElementsByTagName("w:pPr")[0] || pNode.getElementsByTagName("pPr")[0]) : null;
      if (!pPr) return null;
      const numPr = pPr.getElementsByTagName("w:numPr")[0] || pPr.getElementsByTagName("numPr")[0];
      if (!numPr) return null;
      const numIdNode = numPr.getElementsByTagName("w:numId")[0] || numPr.getElementsByTagName("numId")[0];
      const ilvlNode = numPr.getElementsByTagName("w:ilvl")[0] || numPr.getElementsByTagName("ilvl")[0];
      const numId = numIdNode ? (numIdNode.getAttribute("w:val") || numIdNode.getAttribute("val")) : null;
      if (numId === null || numId === "0") return null; // numId 0 = explicitly no numbering
      const ilvl = ilvlNode ? parseInt(ilvlNode.getAttribute("w:val") || ilvlNode.getAttribute("val") || "0", 10) : 0;
      const numFmt = numFormatMap[`${numId}:${ilvl}`] || 'bullet';
      return { ilvl, numFmt };
    };

    const relMap = {};
    const relEntry = zip.getEntry("word/_rels/document.xml.rels");
    if (relEntry) {
      const relXml = zip.readAsText("word/_rels/document.xml.rels");
      const relDoc = new DOMParser().parseFromString(relXml, "text/xml");
      const relNodes = relDoc.getElementsByTagName("Relationship");
      for (let i = 0; i < relNodes.length; i++) {
        const rel = relNodes[i];
        const id = rel.getAttribute("Id") || rel.getAttribute("id");
        const target = rel.getAttribute("Target") || rel.getAttribute("target");
        if (id && target) {
          relMap[id] = "word/" + target.replace(/^(\.\.\/)+/, "");
        }
      }
    }

    const extractedImages = [];
    const findEmbedId = (node) => {
      if (!node || node.nodeType !== 1) return null;
      
      // Check attributes of current node
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        if (attr.localName === 'embed' || attr.localName === 'id') {
          const val = attr.value;
          if (val && val.startsWith('rId')) return val;
        }
      }

      // Check children recursively
      if (node.childNodes) {
        for (let i = 0; i < node.childNodes.length; i++) {
          const res = findEmbedId(node.childNodes[i]);
          if (res) return res;
        }
      }
      return null;
    };

    const processRunNode = (rNode) => {
      if (!rNode) return "";

      let isUnderline = false;
      let isBold = false;
      let isItalic = false;
      let isStrike = false;
      let isSuper = false;
      let isSub = false;
      let isHighlight = false;

      const rPrNodes = rNode.getElementsByTagName ? (rNode.getElementsByTagName("w:rPr")[0] || rNode.getElementsByTagName("rPr")[0]) : null;
      if (rPrNodes) {
        const children = rPrNodes.childNodes || [];
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.nodeType !== 1) continue;
          const name = child.localName || child.nodeName.split(':').pop();
          const val = child.getAttribute ? (child.getAttribute("w:val") || child.getAttribute("val")) : null;

          if (name === 'u' && val !== 'none') {
            isUnderline = true;
          } else if (name === 'b' || name === 'bCs') {
            if (val !== '0' && val !== 'false') isBold = true;
          } else if (name === 'i' || name === 'iCs') {
            if (val !== '0' && val !== 'false') isItalic = true;
          } else if (name === 'strike') {
            if (val !== '0' && val !== 'false') isStrike = true;
          } else if (name === 'vertAlign') {
            if (val === 'superscript') isSuper = true;
            if (val === 'subscript') isSub = true;
          } else if (name === 'highlight') {
            isHighlight = true;
          }
        }
      }

      let runContent = "";
      const children = rNode.childNodes || [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 3) {
          runContent += child.nodeValue || "";
          continue;
        }
        if (child.nodeType !== 1) continue;
        const tagName = child.nodeName.split(':').pop();

        if (tagName === 't') {
          runContent += child.textContent || "";
        } else if (tagName === 'br' || tagName === 'cr') {
          runContent += "\n";
        } else if (tagName === 'tab') {
          runContent += "\t";
        } else if (tagName === 'drawing' || tagName === 'pict') {
          const embedId = findEmbedId(child);
          if (embedId && relMap[embedId]) {
            try {
              const imgEntry = zip.getEntry(relMap[embedId]);
              if (imgEntry) {
                const imageBuffer = imgEntry.getData();
                const imageExt = path.extname(imgEntry.entryName).substring(1);
                const prefix = options.imagePrefix || '';
                const stableName = `${prefix}${embedId}.${imageExt}`;
                extractedImages.push({ id: embedId, extension: imageExt, buffer: imageBuffer, name: stableName });
                runContent += `[IMAGE: ${stableName}]`;
              }
            } catch (e) { }
          }
        } else if (tagName === 'oMath' || tagName === 'oMathPara') {
          try { runContent += convertToLatex(child); } catch (e) { runContent += " [Equation] "; }
        }
      }

      if (!runContent) return "";

      if (isUnderline) runContent = `<u>${runContent}</u>`;
      if (isBold) runContent = `<b>${runContent}</b>`;
      if (isItalic) runContent = `<i>${runContent}</i>`;
      if (isStrike) runContent = `<s>${runContent}</s>`;
      if (isSuper) runContent = `<sup>${runContent}</sup>`;
      if (isSub) runContent = `<sub>${runContent}</sub>`;
      if (isHighlight) runContent = `<mark>${runContent}</mark>`;

      return runContent;
    };

    const processParagraph = (pNode) => {
      if (!pNode) return "";
      let pText = "";
      const children = pNode.childNodes || [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 3) {
          pText += child.nodeValue || "";
          continue;
        }
        if (child.nodeType !== 1) continue;
        const tagName = child.nodeName.split(':').pop();

        if (tagName === 'r') {
          pText += processRunNode(child);
        } else if (tagName === 'hyperlink') {
          const linkRuns = child.getElementsByTagName ? child.getElementsByTagName("w:r") : [];
          for (let r = 0; r < linkRuns.length; r++) {
            pText += processRunNode(linkRuns[r]);
          }
        } else if (tagName === 'oMath' || tagName === 'oMathPara') {
          try { pText += convertToLatex(child); } catch (e) { pText += " [Equation] "; }
        } else if (tagName === 'drawing' || tagName === 'pict') {
          const embedId = findEmbedId(child);
          if (embedId && relMap[embedId]) {
            try {
              const imgEntry = zip.getEntry(relMap[embedId]);
              if (imgEntry) {
                const imageBuffer = imgEntry.getData();
                const imageExt = path.extname(imgEntry.entryName).substring(1);
                const prefix = options.imagePrefix || '';
                const stableName = `${prefix}${embedId}.${imageExt}`;
                extractedImages.push({ id: embedId, extension: imageExt, buffer: imageBuffer, name: stableName });
                pText += `[IMAGE: ${stableName}]`;
              }
            } catch (e) { }
          }
        } else if (tagName === 'br') {
          pText += "\n";
        }
      }

      // Merge adjacent identical tags for clean HTML output
      pText = pText
        .replace(/<\/u>(\s*)<u>/gi, '$1')
        .replace(/<\/b>(\s*)<b>/gi, '$1')
        .replace(/<\/i>(\s*)<i>/gi, '$1')
        .replace(/<\/s>(\s*)<s>/gi, '$1');

      return pText;
    };

    let fullText = "";

    // Stack of currently-open <ul>/<ol> elements (by nesting level), used to
    // rebuild Word's list hierarchy as real HTML so bullets/numbering/nesting
    // survive storage and render natively in the admin editor and student exam.
    let openListStack = [];
    let listBuffer = "";

    const listStyleFor = (ilvl, numFmt) => {
      const cssStyle = numFmtToCssListStyle(numFmt);
      if (cssStyle) return { tag: 'ol', listStyleType: cssStyle };
      const bulletCycle = ['disc', 'circle', 'square'];
      return { tag: 'ul', listStyleType: bulletCycle[ilvl % bulletCycle.length] };
    };

    const pushListItem = (ilvl, numFmt, itemHtml) => {
      const { tag, listStyleType } = listStyleFor(ilvl, numFmt);
      const openTag = `<${tag} style="list-style-type:${listStyleType}; padding-left:1.5em; margin:0.4em 0;">`;

      if (openListStack.length === 0) {
        openListStack.push({ ilvl, tag });
        listBuffer += `${openTag}<li style="margin:0.3em 0;">${itemHtml}`;
        return;
      }

      const top = openListStack[openListStack.length - 1];
      if (ilvl > top.ilvl) {
        openListStack.push({ ilvl, tag });
        listBuffer += `${openTag}<li style="margin:0.3em 0;">${itemHtml}`;
      } else if (ilvl === top.ilvl) {
        listBuffer += `</li><li style="margin:0.3em 0;">${itemHtml}`;
      } else {
        while (openListStack.length > 1 && openListStack[openListStack.length - 1].ilvl > ilvl) {
          const popped = openListStack.pop();
          listBuffer += `</li></${popped.tag}>`;
        }
        const newTop = openListStack[openListStack.length - 1];
        if (newTop.ilvl === ilvl) {
          listBuffer += `</li><li style="margin:0.3em 0;">${itemHtml}`;
        } else {
          const popped = openListStack.pop();
          listBuffer += `</li></${popped.tag}>`;
          openListStack.push({ ilvl, tag });
          listBuffer += `${openTag}<li style="margin:0.3em 0;">${itemHtml}`;
        }
      }
    };

    const closeAllLists = () => {
      if (openListStack.length === 0) return;
      for (let i = openListStack.length - 1; i >= 0; i--) {
        listBuffer += `</li></${openListStack[i].tag}>`;
      }
      fullText += listBuffer + "\n\n";
      listBuffer = "";
      openListStack = [];
    };

    const bodyContainer = doc.getElementsByTagName("w:body")[0];
    const topLevelNodes = bodyContainer.childNodes;
    for (let i = 0; i < topLevelNodes.length; i++) {
      const node = topLevelNodes[i];
      if (node.nodeName === "w:p") {
        const listInfo = getListInfo(node);
        const pText = processParagraph(node);
        if (listInfo && pText.trim()) {
          pushListItem(listInfo.ilvl, listInfo.numFmt, pText);
          continue;
        }
        closeAllLists();
        if (pText.trim()) fullText += pText + "\n\n";
      } else if (node.nodeName === "w:tbl") {
        closeAllLists();
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
    closeAllLists();
    return { text: fullText, images: extractedImages };
  } catch (err) {
    throw new Error(`DOCX extraction failed: ${err.message}`);
  }
};

const parseTableBlock = (lines) => {
  const tableLine = lines[0];
  let tableTopic = "";
  let tableDifficulty = "";
  
  const cells = [...tableLine.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1].trim());
  cells.forEach(cell => {
    const cleanCell = cell.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (cleanCell.match(/^Domain\s+/i)) {
      tableTopic = cleanCell.replace(/^Domain\s+/i, '').trim();
    } else if (cleanCell.match(/^Skill\s+/i)) {
      tableTopic = cleanCell.replace(/^Skill\s+/i, '').trim();
    } else if (cleanCell.match(/^Difficulty\s*/i)) {
      const diff = cleanCell.replace(/^Difficulty\s*/i, '').trim();
      if (diff) tableDifficulty = diff;
    }
  });

  let answerLineIdx = -1;
  let correctAnswer = "";
  for (let i = 1; i < lines.length; i++) {
    const match = lines[i].match(/^(Correct Answer|Correct|Answer|Ans)[\s:.-]*\s*(.*)/i);
    if (match) {
      answerLineIdx = i;
      correctAnswer = match[2].trim();
      break;
    }
  }

  if (answerLineIdx === -1) {
    return null;
  }

  if (!correctAnswer && answerLineIdx + 1 < lines.length) {
    correctAnswer = lines[answerLineIdx + 1].trim();
  }

  const options = [];
  const questionStemLines = [];
  
  let optCount = 0;
  let optStartIdx = answerLineIdx;
  while (optCount < 4 && optStartIdx > 1) {
    optStartIdx--;
    optCount++;
  }

  for (let i = optStartIdx; i < answerLineIdx; i++) {
    options.push(lines[i]);
  }

  for (let i = 1; i < optStartIdx; i++) {
    questionStemLines.push(lines[i]);
  }

  const explanationLines = [];
  const isAnswerOnSameLine = !!lines[answerLineIdx].match(/^(Correct Answer|Correct|Answer|Ans)[\s:.-]*\s*[A-E]$/i);
  const startExpIdx = isAnswerOnSameLine ? answerLineIdx + 1 : answerLineIdx + 2;
  
  for (let i = startExpIdx; i < lines.length; i++) {
    explanationLines.push(lines[i]);
  }

  const questionText = questionStemLines.join('\n');
  const explanationText = explanationLines.join('\n').replace(/^(Rationale|Explanation)[\s:.-]*/i, '').trim();

  const q = {
    question: questionText,
    topic: tableTopic || null,
    options: options,
    correctAnswer: /^[A-E]$/i.test(correctAnswer) ? correctAnswer.toUpperCase() : correctAnswer,
    explanation: explanationText,
    level: tableDifficulty || null,
    type: 'mcq',
    section: 'writing'
  };

  return finalizeQuestion(q);
};

const parseTextToQuestions = (text) => {
  try {
    const cleanText = text.replace(/\u2013|\u2014|\u2212/g, '-').replace(/\u00F7/g, '/');
    const lines = cleanText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    
    // Find all indices of lines starting a table that are ACTUALLY question tables containing metadata
    const tableIndices = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('<table class="docx-table"') && isQuestionTable(lines[i])) {
        tableIndices.push(i);
      }
    }

    // A: If there are table-based questions, process them as blocks
    if (tableIndices.length > 0) {
      const questions = [];
      for (let k = 0; k < tableIndices.length; k++) {
        const start = tableIndices[k];
        const end = (k + 1 < tableIndices.length) ? tableIndices[k + 1] : lines.length;
        const blockLines = lines.slice(start, end);
        const q = parseTableBlock(blockLines);
        if (q) questions.push(q);
      }
      return questions;
    }

    // B: Fallback to original line-by-line parsing logic if no tables exist
    const questions = [];
    let currentQuestion = null;
    let currentPassage = null;

    const normalizeForTopic = (str) => {
      if (!str) return '';
      if (str.trim().startsWith('[IMAGE:')) return '___IMAGE_TAG___';
      
      return str
        .toLowerCase()
        .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
        .replace(/&/g, 'and')
        .replace(/[,\s.:\-_]+/g, ' ')
        .replace(/[^a-z0-9 ]/g, '')
        .trim();
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const passageRegex = /^(?:(?:Reading|Science)\s+)?Passage\s*(?:\d+|[IVX]+)?[:.-]?\s*(.*)|^(?:Table|Figure|Chart|Graph|Diagram)\s*\d+[:.-]?\s*(.*)|^Section\s*(?:\d+|[IVX]+|Header)[:.-]?\s*(.*)/i;
      const passageMatch = line.match(passageRegex);
      const questionMatch = line.match(/^(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*(.*)/i);
      
      if (passageMatch && !questionMatch) {
         if (currentQuestion) {
           questions.push(finalizeQuestion(currentQuestion));
           currentQuestion = null;
         }
         currentPassage = line;
         continue;
      }

      if (currentPassage !== null && !currentQuestion && !questionMatch && !line.match(/^Topic:\s*(.*)/i)) {
         currentPassage += '\n' + line;
         continue;
      }

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
          const colonMatch = qText.match(/^([^:]+):\s*(.*)/);
          if (colonMatch) {
            const potentialTopic = colonMatch[1].trim();
            const remainingText = colonMatch[2].trim();
            const matchedTopic = SAT_TOPICS.find(t =>
              normalizeForTopic(potentialTopic) === normalizeForTopic(t) ||
              normalizeForTopic(potentialTopic).startsWith(normalizeForTopic(t))
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
              const normQText = normalizeForTopic(qText);
              const normTopic = normalizeForTopic(satTopic);
              if (normQText.startsWith(normTopic)) {
                let charCount = 0;
                let normalizedSoFar = '';
                for (let j = 0; j < qText.length; j++) {
                  normalizedSoFar = normalizeForTopic(qText.substring(0, j + 1));
                  if (normalizedSoFar === normTopic || normalizedSoFar.startsWith(normTopic + ' ')) {
                    charCount = j + 1;
                    break;
                  }
                }
                if (charCount > 0) {
                  detectedTopic = satTopic;
                  qText = qText.substring(charCount).replace(/^[,\s.:-]+/, '').trim();
                  for (const subTopic of SAT_TOPICS) {
                    if (subTopic === satTopic) continue;
                    const normRemainingText = normalizeForTopic(qText);
                    const normSubTopic = normalizeForTopic(subTopic);
                    if (normRemainingText.startsWith(normSubTopic)) {
                      let subCharCount = 0;
                      let subNormalizedSoFar = '';
                      for (let j = 0; j < qText.length; j++) {
                        subNormalizedSoFar = normalizeForTopic(qText.substring(0, j + 1));
                        if (subNormalizedSoFar === normSubTopic || subNormalizedSoFar.startsWith(normSubTopic + ' ')) {
                          subCharCount = j + 1;
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

        // Capture the literal question number as printed in the source document (e.g. "Q.26)" -> 26),
        // so the admin UI can display and order by the original source-file sequence rather than
        // database insertion order.
        let questionNumber = null;
        if (questionMatch) {
          const numMatch = questionMatch[1].match(/\d+/);
          if (numMatch) questionNumber = parseInt(numMatch[0], 10);
        }

        currentQuestion = { question: qText, topic: detectedTopic || null, options: [], correctAnswer: '', explanation: null, level: null, passage: currentPassage ? currentPassage.trim() : null, questionNumber };
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
        const expText = explanationMatch ? explanationMatch[2].trim() : line.trim();
        if (currentQuestion.explanation === null) {
          currentQuestion.explanation = expText;
        } else {
          const separator = (expText.startsWith('Choice') || expText.startsWith('Question')) ? '\n' : ' ';
          currentQuestion.explanation += separator + expText;
        }
        continue;
      }

      const { remainingText: lineAfterOptionExtraction, options: extractedFromLine } = extractOptionsFromLine(line, currentQuestion.options.length);
      if (extractedFromLine.length > 0) {
        if (currentQuestion.options.length === 0 && currentQuestion.question) {
          const imageTagRegex = /\[IMAGE\s*:\s*[^\]]+\]\s*$/i;
          let match;
          const trailingImages = [];
          let qText = currentQuestion.question.trim();
          while ((match = qText.match(imageTagRegex))) {
            trailingImages.unshift(match[0].trim());
            qText = qText.replace(imageTagRegex, '').trim();
          }
          currentQuestion.question = qText;
          
          if (trailingImages.length > 0) {
            const combinedImages = trailingImages.join('\n');
            if (extractedFromLine[0]) extractedFromLine[0] = combinedImages + "\n" + extractedFromLine[0];
            else extractedFromLine[0] = combinedImages;
          }
        }

        if (currentQuestion.options.length === 0 && lineAfterOptionExtraction) currentQuestion.question += (currentQuestion.question ? ' ' : '') + lineAfterOptionExtraction;
        currentQuestion.options.push(...extractedFromLine);
        continue;
      }

      if (currentQuestion.explanation !== null) {
        currentQuestion.explanation += (currentQuestion.explanation ? '\n' : '') + line;
      } else if (currentQuestion.options.length === 0 && !currentQuestion.correctAnswer) {
        const isImage = line.match(/\[IMAGE\s*:\s*[^\]]+\]/i);
        if (currentQuestion.question) {
          const needsNewline = line.includes('$') || line.includes('\\(') || isImage || currentQuestion.question.length > 100;
          currentQuestion.question += (needsNewline ? '\n' : ' ') + line;
        } else currentQuestion.question = line;
      } else if (currentQuestion.options.length > 0) {
        currentQuestion.options[currentQuestion.options.length - 1] += '\n' + line;
      }
    }
    if (currentQuestion) questions.push(finalizeQuestion(currentQuestion));
    return questions;
  } catch (err) {
    console.error(err);
    return [];
  }
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
  
  // Clean question text from any leaked prefixes, BUT PROTECT IMAGE TAGS
  // We use a lookahead to ensure we don't strip [IMAGE:
  q.question = q.question
    .replace(/^(?!\s*\[IMAGE:)(\d+[.)\s]|Q\.?\d+[:.)]?|Question\s*\d+[:.)]?)\s*/i, '') // Remove Q.1) etc.
    .replace(/^(?!\s*\[IMAGE:)Topic:\s*(.*)/i, '$1') // Remove Topic: prefix
    .replace(/^(?!\s*\[IMAGE:)[,\s.:-]+/, '') // Remove leading punctuation
    .trim();

  // Try to extract topic from question text if topic is still null
  if (!q.topic) {
    for (const t of SAT_TOPICS) {
       if (q.question.toLowerCase().startsWith(t.toLowerCase())) {
          q.topic = t;
          q.question = q.question.substring(t.length).replace(/^[,\s.:-]+/, '').trim();
          break;
       }
    }
  }

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
  if (['standard english', 'grammar', 'punctuation', 'word', 'logical'].some(k => text.includes(k))) q.section = 'writing';
  else if (['main purpose', 'summarizes', 'completes the text', 'author', 'passage'].some(k => text.includes(k))) q.section = 'reading';
  else q.section = 'math';
  return q;
};
