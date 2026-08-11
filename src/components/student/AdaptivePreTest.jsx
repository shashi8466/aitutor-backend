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
      <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
        
        {/* Back Button */}
        <button 
          onClick={() => navigate('/student/courses')}
          className="group flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold transition-colors mb-6 text-sm"
        >
          <SafeIcon icon={FiArrowLeft} className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Courses
        </button>

        {/* Main White Container */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 sm:p-10">
          
          {/* Purple Hero Banner */}
          <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-indigo-800 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden mb-12 shadow-md">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/20">
                  {course?.category === 'Linear SAT' || course?.tutor_type === 'Linear SAT' ? 'LINEAR SAT' : 'FULL-LENGTH SAT'}
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest border border-emerald-500/30 text-emerald-300">
                  {course?.category === 'Linear SAT' || course?.tutor_type === 'Linear SAT' ? 'LINEAR' : 'ADAPTIVE'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
                {course?.name || 'LINEAR FULL LENGTH TEST'}
              </h1>
              <p className="text-purple-100 text-sm sm:text-base max-w-2xl font-normal leading-relaxed">
                {course?.description || 'Experience a realistic testing environment.'}
              </p>
            </div>
            {/* Abstract Background Shapes (Simulating subtle wave/pattern) */}
            <div className="absolute top-[-20%] right-[-10%] w-96 h-96 bg-white/10 rounded-full blur-3xl mix-blend-overlay"></div>
            <div className="absolute bottom-[-30%] left-[10%] w-80 h-80 bg-indigo-400/20 rounded-full blur-2xl mix-blend-overlay"></div>
            {/* Simulated subtle lines */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 100% 0%, transparent 20%, #ffffff 21%, transparent 22%)', backgroundSize: '40px 40px' }}></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 mb-12">
            {/* Left: Test Details */}
            <div className="space-y-10">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                  <SafeIcon icon={FiInfo} className="text-purple-600 w-4 h-4" />
                  Test Structure & Timing
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-6 bg-purple-50/50 rounded-2xl border border-purple-100/50">
                    <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center mb-4 shadow-sm shadow-purple-200">
                       <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <div className="text-purple-700 font-bold mb-1 uppercase text-[10px] tracking-wider">Reading & Writing</div>
                    <div className="text-sm text-slate-800 font-medium mb-4">2 Modules • 54 Questions</div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-purple-600 uppercase tracking-widest">
                      <SafeIcon icon={FiClock} className="w-3 h-3" /> 64 Minutes
                    </div>
                  </div>
                  <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center mb-4 shadow-sm shadow-blue-200">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="text-blue-700 font-bold mb-1 uppercase text-[10px] tracking-wider">Mathematics</div>
                    <div className="text-sm text-slate-800 font-medium mb-4">2 Modules • 44 Questions</div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                      <SafeIcon icon={FiClock} className="w-3 h-3" /> 70 Minutes
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <SafeIcon icon={FiInfo} className="text-purple-600 w-4 h-4" />
                  Instructions
                </h3>
                <ul className="space-y-3">
                  {[
                    "Timed environment: Manage your time carefully.",
                    "Adaptive Logic: Module 2 difficulty depends on Module 1 score.",
                    "All Math questions allow the use of a calculator.",
                    "You cannot go back to Section 1 after starting Section 2."
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-600 font-medium text-sm">
                      <SafeIcon icon={FiCheckCircle} className="text-emerald-500 w-5 h-5 mt-0 flex-shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: Summary Box */}
            <div className="bg-slate-50/70 rounded-[2rem] p-8 border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 border border-slate-100">
                <SafeIcon icon={FiTarget} className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="text-2xl font-bold text-slate-900 mb-3">Ready to start?</h4>
              <p className="text-slate-500 text-sm font-normal mb-8 leading-relaxed px-4">
                Your progress is saved automatically. Ensure you have a quiet environment and a stable internet connection.
              </p>
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between px-6 py-4 bg-white rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3">
                     <SafeIcon icon={FiFileText} className="text-purple-400 w-4 h-4" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Questions</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">98</span>
                </div>
                <div className="flex items-center justify-between px-6 py-4 bg-white rounded-xl shadow-sm border border-slate-100">
                   <div className="flex items-center gap-3">
                     <SafeIcon icon={FiClock} className="text-purple-400 w-4 h-4" />
                     <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total Time</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">134 mins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Cards (Inside the main white container) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-100">
            <motion.div
              whileHover={{ y: -4 }}
              className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-md border border-slate-100 text-center flex flex-col transition-all"
            >
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <SafeIcon icon={FiBookOpen} className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">View Study Materials</h3>
              <p className="text-xs text-slate-500 font-normal mb-8 leading-relaxed flex-1">
                Review key concepts, formulas, and strategies before diving into the test.
              </p>
              <button 
                onClick={() => {
                  navigate(`/student/course/${courseId}`);
                  setTimeout(() => {
                    document.getElementById('preparation-materials')?.scrollIntoView({ behavior: 'smooth' });
                  }, 500);
                }}
                className="w-full py-3.5 bg-[#2563EB] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors uppercase tracking-wider text-[11px]"
              >
                Access Materials
              </button>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              className="group bg-white p-8 rounded-3xl shadow-sm hover:shadow-md border border-slate-100 text-center flex flex-col transition-all"
            >
              <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <SafeIcon icon={FiZap} className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Practice Quiz</h3>
              <p className="text-xs text-slate-500 font-normal mb-8 leading-relaxed flex-1">
                Take an adaptive practice quiz aligned with the official SAT scoring system to warm up.
              </p>
              <button 
                onClick={() => {
                  navigate(`/student/course/${courseId}/level/moderate/quiz?mode=practice`);
                }}
                className="w-full py-3.5 bg-[#F59E0B] text-white font-bold rounded-xl hover:bg-amber-600 transition-colors uppercase tracking-wider text-[11px]"
              >
                Start Practice
              </button>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              className="group bg-[#0F172A] p-8 rounded-3xl shadow-md border border-slate-800 text-center flex flex-col transition-all relative overflow-hidden"
            >
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <SafeIcon icon={FiActivity} className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Take the Quiz</h3>
                <p className="text-xs text-slate-400 font-normal mb-8 leading-relaxed flex-1">
                  Start the official full-length FULL LENGTH TEST engine and track your performance.
                </p>
                <button 
                  onClick={() => navigate(`/student/adaptive-test/${courseId}`)}
                  className="w-full py-3.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors uppercase tracking-wider text-[11px]"
                >
                  Begin Official Test
                </button>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdaptivePreTest;
