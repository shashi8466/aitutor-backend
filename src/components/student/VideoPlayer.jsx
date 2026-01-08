import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import AITutorModal from './AITutorModal';
import { uploadService } from '../../services/api';

const { FiVideo, FiArrowLeft, FiMessageCircle, FiBook, FiAlertCircle } = FiIcons;

const VideoPlayer = () => {
  const { courseId, level } = useParams();
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAI, setShowAI] = useState(false);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    loadVideos();
  }, [courseId, level]);

  const loadVideos = async () => {
    try {
      const { data } = await uploadService.getAll({ courseId });
      const levelVideos = data.filter(u => u.level === level && u.category === 'video_lecture');
      setVideos(levelVideos);
      if (levelVideos.length > 0) setActiveVideo(levelVideos[0]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoChange = (video) => {
    setActiveVideo(video);
    setVideoError(false); // Reset error state on change
  };

  const genericQuestion = {
    question: "Video content inquiry",
    correct_answer: "",
    type: "general"
  };

  if (loading) return <div className="p-12 text-center">Loading videos...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link to={`/student/course/${courseId}/level/${level}`} className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            <SafeIcon icon={FiArrowLeft} className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {level} Level Videos
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Player */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-black rounded-2xl overflow-hidden shadow-xl aspect-video relative flex items-center justify-center group">
              {activeVideo ? (
                !videoError ? (
                  /* FIX: Added 'key' prop to force re-render when video changes */
                  <video 
                    key={activeVideo.id} 
                    controls 
                    className="w-full h-full"
                    onError={() => setVideoError(true)}
                    /* Auto-play when switching videos can be nice, remove if unwanted */
                    autoPlay
                  >
                    <source src={activeVideo.file_url} type={`video/${activeVideo.file_type || 'mp4'}`} />
                    <source src={activeVideo.file_url} />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="text-center text-red-400 p-8">
                    <SafeIcon icon={FiAlertCircle} className="w-12 h-12 mx-auto mb-2" />
                    <p className="font-bold">Video Failed to Load</p>
                    <p className="text-sm mt-2 text-gray-400">
                      The file might be missing or corrupted.<br/>
                      Please ask the admin to delete and re-upload this video.
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center text-gray-400">
                  <SafeIcon icon={FiVideo} className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No video selected or available.</p>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                {activeVideo ? activeVideo.file_name : "Select a video"}
              </h2>
              <div className="flex gap-4 mt-4">
                <button 
                  onClick={() => setShowAI(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors"
                >
                  <SafeIcon icon={FiMessageCircle} className="w-4 h-4" />
                  Ask AI about this
                </button>
                <Link to={`/student/course/${courseId}/level/${level}`} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors">
                  <SafeIcon icon={FiBook} className="w-4 h-4" />
                  Study Material
                </Link>
              </div>
            </div>
          </div>

          {/* Playlist */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full max-h-[600px] flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-bold text-gray-800">Video Playlist ({videos.length})</h3>
              </div>
              <div className="overflow-y-auto p-2 space-y-2 flex-1 custom-scrollbar">
                {videos.length === 0 && <p className="p-4 text-center text-gray-500 text-sm">No videos found.</p>}
                {videos.map(video => (
                  <button 
                    key={video.id} 
                    onClick={() => handleVideoChange(video)}
                    className={`w-full p-3 rounded-lg text-left flex items-start gap-3 transition-colors ${activeVideo?.id === video.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}`}
                  >
                    <div className="w-20 h-12 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                      {/* Thumbnail Placeholder */}
                      <SafeIcon icon={FiVideo} className="w-4 h-4 text-gray-500" />
                      {/* Optional: If you had thumbnails, img goes here */}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium truncate ${activeVideo?.id === video.id ? 'text-blue-700' : 'text-gray-900'}`}>
                        {video.file_name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 uppercase">{video.file_type || 'MP4'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {showAI && (
          <AITutorModal 
            question={genericQuestion} 
            userAnswer="" 
            correctAnswer="" 
            onClose={() => setShowAI(false)} 
          />
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;