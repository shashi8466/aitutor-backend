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
      const inner = children.map(convertToLatex).join('').trim();
      // If it's already wrapped or contains math-specific LaTeX, keep it as math
      if (inner.startsWith('\\(') || inner.startsWith('$')) return ` ${inner} `;

      // Heuristic: If it has math-specific commands or symbols, wrap it.
      // Otherwise, return as plain text to allow standard wrapping and fonts.
      const hasMathSignal = /[{}^_[\]]|\\(?:frac|sqrt|left|right|times|sum|int|alpha|beta|gamma|theta|sigma|tau|mu|delta|Delta|omega|Omega|phi|lambda|ge|le|ne|approx|pm|times|div|cdot|dots|angle|triangle|parallel|perp|degree)/.test(inner);
      const isSimpleSymbol = inner.length === 1 && /[^a-zA-Z0-9\s]/.test(inner);

      if (hasMathSignal || isSimpleSymbol) {
        return ` \\(${inner}\\) `;
      }
      return inner;

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

    case 'bar': { // Overbar / underbar (e.g. line-segment notation like AB with a bar over it)
      const barBase = children.find(c => getTagName(c) === 'e');
      const barPr = children.find(c => getTagName(c) === 'barPr');
      let pos = 'top'; // OOXML default position when <m:pos> is omitted is "top" (overbar)
      if (barPr) {
        const posNode = Array.from(barPr.childNodes || []).find(c => getTagName(c) === 'pos');
        const posVal = posNode?.getAttribute?.('m:val') || posNode?.getAttribute?.('val');
        if (posVal) pos = posVal;
      }
      const command = pos === 'bot' ? 'underline' : 'overline';
      return `\\${command}{${convertToLatex(barBase)}}`;
    }

    case 'acc': { // Accent (e.g. arc, hat, tilde over a base - Word's Equation > Accent gallery)
      const accBase = children.find(c => getTagName(c) === 'e');
      const accPr = children.find(c => getTagName(c) === 'accPr');
      let chr = '';
      if (accPr) {
        const chrNode = Array.from(accPr.childNodes || []).find(c => getTagName(c) === 'chr');
        chr = chrNode?.getAttribute?.('m:val') || chrNode?.getAttribute?.('val') || '';
      }
      const accBaseLatex = convertToLatex(accBase);
      // Arc/frown notation (e.g. "minor arc AC") - Word's built-in "Arc" accent template.
      // \stackrel{\frown}{} is used instead of \overparen{} since \stackrel/\frown are core
      // MathJax macros (no extension package required), guaranteeing render support.
      if (['⏜', '⌢', '⌣', '︵', '⌒', '⌢', '̑'].includes(chr)) {
        return `\\stackrel{\\frown}{${accBaseLatex}}`;
      }
      if (chr === '^' || chr === '̂') return `\\hat{${accBaseLatex}}`;
      if (chr === '~' || chr === '̃') return `\\tilde{${accBaseLatex}}`;
      if (chr === '.' || chr === '̇') return `\\dot{${accBaseLatex}}`;
      if (chr === '..' || chr === '̈') return `\\ddot{${accBaseLatex}}`;
      if (chr === '→' || chr === '⃗') return `\\vec{${accBaseLatex}}`;
      // Unrecognized accent character - keep it visible above the base rather than silently
      // dropping it (matches the closest available intent instead of losing it entirely).
      return chr ? `\\stackrel{${chr}}{${accBaseLatex}}` : accBaseLatex;
    }

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
      const val = node.textContent || children.map(c => c.nodeValue || '').join('');

      // CRITICAL FIX: Wrap text in \text{} if it looks like words/sentences.
      // This prevents "Theequation..." rendering issues when users type text inside Equation Editor.
      // Condition: Contains spaces OR has more than 1 letter (and isn't just a number/symbol)
      if (/\s/.test(val) || (val.length > 1 && /[a-zA-Z]/.test(val))) {
        // Escape existing braces to prevent latex errors
        const safeVal = val.replace(/}/g, '\\}').replace(/{/g, '\\{');
        return `\\text{${safeVal}}`;
      }

      // A lone LaTeX-reserved character typed as literal text inside a Word math zone
      // (e.g. "#" for "number of", "&" from a manual equation-alignment tab, a literal
      // "%" or "_") is not a structural math command here - emitting it raw crashes
      // MathJax's parser ("Misplaced &", "macro parameter character '#'") instead of
      // rendering. Swap it for its Unicode fullwidth lookalike rather than a "\&"-style
      // backslash escape - confirmed via isolated testing that MathJax's \text{} argument
      // parser does not expand \&/\#/\%/\_ (renders the literal backslash character
      // instead), while a plain printable Unicode character needs no escaping at all and
      // renders correctly in every context, nested or not.
      const FULLWIDTH = { '&': '＆', '%': '％', '#': '＃', '_': '＿' };
      if (FULLWIDTH[val]) {
        return FULLWIDTH[val];
      }
      return val;

    default: // Recurse for unknown/container tags (like num, den, e, etc.)
      return children.map(convertToLatex).join('');
  }
};
