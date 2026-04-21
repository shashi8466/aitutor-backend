import React, { useEffect, useRef } from 'react';

const MathRenderer = ({ text, className = '' }) => {
  const nodeRef = useRef(null);

  useEffect(() => {
    if (!nodeRef.current) return;

    // Default to empty string if null/undefined, and ensure it's a string
    let processedText = (text || '').toString();

    // ---------------------------------------------------------
    // 0. Pre-Sanitization & Decoding
    // ---------------------------------------------------------
    // Decode common HTML entities that might be trapped in the text
    const decodeEntities = (str) => {
      const entities = {
        '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
        '&ge;': '≥', '&le;': '≤', '&ne;': '≠', '&deg;': '°', '&plusmn;': '±',
        '&times;': '×', '&div;': '÷', '&alpha;': 'α', '&beta;': 'β', '&pi;': 'π',
        '&theta;': 'θ', '&omega;': 'ω', '&delta;': 'δ', '&Delta;': 'Δ', '&sigma;': 'σ'
      };
      return str.replace(/&[a-z0-9#]+;/gi, (match) => entities[match.toLowerCase()] || match);
    };
    
    // First decode entities, then handle common "joined" symbols from broken AI output
    processedText = decodeEntities(processedText);
    
    // Recovery for common "hidden" line breaks that AI sometimes outputs as literals
    processedText = processedText.replace(/\\n/g, '\n');

    // ---------------------------------------------------------
    // 0a. Currency Protection
    // ---------------------------------------------------------
    // Prevent dollar signs matched with numbers (like $2,200) from being seen as math delimiters
    // Use a negative lookahead to ensure it's not a math variable like $x$
    processedText = processedText.replace(/\$(?=\d)/g, '<span>$</span>');

    // ---------------------------------------------------------
    // 0b. Broken LaTeX Recovery (Advanced Recovery for Broken AI JSON)
    // ---------------------------------------------------------
    // Only recover if followed by { or [ to avoid breaking common words
    processedText = processedText.replace(/(\\?[\t\v\f\r])frac(?=[{[])/g, '\\frac');
    processedText = processedText.replace(/(\\?[\t\v\f\r])text(?=\{)/g, '\\text');
    processedText = processedText.replace(/(\\?[\t\v\f\r])sqrt(?=[{[])/g, '\\sqrt');
    processedText = processedText.replace(/(\\?[\t\v\f\r])times(?=\s)/g, '\\times');

    // Recovery for lost backslashes in front of common commands
    const mathCommands = ['frac', 'sqrt', 'times', 'tau', 'tan', 'theta', 'alpha', 'beta', 'gamma'];
    mathCommands.forEach(cmd => {
      const regex = new RegExp('(^|[^a-zA-Z\\\\])' + cmd + '(?=[\\{\\[\\s])', 'g');
      processedText = processedText.replace(regex, '$1\\' + cmd);
    });

    processedText = processedText.replace(/(^|[^\\])text(?=\{)/g, '$1\\text');
    processedText = processedText.replace(/\\text\{\s*\}/g, '');

    // FIX: Clean up spaces inside delimiters to help MathJax detection
    processedText = processedText.replace(/\\\(\s+/g, '\\(').replace(/\s+\\\)/g, '\\)');
    processedText = processedText.replace(/\\\\(\(|\)|\[|\])/g, '\\$1');

    // ---------------------------------------------------------
    // 1. Basic Markdown Parsing (Bold, Italic, Tables)
    // ---------------------------------------------------------
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    processedText = processedText.replace(/__(.*?)__/g, '<i>$1</i>');

    const tableRegex = /(\|[^\n]+\|\n\|[\s:|-]+\|(?:\n\|[^\n]+\|)+)/g;
    processedText = processedText.replace(tableRegex, (match) => {
      const rows = match.trim().split('\n');
      const htmlRows = rows.map((row, index) => {
        const cells = row.replace(/^\||\|$/g, '').split('|');
        const cellTag = index === 0 ? 'th' : 'td';
        if (row.includes('---')) return '';
        const htmlCells = cells.map(c => `<${cellTag}>${c.trim()}</${cellTag}>`).join('');
        return `<tr>${htmlCells}</tr>`;
      }).join('');
      return `<table class="min-w-full border-collapse border border-gray-300 my-4 text-sm">${htmlRows}</table>`;
    });

    // Handle line breaks before math wrapping
    processedText = processedText.replace(/\r?\n/g, '<br />');

    // ---------------------------------------------------------
    // 2. Smart Math Detection & Wrapping
    // ---------------------------------------------------------
    if (window.MathJax) {
      // Split by HTML tags to avoid mangling images/tables
      const parts = processedText.split(/(<[^>]+>)/g);

      const processedParts = parts.map(part => {
        // If it's an HTML tag, leave it alone
        if (part.startsWith('<') && part.endsWith('>')) return part;

        // CRITICAL FIX: Escape literal < and > to prevent browser from interpreting them as tags
        // This fixes the "Inequalities reduced to single numbers" issue
        let subText = part.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Check if this part ALREADY contains math delimiters. 
        const hasDelimiters = /\$|\\\(|\\\[/.test(subText);

        if (!hasDelimiters) {
          // A. Detect Explicit LaTeX commands (e.g. \frac, \sqrt)
          const latexPattern = /\\(?:[a-zA-Z]+)(?:(?:\s*\[.*?\])|(?:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})){1,2}/g;
          const simpleLatexPattern = /\\[a-zA-Z]+/g;

          // B. Detect Implicit Algebra (e.g. T=2h+18, C_f, q/r, 1<x<5)
          // Updated to include < and > signals
          const implicitMathPattern = /((?:[a-zA-Z\d()]+[+\-*/_^=<>][a-zA-Z\d()+\-*/_^=.<>]*)+)/g;

          subText = subText.replace(implicitMathPattern, (match) => {
            if (match.includes('http') || match.includes('@') || match.includes('www.')) return match;
            if (/^[a-zA-Z]+-[a-zA-Z]+$/.test(match)) return match;
            if (/^\d{1,4}\/\d{1,2}\/\d{2,4}$/.test(match)) return match;
            if (/[+\-*/_^=<>]$/.test(match)) return match;
            if (/^\d+$/.test(match)) return match;

            const hasMathSignal = /[=_^\\\d<>~]/.test(match) || (/[+\-*/]/.test(match) && match.length < 20);
            return hasMathSignal ? ` \\(${match}\\) ` : match;
          });

          subText = subText.replace(latexPattern, (match) => {
            const m = match.trim();
            if (m.startsWith('\\text{') && m.length > 30) return match;
            return ` \\(${m}\\) `;
          });

          subText = subText.replace(simpleLatexPattern, (match) => {
            const trimmedMatch = match.trim();
            const skipList = ['\\text', '\\frac', '\\sqrt', '\\sqrt[', '\\textbf', '\\textit'];
            if (skipList.includes(trimmedMatch)) return match;

            const mathSymbols = [
              '\\pi', '\\theta', '\\alpha', '\\beta', '\\gamma', '\\sigma', '\\tau', '\\mu', '\\delta', '\\Delta', '\\omega', '\\Omega', '\\phi', '\\lambda',
              '\\ge', '\\le', '\\ne', '\\approx', '\\pm', '\\times', '\\div', '\\cdot', '\\degree', '\\angle', '\\triangle', '\\therefore', '\\implies',
              '\\sin', '\\cos', '\\tan', '\\log', '\\ln'
            ];
            if (mathSymbols.includes(trimmedMatch) || trimmedMatch.length > 2) {
              return ` \\(${trimmedMatch}\\) `;
            }
            return match;
          });
        }
        return subText;
      });

      processedText = processedParts.join('');

      // ---------------------------------------------------------
      // 3. Render & Typeset
      // ---------------------------------------------------------
      nodeRef.current.innerHTML = processedText;

      window.MathJax.typesetPromise([nodeRef.current])
        .catch((err) => {
          console.warn('MathJax processing error:', err);
          nodeRef.current.innerText = processedText.replace(/\$/g, '');
        });
    } else {
      nodeRef.current.innerHTML = processedText;
    }


  }, [text]);

  return (
    <div
      ref={nodeRef}
      className={`math-content overflow-x-auto max-w-full ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'baseline',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
        whiteSpace: 'normal'
      }}
    />
  );
};

export default MathRenderer;