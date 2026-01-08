import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import ServerStatusBanner from '../../components/common/ServerStatusBanner';

const { FiUpload, FiFile, FiCheck, FiX, FiAlertCircle, FiLoader, FiTrash2, FiSettings, FiDatabase } = FiIcons;

const FileUpload = () => {
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [courses, setCourses] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [serverOnline, setServerOnline] = useState(false);
  
  // New Upload Options
  const [parseAsQuiz, setParseAsQuiz] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('All');

  const navigate = useNavigate();

  React.useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const response = await courseService.getAll();
      setCourses(response.data);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles) => {
    const validFiles = newFiles.filter(file => {
      // Extended support for video formats
      const validTypes = ['.pdf', '.docx', '.txt', '.zip', '.mp4', '.mov', '.webm', '.avi', '.mkv'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      const isValidType = validTypes.includes(fileExtension);
      
      // INCREASED LIMIT TO 3GB
      const MAX_SIZE = 3 * 1024 * 1024 * 1024; // 3GB
      const isValidSize = file.size <= MAX_SIZE;

      if (!isValidType) {
        console.warn(`Invalid file type: ${file.name}. Supported: PDF, DOCX, TXT, ZIP, MP4, MOV, WEBM`);
        return false;
      }
      if (!isValidSize) {
        console.warn(`File too large: ${file.name}. Maximum size: 3GB`);
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'pending'
    }))]);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleUpload = async () => {
    if (!selectedCourse || files.length === 0) return;

    setUploading(true);
    setUploadResults([]);

    // Determine metadata based on file type if not parsing as quiz
    const getCategory = (file) => {
      if (parseAsQuiz) return 'quiz_document';
      const ext = file.name.split('.').pop().toLowerCase();
      if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video_lecture';
      return 'study_material';
    };

    for (const fileItem of files) {
      try {
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'uploading' } : f));
        
        const metadata = {
          category: getCategory(fileItem.file),
          level: selectedLevel,
          parse: parseAsQuiz ? 'true' : 'false'
        };

        // Use real upload service with Metadata
        const response = await courseService.uploadFile(selectedCourse, fileItem.file, metadata);
        
        setUploadResults(prev => [...prev, {
          fileName: fileItem.file.name,
          status: 'success',
          message: response.data.count > 0 
            ? `Successfully imported ${response.data.count} questions` 
            : parseAsQuiz ? "Uploaded, but no questions found." : "File uploaded successfully"
        }]);

        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'completed' } : f));
      } catch (error) {
        console.error(error);
        setUploadResults(prev => [...prev, {
          fileName: fileItem.file.name,
          status: 'error',
          message: error.response?.data?.error || error.message || 'Failed to process file'
        }]);
        setFiles(prev => prev.map(f => f.id === fileItem.id ? { ...f, status: 'error' } : f));
      }
    }
    setUploading(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return FiCheck;
      case 'error': return FiX;
      case 'uploading': 
      case 'processing': return FiLoader;
      default: return FiFile;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'uploading': 
      case 'processing': return 'text-blue-600 animate-spin';
      default: return 'text-gray-600';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Document & Video Upload System</h2>
        <p className="text-gray-600 mt-2">Upload documents to extract questions or videos for course content</p>
      </div>

      {/* Server Status Check */}
      <ServerStatusBanner onStatusChange={setServerOnline} />

      {/* Upload Settings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <SafeIcon icon={FiSettings} className="w-5 h-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">Upload Settings</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Course</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a course...</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
            <div className="flex items-center h-[42px] px-3 border border-gray-300 rounded-lg bg-gray-50">
              <input
                type="checkbox"
                id="parseAsQuiz"
                checked={parseAsQuiz}
                onChange={(e) => setParseAsQuiz(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="parseAsQuiz" className="ml-2 text-sm text-gray-700 cursor-pointer select-none">
                Parse as Quiz (Extract Questions)
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content Level</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">Mixed / All Levels</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs text-gray-500 gap-2">
          <SafeIcon icon={FiDatabase} className="w-3 h-3" />
          <span>Target Bucket: <strong>documents</strong> (Max 3GB)</span>
        </div>
      </motion.div>

      {/* File Upload Area */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`bg-white rounded-xl shadow-lg border border-gray-200 p-6 ${!serverOnline ? 'opacity-50 pointer-events-none grayscale' : ''}`}
      >
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <SafeIcon icon={FiUpload} className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Drop files here or click to upload</h3>
          <p className="text-gray-600 mb-4">Supports: PDF, DOCX, MP4, MOV, ZIP (Max 3GB)</p>
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.zip,.mp4,.mov,.webm,.avi,.mkv"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors"
          >
            Choose Files
          </label>
        </div>

        {files.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Selected Files</h4>
            <div className="space-y-2">
              {files.map((fileItem) => (
                <div key={fileItem.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <SafeIcon icon={getStatusIcon(fileItem.status)} className={`w-5 h-5 ${getStatusColor(fileItem.status)}`} />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block max-w-xs md:max-w-md">{fileItem.file.name}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(fileItem.file.size)})</span>
                    </div>
                  </div>
                  {fileItem.status === 'pending' && (
                    <button onClick={() => removeFile(fileItem.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                      <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleUpload}
              disabled={!selectedCourse || uploading || files.length === 0 || !serverOnline}
              className="mt-4 w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {uploading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  />
                  <span>Processing Files...</span>
                </>
              ) : (
                <>
                  <SafeIcon icon={FiUpload} className="w-4 h-4" />
                  <span>{parseAsQuiz ? "Upload & Parse Questions" : "Upload Files"}</span>
                </>
              )}
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium text-gray-900">Processing Results</h3>
            <button onClick={() => navigate('/admin/uploads')} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              View All Uploads →
            </button>
          </div>
          <div className="space-y-3">
            {uploadResults.map((result, index) => (
              <div key={index} className={`p-4 rounded-lg border ${result.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start space-x-3">
                  <SafeIcon icon={result.status === 'success' ? FiCheck : FiAlertCircle} className={`w-5 h-5 mt-0.5 ${result.status === 'success' ? 'text-green-600' : 'text-red-600'}`} />
                  <div>
                    <p className="font-medium text-gray-900 break-all">{result.fileName}</p>
                    <p className={`text-sm ${result.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                      {result.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default FileUpload;