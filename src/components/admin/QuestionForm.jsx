import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import MathRenderer from '../../common/MathRenderer';
import { questionService } from '../../services/api';
import JoditEditor from 'jodit-react';

const { FiX, FiSave, FiPlus, FiTrash2, FiImage, FiUpload, FiLoader, FiAlertCircle, FiEye } = FiIcons;


export const processMathForEditor = async (html) => {
  if (!html) return html;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const walk = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
  const textNodes = [];
  let node;
  while(node = walk.nextNode()) textNodes.push(node);

  textNodes.forEach(node => {
      let text = node.nodeValue;
      const explicitRegex = /(\$\$.*?\$\$|\\\[[\s\S]*?\\\]|\\\(.*?\\\))/g;
      if (explicitRegex.test(text)) {
          const span = document.createElement('span');
          span.innerHTML = text.replace(explicitRegex, (match) => {
              const encoded = btoa(encodeURIComponent(match));
              return `<span class="jodit-math-widget" data-tex="${encoded}" contenteditable="false" style="display:inline-block; background:#f8fafc; border:1px solid #cbd5e1; padding:2px 4px; border-radius:4px; cursor:pointer; margin: 0 2px;" title="Double-click to edit Math">${match}</span>`;
          });
          node.parentNode.replaceChild(span, node);
      }
  });

  if (window.MathJax) {
      const widgets = Array.from(tempDiv.querySelectorAll('.jodit-math-widget'));
      if (widgets.length > 0) await window.MathJax.typesetPromise(widgets);
  }
  return tempDiv.innerHTML;
};

export const restoreMathFromEditor = (html) => {
  if (!html) return html;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  const widgets = tempDiv.querySelectorAll('.jodit-math-widget');
  widgets.forEach(widget => {
      try {
          const tex = decodeURIComponent(atob(widget.getAttribute('data-tex')));
          widget.replaceWith(tex);
      } catch (e) {
          console.error("Failed to restore math widget", e);
      }
  });
  return tempDiv.innerHTML;
};

const QuestionForm = ({ question, courses, onClose, onSave }) => {

  const [formData, setFormData] = useState({});
  const [isInitializing, setIsInitializing] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    const initializeData = async () => {
      setIsInitializing(true);
      try {
        if (question) {
          const processedQuestion = await processMathForEditor(question.question || '');
          const processedPassage = await processMathForEditor(question.passage || '');
          const processedExplanation = await processMathForEditor(question.explanation || '');
          const processedOptions = await Promise.all((question.options || []).map(opt => processMathForEditor(opt)));
          
          if (!isMounted) return;
          setFormData({
            courseId: question.course_id || '',
            level: question.level || 'Medium',
            type: question.type || 'mcq',
            section: question.section || 'math',
            topic: question.topic || '',
            concept: question.concept || '',
            question_number: question.question_number || '',
            points: question.points || 10,
            difficulty_weight: question.difficulty_weight || 1,
            question: processedQuestion,
            passage: processedPassage,
            options: processedOptions.length > 0 ? processedOptions : (question.type === 'mcq' ? ['', '', '', ''] : []),
            correct_answer: question.correct_answer || '',
            explanation: processedExplanation,
            image: question.image || null,
          });
        } else {
          if (!isMounted) return;
          setFormData({
            courseId: courses?.[0]?.id || '',
            level: 'Medium',
            type: 'mcq',
            section: 'math',
            topic: '',
            concept: '',
            question_number: '',
            points: 10,
            difficulty_weight: 1,
            question: '',
            passage: '',
            options: ['', '', '', ''],
            correct_answer: '',
            explanation: '',
            image: null,
          });
        }
      } finally {
        if (isMounted) setIsInitializing(false);
      }
    };
    initializeData();
    return () => { isMounted = false; };
  }, [question, courses]);


  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('edit'); // 'edit' or 'preview'
  const fileInputRef = useRef(null);

  // Direct handles to the live Jodit instances. onBlur only commits content to formData when
  // focus actually leaves an editor - relying on that alone for "switch to Preview" or "Save"
  // is timing-sensitive (e.g. an unmount racing the blur). Reading .value directly from these
  // refs guarantees the latest keystrokes are always captured, regardless of blur timing.
  const questionEditorRef = useRef(null);
  const passageEditorRef = useRef(null);
  const explanationEditorRef = useRef(null);
  const optionEditorRefs = useRef([]);

  // Merges the live editor content into formData and returns the merged object synchronously,
  // so callers don't have to wait for a re-render to use the freshest values.
  const syncEditorsToFormData = () => {
    const merged = { ...formData };
    if (questionEditorRef.current) merged.question = questionEditorRef.current.value;
    if (passageEditorRef.current) merged.passage = passageEditorRef.current.value;
    if (explanationEditorRef.current) merged.explanation = explanationEditorRef.current.value;
    if (merged.type === 'mcq' && Array.isArray(merged.options)) {
      merged.options = merged.options.map((opt, i) => optionEditorRefs.current[i]?.value ?? opt);
    }
    setFormData(merged);
    return merged;
  };

const mathButton = {
    name: 'insertMath',
    iconURL: 'data:image/svg+xml;utf8,<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><path d="M2 13h12v1H2v-1zm10.7-3.3l-3.4-3.4 1.4-1.4 3.4 3.4-1.4 1.4zM3 11l4-8h2l4 8h-1.5L8 4.5 4.5 11H3z" fill="currentColor"/></svg>',
    tooltip: 'Insert Math (LaTeX)',
    exec: (editor) => {
      const tex = prompt('Enter LaTeX (include $ or \\( \\)):', '\\( \\)');
      if (tex && tex.trim() !== '') {
          const encoded = btoa(encodeURIComponent(tex));
          const html = `<span class="jodit-math-widget" data-tex="${encoded}" contenteditable="false" style="display:inline-block; background:#f8fafc; border:1px solid #cbd5e1; padding:2px 4px; border-radius:4px; cursor:pointer; margin: 0 2px;" title="Double-click to edit Math">${tex}</span>`;
          editor.s.insertHTML(html);
          setTimeout(() => {
              const widgets = editor.editor.querySelectorAll('.jodit-math-widget');
              const lastWidget = widgets[widgets.length - 1];
              if (window.MathJax && lastWidget) {
                  window.MathJax.typesetPromise([lastWidget]);
              }
          }, 50);
      }
    }
  };

  const editorEvents = {
    dblclick: (e) => {
      const widget = e.target.closest('.jodit-math-widget');
      if (widget) {
          try {
              const currentTex = decodeURIComponent(atob(widget.getAttribute('data-tex')));
              const newTex = prompt('Edit Math (LaTeX):', currentTex);
              if (newTex !== null && newTex !== currentTex && newTex.trim() !== '') {
                  widget.setAttribute('data-tex', btoa(encodeURIComponent(newTex)));
                  widget.innerHTML = newTex;
                  if (window.MathJax) window.MathJax.typesetPromise([widget]);
                  const editor = e.target.closest('.jodit-wysiwyg');
                  if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
              }
          } catch(err) {}
      }
    }
  };

  const editorConfig = {
    readonly: false,
    toolbarSticky: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    disablePlugins: ['cleanHTML'],
    defaultActionOnPaste: 'insert_as_html',
    extraButtons: [mathButton],
    events: editorEvents,
    buttons: [
      'source', '|',
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'superscript', 'subscript', '|',
      'ul', 'ol', '|',
      'outdent', 'indent', '|',
      'font', 'fontsize', 'brush', 'paragraph', '|',
      'image', 'table', 'link', 'insertMath', '|',
      'align', 'undo', 'redo', '|',
      'hr', 'eraser', 'copyformat', '|',
      'fullsize'
    ],
    uploader: {
      insertImageAsBase64URI: true
    }
  };

  const minimalEditorConfig = {
    readonly: false,
    toolbarSticky: false,
    showCharsCounter: false,
    showWordsCounter: false,
    showXPathInStatusbar: false,
    disablePlugins: ['cleanHTML'],
    defaultActionOnPaste: 'insert_as_html',
    extraButtons: [mathButton],
    events: editorEvents,
    buttons: [
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'superscript', 'subscript', '|',
      'ul', 'ol', '|',
      'image', 'table', 'link', 'insertMath', '|',
      'eraser', 'source'
    ],
    uploader: {
      insertImageAsBase64URI: true
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const latestData = syncEditorsToFormData();
      const cleanedQuestion = restoreMathFromEditor(latestData.question);
      const cleanedPassage = restoreMathFromEditor(latestData.passage);
      const cleanedExplanation = restoreMathFromEditor(latestData.explanation);
      const cleanedOptions = latestData.options.map(opt => restoreMathFromEditor(opt));

      const submitData = {
        ...latestData,
        // The DB column is course_id (snake_case); formData uses courseId internally to match
        // the <select name="courseId"> field, so translate it at the submission boundary.
        course_id: latestData.courseId ? Number(latestData.courseId) : null,
        question: cleanedQuestion,
        passage: cleanedPassage,
        explanation: cleanedExplanation,
        options: latestData.type === 'mcq' ? cleanedOptions : []
      };
      delete submitData.courseId;

      let savedQuestion;
      if (question) {
        const { data, error: updateError } = await questionService.update(question.id, submitData);
        if (updateError) throw updateError;
        savedQuestion = data;
      } else {
        const { data, error: createError } = await questionService.create(submitData);
        if (createError) throw createError;
        savedQuestion = data;
      }
      // Pass the freshly-saved row straight to the parent so the list reflects the new content
      // immediately, instead of racing a background refetch that might not have landed yet if
      // the admin reopens the same question right away.
      await onSave(savedQuestion);
      onClose();
    } catch (err) {
      console.error('Error saving question:', err);
      setError(err.message || 'Failed to save question.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleOptionChange = (index, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const addOption = () => {
    if (formData.options.length < 6) {
      setFormData(prev => ({ ...prev, options: [...prev.options, ''] }));
    }
  };

  const removeOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const handleTypeChange = (newType) => {
    setFormData(prev => ({
      ...prev,
      type: newType,
      options: newType === 'mcq' ? ['', '', '', ''] : [],
      correct_answer: ''
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    if (file.size > 5 * 1024 * 1024) {
      setError("File size too large. Please upload an image under 5MB.");
      return;
    }
    setUploadingImage(true);
    try {
      const { publicUrl } = await questionService.uploadImage(file);
      setFormData(prev => ({ ...prev, image: publicUrl }));
    } catch (err) {
      console.error("Upload failed", err);
      setError("Failed to upload image. Please check your internet connection.");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setFormData(prev => ({ ...prev, image: null }));
  };

  if (isInitializing) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white p-6 rounded-xl flex items-center space-x-3 text-blue-600 font-bold shadow-xl border border-gray-100">
          <SafeIcon icon={FiLoader} className="w-6 h-6 animate-spin" />
          <span>Initializing Editor...</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto py-10"
    >
      <style>{`
        .jodit-wysiwyg {
          font-family: 'Inter', sans-serif !important;
          font-size: 1rem !important;
          line-height: 1.6 !important;
        }
        .jodit-wysiwyg .docx-image-wrapper img {
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
          display: inline-block !important;
          vertical-align: middle !important;
        }
        /* Make raw math look slightly different if wrapped in standard tags */
        .jodit-wysiwyg code {
          background-color: #f1f5f9;
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
          font-family: monospace;
          color: #0f172a;
        }
      `}</style>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-0 flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-900">
            {question ? 'Edit Question' : 'Create New Question'}
          </h3>
          <div className="flex items-center gap-4">
            <div className="bg-gray-100 p-1 rounded-lg flex items-center">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Edit Mode
              </button>
              <button
                type="button"
                onClick={() => { syncEditorsToFormData(); setActiveTab('preview'); }}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <SafeIcon icon={FiEye} className="w-4 h-4" /> Preview
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 bg-white rounded-full hover:bg-gray-100 transition-colors shadow-sm"
            >
              <SafeIcon icon={FiX} className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
            <SafeIcon icon={FiAlertCircle} className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === 'edit' ? (
            <form id="question-form" onSubmit={handleSubmit} className="space-y-8">
              
              {/* METADATA SECTION */}
              <div className="bg-blue-50/30 p-5 rounded-xl border border-blue-100/50">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-4 border-b border-blue-200 pb-2">1. Categorization & Metadata</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Course *</label>
                    <select name="courseId" value={formData.courseId} onChange={handleChange} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Select a course</option>
                      {courses.map(course => (
                        <option key={course.id} value={course.id}>{course.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Section</label>
                    <select name="section" value={formData.section} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="math">Math</option>
                      <option value="reading_writing">Reading & Writing</option>
                      <option value="reading">Reading</option>
                      <option value="writing">Writing</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                    <select name="type" value={formData.type} onChange={(e) => handleTypeChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="mcq">Multiple Choice</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="fill_in_the_blank">Fill in the Blank</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Difficulty</label>
                    <select name="level" value={formData.level} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Topic Name</label>
                    <input type="text" name="topic" value={formData.topic} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Algebra" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Sub-Concept</label>
                    <input type="text" name="concept" value={formData.concept} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. Linear Equations" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Question Number / Order</label>
                    <input type="text" name="question_number" value={formData.question_number} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="e.g. 1A" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Points</label>
                      <input type="number" name="points" value={formData.points} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Weight</label>
                      <input type="number" step="0.1" name="difficulty_weight" value={formData.difficulty_weight} onChange={handleChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* CONTENT SECTION */}
              <div className="bg-white p-0">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">2. Question Content</h4>
                
                <div className="space-y-5">
                  <div>
                    <label className="flex justify-between items-center text-sm font-bold text-gray-800 mb-2">
                      <span>Reading Passage / Reference Text (Optional)</span>
                    </label>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden text-gray-900 [&_.jodit-wysiwyg]:!text-gray-900 [&_.jodit-wysiwyg]:!bg-white">
                      <JoditEditor
                        value={formData.passage}
                        config={{...editorConfig, placeholder: "Enter the linked passage or context for this question (supports LaTeX with $$ or $)..."}}
                        onBlur={(newContent) => setFormData(prev => ({ ...prev, passage: newContent }))}
                        editorRef={(instance) => { passageEditorRef.current = instance; }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex justify-between items-center text-sm font-bold text-gray-800 mb-2">
                      <span>Question Text *</span>
                      <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Supports LaTeX math enclosed in $$ or $</span>
                    </label>
                    <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden text-gray-900 [&_.jodit-wysiwyg]:!text-gray-900 [&_.jodit-wysiwyg]:!bg-white">
                      <JoditEditor
                        value={formData.question}
                        config={{...editorConfig, placeholder: "Enter your question here..."}}
                        onBlur={(newContent) => setFormData(prev => ({ ...prev, question: newContent }))}
                        editorRef={(instance) => { questionEditorRef.current = instance; }}
                      />
                    </div>
                  </div>
                  
                  {/* MEDIA UPLOAD SECTION */}
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <SafeIcon icon={FiImage} className="w-5 h-5 text-indigo-600" /> Attached Media (Image, Diagram, Table, Figure)
                    </label>

                    {formData.image ? (
                      <div className="relative inline-block group max-w-sm w-full">
                        <img
                          src={formData.image}
                          alt="Question Media"
                          className="w-full h-auto rounded-lg border border-gray-300 object-contain bg-white shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={removeImage}
                          className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-transform transform hover:scale-110"
                          title="Remove Media"
                        >
                          <SafeIcon icon={FiX} className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-start gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current.click()}
                          disabled={uploadingImage}
                          className="px-5 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2 shadow-sm transition-colors w-full sm:w-auto justify-center"
                        >
                          {uploadingImage ? (
                            <><SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin text-indigo-600" /> Uploading...</>
                          ) : (
                            <><SafeIcon icon={FiUpload} className="w-5 h-5 text-indigo-600" /> Upload New Media</>
                          )}
                        </button>
                        <span className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1.5 rounded-md">Supports JPG, PNG, WEBP (Max 5MB). Use this for diagrams, tables, or figures.</span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                </div>
              </div>

              {/* OPTIONS & ANSWERS SECTION */}
              <div className="bg-emerald-50/30 p-5 rounded-xl border border-emerald-100/50">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-4 border-b border-emerald-200 pb-2">3. Answer & Options</h4>
                
                {formData.type === 'mcq' && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-bold text-gray-800">Answer Options</label>
                      {formData.options.length < 6 && (
                        <button
                          type="button"
                          onClick={addOption}
                          className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 transition-colors shadow-sm"
                        >
                          <SafeIcon icon={FiPlus} className="w-4 h-4" />
                          <span>Add Option</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      {formData.options.map((option, index) => (
                        <div key={index} className="flex items-start space-x-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm relative group">
                          <span className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-sm font-black ${String.fromCharCode(65 + index) === formData.correct_answer ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                            {String.fromCharCode(65 + index)}
                          </span>
                          <div className="flex-1 w-full bg-white border border-gray-200 rounded text-sm overflow-hidden min-w-[200px] text-gray-900 [&_.jodit-wysiwyg]:!text-gray-900 [&_.jodit-wysiwyg]:!bg-white">
                            <JoditEditor
                              value={option}
                              config={{...minimalEditorConfig, placeholder: `Enter Option ${String.fromCharCode(65 + index)}...`, minHeight: 100}}
                              onBlur={(newContent) => handleOptionChange(index, newContent)}
                              editorRef={(instance) => { optionEditorRefs.current[index] = instance; }}
                            />
                          </div>
                          {formData.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(index)}
                              className="absolute -top-2 -right-2 bg-red-100 text-red-600 hover:bg-red-500 hover:text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                            >
                              <SafeIcon icon={FiTrash2} className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <label className="block text-sm font-bold text-gray-800 mb-2">
                    Correct Answer *
                  </label>
                  {formData.type === 'mcq' ? (
                    <select
                      name="correct_answer"
                      value={formData.correct_answer}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-900 bg-emerald-50"
                    >
                      <option value="">Select the correct option</option>
                      {formData.options.map((_, index) => (
                        <option key={index} value={String.fromCharCode(65 + index)}>
                          Option {String.fromCharCode(65 + index)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      name="correct_answer"
                      value={formData.correct_answer}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-gray-900 bg-emerald-50"
                      placeholder={formData.type === 'fill_in_the_blank' ? "Enter the exact correct answer text..." : "Enter the short answer..."}
                    />
                  )}
                </div>
              </div>

              {/* EXPLANATION SECTION */}
              <div className="bg-amber-50/30 p-5 rounded-xl border border-amber-100/50">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-4 border-b border-amber-200 pb-2">4. Solution & Explanation</h4>
                <div>
                  <label className="flex justify-between items-center text-sm font-bold text-gray-800 mb-2">
                    <span>Explanation / Solution Steps (Optional)</span>
                    <span className="text-xs font-normal text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded">Supports LaTeX math</span>
                  </label>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden mt-2 text-gray-900 [&_.jodit-wysiwyg]:!text-gray-900 [&_.jodit-wysiwyg]:!bg-white">
                    <JoditEditor
                      value={formData.explanation}
                      config={{...editorConfig, placeholder: "Provide detailed steps, hints, or reasons why the answer is correct..."}}
                      onBlur={(newContent) => setFormData(prev => ({ ...prev, explanation: newContent }))}
                      editorRef={(instance) => { explanationEditorRef.current = instance; }}
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* PREVIEW TAB */
            <div className="space-y-8 p-4 bg-white rounded-xl">
              <div className="bg-indigo-50 text-indigo-800 p-4 rounded-xl text-sm font-medium flex items-start gap-3 border border-indigo-100">
                <SafeIcon icon={FiEye} className="w-5 h-5 flex-shrink-0 mt-0.5" />
                This is a live preview of how the question will render for students. Math expressions and formatting are applied.
              </div>
              
              <div className="border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                {formData.passage && (
                  <div className="mb-6 p-5 bg-gray-50 rounded-xl border-l-4 border-gray-400 font-serif text-gray-800 prose prose-sm max-w-none">
                    <MathRenderer text={formData.passage} />
                  </div>
                )}
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <span className="bg-blue-600 text-white font-bold w-8 h-8 flex items-center justify-center rounded-full text-sm">
                      {formData.question_number || 'Q'}
                    </span>
                  </div>
                  <div className="flex-1 text-gray-900 text-lg">
                    <MathRenderer text={formData.question || 'No question text provided.'} />
                    
                    {formData.image && (
                      <div className="mt-6 mb-6">
                        <img src={formData.image} alt="Question Media Preview" className="max-h-80 w-auto object-contain rounded-lg border border-gray-200 shadow-sm" />
                      </div>
                    )}

                    {formData.type === 'mcq' ? (
                      <div className="mt-8 space-y-3">
                        {formData.options.map((opt, i) => (
                          <div key={i} className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all ${formData.correct_answer === String.fromCharCode(65 + i) ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 hover:border-blue-300 bg-white'}`}>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold flex-shrink-0 ${formData.correct_answer === String.fromCharCode(65 + i) ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 text-gray-500'}`}>
                              {String.fromCharCode(65 + i)}
                            </div>
                            <div className="pt-1 flex-1">
                              <MathRenderer text={opt || ''} />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-8">
                        <div className="p-4 border-2 border-gray-300 rounded-xl bg-gray-50 w-full max-w-md text-gray-500 italic">
                          Student will enter their answer here...
                        </div>
                        <div className="mt-4 p-4 border-2 border-emerald-500 bg-emerald-50 rounded-xl text-emerald-900 w-full max-w-md">
                          <span className="font-bold uppercase text-xs tracking-wider text-emerald-700 block mb-1">Accepted Answer:</span>
                          <span className="font-mono text-lg font-bold">{formData.correct_answer || 'None provided'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {formData.explanation && (
                  <div className="mt-10 p-5 bg-amber-50 rounded-xl border border-amber-200">
                    <h5 className="font-bold text-amber-800 uppercase tracking-widest text-xs mb-3">Explanation & Solution</h5>
                    <div className="text-gray-800">
                      <MathRenderer text={formData.explanation} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-4 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-white hover:shadow-sm transition-all bg-transparent"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="question-form"
            disabled={loading || uploadingImage}
            className="flex-[2] px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            {loading ? (
              <><SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" /> Saving Changes...</>
            ) : (
              <><SafeIcon icon={FiSave} className="w-5 h-5" /> Save Question</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default QuestionForm;