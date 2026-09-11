/**
 * Regenerates a downloadable .docx for a source upload from the CURRENT question records in
 * the database - not from the original uploaded file. An admin's edits made through
 * Edit Question (question text, passage, options, correct answer, explanation, topic, etc.)
 * are saved straight to the `questions` table, so reading from that table here is what makes
 * the download reflect those edits. The original uploaded file (uploads.file_url) is never
 * touched or overwritten by this - it stays available as the historical source.
 *
 * Math/LaTeX is preserved as the literal text already stored (e.g. "\(\sin R\)"), not
 * converted into native Word equation objects - reconstructing OMML from arbitrary LaTeX is a
 * separate, much larger undertaking than "the edited content must not be lost on download".
 * Images referenced via <img src="..."> in question/passage/explanation/option text are fetched
 * and embedded into the document.
 */
import axios from 'axios';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from 'docx';

const decodeEntities = (str) => str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

const imageTypeFromUrl = (url) => {
    const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
    if (ext === 'gif') return 'gif';
    if (ext === 'bmp') return 'bmp';
    return 'png';
};

/**
 * Converts one stored HTML-ish field (question/passage/explanation/option text) into an
 * ordered array of docx ParagraphChild runs - TextRun for plain text (with embedded newlines
 * turned into line breaks), ImageRun for each <img> tag found. HTML tags other than <img> are
 * stripped rather than translated into Word styling, since the goal here is "the edited
 * content is present in the download", not a pixel-perfect re-render of the rich text editor.
 */
async function fieldToRuns(html, imageCache) {
    if (!html) return [];

    const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    const segments = [];
    let lastIndex = 0;
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
        if (match.index > lastIndex) segments.push({ type: 'text', value: html.slice(lastIndex, match.index) });
        segments.push({ type: 'image', url: match[1] });
        lastIndex = imgRegex.lastIndex;
    }
    if (lastIndex < html.length) segments.push({ type: 'text', value: html.slice(lastIndex) });

    const runs = [];
    for (const segment of segments) {
        if (segment.type === 'image') {
            try {
                let data = imageCache.get(segment.url);
                if (!data) {
                    const resp = await axios.get(segment.url, { responseType: 'arraybuffer', timeout: 15000 });
                    data = Buffer.from(resp.data);
                    imageCache.set(segment.url, data);
                }
                runs.push(new ImageRun({
                    type: imageTypeFromUrl(segment.url),
                    data,
                    transformation: { width: 350, height: 220 }
                }));
            } catch (err) {
                console.error(`[questionDocxExport] Failed to embed image ${segment.url}:`, err.message);
                runs.push(new TextRun({ text: '[Image could not be embedded]', italics: true }));
            }
        } else {
            const text = decodeEntities(
                segment.value
                    .replace(/<\/(p|div|li|tr)>/gi, '\n')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
            );
            const lines = text.split('\n');
            lines.forEach((line, idx) => {
                if (line) runs.push(new TextRun({ text: line }));
                if (idx < lines.length - 1) runs.push(new TextRun({ break: 1 }));
            });
        }
    }
    return runs;
}

const labelParagraph = (text) => new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true })]
});

async function buildQuestionParagraphs(question, index, imageCache) {
    const paragraphs = [];

    paragraphs.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 120 },
        children: [new TextRun({ text: `Question ${question.question_number ?? index + 1}` })]
    }));

    if (question.topic) {
        paragraphs.push(new Paragraph({
            children: [new TextRun({ text: `Topic: ${question.topic}`, italics: true, color: '555555' })]
        }));
    }

    if (question.passage) {
        paragraphs.push(labelParagraph('Reading Passage / Reference Text:'));
        paragraphs.push(new Paragraph({ children: await fieldToRuns(question.passage, imageCache) }));
    }

    paragraphs.push(new Paragraph({ children: await fieldToRuns(question.question, imageCache) }));

    if (question.type === 'mcq' && Array.isArray(question.options) && question.options.length > 0) {
        for (let i = 0; i < question.options.length; i++) {
            const letter = String.fromCharCode(65 + i);
            const isCorrect = question.correct_answer && question.correct_answer.trim().toUpperCase() === letter;
            const optionRuns = await fieldToRuns(question.options[i], imageCache);
            paragraphs.push(new Paragraph({
                children: [new TextRun({ text: `${letter}. `, bold: isCorrect }), ...optionRuns]
            }));
        }
    }

    paragraphs.push(new Paragraph({
        children: [
            new TextRun({ text: 'Correct Answer: ', bold: true }),
            new TextRun({ text: question.correct_answer || 'N/A' })
        ]
    }));

    if (question.explanation) {
        paragraphs.push(labelParagraph('Explanation:'));
        paragraphs.push(new Paragraph({ children: await fieldToRuns(question.explanation, imageCache) }));
    }

    paragraphs.push(new Paragraph({
        border: { bottom: { color: 'CCCCCC', space: 1, style: 'single', size: 6 } },
        spacing: { after: 200 },
        children: []
    }));

    return paragraphs;
}

/**
 * Builds a .docx Buffer for one upload's current questions, ordered the same way they were
 * originally imported (question_number).
 */
export async function generateUploadDocx({ upload, questions }) {
    const imageCache = new Map();
    const sorted = [...questions].sort((a, b) => (a.question_number ?? 0) - (b.question_number ?? 0));

    const body = [
        new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: upload?.file_name || 'Question Set' })]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({
                text: `Level: ${upload?.level || 'N/A'}  |  ${sorted.length} Questions  |  Generated ${new Date().toISOString().split('T')[0]}`,
                italics: true,
                color: '777777'
            })]
        })
    ];

    for (let i = 0; i < sorted.length; i++) {
        const qParagraphs = await buildQuestionParagraphs(sorted[i], i, imageCache);
        body.push(...qParagraphs);
    }

    const doc = new Document({
        sections: [{ children: body }]
    });

    return Packer.toBuffer(doc);
}
