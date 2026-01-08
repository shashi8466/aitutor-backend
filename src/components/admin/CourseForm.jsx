import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService } from '../../services/api';

const { FiX, FiSave, FiUpload, FiFile, FiVideo, FiBook, FiCheck, FiTrash2, FiLoader, FiAlertCircle, FiDollarSign, FiUsers, FiAlertTriangle } = FiIcons;

const CourseForm = ({ course, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: course?.name || '',
    tutor_type: course?.tutor_type || 'General',
    description: course?.description || '',
    status: course?.status || 'active',
    price_full: course?.price_full || '',
    manual_enrollment_count: course?.manual_enrollment_count || '',
    price_section_a: course?.price_section_a || '',
    price_section_b: course?.price_section_b || '',
  });

  const [newFiles, setNewFiles] = useState({});
  const [existingFiles, setExistingFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingUploads, setFetchingUploads] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ message: '', type: 'info' });

  useEffect(() => {
    if (course?.id) {
      loadExistingUploads();
    }
  }, [course]);

  const loadExistingUploads = async () => {
    setFetchingUploads(true);
    try {
      const { data } = await uploadService.getAll({ courseId: course.id });
      const mapped = {};
      data.forEach(file => {
        const levelKey = file.level === 'All' ? 'main' : file.level.toLowerCase();
        let typeKey = '';
        if (file.category === 'study_material') typeKey = 'study';
        else if (file.category === 'video_lecture') typeKey = 'video';
        else if (file.category === 'quiz_document') typeKey = 'quiz';
        if (levelKey && typeKey) mapped[`${levelKey}_${typeKey}`] = file;
      });
      setExistingFiles(mapped);
    } catch (err) {
      console.error("Failed to load uploads:", err);
    } finally {
      setFetchingUploads(false);
    }
  };

  const handleDeleteExisting = async (key, fileId) => {
    try {
      setUploadStatus({ message: 'Deleting file...', type: 'info' });
      await uploadService.delete(fileId);
      setExistingFiles(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setUploadStatus({ message: 'File deleted', type: 'success' });
    } catch (err) {
      setUploadStatus({ message: 'Delete failed', type: 'error' });
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (key, file) => setNewFiles(prev => ({ ...prev, [key]: file }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUploadStatus({ message: 'Saving course...', type: 'info' });

    try {
      // 1. Save Course
      const cleanData = {
        name: formData.name,
        tutor_type: formData.tutor_type,
        description: formData.description,
        status: formData.status,
        price_full: Number(formData.price_full) || 0,
        manual_enrollment_count: Number(formData.manual_enrollment_count) || 0,
        price_section_a: Number(formData.price_section_a) || 0,
        price_section_b: Number(formData.price_section_b) || 0,
        levels: ['Easy', 'Medium', 'Hard'],
      };

      let savedCourse;
      if (course?.id) {
        const { data } = await courseService.update(course.id, cleanData);
        savedCourse = data;
      } else {
        const { data } = await courseService.create(cleanData);
        savedCourse = data;
      }

      // 2. Upload Files with Auto-Cleanup
      const uploadKeys = Object.keys(newFiles);
      const errors = [];
      let successCount = 0;

      for (const key of uploadKeys) {
        const file = newFiles[key];
        if (!file) continue;

        // AUTO-CLEANUP: If replacing an existing file in this slot, delete the old one first
        if (existingFiles[key]) {
          setUploadStatus({ message: `Replacing old ${key.replace('_', ' ')}...`, type: 'info' });
          try {
            await uploadService.delete(existingFiles[key].id);
          } catch (delErr) {
            console.warn(`Failed to delete old file for ${key}`, delErr);
          }
        }

        setUploadStatus({ message: `Uploading ${file.name}...`, type: 'info' });

        // Determine metadata
        let category = 'source_document';
        let level = 'All';
        let parse = 'false';

        const parts = key.split('_'); // e.g. "easy_quiz"
        if (parts.length >= 2) {
          const lvlStr = parts[0]; // "easy"
          const typeStr = parts[1]; // "quiz"
          level = lvlStr.charAt(0).toUpperCase() + lvlStr.slice(1);

          if (typeStr === 'study') category = 'study_material';
          else if (typeStr === 'video') category = 'video_lecture';
          else if (typeStr === 'quiz') {
            category = 'quiz_document';
            parse = 'true';
          }
        }

        try {
          const res = await courseService.uploadFile(savedCourse.id, file, { category, level, parse });
          if (res.data?.warning) {
            errors.push(`${file.name}: ${res.data.message}`);
          } else {
            successCount++;
          }
        } catch (err) {
          console.error(`Upload error for ${key}:`, err);
          
          // Enhanced error message
          let errorMsg = err.message || 'Upload failed';
          
          if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
            errorMsg = '❌ Backend server is not responding. Please ensure the backend is running on port 3001.';
          } else if (err.code === 'ECONNREFUSED') {
            errorMsg = '❌ Cannot connect to backend server. Run: npm run server';
          } else if (err.response?.status === 404) {
            errorMsg = '❌ Upload endpoint not found. Backend may have issues.';
          } else if (err.response?.status === 413) {
            errorMsg = '❌ File too large. Maximum size is 2GB.';
          } else if (err.response?.data?.error) {
            errorMsg = err.response.data.error;
          }
          
          errors.push(`${file.name}: ${errorMsg}`);
        }
      }

      if (errors.length > 0) {
        setError(errors.join('; '));
        setUploadStatus({ message: 'Saved with errors', type: 'error' });
      } else {
        setUploadStatus({ message: 'All saved successfully!', type: 'success' });
        setTimeout(() => {
          onSave();
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Save error:', error);
      
      let errorMsg = error.message || 'Failed to save course.';
      
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        errorMsg = '❌ Backend server is not running. Please start it with: npm run server';
      }
      
      setError(errorMsg);
      setUploadStatus({ message: 'Error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{course ? 'Edit Course' : 'Create Course'}</h3>
            <p className="text-sm text-gray-500">Manage content and files</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <SafeIcon icon={FiX} className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar bg-gray-50">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-50 border-2 border-red-300 text-red-800 px-5 py-4 rounded-lg flex items-start gap-3 shadow-sm">
                <SafeIcon icon={FiAlertTriangle} className="w-6 h-6 mt-0.5 flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <p className="font-bold text-sm mb-1">Upload Error</p>
                  <p className="text-sm leading-relaxed">{error}</p>
                  {error.includes('Backend server is not running') && (
                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-xs">
                      <p className="font-bold mb-1">🔧 Quick Fix:</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Open a terminal</li>
                        <li>Run: <code className="bg-yellow-100 px-1 py-0.5 rounded font-mono">npm run server</code></li>
                        <li>Wait for "Server running" message</li>
                        <li>Try uploading again</li>
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Basic Info */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              <h4 className="font-bold text-gray-900 text-lg border-b pb-2 mb-4">Course Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Course Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Tutor Type</label>
                  <select
                    name="tutor_type"
                    value={formData.tutor_type}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  >
                    <option value="General">General</option>
                    <option value="SAT Math">SAT Math</option>
                    <option value="SAT Reading">SAT Reading</option>
                    <option value="Science">Science</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Display Settings (Price & Enrollment) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
              <h4 className="font-bold text-gray-900 text-lg border-b pb-2 mb-4">Marketing & Display</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <SafeIcon icon={FiUsers} className="w-4 h-4 text-gray-500" />
                    Students Enrolled (Display Count)
                  </label>
                  <input
                    type="number"
                    name="manual_enrollment_count"
                    value={formData.manual_enrollment_count}
                    onChange={handleChange}
                    placeholder="e.g. 1248"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave empty or 0 to show real enrollment count.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <SafeIcon icon={FiDollarSign} className="w-4 h-4 text-gray-500" />
                    Price (INR)
                  </label>
                  <input
                    type="number"
                    name="price_full"
                    value={formData.price_full}
                    onChange={handleChange}
                    placeholder="e.g. 1999"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 bg-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Set to 0 for "Free".</p>
                </div>
              </div>
            </div>

            {/* Upload Sections */}
            <div className="space-y-6">
              <h4 className="font-bold text-gray-900 text-xl">Course Materials</h4>
              {fetchingUploads ? (
                <div className="text-gray-500">Loading files...</div>
              ) : (
                <>
                  <LevelUploadSection
                    level="Easy"
                    color="green"
                    icon={FiBook}
                    newFiles={newFiles}
                    existingFiles={existingFiles}
                    onFileChange={handleFileChange}
                    onDeleteExisting={handleDeleteExisting}
                  />
                  <LevelUploadSection
                    level="Medium"
                    color="yellow"
                    icon={FiBook}
                    newFiles={newFiles}
                    existingFiles={existingFiles}
                    onFileChange={handleFileChange}
                    onDeleteExisting={handleDeleteExisting}
                  />
                  <LevelUploadSection
                    level="Hard"
                    color="red"
                    icon={FiBook}
                    newFiles={newFiles}
                    existingFiles={existingFiles}
                    onFileChange={handleFileChange}
                    onDeleteExisting={handleDeleteExisting}
                  />
                </>
              )}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center">
          <div className={`flex items-center gap-2 text-sm font-medium ${uploadStatus.type === 'error' ? 'text-red-600' : 'text-blue-600'}`}>
            {loading && <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin" />}
            {uploadStatus.message}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SafeIcon icon={FiSave} className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Sub-components
const LevelUploadSection = ({ level, color, icon, newFiles, existingFiles, onFileChange, onDeleteExisting }) => {
  const levelKey = level.toLowerCase();
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <h3 className="font-bold mb-4 flex items-center justify-between">
        {level} Level Content
        <span className="text-xs bg-white px-2 py-1 rounded border border-gray-200">
          {[
            existingFiles[`${levelKey}_study`],
            existingFiles[`${levelKey}_video`],
            existingFiles[`${levelKey}_quiz`]
          ].filter(Boolean).length} files
        </span>
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <FileUploadBox
          id={`${levelKey}_study`}
          label="Study Guide (PDF)"
          icon={FiFile}
          accept=".pdf,.doc,.docx"
          newFile={newFiles[`${levelKey}_study`]}
          existingFile={existingFiles[`${levelKey}_study`]}
          onChange={f => onFileChange(`${levelKey}_study`, f)}
          onDelete={id => onDeleteExisting(`${levelKey}_study`, id)}
        />
        <FileUploadBox
          id={`${levelKey}_video`}
          label="Video (MP4)"
          icon={FiVideo}
          accept=".mp4,.webm"
          newFile={newFiles[`${levelKey}_video`]}
          existingFile={existingFiles[`${levelKey}_video`]}
          onChange={f => onFileChange(`${levelKey}_video`, f)}
          onDelete={id => onDeleteExisting(`${levelKey}_video`, id)}
        />
        <FileUploadBox
          id={`${levelKey}_quiz`}
          label="Quiz File (Parsed)"
          icon={FiBook}
          accept=".txt,.docx"
          highlight
          newFile={newFiles[`${levelKey}_quiz`]}
          existingFile={existingFiles[`${levelKey}_quiz`]}
          onChange={f => onFileChange(`${levelKey}_quiz`, f)}
          onDelete={id => onDeleteExisting(`${levelKey}_quiz`, id)}
        />
      </div>
    </div>
  );
};

const FileUploadBox = ({ label, icon, accept, highlight, newFile, existingFile, onChange, onDelete }) => {
  const fileInputRef = useRef(null);

  return (
    <div className={`rounded-lg p-4 border ${highlight ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
      <div className="flex items-center gap-2 mb-2">
        <SafeIcon icon={icon} className={`w-4 h-4 ${highlight ? 'text-blue-600' : 'text-gray-500'}`} />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>

      {existingFile && !newFile && (
        <div className="mb-2 p-2 bg-white rounded border flex justify-between items-center">
          <span className="text-xs truncate max-w-[100px] text-gray-700" title={existingFile.file_name}>
            {existingFile.file_name}
          </span>
          <button type="button" onClick={() => onDelete(existingFile.id)} className="text-red-500">
            <SafeIcon icon={FiTrash2} className="w-3 h-3" />
          </button>
        </div>
      )}

      {newFile && (
        <div className="mb-2 p-2 bg-blue-100 rounded border border-blue-200 flex justify-between items-center">
          <span className="text-xs text-blue-800 truncate max-w-[100px]">{newFile.name}</span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              fileInputRef.current.value = '';
            }}
            className="text-blue-600"
          >
            <SafeIcon icon={FiX} className="w-3 h-3" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => fileInputRef.current.click()}
        className="w-full py-2 bg-white border rounded text-xs font-medium hover:bg-gray-50 text-gray-700"
      >
        {existingFile && !newFile ? 'Replace' : (newFile ? 'Change' : 'Upload')}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={e => onChange(e.target.files[0])}
      />
    </div>
  );
};

export default CourseForm;