/**
 * Converts Office Math Markup Language (OMML) XML nodes to LaTeX.
 * Works with both Browser DOM nodes and xmldom (Node.js) nodes.
 */

// Helper to get tag name ignoring namespace prefixes (m:oMath -> oMath)
const getTagName = (node) => {
  if (!node || (!node.tagName && !node.nodeName)) return '';
  const name = node.tagName || node.nodeName;
  return name.includes(':') ? name.split(':')[1] : name;
};

// Recursive function to process OMML nodes
export const convertToLatex = (node) => {
  if (!node) return '';

  // Handle Text Nodes
  if (node.nodeType === 3) { // TEXT_NODE
    return node.nodeValue;
  }

  const tagName = getTagName(node);
  const children = Array.from(node.childNodes || []);

  switch (tagName) {
    case 'oMath': // Inline Math Container
    case 'oMathPara': // Block Math Container
      return ` \\(${children.map(convertToLatex).join('')}\\) `;

    case 'f': // Fraction
      const num = children.find(c => getTagName(c) === 'num');
      const den = children.find(c => getTagName(c) === 'den');
      return `\\frac{${convertToLatex(num)}}{${convertToLatex(den)}}`;

    case 'rad': // Radical / Root
      const radBase = children.find(c => getTagName(c) === 'e'); // Base
      const deg = children.find(c => getTagName(c) === 'deg'); // Degree (optional)
      const degText = deg ? convertToLatex(deg) : null;
      return degText ? `\\sqrt[${degText}]{${convertToLatex(radBase)}}` : `\\sqrt{${convertToLatex(radBase)}}`;

    case 'sSup': // Superscript
      const supBase = children.find(c => getTagName(c) === 'e');
      const supVal = children.find(c => getTagName(c) === 'sup');
      return `{${convertToLatex(supBase)}}^{${convertToLatex(supVal)}}`;

    case 'sSub': // Subscript
      const subBase = children.find(c => getTagName(c) === 'e');
      const subVal = children.find(c => getTagName(c) === 'sub');
      return `{${convertToLatex(subBase)}}_{${convertToLatex(subVal)}}`;

    case 'sSubSup': // Subscript & Superscript
      const base = children.find(c => getTagName(c) === 'e');
      const sub = children.find(c => getTagName(c) === 'sub');
      const sup = children.find(c => getTagName(c) === 'sup');
      return `{${convertToLatex(base)}}_{${convertToLatex(sub)}}^{${convertToLatex(sup)}}`;

    case 'd': // Delimiter (Parentheses, brackets)
      // Try to extract content. We default to () if no specific separator logic is implemented yet.
      const content = children.find(c => getTagName(c) === 'e');
      return `(${convertToLatex(content)})`;

    case 'nary': // Integral / Sum
      const narySub = children.find(c => getTagName(c) === 'sub');
      const narySup = children.find(c => getTagName(c) === 'sup');
      const naryBase = children.find(c => getTagName(c) === 'e');

      let result = '';
      if (narySub) result += `_{${convertToLatex(narySub)}}`;
      if (narySup) result += `^{${convertToLatex(narySup)}}`;
      return result + convertToLatex(naryBase);

    case 'r': // Run (Text container)
      // Ignore styling (m:sty) for now, just get text
      const tNode = children.find(c => getTagName(c) === 't');
      return tNode ? convertToLatex(tNode) : children.map(convertToLatex).join('');

    case 't': // Text Node Wrapper
      const val = children.map(c => c.nodeValue || '').join('');

      // CRITICAL FIX: Wrap text in \text{} if it looks like words/sentences.
      // This prevents "Theequation..." rendering issues when users type text inside Equation Editor.
      // Condition: Contains spaces OR has more than 1 letter (and isn't just a number/symbol)
      if (/\s/.test(val) || (val.length > 1 && /[a-zA-Z]/.test(val))) {
        // Escape existing braces to prevent latex errors
        const safeVal = val.replace(/}/g, '\\}').replace(/{/g, '\\{');
        return `\\text{${safeVal}}`;
      }
      return val;

    default: // Recurse for unknown/container tags (like num, den, e, etc.)
      return children.map(convertToLatex).join('');
  }
};