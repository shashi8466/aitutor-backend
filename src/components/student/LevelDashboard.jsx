import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { uploadService, courseService } from '../../services/api';

// Lazy load complex modals
const AITutorModal = lazy(() => import('./AITutorModal'));


const { FiBook, FiVideo, FiMessageCircle, FiAward, FiArrowLeft, FiFileText, FiDownload, FiEye, FiX, FiExternalLink, FiCpu, FiZap } = FiIcons;

const LevelDashboard = () => {
  const { courseId, level } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isTutorContext = location.pathname.startsWith('/tutor');
  const routeBase = isTutorContext ? '/tutor/course-content' : '/student';
  const [uploads, setUploads] = useState([]);
  const [showAI, setShowAI] = useState(false);

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  
  // New State for inline viewing
  const [viewingFile, setViewingFile] = useState(null);

  useEffect(() => {
    loadLevelData();
  }, [courseId, level]);

  const loadLevelData = async () => {
    try {
      const [uploadRes, courseRes] = await Promise.all([
        uploadService.getAll({ courseId }),
        courseService.getById(courseId)
      ]);
      if (courseRes.data && ['AP', 'ACT'].includes(courseRes.data.main_category?.toUpperCase())) {
        navigate(`${routeBase}/course/${courseId}`);
        return;
      }
      setUploads(uploadRes.data.filter(u => u.level === level || u.level === 'All'));
      setCourse(courseRes.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (file) => {
    if (file && file.file_url) {
      setViewingFile(file);
      // Smooth scroll to the viewer
      setTimeout(() => {
        document.getElementById('doc-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      alert("File URL is invalid or missing.");
    }
  };

  const handleDownload = (fileUrl, fileName) => {
    if (fileUrl) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName || 'download';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert("File URL is invalid or missing.");
    }
  };

  const studyMaterials = uploads.filter(u => u.category === 'study_material');
  const genericQuestion = { question: "How can I help you with your studies today?", correct_answer: "N/A", type: "general" };

  if (loading) return <div className="p-12 text-center text-[#E53935] font-bold">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - Red Theme */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#E53935] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-200">
            <SafeIcon icon={FiBook} className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-black mb-2">
            {level} Level Dashboard
          </h1>
          <p className="text-gray-600 max-w-2xl mx-auto font-medium text-sm sm:text-base">
            Access study materials, watch videos, ask questions, or take a quiz to test your knowledge.
          </p>
        </div>

        {/* Study Materials Section */}
        <div className="mb-10">
          <h3 className="text-xl font-bold text-black mb-4 flex items-center gap-2">
            <SafeIcon icon={FiFileText} className="w-5 h-5 text-[#E53935]" /> Study Materials
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studyMaterials.length > 0 ? (
              studyMaterials.map(file => (
                <div key={file.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all ${viewingFile?.id === file.id ? 'border-[#E53935] ring-1 ring-[#E53935]' : 'border-gray-200'}`}>
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <SafeIcon icon={FiFileText} className="w-6 h-6 text-gray-800" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate" title={file.file_name}>{file.file_name}</h4>
                      <p className="text-xs text-gray-500 mt-1 font-medium">Uploaded {new Date(file.created_at).toLocaleDateString()}</p>
                      <div className="flex gap-3 mt-3">
                        <button
                          onClick={() => handleView(file)}
                          className="text-xs font-bold text-[#E53935] flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <SafeIcon icon={FiEye} className="w-3 h-3" /> {viewingFile?.id === file.id ? 'Viewing...' : 'View'}
                        </button>
                        {/* Download removed for content security - students can only view */}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full p-8 text-center bg-white rounded-xl border border-dashed border-gray-300 text-gray-500 font-medium">
                No study materials uploaded for this level yet.
              </div>
            )}
          </div>

          {/* DOCUMENT VIEWER (Embedded) */}
          {viewingFile && (
            <DocumentViewer file={viewingFile} onClose={() => setViewingFile(null)} />
          )}
        </div>

        {/* 3 Action Cards - Themed */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 px-2 sm:px-0">

          {/* Card 1: Videos - White with Red Accent */}
          <Link to={`${routeBase}/course/${courseId}/level/${level}/video`} className="group h-full">
            <div className="h-full bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer group-hover:-translate-y-1 group-hover:shadow-lg flex flex-col items-center justify-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 shadow-sm text-[#E53935] group-hover:bg-[#E53935] group-hover:text-white transition-colors">
                <SafeIcon icon={FiVideo} className="w-6 h-6 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Premade Videos</h3>
              <p className="text-xs sm:text-sm text-gray-600 font-medium">Watch instructional videos</p>
            </div>
          </Link>



          {/* Card 3: Practice Quiz */}
          <Link 
            to={course?.is_adaptive 
              ? `${routeBase}/course/${courseId}/level/moderate/quiz?mode=practice` 
              : `${routeBase}/course/${courseId}/level/${level}/quiz?mode=practice`
            } 
            className="group h-full"
          >
            <div className="h-full bg-[#1A2333] hover:bg-[#1e293b] border border-gray-800 rounded-2xl p-6 text-center transition-all group-hover:-translate-y-1 group-hover:shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
               <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center mb-4 text-white group-hover:bg-white/20 transition-colors">
                <SafeIcon icon={FiZap} className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Practice Quiz</h3>
              <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                Build your skills with focus
              </p>
            </div>
          </Link>

          {/* Card 4: Take the Quiz - Primary Red Card */}
          <Link 
            to={course?.is_adaptive 
              ? `${routeBase}/adaptive-test/${courseId}` 
              : `${routeBase}/course/${courseId}/level/${level}/quiz`
            } 
            className="group h-full"
          >
            <div className="h-full bg-[#E53935] hover:bg-[#d32f2f] border border-[#E53935] rounded-2xl p-6 text-center transition-all cursor-pointer group-hover:-translate-y-1 group-hover:shadow-lg shadow-red-200 flex flex-col items-center justify-center">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-4 text-white">
                <SafeIcon icon={FiAward} className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">Take the Quiz</h3>
              <p className="text-[10px] text-red-100 font-medium">Test your knowledge</p>
            </div>
          </Link>

        </div>

        <div className="mt-12 text-center">
          <Link to={`${routeBase}/course/${courseId}`} className="text-gray-500 hover:text-black font-bold flex items-center justify-center gap-2 transition-colors py-2">
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back to Topics
          </Link>
        </div>

        {/* OLD AI Modal (Preserved for other calls if any) */}
        <Suspense fallback={null}>
          {showAI && (
            <AITutorModal question={genericQuestion} userAnswer="" correctAnswer="" onClose={() => setShowAI(false)} />
          )}

        </Suspense>

      </div>
    </div>
  );
};

// --- Helper Component for Viewing Files ---
const DocumentViewer = ({ file, onClose }) => {
  const ext = file.file_name?.split('.').pop().toLowerCase();
  const url = file.file_url;

  // File type detection
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext);
  const isPDF = ext === 'pdf';
  // Office files supported by Google Docs Viewer
  const isOffice = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext);

  return (
    <div id="doc-viewer" className="mt-8 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden scroll-mt-24 transition-all animate-fade-in" onContextMenu={(e) => e.preventDefault()}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          iframe, embed, object, #doc-viewer, .no-print {
            display: none !important;
          }
        }
      `}} />
      {/* Viewer Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-100 rounded text-[#E53935]">
            <SafeIcon icon={FiEye} className="w-4 h-4" />
          </div>
          <span className="font-bold text-gray-800 text-sm md:text-base truncate max-w-[200px] md:max-w-md">
            {file.file_name}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Close Preview"
          >
            <SafeIcon icon={FiX} className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Viewer Content */}
      <div className="w-full h-[400px] sm:h-[600px] bg-gray-100 relative">
        {isImage ? (
          <div className="w-full h-full flex items-center justify-center p-4">
            <img src={url} alt="Preview" className="max-w-full max-h-full object-contain shadow-sm bg-white" />
          </div>
        ) : isPDF ? (
          <iframe src={`${url}#toolbar=0`} className="w-full h-full" title="PDF Preview" />
        ) : isOffice ? (
          <iframe
            src={`https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`}
            className="w-full h-full"
            title="Office Document Preview"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-4">
            <SafeIcon icon={FiFileText} className="w-16 h-16 opacity-50" />
            <p>This file type cannot be previewed directly.</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-[#E53935] text-white rounded-lg hover:bg-[#d32f2f] font-medium transition-colors shadow-sm"
            >
              Open in New Tab
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default LevelDashboard;