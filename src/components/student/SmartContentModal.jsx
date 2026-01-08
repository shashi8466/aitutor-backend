import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { aiService } from '../../services/api';
import { parseDocumentClient } from '../../utils/clientParser';
import SmartDocViewer from './smart/SmartDocViewer';
import SmartAIPanel from './smart/SmartAIPanel';

const { FiX, FiUpload, FiLink, FiCpu, FiFileText } = FiIcons;

const SmartContentModal = ({ onClose }) => {
  const [viewState, setViewState] = useState('upload'); // upload, processing, split
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  
  // AI Data
  const [extractedText, setExtractedText] = useState('');
  const [summaryData, setSummaryData] = useState(null);

  const handleProcess = async () => {
    if (!file && !url) return;
    setViewState('processing');
    setError('');
    try {
      let text = '';
      
      if (file) {
        // Use client-side parser for files
        const result = await parseDocumentClient(file, true); // rawTextOnly = true
        text = result.text;
      } else if (url) {
        // Use server API for URLs
        const res = await aiService.extractContent(null, url);
        text = res.data?.text;
      }
      
      if (!text || text.length < 50) {
        throw new Error("Could not extract enough text. Please try a different file.");
      }
      
      setExtractedText(text);

      // 2. Summarize (Initial Analysis - Lazy load mostly handled in panel now)
      // We start this but don't block the UI for it
      aiService.summarizeContent(text).then(res => setSummaryData(res.data)).catch(console.error);

      setViewState('split');
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to process content. Please try again.");
      setViewState('upload');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-0 md:p-4"
    >
      <motion.div 
        initial={{ scale: 0.98, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="w-full h-full md:rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col border border-gray-200"
      >
        {/* Header - Premium & Minimal */}
        <div className="h-16 border-b border-gray-100 flex justify-between items-center px-6 bg-white z-10 flex-shrink-0">
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 bg-black rounded-lg flex items-center justify-center text-white shadow-lg">
                <SafeIcon icon={FiCpu} className="w-5 h-5"/>
             </div>
             <div>
                <span className="font-bold text-lg tracking-tight text-gray-900 block leading-tight">AI Tutor</span>
                <span className="text-[10px] font-bold text-[#E53935] uppercase tracking-widest">Intelligent Assistant</span>
             </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-black"
          >
            <SafeIcon icon={FiX} className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden relative bg-[#F9FAFB]">
          
          {/* A. Upload State */}
          {viewState === 'upload' && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                   <SafeIcon icon={FiUpload} className="w-8 h-8 text-[#E53935]" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Knowledge</h2>
                <p className="text-gray-500 mb-8 text-sm">Upload a PDF/DOCX or paste a URL to generate an interactive study guide.</p>
                
                {/* File Input */}
                <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-8 mb-4 hover:border-black hover:bg-gray-50 cursor-pointer transition-all group">
                   <span className="text-sm font-bold text-gray-400 group-hover:text-black transition-colors block">
                      {file ? (
                        <span className="text-black flex items-center justify-center gap-2">
                          <SafeIcon icon={FiFileText} className="text-[#E53935]" /> {file.name}
                        </span>
                      ) : (
                        "Click to Upload Document"
                      )}
                   </span>
                   <input type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={(e) => {
                     if (e.target.files[0]) {
                       setFile(e.target.files[0]);
                       setUrl(''); // Clear URL when file is selected
                     }
                   }} />
                </label>

                {/* URL Input */}
                <div className="relative mb-6">
                   <SafeIcon icon={FiLink} className="absolute left-4 top-4 text-gray-400 w-4 h-4" />
                   <input 
                      type="text" 
                      placeholder="Or paste a website URL..." 
                      className="w-full pl-10 pr-4 py-3.5 bg-gray-50 border border-transparent focus:bg-white focus:border-gray-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-black/5 text-sm transition-all"
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        if (e.target.value) setFile(null); // Clear file when URL is entered
                      }}
                   />
                </div>

                {error && <p className="text-red-600 text-xs mb-4 font-bold bg-red-50 p-2 rounded-lg">{error}</p>}

                <button 
                  onClick={handleProcess}
                  disabled={!file && !url}
                  className="w-full py-3.5 bg-black text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm"
                >
                  Analyze Content
                </button>
              </div>
            </div>
          )}

          {/* B. Processing State */}
          {viewState === 'processing' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white">
               <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }} 
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="w-16 h-16 border-4 border-gray-100 border-t-[#E53935] rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <SafeIcon icon={FiCpu} className="w-5 h-5 text-black" />
                  </div>
               </div>
               <h3 className="mt-6 font-bold text-xl text-gray-900">Analyzing Content</h3>
               <p className="text-gray-400 mt-2 text-sm font-medium">Extracting chapters & key concepts...</p>
            </div>
          )}

          {/* C. Split View State */}
          {viewState === 'split' && (
            <div className="flex h-full flex-col md:flex-row">
              {/* Left: Document Viewer (50%) */}
              <div className="h-1/2 md:h-full md:w-1/2 md:border-r border-b md:border-b-0 border-gray-200 bg-white">
                 <SmartDocViewer file={file} url={url} textContent={extractedText} />
              </div>

              {/* Right: AI Assistant (50%) */}
              <div className="h-1/2 md:h-full md:w-1/2 bg-[#F9FAFB]">
                 <SmartAIPanel 
                    content={extractedText} 
                    summary={summaryData} 
                 />
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
};

export default SmartContentModal;