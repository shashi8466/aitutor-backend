import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { courseService, uploadService, progressService, enrollmentService, planService, gradingService } from '../../services/api';
import supabase from '../../supabase/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCategory, calculateSatScore } from '../../utils/scoreCalculator';

const { FiArrowLeft, FiLock, FiPlay, FiCheckCircle, FiShield, FiAward, FiTrendingUp, FiInfo, FiKey, FiAlertCircle, FiLoader } = FiIcons;

const CourseView = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [course, setCourse] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [courseProgress, setCourseProgress] = useState([]);
  const [courseSubmissions, setCourseSubmissions] = useState([]);
  const [diagnostic, setDiagnostic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showEnrollmentKey, setShowEnrollmentKey] = useState(false);
  const [keyCode, setKeyCode] = useState('');
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState('');
  const [enrollmentSuccess, setEnrollmentSuccess] = useState(false);
  const [lockMessage, setLockMessage] = useState('');
  const [planAccess, setPlanAccess] = useState([]);

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
        try {
          const response = await enrollmentService.initiateEnrollment(user.id, parseInt(courseId));
          if (response.data?.requiresKey || (response.data?.error && response.data.error.includes('key'))) {
            setAccessDenied(true);
            setShowEnrollmentKey(true);
            setLoading(false);
            return;
          }
        } catch (enrollmentError) {
          if (enrollmentError.response?.data?.error && enrollmentError.response.data.error.includes('key')) {
            setAccessDenied(true);
            setShowEnrollmentKey(true);
            setLoading(false);
            return;
          } else if (enrollmentError.response?.status === 500) {
            setAccessDenied(true);
            setShowEnrollmentKey(false);
            setLoading(false);
            return;
          }
        }

        setAccessDenied(true);
        setLoading(false);
        setTimeout(() => navigate('/student'), 3000);
        return;
      }

      const [courseRes, uploadsResponse, allProgressRes, planRes, submissionsRes, planAccessRes] = await Promise.all([
        courseService.getById(courseId),
        uploadService.getAll({ courseId }),
        progressService.getAllUserProgress(user.id),
        planService.getPlan(user.id),
        gradingService.getAllMyScores(),
        planService.getContentAccess()
      ]);

      const accessData = planAccessRes.data || [];
      setPlanAccess(accessData);

      const courseData = courseRes.data;
      if (courseData?.start_date) {
        const startDate = new Date(courseData.start_date);
        const now = new Date();
        if (now < startDate) {
          setAccessDenied(true);
          setShowEnrollmentKey(false);
          setLockMessage(`Course will unlock on ${startDate.toLocaleString()}`);
          setLoading(false);
          return;
        }
      }
      setCourse(courseData);
      setUploads(uploadsResponse.data);

      const pData = allProgressRes.data || [];
      const sData = submissionsRes.data?.submissions || [];

      setCourseProgress(pData.filter(p => Number(p.course_id) === Number(courseId)));
      setCourseSubmissions(sData.filter(s => Number(s.course_id) === Number(courseId)));

      if (planRes.data && planRes.data.diagnostic_data) {
        setDiagnostic(planRes.data.diagnostic_data);
      }
    } catch (error) {
      console.error('Error loading course data:', error);
      if (error.response?.status === 500) {
        setAccessDenied(true);
        setShowEnrollmentKey(false);
        setLoading(false);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentWithKey = async () => {
    if (!keyCode.trim()) {
      setEnrollmentError('Please enter an enrollment key');
      return;
    }

    setEnrollmentLoading(true);
    setEnrollmentError('');

    try {
      const response = await enrollmentService.useKey(keyCode, courseId);

      if (response.data.enrolled) {
        setEnrollmentSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (error) {
      if (error.response?.data?.error) {
        setEnrollmentError(error.response.data.error);
      } else {
        setEnrollmentError('Failed to use enrollment key. Please try again.');
      }
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const getTopicsForLevel = (level) => {
    const files = uploads.filter(u => u.level === level && u.category === 'study_material');
    if (files.length === 0) return [{ name: 'General Concepts', locked: false }];
    
    const userPlan = user?.plan_type || 'free';
    const isPremium = userPlan === 'premium' && user?.plan_status === 'active';

    return files.map(f => {
      const topicName = f.file_name.replace(/\.[^/.]+$/, '');
      const hasAccess = isPremium || planAccess.some(a => a.content_type === 'topic' && a.content_id === topicName && a.plan_type === userPlan);
      return { name: topicName, locked: !hasAccess };
    });
  };

  const isLevelUnlocked = (level) => {
    if (level === 'Easy') return true;
    if (level === 'Medium') {
      const easy = courseProgress.find(p => p.level === 'Easy');
      return !!(easy && easy.passed);
    }
    if (level === 'Hard') {
      const medium = courseProgress.find(p => p.level === 'Medium');
      return !!(medium && medium.passed);
    }
    return false;
  };

  const getLevelStatus = (level) => {
    const p = courseProgress.find(p => p.level === level);
    if (!p) return { passed: false, score: 0 };
    return { passed: p.passed, score: p.score };
  };

  // Course-level SAT section score using the weighted Easy/Medium/Hard formula.
  const getScoreDisplay = () => {
    if (!course) return { score: 0, max: 800, label: 'Estimated Score' };

    const category = getCategory(course);
    const levelScores = { Easy: 0, Medium: 0, Hard: 0 };

    // Prefer submissions for level accuracies, but also consider progress scores.
    (courseSubmissions || []).forEach(sub => {
      const lvl = (sub.level || 'Medium').charAt(0).toUpperCase() + (sub.level || 'Medium').slice(1).toLowerCase();
      if (!['Easy', 'Medium', 'Hard'].includes(lvl)) return;
      const pct = Math.round(sub.raw_score_percentage || 0);
      if (pct > levelScores[lvl]) levelScores[lvl] = pct;
    });

    courseProgress.forEach(p => {
      const lvl = (p.level || 'Medium').charAt(0).toUpperCase() + (p.level || 'Medium').slice(1).toLowerCase();
      if (!['Easy', 'Medium', 'Hard'].includes(lvl)) return;
      const pct = Math.round(p.score || 0);
      if (pct > levelScores[lvl]) levelScores[lvl] = pct;
    });

    const hasLevelScores = levelScores.Easy > 0 || levelScores.Medium > 0 || levelScores.Hard > 0;
    const sectionScore = hasLevelScores
      ? calculateSatScore(levelScores.Easy, levelScores.Medium, levelScores.Hard)
      : (category === 'MATH'
        ? (diagnostic ? parseInt(diagnostic.mathScore) || 200 : 200)
        : (diagnostic ? parseInt(diagnostic.rwScore) || 200 : 200));

    const label = category === 'MATH' ? 'Math Section Score' : 'Reading & Writing Score';
    return { score: sectionScore || 0, max: 800, label };
  };

  const levels = ['Easy', 'Medium', 'Hard'];
  const passedLevels = courseProgress.filter(p => levels.includes(p.level) && p.passed);
  const uniquePassed = new Set(passedLevels.map(p => p.level));
  const isCourseCompleted = uniquePassed.size === 3;

  const scoreData = getScoreDisplay();

  if (loading) return <div className="p-12 text-center text-gray-500 font-bold">Refreshing data...</div>;
  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-200 max-w-md w-full">
          {!showEnrollmentKey ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <SafeIcon icon={FiShield} className="w-8 h-8 text-[#E53935]" />
              </div>
              <h2 className="text-xl font-bold text-black mb-2 text-center">Access Denied</h2>
              <p className="text-gray-600 mb-6 font-medium text-center">{lockMessage || 'You are not enrolled in this course.'}</p>
              <Link to="/student" className="text-[#E53935] hover:text-[#b71c1c] font-bold block text-center">Return to Dashboard Now</Link>
            </>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <SafeIcon icon={FiKey} className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-xl font-bold text-black mb-2">Enrollment Required</h2>
                <p className="text-gray-600 mb-6 font-medium">This course requires an enrollment key to access</p>
              </div>

              {enrollmentSuccess ? (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-start gap-3">
                  <SafeIcon icon={FiCheckCircle} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-sm mb-1">Success!</p>
                    <p className="text-sm">You've been enrolled in the course. Redirecting...</p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="enrollmentKey" className="block text-sm font-semibold text-gray-700 mb-2">
                      Enrollment Key
                    </label>
                    <input
                      type="text"
                      id="enrollmentKey"
                      value={keyCode}
                      onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                      placeholder="ENTER-KEY-HERE"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg tracking-wider font-mono"
                      disabled={enrollmentLoading}
                    />
                  </div>

                  {enrollmentError && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                      <SafeIcon icon={FiAlertCircle} className="w-5 h-5 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{enrollmentError}</p>
                    </div>
                  )}

                  <button
                    onClick={handleEnrollmentWithKey}
                    disabled={enrollmentLoading}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-lg font-semibold shadow-lg hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all"
                  >
                    {enrollmentLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <SafeIcon icon={FiLoader} className="w-5 h-5 animate-spin" />
                        Enrolling...
                      </span>
                    ) : (
                      'Enroll with Key'
                    )}
                  </button>
                </>
              )}

              <div className="pt-4 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">
                  Don't have an enrollment key?
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Ask your tutor or administrator for a key</li>
                  <li>• Check your email for an invitation link</li>
                  <li>• Enrollment keys are usually 10-15 characters</li>
                </ul>
              </div>
            </div>
          )}
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

        <div className="mb-10 bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <SafeIcon icon={FiInfo} className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-extrabold text_black">Understanding Your Score</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 flex-shrink-0">1</div>
                <div>
                  <h4 className="font-bold text-gray-900 mb-1">Key Concepts</h4>
                  <ul className="text-sm text-gray-600 space-y-2">
                    <li className="flex gap-2"><span>•</span> <strong>Raw Score:</strong> Total number of correct answers.</li>
                    <li className="flex gap-2"><span>•</span> <strong>No Penalties:</strong> Wrong or skipped answers do not lower your score.</li>
                    <li className="flex gap-2"><span>•</span> <strong>Adaptive Nature:</strong> Your performance in earlier levels impacts future difficulty.</li>
                    <li className="flex gap-2"><span>•</span> <strong>Weighting:</strong> Harder levels contribute more to your final scaled score.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 flex-shrink-0">2</div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-900 mb-1">Level Difficulty & Ranges</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 font-bold uppercase tracking-wider">
                          <th className="py-2">Level</th>
                          <th className="py-2">Math Range</th>
                          <th className="py-2">English Range</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 font-medium">
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-green-600 font-bold">Easy</td>
                          <td className="py-2">200 – 500</td>
                          <td className="py-2">200 – 480</td>
                        </tr>
                        <tr className="border-b border-gray-50">
                          <td className="py-2 text-orange-500 font-bold">Medium</td>
                          <td className="py-2">400 – 650</td>
                          <td className="py-2">380 – 650</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-[#E53935] font-bold">Hard</td>
                          <td className="py-2">550 – 800</td>
                          <td className="py-2">550 – 800</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4 text-[11px] text-gray-500 italic leading-relaxed">
                    Same raw score ≠ same final score. Higher levels unlock the top 700–800 range.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            const lockedClass = !unlocked ? 'opacity-60 grayscale cursor-not-allowed' : '';

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

                {passed && (
                  <div className="flex flex-wrap items-center gap-2 mb-4 md:absolute md:top-6 md:right-6 md:mb-0 z-10">
                    <span className="text-sm font-bold text-gray-500">Best: {score}%</span>
                    <div className="bg-green-100 text-green-800 p-1.5 sm:p-2 rounded-lg flex items-center gap-1 sm:gap-2 px-2 sm:px-3 text-xs font-bold border border-green-200">
                      <SafeIcon icon={FiCheckCircle} className="w-3 h-3 sm:w-4 sm:h-4" /> Passed
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-4 md:gap-6">
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
                        <div key={i} className={`flex items-center gap-2 font-medium text-sm sm:text-base ${topic.locked ? 'text-gray-400' : 'text-gray-700'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${topic.locked ? 'bg-gray-300' : theme.numberBg}`} />
                          <span className="truncate">{topic.name}</span>
                          {topic.locked && <SafeIcon icon={FiLock} className="w-3 h-3 text-gray-300" />}
                        </div>
                      ))}
                    </div>
                  </div>

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

