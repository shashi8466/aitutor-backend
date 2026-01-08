import React, { useState, useEffect, useRef } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';

const {
  FiFileText, FiLink, FiCpu, FiAlignLeft, FiEye, FiAlertCircle,
  FiSidebar, FiSearch, FiMoon, FiSun, FiVolume2, FiVolumeX, FiX, FiArrowLeft, FiArrowRight
} = FiIcons;

const SmartDocViewer = ({ file, url, textContent }) => {
  // View State
  const [viewMode, setViewMode] = useState('original'); // 'original' | 'reader'
  const [fileUrl, setFileUrl] = useState(null);

  // Toolbar State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const speechRef = useRef(null);
  const isPDF = file?.type === 'application/pdf' || file?.name?.endsWith('.pdf');
  const isImage = file?.type?.startsWith('image/');

  // Initialize File URL
  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setFileUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (url) {
      setFileUrl(url);
    }
  }, [file, url]);

  // Auto-switch to Reader if no visual file (like .docx or .txt)
  useEffect(() => {
    const isVisual = isPDF || isImage || !!url;
    if (textContent && !isVisual) {
      setViewMode('reader');
    }
  }, [textContent, file, url, isPDF, isImage]);

  // Stop speech on unmount
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

  // --- Handlers ---

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'original' ? 'reader' : 'original');
  };

  const toggleSpeech = () => {
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
    } else {
      if (!textContent) return;
      // Cancel any existing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textContent);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsReading(false);
      utterance.onerror = () => setIsReading(false);

      speechRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      setIsReading(true);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    // Simple browser find
    if (window.find) {
      window.find(searchQuery);
    }
  };

  // --- Renderers ---

  const renderContent = () => {
    // 1. Reader View (Text Mode)
    if (viewMode === 'reader') {
      return (
        <div className={`w-full h-full overflow-y-auto custom-scrollbar p-8 md:p-12 transition-colors duration-300 ${isDarkMode ? 'bg-[#1a1a1a] text-gray-200' : 'bg-white text-gray-800'}`}>
          <div className="max-w-3xl mx-auto animate-fade-in">
            <div className={`mb-8 pb-4 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-100'}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-50 text-blue-700'}`}>
                  Reader View
                </span>
                {isReading && (
                  <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                    <SafeIcon icon={FiVolume2} className="w-3 h-3" /> Reading Aloud...
                  </span>
                )}
              </div>
              <h2 className={`text-3xl font-bold break-words leading-tight ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {file?.name || url || "Document Content"}
              </h2>
            </div>

            {textContent ? (
              <div className={`prose prose-lg max-w-none leading-8 font-serif whitespace-pre-wrap ${isDarkMode ? 'prose-invert text-gray-300' : 'text-gray-700'}`}>
                {textContent}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <SafeIcon icon={FiCpu} className="w-10 h-10 mb-4 animate-pulse" />
                <p className="text-sm font-medium">Extracting text content...</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 2. Original View (File/URL)
    if (!file && !url) {
      return (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 bg-gray-50">
          <SafeIcon icon={FiFileText} className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">No document loaded</p>
        </div>
      );
    }

    if (isPDF) {
      return (
        <div className="w-full h-full bg-gray-100 relative">
          <iframe
            src={`${fileUrl}#toolbar=0&view=FitH`}
            className="w-full h-full border-none relative z-10 bg-white"
            title="PDF Viewer"
          />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 overflow-auto p-4">
          <img src={fileUrl} alt="Preview" className="max-w-full max-h-full shadow-lg rounded-lg object-contain bg-white" />
        </div>
      );
    }

    if (url) {
      return (
        <div className="w-full h-full relative bg-white">
          <iframe
            src={url}
            className="w-full h-full border-none"
            title="Web Preview"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-yellow-50 p-2 text-center text-xs text-yellow-800 border-t border-yellow-100 opacity-90">
            If the site refuses to connect, switch to <strong className="cursor-pointer underline" onClick={() => setViewMode('reader')}>Reader View</strong>.
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50 p-8">
        <p>Preview not available.</p>
        <button onClick={() => setViewMode('reader')} className="mt-4 text-blue-600 font-bold hover:underline">
          Switch to Reader View
        </button>
      </div>
    );
  };

  return (
    <div className="h-full w-full bg-gray-50 flex flex-col border-r border-gray-200">

      {/* --- Premium Toolbar Header --- */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-20 shadow-sm relative">

        {/* Left: Toolbar Actions (Mac-style pill) */}
        <div className="flex items-center gap-4">
          {/* The Pill Container */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg">

            {/* 1. Sidebar / View Toggle */}
            <button
              onClick={toggleViewMode}
              className={`flex items-center gap-2 px-3 h-8 rounded-md transition-all text-xs font-bold ${viewMode === 'reader' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black hover:bg-gray-200'}`}
              title={viewMode === 'reader' ? "Show Original" : "Show Reader View"}
            >
              <SafeIcon icon={viewMode === 'reader' ? FiFileText : FiAlignLeft} className="w-4 h-4" />
              <span className="hidden sm:inline">{viewMode === 'reader' ? 'Original' : 'Reader View'}</span>
            </button>

            <div className="w-px h-4 bg-gray-300 mx-1"></div>

            {/* 2. Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${showSearch ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-black hover:bg-gray-200'}`}
              title="Find in text"
            >
              <SafeIcon icon={FiSearch} className="w-4 h-4" />
            </button>

            {/* 3. Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              disabled={viewMode !== 'reader'}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${isDarkMode ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-500 hover:text-black hover:bg-gray-200 disabled:opacity-30'}`}
              title="Toggle Dark Mode"
            >
              <SafeIcon icon={isDarkMode ? FiSun : FiMoon} className="w-4 h-4" />
            </button>

            {/* 4. Read Aloud (Speaker) */}
            <button
              onClick={toggleSpeech}
              disabled={!textContent}
              className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${isReading ? 'bg-[#E53935] text-white shadow-md' : 'text-gray-500 hover:bg-gray-200 disabled:opacity-30'}`}
              title="Read Aloud"
            >
              <SafeIcon icon={isReading ? FiVolumeX : FiVolume2} className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: File Info */}
        <div className="flex items-center gap-3 max-w-[40%] justify-end">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider hidden sm:block">
            {viewMode === 'reader' ? 'Reader View' : 'Document'}
          </span>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm ${isPDF ? 'bg-red-500' : 'bg-blue-500'}`}>
            <SafeIcon icon={FiFileText} className="w-4 h-4" />
          </div>
        </div>

        {/* Search Bar Popover */}
        {showSearch && (
          <div className="absolute top-16 left-6 z-30 bg-white p-2 rounded-xl shadow-xl border border-gray-200 flex items-center gap-2 animate-fade-in-down w-64">
            <SafeIcon icon={FiSearch} className="ml-2 text-gray-400 w-4 h-4" />
            <form onSubmit={handleSearch} className="flex-1">
              <input
                autoFocus
                type="text"
                placeholder="Find in document..."
                className="w-full py-1 bg-transparent border-none focus:ring-0 text-sm font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
            <button onClick={() => setShowSearch(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
              <SafeIcon icon={FiX} className="w-3 h-3" />
            </button>
          </div>
        )}

      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-hidden relative ${isDarkMode && viewMode === 'reader' ? 'bg-[#1a1a1a]' : 'bg-gray-50'}`}>
        {renderContent()}
      </div>
    </div>
  );
};

export default SmartDocViewer;