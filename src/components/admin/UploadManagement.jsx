import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { uploadService } from '../../services/api';

const { FiFile, FiCheck, FiX, FiLoader, FiTrash2, FiRefreshCw, FiEye } = FiIcons;

const UploadManagement = () => {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUploads();
  }, []);

  const loadUploads = async () => {
    try {
      const response = await uploadService.getAll();
      setUploads(response.data);
    } catch (error) {
      console.error('Error loading uploads:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUpload = async (uploadId) => {
    if (window.confirm('Are you sure you want to delete this upload? This will NOT delete the extracted questions.')) {
      try {
        await uploadService.delete(uploadId);
        setUploads(prev => prev.filter(u => u.id !== uploadId));
      } catch (error) {
        console.error('Error deleting upload:', error);
      }
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return FiCheck;
      case 'error': return FiX;
      case 'processing': return FiLoader;
      default: return FiFile;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'processing': return 'text-blue-600 animate-spin';
      default: return 'text-gray-600';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
        <h2 className="text-2xl font-bold text-gray-900">File & Media Management</h2>
        <p className="text-gray-600 mt-2">Monitor and manage all document uploads and processing status</p>
      </div>

      {/* Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Uploads</p>
              <p className="text-2xl font-bold text-gray-900">{uploads.length}</p>
            </div>
            <SafeIcon icon={FiFile} className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {uploads.filter(u => u.status === 'completed').length}
              </p>
            </div>
            <SafeIcon icon={FiCheck} className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Questions</p>
              <p className="text-2xl font-bold text-purple-600">
                {uploads.reduce((sum, u) => sum + (u.questions_count || 0), 0)}
              </p>
            </div>
            <SafeIcon icon={FiEye} className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </motion.div>

      {/* Uploads List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-semibold text-gray-900">Upload History</h3>
          <button onClick={loadUploads} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center">
            <SafeIcon icon={FiRefreshCw} className="w-4 h-4 mr-1" /> Refresh
          </button>
        </div>
        
        {uploads.length === 0 ? (
          <div className="text-center py-12">
            <SafeIcon icon={FiFile} className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No uploads yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {uploads.map((upload, index) => (
              <motion.div
                key={upload.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <SafeIcon icon={getStatusIcon(upload.status)} className={`w-5 h-5 ${getStatusColor(upload.status)}`} />
                      <h4 className="font-medium text-gray-900">{upload.file_name}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(upload.status)}`}>
                        {upload.status}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                      <span className="font-medium text-gray-800">{upload.courseName}</span>
                      <span className="text-gray-400">•</span>
                      <span>{new Date(upload.created_at).toLocaleDateString()} {new Date(upload.created_at).toLocaleTimeString()}</span>
                    </div>
                    
                    {upload.status === 'completed' && (
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-green-600 font-medium">
                          {upload.questions_count} questions generated
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleDeleteUpload(upload.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete Upload Record"
                    >
                      <SafeIcon icon={FiTrash2} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default UploadManagement;