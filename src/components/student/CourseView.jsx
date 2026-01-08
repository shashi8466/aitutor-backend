import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService, progressService, enrollmentService, planService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { calculateStudentScore } from '../../utils/scoreCalculator';

const { FiArrowLeft, FiLock, FiPlay, FiCheckCircle, FiShield, FiAward, FiTrendingUp } = FiIcons;

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [courseProgress, setCourseProgress] = useState([]);
  const [diagnostic, setDiagnostic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (user?.id && courseId) {
      checkAccessAndLoad();
    }
  }, [courseId, user]);

  const checkAccessAndLoad = async () => {
    setLoading(true);
    try {
      const isEnrolled = await enrollmentService.isEnrolled(user.id, parseInt(courseId));
      if (!isEnrolled) {
        setAccessDenied(true);
        setLoading(false);
        setTimeout(() => navigate('/student'), 3000);
        return;
      }

      const [coursesResponse, uploadsResponse, allProgressRes, planRes] = await Promise.all([
        courseService.getAll(),
        uploadService.getAll({ courseId }),
        progressService.getAllUserProgress(user.id),
        planService.getPlan(user.id)
      ]);

      const courseData = coursesResponse.data.find(c => c.id === parseInt(courseId));
      setCourse(courseData);
      setUploads(uploadsResponse.data);
      // Filter progress strictly for this course to ensure independent calculation logic within this view
      setCourseProgress((allProgressRes.data || []).filter(p => p.course_id === parseInt(courseId)));

      if (planRes.data && planRes.data.diagnostic_data) {
        setDiagnostic(planRes.data.diagnostic_data);
      }
    } catch (error) {
      console.error('Error loading course data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTopicsForLevel = (level) => {
    const files = uploads.filter(u => u.level === level && u.category === 'study_material');
    if (files.length === 0) return ["General Concepts"];
    return files.map(f => f.file_name.replace(/\.[^/.]+$/, ""));
  };

  const isLevelUnlocked = (level) => {
    if (level === 'Easy') return true;
    if (level === 'Medium') {
      const easy = courseProgress.find(p => p.level === 'Easy');
      return easy && easy.passed;
    }
    if (level === 'Hard') {
      const medium = courseProgress.find(p => p.level === 'Medium');
      return medium && medium.passed;
    }
    return false;
  };

  const getLevelStatus = (level) => {
    const p = courseProgress.find(p => p.level === level);
    if (!p) return { passed: false, score: 0 };
    return { passed: p.passed, score: p.score };
  };

  // Determine Course Type and Calculate INDEPENDENT Score Display
  const getScoreDisplay = () => {
    if (!course) return { score: 0, max: 1600, label: "Estimated Score" };

    // Use ONLY this course's progress for calculation to ensure independence
    // This ensures Math progress doesn't affect English score display inside the English course
    const scores = calculateStudentScore(courseProgress, diagnostic);

    // FIX: Defensively handle null scores if calculator fails (though calculator is fixed now)
    if (!scores) {
      return { score: 0, max: 1600, label: "Estimated Score" };
    }

    // Check for Math
    const isMath = course.tutor_type?.toLowerCase().includes('math') ||
      course.name?.toLowerCase().includes('math') ||
      course.name?.toLowerCase().includes('algebra') ||
      course.name?.toLowerCase().includes('geometry') ||
      course.name?.toLowerCase().includes('quant');

    // Check for Reading/Writing
    const isRW = course.tutor_type?.toLowerCase().includes('reading') ||
      course.tutor_type?.toLowerCase().includes('writing') ||
      course.name?.toLowerCase().includes('english') ||
      course.name?.toLowerCase().includes('verbal');

    if (isMath) {
      // Return Math Section Score (max 800)
      return { score: scores.math, max: 800, label: "Math Section Score" };
    } else if (isRW) {
      // Return RW Section Score (max 800)
      return { score: scores.rw, max: 800, label: "Reading & Writing Score" };
    } else {
      // If it's a general/full course, return total (max 1600)
      return { score: scores.current, max: 1600, label: "Total SAT Score" };
    }
  };

  const levels = ['Easy', 'Medium', 'Hard'];
  const passedLevels = courseProgress.filter(p => levels.includes(p.level) && p.passed);
  const uniquePassed = new Set(passedLevels.map(p => p.level));
  // Course is completed if all 3 levels are passed
  const isCourseCompleted = uniquePassed.size === 3;

  const scoreData = getScoreDisplay();

  if (loading) return <div className="p-12 text-center text-gray-500 font-bold">Refreshing data...</div>;
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-200 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiShield} className="w-8 h-8 text-[#E53935]" />
          </div>
          <h2 className="text-xl font-bold text-black mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6 font-medium">You are not enrolled in this course.</p>
          <Link to="/student" className="text-[#E53935] hover:text-[#b71c1c] font-bold">Return to Dashboard Now</Link>
        </div>
      </div>
    );
  }
  if (!course) return <div className="p-12 text-center text-gray-500 font-bold">Course not found</div>;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-black mb-3">
            <span className="text-[#E53935]">{course.name}</span>
          </h1>
          <p className="text-gray-600 text-lg font-medium">
            Complete each level to unlock the next difficulty.
          </p>
        </div>

        {/* Score Card - Shows Specific Section Score or Total depending on course */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white p-8 rounded-3xl shadow-2xl border border-gray-800 text-center relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col items-center">
            {isCourseCompleted && (
              <div className="bg-[#E53935] text-white p-2 rounded-full mb-4 shadow-lg shadow-red-500/50 animate-bounce">
                <SafeIcon icon={FiAward} className="w-6 h-6" />
              </div>
            )}

            <div className="flex items-center gap-2 mb-2">
              <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">{scoreData.label}</span>
              {isCourseCompleted && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-green-900/50 text-green-400 border border-green-800 animate-pulse">
                  <SafeIcon icon={FiTrendingUp} className="w-3 h-3 mr-1" /> Final
                </span>
              )}
            </div>

            <div className="inline-block bg-white/10 backdrop-blur-md p-6 px-10 rounded-2xl border border-white/20 transform hover:scale-105 transition-transform cursor-default">
              {isCourseCompleted ? (
                <div className="text-6xl font-extrabold text-[#E53935] tracking-tight">
                  {scoreData.score} <span className="text-2xl text-white/50 font-normal">/ {scoreData.max}</span>
                </div>
              ) : (
                <div className="text-xl font-bold text-gray-400 tracking-tight py-4">
                  Complete All Levels to View Score
                </div>
              )}
            </div>
          </div>

          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-[#E53935] rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-blue-600 rounded-full blur-[100px]"></div>
          </div>
        </motion.div>

        {/* Levels Grid */}
        <div className="space-y-6">
          {['Easy', 'Medium', 'Hard'].map((level, index) => {
            const topics = getTopicsForLevel(level);
            const unlocked = isLevelUnlocked(level);
            const { passed, score } = getLevelStatus(level);

            const styles = {
              Easy: { bg: 'bg-white', border: 'border-green-200', numberBg: 'bg-green-600', btn: 'bg-black text-white hover:bg-gray-800' },
              Medium: { bg: 'bg-white', border: 'border-orange-200', numberBg: 'bg-orange-500', btn: 'bg-black text-white hover:bg-gray-800' },
              Hard: { bg: 'bg-white', border: 'border-red-200', numberBg: 'bg-[#E53935]', btn: 'bg-black text-white hover:bg-gray-800' }
            };
            const theme = styles[level];
            const lockedClass = !unlocked ? "opacity-60 grayscale cursor-not-allowed" : "";

            return (
              <motion.div
                key={level}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`rounded-2xl border ${theme.bg} ${theme.border} p-4 sm:p-6 md:p-8 shadow-lg transition-shadow relative ${lockedClass}`}
              >
                {!unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/50 backdrop-blur-[1px] rounded-2xl">
                    <div className="bg-white p-4 rounded-full shadow-xl border border-gray-100">
                      <SafeIcon icon={FiLock} className="w-6 h-6 text-gray-400" />
                    </div>
                  </div>
                )}

                {/* Passed Badge - Responsive positioning */}
                {passed && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 md:absolute md:top-6 md:right-6 md:mb-0 z-10">
                    <span className="text-sm font-bold text-gray-500">Best: {score}%</span>
                    <div className="bg-green-100 text-green-800 p-1.5 sm:p-2 rounded-lg flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs font-bold border border-green-200">
                      <SafeIcon icon={FiCheckCircle} className="w-3 h-3 sm:w-4 sm:h-4" /> Passed
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4 md:gap-6">
                  {/* Level header and topics */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg sm:text-xl shadow-md flex-shrink-0 ${theme.numberBg}`}>
                        {index + 1}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold text-black">
                        {level} Level
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-1.5 sm:gap-y-2 ml-0 sm:ml-14 md:ml-16">
                      {topics.map((topic, i) => (
                        <div key={i} className="flex items-center gap-2 text-gray-700 font-medium text-sm sm:text-base">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.numberBg}`} />
                          <span className="truncate">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Button - Full width on mobile */}
                  <div className="flex flex-col gap-2 w-full md:w-auto md:self-end">
                    <button
                      onClick={() => unlocked && navigate(`/student/course/${courseId}/level/${level}`)}
                      disabled={!unlocked}
                      className={`w-full md:w-auto px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-md transition-all ${theme.btn}`}
                    >
                      <SafeIcon icon={FiPlay} className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                      {unlocked ? (passed ? `Retake ${level}` : `Start ${level}`) : 'Locked'}
                    </button>
                    {passed && (
                      <span className="text-[10px] sm:text-xs text-gray-400 text-center font-medium">
                        Retaking only updates score if higher than {score}%
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link to="/student" className="text-gray-500 hover:text-black font-bold flex items-center justify-center gap-2 transition-colors">
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CourseView;