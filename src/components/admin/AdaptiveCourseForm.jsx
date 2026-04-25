import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService } from '../../services/api';
import axios from 'axios';
import supabase from '../../supabase/supabase';


const { FiX, FiSave, FiAlertTriangle, FiBook, FiLoader, FiUsers, FiDollarSign, FiVideo, FiFile, FiCheck, FiKey, FiCopy, FiActivity, FiTrash2 } = FiIcons;

const AdaptiveCourseForm = ({ onClose, onSave, course = null }) => {
  const isEditMode = !!course;
  const [formData, setFormData] = useState({
    name: course?.name || 'Full-Length Adaptive SAT Test',
    description: course?.description || 'An adaptive SAT test that adjusts difficulty based on performance in the first module.',
    threshold_percentage: course?.threshold_percentage || 60,
    price_full: course?.price_full || '',
    manual_enrollment_count: course?.manual_enrollment_count || '',
    status: course?.status || 'active',
    is_demo: course?.is_demo || false,
    is_practice: course?.is_practice ?? true
  });

  // Enrollment Key State
  const [generateKey, setGenerateKey] = useState(true);
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [keyOptions, setKeyOptions] = useState({
    maxUses: '',
    maxStudents: '',
    validUntil: '',
    description: ''
  });
  const [customKey, setCustomKey] = useState('');

  const [newFiles, setNewFiles] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadStatus, setUploadStatus] = useState({ message: '', type: 'info' });

  const [existingUploads, setExistingUploads] = useState({});
  const [loadingUploads, setLoadingUploads] = useState(false);

  useEffect(() => {
    if (isEditMode && course?.id) {
      loadExistingUploads();
    }
  }, [isEditMode, course?.id]);

  const loadExistingUploads = async () => {
    try {
      setLoadingUploads(true);
      const { data: uploads } = await supabase
        .from('uploads')
        .select('*')
        .eq('course_id', course.id);
      
      if (uploads) {
        const mapped = {};
        uploads.forEach(u => {
          const sectionKey = u.section === 'math' ? 'math' : 
                            (u.section === 'reading_writing' ? 'rw' : 
                            ((u.file_name?.toLowerCase().includes('math')) ? 'math' : 'rw'));
          const levelKey = u.level?.toLowerCase();
          const typeKey = u.category === 'study_material' ? 'study' : 
                          u.category === 'video_lecture' ? 'video' : 'quiz';
          
          if (levelKey && sectionKey) {
            mapped[`${sectionKey}_${levelKey}_${typeKey}`] = u;
          }
        });
        setExistingUploads(mapped);
      }
    } catch (err) {
      console.error("Error loading existing uploads:", err);
    } finally {
      setLoadingUploads(false);
    }
  };

  const handleDeleteExisting = async (key) => {
    const upload = existingUploads[key];
    if (!upload) return;

    try {
      setLoading(true);
      await uploadService.delete(upload.id);
      setExistingUploads(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (err) {
      setError("Failed to delete file: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleFileChange = (key, file) => setNewFiles(prev => ({ ...prev, [key]: file }));

  const createEnrollmentKey = async (courseId) => {
    try {
      if (customKey && (customKey.length < 4 || customKey.length > 12)) {
        setError('Enrollment Key must be between 4 and 12 characters.');
        setLoading(false);
        return null;
      }

      const payload = {
        courseId,
        customCode: customKey || undefined,
        maxUses: keyOptions.maxUses ? parseInt(keyOptions.maxUses) : null,
        maxStudents: keyOptions.maxStudents ? parseInt(keyOptions.maxStudents) : null,
        validUntil: keyOptions.validUntil || null,
        description: keyOptions.description || `Access key for ${formData.name}`
      };

      const response = await axios.post('/api/enrollment/create-key', payload);
      if (response.data.success || response.data.key) {
        setGeneratedKey(response.data.key);
        return response.data.key;
      }
    } catch (error) {
      console.error('Error generating key:', error);
      setError('Failed to generate enrollment key: ' + (error.response?.data?.error || error.message));
    }
    return null;
  };

  const copyKeyToClipboard = () => {
    if (generatedKey?.key_code) {
      navigator.clipboard.writeText(generatedKey.key_code);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    console.log("Submit triggered", { isEditMode, formData, newFiles });
    
    const requiredModules = ['rw_moderate', 'rw_easy', 'rw_hard', 'math_moderate', 'math_easy', 'math_hard'];
    const missing = [];
    
    // Only require files on initial creation
    if (!isEditMode) {
      for (const m of requiredModules) {
          if (!newFiles[`${m}_quiz`]) {
              missing.push(`${m.replace('_', ' ').toUpperCase()} Quiz`);
          }
      }
      
      if (missing.length > 0) {
          setError(`Missing required quiz files: ${missing.join(', ')}`);
          return;
      }
    }

    setLoading(true);
    setError('');
    setUploadStatus({ message: isEditMode ? 'Updating course...' : 'Creating adaptive course...', type: 'info' });

    try {
      const cleanData = {
        name: formData.name,
        description: formData.description,
        tutor_type: 'Full-Length SAT Test',
        price: Number(formData.price_full) || 0,
        currency: 'INR',
        is_free: Number(formData.price_full) === 0,
        is_practice: true,
        is_demo: formData.is_demo,
        status: formData.status || 'active',
        manual_enrollment_count: Number(formData.manual_enrollment_count) || 0,
        main_category: 'Adaptive Tests',
        category: 'Full-Length SAT',
        is_adaptive: true,
        threshold_percentage: Number(formData.threshold_percentage) || 60
      };

      let savedCourse;
      if (isEditMode) {
        const response = await courseService.update(course.id, cleanData);
        savedCourse = response.data || response;
      } else {
        const response = await courseService.create(cleanData);
        savedCourse = response.data || response;
      }

      if (Array.isArray(savedCourse)) savedCourse = savedCourse[0];

      if (!savedCourse || !savedCourse.id) {
        throw new Error(`Failed to ${isEditMode ? 'update' : 'create'} course - no course ID returned.`);
      }

      // 2. Generate Enrollment Key if requested (Only on creation or if explicitly asked? For now, keep as is)
      if (!isEditMode && generateKey && savedCourse?.id) {
        setUploadStatus({ message: 'Generating enrollment key...', type: 'info' });
        await createEnrollmentKey(savedCourse.id);
      }

      setUploadStatus({ message: 'Course created. Uploading module content...', type: 'info' });

      // 3. Upload ALL Files (18 potential files: 6 modules * 3 types)
      const errors = [];
      const sections = ['reading_writing', 'math'];
      const levels = ['Moderate', 'Easy', 'Hard'];
      
      for (const section of sections) {
        for (const level of levels) {
          const sectionKey = section === 'reading_writing' ? 'rw' : 'math';
          const levelKey = level.toLowerCase();
          const baseKey = `${sectionKey}_${levelKey}`;

          const moduleFiles = [
            { key: `${baseKey}_study`, category: 'study_material', parse: 'false' },
            { key: `${baseKey}_video`, category: 'video_lecture', parse: 'false' },
            { key: `${baseKey}_quiz`, category: 'quiz_document', parse: 'true' }
          ];

          for (const config of moduleFiles) {
            const file = newFiles[config.key];
            if (!file) continue;

            setUploadStatus({ message: `Uploading ${level} ${section.replace('_', ' ')}: ${file.name}...`, type: 'info' });
            
            try {
              const res = await courseService.uploadFile(savedCourse.id, file, {
                level,
                section,
                category: config.category,
                parse: config.parse
              });
              if (res.data?.warning) {
                errors.push(`${file.name}: ${res.data.message}`);
              }
            } catch (err) {
              console.error(`Upload error for ${config.key}:`, err);
              errors.push(`${file.name}: ${err.response?.data?.error || err.message}`);
            }
          }
        }
      }

      if (errors.length > 0) {
        setError("Course created but some uploads failed: " + errors.join('; '));
        setUploadStatus({ message: 'Completed with errors', type: 'error' });
      } else {
        setUploadStatus({ 
          message: generateKey ? 'Adaptive course created with Enrollment Key!' : 'Adaptive course created successfully!', 
          type: 'success' 
        });
        
        if (!generateKey) {
            setTimeout(() => {
              onSave();
              onClose();
            }, 2000);
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      setError(error.response?.data?.error || error.message || 'Failed to save adaptive course.');
      setUploadStatus({ message: 'Error occurred', type: 'error' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh] border dark:border-slate-800"
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div>
            <h3 className="text-2xl font-bold text-purple-700">Create Full-Length SAT Test (Adaptive)</h3>
            <p className="text-sm text-gray-500">Configure strict 6-module adaptive flow</p>
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
                  <p className="font-bold text-sm mb-1">Error</p>
                  <p className="text-sm leading-relaxed">{error}</p>
                </div>
              </div>
            )}

            {/* Section 1: SAT Test Configuration (Core Feature) */}
            <div className="bg-white p-6 rounded-xl border border-purple-200 shadow-sm space-y-8">
              <div className="flex items-center gap-3 border-b border-purple-100 pb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                   <SafeIcon icon={FiActivity} className="text-purple-600 w-6 h-6" />
                </div>
                <div>
                   <h4 className="font-bold text-gray-900 text-lg">SAT Test Configuration</h4>
                   <p className="text-xs text-gray-500">Define the adaptive logic layer and upload core modules</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Test Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Threshold Percentage (%)</label>
                  <input
                    type="number"
                    name="threshold_percentage"
                    value={formData.threshold_percentage}
                    onChange={handleChange}
                    required
                    min="1"
                    max="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Score &ge; this threshold in Moderate module triggers the Hard module.</p>
                </div>
              </div>

              <div className="space-y-10">
                {/* Reading & Writing Modules */}
                <div className="space-y-6">
                  <h5 className="font-black text-blue-900 text-sm uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-6 bg-blue-500 rounded-full"></div>
                    Reading & Writing Section
                  </h5>
                  
                  <ModuleContentBlock 
                    title="1. Moderate (Starting)"
                    baseKey="rw_moderate"
                    newFiles={newFiles}
                    existingUploads={existingUploads}
                    onDeleteExisting={handleDeleteExisting}
                    handleFileChange={handleFileChange}
                    colorClass="blue"
                  />
                  
                  <ModuleContentBlock 
                    title="2. Easy (Score < Threshold)"
                    baseKey="rw_easy"
                    newFiles={newFiles}
                    existingUploads={existingUploads}
                    onDeleteExisting={handleDeleteExisting}
                    handleFileChange={handleFileChange}
                    colorClass="blue"
                  />
                  
                  <ModuleContentBlock 
                    title="3. Hard (Score &ge; Threshold)"
                    baseKey="rw_hard"
                    newFiles={newFiles}
                    existingUploads={existingUploads}
                    onDeleteExisting={handleDeleteExisting}
                    handleFileChange={handleFileChange}
                    colorClass="blue"
                  />
                </div>

                {/* Math Modules */}
                <div className="space-y-6">
                  <h5 className="font-black text-emerald-900 text-sm uppercase tracking-widest flex items-center gap-2">
                    <div className="w-2 h-6 bg-emerald-500 rounded-full"></div>
                    Math Section
                  </h5>
                  
                  <ModuleContentBlock 
                    title="1. Moderate (Starting)"
                    baseKey="math_moderate"
                    newFiles={newFiles}
                    existingUploads={existingUploads}
                    onDeleteExisting={handleDeleteExisting}
                    handleFileChange={handleFileChange}
                    colorClass="emerald"
                  />
                  
                  <ModuleContentBlock 
                    title="2. Easy (Score < Threshold)"
                    baseKey="math_easy"
                    newFiles={newFiles}
                    existingUploads={existingUploads}
                    onDeleteExisting={handleDeleteExisting}
                    handleFileChange={handleFileChange}
                    colorClass="emerald"
                  />
                  
                  <ModuleContentBlock 
                    title="3. Hard (Score &ge; Threshold)"
                    baseKey="math_hard"
                    newFiles={newFiles}
                    existingUploads={existingUploads}
                    onDeleteExisting={handleDeleteExisting}
                    handleFileChange={handleFileChange}
                    colorClass="emerald"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: General Course Settings (Reuse Existing Features) */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-8">
              <div className="flex items-center justify-between border-b pb-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                       <SafeIcon icon={FiBook} className="text-gray-600 w-6 h-6" />
                    </div>
                    <div>
                       <h4 className="font-bold text-gray-900 text-lg">General Course Settings</h4>
                       <p className="text-xs text-gray-500">Marketing, Content, and Access Control</p>
                    </div>
                 </div>
                 <select
                   name="status"
                   value={formData.status}
                   onChange={handleChange}
                   className="text-xs font-bold px-4 py-2 rounded-full bg-gray-100 border-none outline-none hover:bg-gray-200 transition-colors"
                 >
                   <option value="active">Active</option>
                   <option value="draft">Draft</option>
                 </select>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Left: Marketing & Display */}
                <div className="space-y-6">
                  <h5 className="text-sm font-bold text-gray-900">Marketing & Display</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiUsers} className="w-3.5 h-3.5" />
                        Students Enrolled (Display Count)
                      </label>
                      <input
                        type="number"
                        name="manual_enrollment_count"
                        value={formData.manual_enrollment_count}
                        onChange={handleChange}
                        placeholder="e.g. 1248"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 font-medium">Leave empty or 0 to show real enrollment count.</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiDollarSign} className="w-3.5 h-3.5" />
                        Price (INR)
                      </label>
                      <input
                        type="number"
                        name="price_full"
                        value={formData.price_full}
                        onChange={handleChange}
                        placeholder="e.g. 1999"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  {/* Public Demo Box */}
                  <div className="bg-blue-50/80 border border-blue-100 rounded-xl p-4 flex items-start gap-4 shadow-sm group hover:bg-blue-50 transition-all cursor-pointer" onClick={() => setFormData({...formData, is_demo: !formData.is_demo})}>
                    <div className="flex items-center h-5">
                      <input 
                        type="checkbox" 
                        id="is_demo" 
                        checked={formData.is_demo} 
                        onChange={(e) => setFormData({...formData, is_demo: e.target.checked})}
                        className="w-5 h-5 text-blue-600 rounded border-blue-200 focus:ring-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="is_demo" className="text-sm font-bold text-blue-800 flex items-center gap-2 cursor-pointer mb-0.5">
                        <SafeIcon icon={FiActivity} className="w-4 h-4" />
                        Mark as Public Demo Course
                      </label>
                      <p className="text-[11px] text-blue-600 leading-tight">
                        Enable this to generate a standalone public link that requires no login/signup.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right: Marketing & Meta */}
                <div className="space-y-6">
                  <h5 className="text-sm font-bold text-gray-900">Marketing & Visibility</h5>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 mb-1.5 uppercase tracking-widest">Description</label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all resize-none text-sm"
                        placeholder="Describe the target audience and test benefits..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Enrollment Key Section (Updated Style) */}
              <div className="pt-8 border-t border-gray-100 space-y-6">
                <div className="flex items-center gap-2 text-purple-700">
                  <SafeIcon icon={FiKey} className="w-5 h-5" />
                  <h5 className="font-bold text-gray-900">Enrollment Key (Optional)</h5>
                </div>

                <div className="bg-gray-50/50 border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="flex items-center h-5">
                      <input 
                        type="checkbox" 
                        id="gen_key" 
                        checked={generateKey} 
                        onChange={(e) => setGenerateKey(e.target.checked)}
                        className="w-5 h-5 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="gen_key" className="text-sm font-bold text-gray-700 cursor-pointer block mb-0.5">
                        Generate enrollment key when creating this course
                      </label>
                      <p className="text-[11px] text-gray-500">Students will need this key to enroll in the course</p>
                    </div>
                  </div>

                  {generateKey && !generatedKey && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 p-5 bg-white rounded-xl border border-purple-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                      <div>
                        <label className="block text-[10px] font-black text-purple-600 mb-1.5 uppercase tracking-widest">Custom Key Code</label>
                        <input
                          type="text"
                          value={customKey}
                          onChange={(e) => setCustomKey(e.target.value.toUpperCase().replace(/\s/g, ''))}
                          placeholder="e.g. FREE2024"
                          maxLength={12}
                          className="w-full px-4 py-2 border border-purple-100 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono tracking-wider"
                        />
                        <p className="text-[9px] text-purple-400 mt-1">4-12 characters. Leave blank for random.</p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-purple-600 mb-1.5 uppercase tracking-widest">Max Students</label>
                        <input
                          type="number"
                          value={keyOptions.maxStudents}
                          onChange={(e) => setKeyOptions({...keyOptions, maxStudents: e.target.value})}
                          placeholder="Unlimited"
                          className="w-full px-4 py-2 border border-purple-100 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {generatedKey && (
                    <div className="mt-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-6 flex flex-col items-center text-center animate-in zoom-in">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-3">
                        <SafeIcon icon={FiCheck} className="text-emerald-600 w-6 h-6" />
                      </div>
                      <h5 className="font-black text-emerald-900 text-lg mb-1">Key Ready!</h5>
                      <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border-2 border-emerald-300 shadow-lg mt-2">
                        <span className="text-2xl font-black tracking-widest text-emerald-900">{generatedKey.key_code}</span>
                        <button 
                          type="button"
                          onClick={copyKeyToClipboard}
                          className="p-2 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors"
                        >
                          <SafeIcon icon={copiedKey ? FiCheck : FiCopy} className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </form>
        </div>

        <div className="p-6 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center">
          <div className={`flex items-center gap-2 text-sm font-medium ${uploadStatus.type === 'error' ? 'text-red-600' : 'text-purple-600'}`}>
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
              className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50 flex items-center gap-2"
            >
              <SafeIcon icon={FiSave} />
              {loading ? 'Processing...' : (isEditMode ? 'Update Course' : 'Create Course')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Per-Module Content Block (PDF, Video, Quiz)
const ModuleContentBlock = ({ title, baseKey, newFiles, existingUploads = {}, onDeleteExisting, handleFileChange, colorClass }) => {
  const fileCount = [
    newFiles[`${baseKey}_study`] || existingUploads[`${baseKey}_study`],
    newFiles[`${baseKey}_video`] || existingUploads[`${baseKey}_video`],
    newFiles[`${baseKey}_quiz`] || existingUploads[`${baseKey}_quiz`]
  ].filter(Boolean).length;

  return (
    <div className={`p-6 rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md ${
      colorClass === 'blue' ? 'border-blue-100 hover:border-blue-300' : 'border-emerald-100 hover:border-emerald-300'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <h6 className="font-bold text-gray-800 flex items-center gap-2">
          {title}
        </h6>
        <div className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-[10px] font-black text-gray-400 uppercase tracking-tighter">
          {fileCount} files
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SimpleFileUpload
          id={`${baseKey}_study`}
          label="Study Guide (PDF)"
          newFile={newFiles[`${baseKey}_study`]}
          existingFile={existingUploads[`${baseKey}_study`]}
          onDeleteExisting={() => onDeleteExisting(`${baseKey}_study`)}
          onChange={f => handleFileChange(`${baseKey}_study`, f)}
          accept=".pdf"
          icon={FiFile}
        />
        <SimpleFileUpload
          id={`${baseKey}_video`}
          label="Video (MP4)"
          newFile={newFiles[`${baseKey}_video`]}
          existingFile={existingUploads[`${baseKey}_video`]}
          onDeleteExisting={() => onDeleteExisting(`${baseKey}_video`)}
          onChange={f => handleFileChange(`${baseKey}_video`, f)}
          accept=".mp4"
          icon={FiVideo}
        />
        <SimpleFileUpload
          id={`${baseKey}_quiz`}
          label="Quiz File (DOCX)"
          newFile={newFiles[`${baseKey}_quiz`]}
          existingFile={existingUploads[`${baseKey}_quiz`]}
          onDeleteExisting={() => onDeleteExisting(`${baseKey}_quiz`)}
          onChange={f => handleFileChange(`${baseKey}_quiz`, f)}
          accept=".docx,.txt"
          icon={FiBook}
        />
      </div>
    </div>
  );
};

// Component for the "Card with Upload Button" style shown in the images
const SimpleFileUpload = ({ id, label, newFile, existingFile, onDeleteExisting, onChange, accept = ".txt,.docx", icon = FiBook, isBlue = false }) => {
  return (
    <div className={`flex flex-col p-5 rounded-xl border transition-all h-full ${
      isBlue 
        ? 'bg-blue-50/50 border-blue-100' 
        : 'bg-white border-gray-100'
    }`}>
      <div className="flex items-center gap-2 mb-4">
        <SafeIcon icon={icon} className={`w-3.5 h-3.5 ${isBlue ? 'text-blue-700' : 'text-slate-600'}`} />
        <span className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">{label}</span>
      </div>
      
      <input
        type="file"
        id={id}
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onChange(e.target.files[0]);
          }
        }}
        className="hidden"
      />
      
      {!newFile && !existingFile ? (
        <label
          htmlFor={id}
          className="w-full py-2 border border-gray-100 rounded-lg text-[10px] font-black text-gray-400 bg-white hover:bg-gray-50 hover:text-gray-600 cursor-pointer flex items-center justify-center transition-all uppercase tracking-widest"
        >
          Upload
        </label>
      ) : newFile ? (
        <div className="space-y-2 mt-auto">
          <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/30 p-2 rounded-lg border border-purple-100 dark:border-purple-800">
             <span className="text-[10px] font-bold text-slate-950 dark:text-purple-100 truncate max-w-[80px]" title={newFile.name}>
                {newFile.name}
             </span>
             <span className="text-[8px] font-black text-purple-400">NEW</span>
          </div>
          <label htmlFor={id} className="w-full py-1.5 border border-purple-200 rounded-lg text-[9px] font-black text-purple-600 bg-white hover:bg-purple-50 cursor-pointer flex items-center justify-center uppercase tracking-widest transition-all">
            Change
          </label>
        </div>
      ) : (
        <div className="space-y-2 mt-auto">
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/30 p-2 rounded-lg border border-emerald-100 dark:border-emerald-800">
             <span className="text-[10px] font-bold text-slate-950 dark:text-emerald-100 truncate max-w-[80px]" title={existingFile.file_name}>
                {existingFile.file_name}
             </span>
             <span className="text-[8px] font-black text-emerald-400">READY</span>
          </div>
          <div className="flex gap-1">
            <label htmlFor={id} className="flex-1 py-1.5 border border-gray-200 rounded-lg text-[9px] font-black text-gray-400 bg-white hover:bg-gray-50 cursor-pointer flex items-center justify-center uppercase tracking-widest transition-all">
              Replace
            </label>
            <button 
              type="button"
              onClick={onDeleteExisting}
              className="px-2 py-1.5 border border-red-100 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
            >
              <SafeIcon icon={FiTrash2} className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdaptiveCourseForm;
