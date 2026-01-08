import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { uploadService, questionService, courseService } from '../../services/api';
import MathRenderer from '../../common/MathRenderer';

const { FiDatabase, FiFileText, FiChevronRight, FiLayers, FiFilter, FiTrash2, FiSearch, FiArrowLeft, FiCheckCircle, FiAlertCircle, FiUpload, FiX, FiLoader, FiPlus } = FiIcons;

const KnowledgeBase = () => {
  const [uploads, setUploads] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadUploads();
  }, []);

  useEffect(() => {
    if (selectedUpload) {
      loadQuestions(selectedUpload.id);
    }
  }, [selectedUpload]);

  const loadUploads = async () => {
    try {
      const { data } = await uploadService.getAll();
      // Filter only files that are meant to have questions (quiz_documents or parsed files)
      const meaningfulUploads = data.filter(u => u.questions_count > 0 || u.category === 'quiz_document');
      setUploads(meaningfulUploads);
    } catch (error) {
      console.error("Failed to load knowledge sources:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async (uploadId) => {
    setLoadingQuestions(true);
    try {
      const { data } = await questionService.getAll({ uploadId });
      setQuestions(data);
    } catch (error) {
      console.error("Failed to load questions:", error);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleDeleteQuestion = async (questionId) => {
    try {
      await questionService.delete(questionId);
      setQuestions(prev => prev.filter(q => q.id !== questionId));
      // Update the local upload count strictly for UI sync (optional)
      setUploads(prev => prev.map(u => 
        u.id === selectedUpload.id ? { ...u, questions_count: u.questions_count - 1 } : u
      ));
    } catch (error) {
      console.error("Failed to delete question:", error);
      alert("Failed to delete question.");
    }
  };

  const filteredUploads = uploads.filter(u => 
    u.file_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.courseName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-12 text-center text-gray-500">Loading Knowledge Base...</div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 relative">
      
      {/* LEFT PANEL: Source Documents List */}
      <div className={`flex-1 flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden ${selectedUpload ? 'hidden md:flex md:w-1/3 md:flex-none' : 'w-full'}`}>
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <SafeIcon icon={FiDatabase} className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">Sources</h2>
              </div>
            </div>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-xs font-bold"
            >
              <SafeIcon icon={FiPlus} className="w-4 h-4" /> Add File
            </button>
          </div>
          <div className="relative">
            <SafeIcon icon={FiSearch} className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search documents..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
          {filteredUploads.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No documents found.</div>
          ) : (
            filteredUploads.map(upload => (
              <motion.button
                key={upload.id}
                onClick={() => setSelectedUpload(upload)}
                whileHover={{ backgroundColor: '#f9fafb' }}
                className={`w-full text-left p-4 rounded-xl border transition-all group ${selectedUpload?.id === upload.id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-gray-100 hover:border-gray-300'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800 text-sm line-clamp-1" title={upload.file_name}>
                    {upload.file_name}
                  </span>
                  {selectedUpload?.id === upload.id && <SafeIcon icon={FiChevronRight} className="text-blue-500" />}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                  <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{upload.courseName}</span>
                  <span>•</span>
                  <span>{new Date(upload.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${upload.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {upload.status === 'completed' ? <SafeIcon icon={FiCheckCircle} className="w-3 h-3" /> : <SafeIcon icon={FiAlertCircle} className="w-3 h-3" />}
                    {upload.status}
                  </span>
                  <span className="ml-auto font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    {upload.questions_count} Qs
                  </span>
                </div>
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Questions Detail View */}
      <div className={`flex-[2] bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden ${!selectedUpload ? 'hidden md:flex items-center justify-center bg-gray-50 border-dashed' : ''}`}>
        {!selectedUpload ? (
          <div className="text-center text-gray-400 p-8">
            <SafeIcon icon={FiLayers} className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a document to view its knowledge</p>
            <p className="text-sm">Click on any file from the list to see extracted questions.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <button 
                  onClick={() => setSelectedUpload(null)} 
                  className="md:hidden mb-2 text-gray-500 flex items-center gap-1 text-sm font-medium"
                >
                  <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back to Files
                </button>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <SafeIcon icon={FiFileText} className="text-gray-500" />
                  {selectedUpload.file_name}
                </h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                  <span className="font-medium text-blue-600">{selectedUpload.courseName}</span>
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${getLevelBadge(selectedUpload.level)}`}>{selectedUpload.level} Level</span>
                </div>
              </div>
              <div className="text-right">
                <span className="block text-2xl font-bold text-gray-900">{questions.length}</span>
                <span className="text-xs text-gray-500 uppercase tracking-wider">Questions</span>
              </div>
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50 custom-scrollbar">
              {loadingQuestions ? (
                <div className="flex justify-center py-12">
                   <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No questions found linked to this file.</p>
                  <p className="text-xs mt-1">Try re-uploading or parsing the file again.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <motion.div 
                      key={q.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="space-y-2 w-full">
                            <p className="text-gray-900 font-medium leading-relaxed">
                              <MathRenderer text={q.question} />
                            </p>
                            
                            {/* Options Grid */}
                            {q.type === 'mcq' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                                {q.options.map((opt, i) => {
                                  const letter = String.fromCharCode(65 + i);
                                  const isCorrect = letter === q.correct_answer;
                                  return (
                                    <div key={i} className={`text-sm px-3 py-2 rounded border flex items-center gap-2 ${isCorrect ? 'bg-green-50 border-green-200 text-green-800 font-medium' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
                                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${isCorrect ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-500'}`}>{letter}</span>
                                      <span className="truncate"><MathRenderer text={opt} /></span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Short Answer / Explanation */}
                            <div className="flex flex-wrap gap-4 mt-2 text-xs">
                              {q.type !== 'mcq' && (
                                <div className="text-green-700 bg-green-50 px-2 py-1 rounded border border-green-100">
                                  <strong>Answer:</strong> {q.correct_answer}
                                </div>
                              )}
                              {q.explanation && (
                                <div className="text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100 max-w-full truncate">
                                  <strong>Expl:</strong> <span title={q.explanation}>{q.explanation.substring(0, 50)}{q.explanation.length > 50 ? '...' : ''}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete Question"
                        >
                          <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* KB Upload Modal */}
      {showUploadModal && <KBUploadModal onClose={() => setShowUploadModal(false)} onSuccess={() => { loadUploads(); setShowUploadModal(false); }} />}
    </div>
  );
};

// --- Internal Component: Knowledge Base Upload Modal ---
const KBUploadModal = ({ onClose, onSuccess }) => {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('Medium');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await courseService.getAll();
        setCourses(data);
      } catch (e) {
        console.error("Failed to load courses for upload modal", e);
      }
    };
    fetchCourses();
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !selectedCourse) {
      setError("Please select a course and a file.");
      return;
    }

    setUploading(true);
    setError('');

    try {
      const metadata = {
        category: 'quiz_document',
        level: selectedLevel,
        parse: 'true' // Always parse for Knowledge Base
      };

      const res = await courseService.uploadFile(selectedCourse, file, metadata);
      
      if (res.data?.success) {
        if (res.data.warning) {
          alert(`File uploaded with warning: ${res.data.message}`);
        }
        onSuccess(); // Refresh parent
      } else {
         throw new Error("Upload failed");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">Add Knowledge Source</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><SafeIcon icon={FiX} className="w-5 h-5"/></button>
        </div>

        {error && (
            <div className="mb-4 bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                <SafeIcon icon={FiAlertCircle} className="w-4 h-4" /> {error}
            </div>
        )}

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
            <select 
              value={selectedCourse} 
              onChange={(e) => setSelectedCourse(e.target.value)} 
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a course...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Target Level</label>
             <select 
               value={selectedLevel} 
               onChange={(e) => setSelectedLevel(e.target.value)}
               className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
             >
               <option value="Easy">Easy</option>
               <option value="Medium">Medium</option>
               <option value="Hard">Hard</option>
             </select>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">File (DOCX/TXT)</label>
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 transition-colors"
             >
                {file ? (
                    <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
                        <SafeIcon icon={FiCheckCircle} className="w-5 h-5" />
                        {file.name}
                    </div>
                ) : (
                    <div className="text-gray-500 text-sm">
                        <SafeIcon icon={FiUpload} className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Click to select file</p>
                    </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => setFile(e.target.files[0])} 
                  accept=".docx,.txt" 
                  className="hidden" 
                />
             </div>
          </div>

          <button 
            type="submit" 
            disabled={uploading || !file || !selectedCourse}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
             {uploading ? <SafeIcon icon={FiLoader} className="w-4 h-4 animate-spin"/> : <SafeIcon icon={FiUpload} className="w-4 h-4"/>}
             {uploading ? "Parsing & Uploading..." : "Upload & Extract"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

// Helper for badges
const getLevelBadge = (level) => {
  switch(level) {
    case 'Easy': return 'bg-green-100 text-green-800';
    case 'Medium': return 'bg-purple-100 text-purple-800';
    case 'Hard': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export default KnowledgeBase;