import React, { useEffect, useRef } from 'react';

const MathRenderer = ({ text, className = '' }) => {
  const nodeRef = useRef(null);

  useEffect(() => {
    if (!nodeRef.current) return;

    // Default to empty string if null/undefined, and ensure it's a string
    let processedText = (text || '').toString();

    // ---------------------------------------------------------
    // 0. Pre-Sanitization (Advanced Recovery for Broken AI JSON)
    // ---------------------------------------------------------
    // The AI often outputs single backslashes in JSON, which JS interprets as control chars.
    // We must reverse this damage before MathJax sees it.

    // FIX: Common LaTeX command corruption from JSON/Word extraction
    // Only recover if followed by { or [ to avoid breaking common words
    processedText = processedText.replace(/(\\?[\t\v\f\r])frac(?=[{[])/g, '\\frac');
    processedText = processedText.replace(/(\\?[\t\v\f\r])text(?=\{)/g, '\\text');
    processedText = processedText.replace(/(\\?[\t\v\f\r])sqrt(?=[{[])/g, '\\sqrt');
    processedText = processedText.replace(/(\\?[\t\v\f\r])times(?=\s)/g, '\\times');

    // Recovery for lost backslashes in front of common commands
    const mathCommands = ['frac', 'sqrt', 'times', 'tau', 'tan', 'theta', 'alpha', 'beta', 'gamma'];
    mathCommands.forEach(cmd => {
      // Improved: Match cmd only if it's at the start of a word (start of string or non-word char)
      // and NOT already preceded by a backslash.
      const regex = new RegExp('(^|[^a-zA-Z\\\\])' + cmd + '(?=[\\{\\[\\s])', 'g');
      processedText = processedText.replace(regex, '$1\\' + cmd);
    });

    // Special case for 'text' - ONLY fix if followed by { (to avoid breaking the word "Context")
    processedText = processedText.replace(/(^|[^\\])text(?=\{)/g, '$1\\text');

    // Remove empty text commands
    processedText = processedText.replace(/\\text\{\s*\}/g, '');

    // ---------------------------------------------------------
    // 1. Basic Markdown Parsing (Bold, Italic, Tables)
    // ---------------------------------------------------------
    // Convert **Bold** -> <b>Bold</b>
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    // Convert __Italic__ -> <i>Italic</i>
    processedText = processedText.replace(/__(.*?)__/g, '<i>$1</i>');

    // Convert Markdown Tables
    // Minimal parser for simple tables: headers | ... | \n |---|---|
    // Note: Use a more robust library for complex tables if needed, but this works for basic ones.
    const tableRegex = /(\|[^\n]+\|\n\|[\s:|-]+\|(?:\n\|[^\n]+\|)+)/g;

    processedText = processedText.replace(tableRegex, (match) => {
      const rows = match.trim().split('\n');
      const htmlRows = rows.map((row, index) => {
        // Remove outer pipes if they exist, but split on internal pipes
        const cells = row.replace(/^\||\|$/g, '').split('|');
        const cellTag = index === 0 ? 'th' : 'td';

        // Skip separator row
        if (row.includes('---')) return '';

        const htmlCells = cells.map(c => `<${cellTag}>${c.trim()}</${cellTag}>`).join('');
        return `<tr>${htmlCells}</tr>`;
      }).join('');

      return `<table class="min-w-full border-collapse border border-gray-300 my-4 text-sm">${htmlRows}</table>`;
    });

    // Convert Newlines -> <br /> (Only if not inside table)
    // We do this by careful split or simple global replace IF we assume tables are handled block-style
    // For now, simpler: just doing <br> replace might break table HTML, so we do it AFTER table replace but careful not to break tags
    // Or simpler strategy: We already did table replace which outputs HTML. <br> inside table is okay?
    // Let's rely on standard logic but keep checking.
    // The previous code replaced \n with <br/> globally. We should avoid doing that inside the generated table code?
    // Actually, `tableRegex` consumed the newlines of the table. So normal text newlines remain.
    processedText = processedText.replace(/\n/g, '<br />');

    // ---------------------------------------------------------
    // 2. Smart Math Detection & Wrapping
    // ---------------------------------------------------------
    if (window.MathJax) {
      // Split by HTML tags to avoid mangling images/tables
      const parts = processedText.split(/(<[^>]+>)/g);

      const processedParts = parts.map(part => {
        // If it's an HTML tag, leave it alone
        if (part.startsWith('<') && part.endsWith('>')) return part;

        let subText = part;
        const hasDelimiters = /\$|\\\(|\\\[/.test(subText);

        if (!hasDelimiters) {
          // A. Detect Explicit LaTeX commands (e.g. \frac, \sqrt)
          // Improved regex to capture \command{arg1}{arg2} and avoid "Missing argument"
          const latexPattern = /\\(?:[a-zA-Z]+)(?:(?:\s*\[.*?\])|(?:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})){1,2}/g;
          const simpleLatexPattern = /\\[a-zA-Z]+/g;

          // B. Detect Implicit Algebra (e.g. T=2h+18, C_f, q/r)
          const implicitMathPattern = new RegExp("((?:[a-zA-Z0-9()]+[+\\-*/_^=][a-zA-Z0-9()+\\-*/_^=.]*)+)", "g");

          subText = subText.replace(implicitMathPattern, (match) => {
            if (match.includes('http') || match.includes('@') || match.includes('www.')) return match;
            if (/^[a-zA-Z]+-[a-zA-Z]+$/.test(match)) return match;
            if (new RegExp("^\\d{1,4}/\\d{1,2}/\\d{2,4}$").test(match)) return match;
            if (/[+\-*/_^=]$/.test(match)) return match;

            const hasMathSignal = /[=_^\\\d]/.test(match) || (new RegExp("[+\\-*/]").test(match) && match.length < 20);
            return hasMathSignal ? ` \\(${match}\\) ` : match;
          });

          // Apply complex LaTeX pattern first (commands with arguments)
          subText = subText.replace(latexPattern, (match) => {
            if (match.trim().startsWith('\\(') || match.trim().startsWith('$')) return match;
            return ` \\(${match.trim()}\\) `;
          });

          // Apply simple LaTeX pattern for remaining commands (like \pi)
          subText = subText.replace(simpleLatexPattern, (match) => {
            const trimmedMatch = match.trim();
            if (trimmedMatch.startsWith('\\(') || trimmedMatch.startsWith('$')) return match;

            // SKIP: These commands MUST have arguments. Wrapping them alone causes "Missing argument" errors
            const needsBraces = ['\\text', '\\frac', '\\sqrt', '\\sqrt['];
            if (needsBraces.includes(trimmedMatch)) return match;

            // Check if already inside \(\)
            if (subText.indexOf(`\\(${trimmedMatch}`) !== -1) return match;
            return ` \\(${trimmedMatch}\\) `;
          });
        }
        return subText;
      });

      processedText = processedParts.join('');

      // ---------------------------------------------------------
      // 3. Render & Typeset
      // ---------------------------------------------------------
      nodeRef.current.innerHTML = processedText;

      // Clear previous math (if any) and typeset new content
      // We use typesetPromise to avoid freezing UI
      window.MathJax.typesetPromise([nodeRef.current])
        .catch((err) => {
          console.warn('MathJax processing error:', err);
          nodeRef.current.innerText = processedText.replace(/\$/g, '');
        });
    } else {
      // Fallback if MathJax not loaded
      nodeRef.current.innerHTML = processedText;
    }

  }, [text]);

  return (
    <span
      ref={nodeRef}
      className={`math-content ${className}`}
      style={{ display: 'inline-block', maxWidth: '100%', verticalAlign: 'middle' }}
    />
  );
};

export default MathRenderer;