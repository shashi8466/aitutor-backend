import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService } from '../../services/api';

const { 
  FiClock, FiBookOpen, FiPlay, FiArrowLeft, FiInfo, FiCheckCircle, 
  FiFileText, FiTarget, FiZap, FiActivity 
} = FiIcons;

const AdaptivePreTest = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  const loadCourseData = async () => {
    try {
      const { data } = await courseService.getById(courseId);
      setCourse(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Preparing Test Environment...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24">
      <div className="max-w-6xl mx-auto py-10">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate(`/student/course/${courseId}`)}
          className="group flex items-center gap-2 text-gray-500 hover:text-purple-600 font-bold transition-colors mb-8"
        >
          <SafeIcon icon={FiArrowLeft} className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          Back to Course
        </button>

        {/* Hero Section */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden mb-10">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-8 sm:p-12 text-white relative">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-white/20">
                  Full-Length SAT
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/30 text-emerald-300">
                  Adaptive
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black mb-4 leading-tight">
                {course?.name || 'Adaptive Practice Test'}
              </h1>
              <p className="text-purple-100 text-lg max-w-2xl font-medium opacity-90">
                Experience a realistic testing environment. This test adapts to your skill level in real-time.
              </p>
            </div>
            {/* Abstract Background Shapes */}
            <div className="absolute top-[-20%] right-[-10%] w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-60 h-60 bg-indigo-500/20 rounded-full blur-2xl"></div>
          </div>

          <div className="p-8 sm:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              {/* Left: Test Details */}
              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <SafeIcon icon={FiInfo} className="text-purple-500" />
                    Test Structure & Timing
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-5 bg-purple-50 rounded-2xl border border-purple-100">
                      <div className="text-purple-700 font-black mb-1">Reading & Writing</div>
                      <div className="text-sm text-gray-600 font-bold mb-3">2 Modules • 54 Questions</div>
                      <div className="flex items-center gap-2 text-xs font-black text-purple-600 uppercase">
                        <SafeIcon icon={FiClock} /> 64 Minutes
                      </div>
                    </div>
                    <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <div className="text-indigo-700 font-black mb-1">Mathematics</div>
                      <div className="text-sm text-gray-600 font-bold mb-3">2 Modules • 44 Questions</div>
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase">
                        <SafeIcon icon={FiClock} /> 70 Minutes
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Instructions</h3>
                  <ul className="space-y-3">
                    {[
                      "Timed environment: Manage your time carefully.",
                      "Adaptive Logic: Module 2 difficulty depends on Module 1 score.",
                      "All Math questions allow the use of a calculator.",
                      "You cannot go back to Section 1 after starting Section 2."
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-700 font-medium text-sm">
                        <SafeIcon icon={FiCheckCircle} className="text-emerald-500 w-5 h-5 mt-0.5 flex-shrink-0" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Right: Summary Box */}
              <div className="bg-slate-50 rounded-[32px] p-8 sm:p-10 border border-slate-100 flex flex-col justify-center text-center shadow-inner">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-md flex items-center justify-center mx-auto mb-8 transform -rotate-6 border border-slate-100">
                  <SafeIcon icon={FiTarget} className="w-10 h-10 text-purple-600" />
                </div>
                <h4 className="text-3xl font-black text-slate-900 mb-3">Ready to start?</h4>
                <p className="text-slate-500 text-sm font-bold mb-10 leading-relaxed">
                  Your progress is saved automatically. Ensure you have a quiet environment and a stable internet connection.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-8 py-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Questions</span>
                    <span className="text-xl font-black text-slate-900">98</span>
                  </div>
                  <div className="flex items-center justify-between px-8 py-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Time</span>
                    <span className="text-xl font-black text-slate-900">134 mins</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div
            whileHover={{ y: -8 }}
            className="group bg-white p-10 rounded-[32px] shadow-xl border border-slate-100 text-center relative overflow-hidden flex flex-col"
          >
            <div className="relative z-10 flex flex-col h-full">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiBookOpen} className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3">View Study Materials</h3>
              <p className="text-sm text-slate-500 font-medium mb-10 leading-relaxed flex-1">
                Review key concepts, formulas, and strategies before diving into the test.
              </p>
              <button 
                onClick={() => {
                  navigate(`/student/course/${courseId}`);
                  setTimeout(() => {
                    document.getElementById('preparation-materials')?.scrollIntoView({ behavior: 'smooth' });
                  }, 500);
                }}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 uppercase tracking-widest text-xs"
              >
                Access Materials
              </button>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8 }}
            className="group bg-white p-10 rounded-[32px] shadow-xl border border-slate-100 text-center relative overflow-hidden flex flex-col"
          >
            <div className="relative z-10 flex flex-col h-full">
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform">
                <SafeIcon icon={FiZap} className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3">Practice Quiz</h3>
              <p className="text-sm text-slate-500 font-medium mb-10 leading-relaxed flex-1">
                Take a quick, non-adaptive practice quiz to warm up your problem-solving skills.
              </p>
              <button 
                onClick={() => {
                  navigate(`/student/course/${courseId}/level/moderate/quiz?section=reading_writing&mode=practice`);
                }}
                className="w-full py-4 bg-amber-500 text-white font-black rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 uppercase tracking-widest text-xs"
              >
                Start Practice
              </button>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -8 }}
            className="group bg-slate-900 p-10 rounded-[32px] shadow-2xl border border-slate-800 text-center relative overflow-hidden flex flex-col"
          >
            <div className="relative z-10 flex flex-col h-full">
              <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform shadow-lg shadow-purple-500/20">
                <SafeIcon icon={FiActivity} className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-3">Take the Quiz</h3>
              <p className="text-sm text-slate-400 font-medium mb-10 leading-relaxed flex-1">
                Start the official full-length adaptive test engine and track your performance.
              </p>
              <button 
                onClick={() => navigate(`/student/adaptive-test/${courseId}`)}
                className="w-full py-4 bg-purple-600 text-white font-black rounded-2xl hover:bg-purple-700 transition-all shadow-xl shadow-purple-900/40 uppercase tracking-widest text-xs"
              >
                Begin Official Test
              </button>
            </div>
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <SafeIcon icon={FiZap} className="w-20 h-20 text-white" />
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default AdaptivePreTest;
