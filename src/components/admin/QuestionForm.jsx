import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { questionService } from '../../services/api';

const { FiX, FiSave, FiPlus, FiTrash2, FiImage, FiUpload, FiLoader, FiAlertCircle } = FiIcons;

const QuestionForm = ({ question, courses, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    courseId: question?.courseId || '',
    level: question?.level || 'Medium',
    type: question?.type || 'mcq',
    question: question?.question || '',
    options: question?.options || ['', '', '', ''],
    correct_answer: question?.correct_answer || '',
    explanation: question?.explanation || '',
    image: question?.image || null
  });

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState(''); // Local error state instead of alert
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const submitData = {
        ...formData,
        options: formData.type === 'mcq' ? formData.options : []
      };

      if (question) {
        await questionService.update(question.id, submitData);
      } else {
        await questionService.create(submitData);
      }
      onSave();
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
    if (formData.options.length < 4) {
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

    setError(''); // Clear previous errors

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {question ? 'Edit Question' : 'Create New Question'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <SafeIcon icon={FiX} className="w-5 h-5" />
          </button>
        </div>

        {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                <SafeIcon icon={FiAlertCircle} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
              <select
                name="courseId"
                value={formData.courseId}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                name="level"
                value={formData.level}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mcq">Multiple Choice</option>
                <option value="short_answer">Short Answer</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Question Text</label>
            <textarea
              name="question"
              value={formData.question}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your question..."
            />
          </div>

          {/* IMAGE UPLOAD SECTION */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
             <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                 <SafeIcon icon={FiImage} className="w-4 h-4 text-blue-600"/> Question Image (Optional)
             </label>
             
             {formData.image ? (
                 <div className="relative inline-block group">
                     <img 
                        src={formData.image} 
                        alt="Question Preview" 
                        className="h-32 w-auto rounded border border-gray-300 object-contain bg-white" 
                     />
                     <button
                        type="button"
                        onClick={removeImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600"
                        title="Remove Image"
                     >
                         <SafeIcon icon={FiX} className="w-4 h-4" />
                     </button>
                 </div>
             ) : (
                 <div className="flex items-center gap-3">
                     <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        disabled={uploadingImage}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                     >
                         {uploadingImage ? (
                             <>
                                <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" /> Uploading...
                             </>
                         ) : (
                             <>
                                <SafeIcon icon={FiUpload} className="w-4 h-4" /> Upload Image
                             </>
                         )}
                     </button>
                     <span className="text-xs text-gray-500">Supports JPG, PNG, GIF (Max 5MB)</span>
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

          {formData.type === 'mcq' && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Options</label>
                {formData.options.length < 4 && (
                  <button
                    type="button"
                    onClick={addOption}
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1"
                  >
                    <SafeIcon icon={FiPlus} className="w-4 h-4" />
                    <span>Add Option</span>
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {formData.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <span className="w-8 text-sm font-medium text-gray-600">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                    />
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correct Answer
            </label>
            {formData.type === 'mcq' ? (
              <select
                name="correct_answer"
                value={formData.correct_answer}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select correct answer</option>
                {formData.options.map((_, index) => (
                  <option key={index} value={String.fromCharCode(65 + index)}>
                    {String.fromCharCode(65 + index)} - {formData.options[index] || 'Option ' + String.fromCharCode(65 + index)}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the correct answer"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explanation (Optional)</label>
            <textarea
              name="explanation"
              value={formData.explanation}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Explain why this is the correct answer..."
            />
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <SafeIcon icon={FiSave} className="w-4 h-4" />
                  <span>Save Question</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default QuestionForm;