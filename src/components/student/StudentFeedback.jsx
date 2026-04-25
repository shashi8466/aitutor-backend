import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { gradingService, contactService, progressService, enrollmentService } from '../../services/api';
import Toast from '../common/Toast';

const { 
  FiMessageSquare, 
  FiStar, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiLoader, 
  FiChevronDown, 
  FiAward, 
  FiBookOpen, 
  FiPieChart,
  FiSend
} = FiIcons;

const StudentFeedback = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [toast, setToast] = useState(null);
  
  const [formData, setFormData] = useState({
    rating: 5,
    difficulty_level: 'Just Right',
    quality_rating: 5,
    message: '',
    anonymous: false
  });

  useEffect(() => {
    if (user?.id) {
      loadAttempts();
    }
  }, [user]);

  const loadAttempts = async () => {
    try {
      setLoading(true);
      
      // Parallel fetch of all possible feedback targets
      const [scoresRes, progressRes, enrollRes] = await Promise.all([
        gradingService.getAllMyScores(user.id),
        progressService.getAllUserProgress(user.id),
        enrollmentService.getStudentEnrollments(user.id)
      ]);

      const submissions = scoresRes.data?.submissions || [];
      const progress = progressRes.data || [];
      const enrollments = enrollRes.data || [];

      // 1. Map Attempted Tests
      const testAttempts = submissions.map(s => ({
        id: `test-${s.id}`,
        course_id: s.courses?.id,
        course_name: s.courses?.name || 'Unknown Test',
        level: s.level || 'Standard',
        test_date: s.test_date || s.created_at,
        type: 'Test'
      }));

      // 2. Map Completed Quizzes (from progress)
      const passingProgress = progress.filter(p => p.passed);
      const quizAttempts = passingProgress.map(p => ({
        id: `quiz-${p.id}`,
        course_id: p.course_id,
        course_name: p.courses?.name || 'Quiz',
        level: p.level || 'Lesson',
        test_date: p.created_at,
        type: 'Quiz'
      }));

      // 3. Map Courses (from enrollments)
      const courseAttempts = enrollments.map((e, index) => ({
        id: `enroll-${e.id || e.course_id || index}`,
        course_id: e.course_id,
        course_name: e.courses?.name || 'Course',
        level: e.status || 'Active',
        test_date: e.enrolled_at || e.created_at,
        type: 'Course'
      }));

      // 4. Combine and deduplicate
      const allEvents = [...testAttempts, ...quizAttempts, ...courseAttempts].sort((a, b) => 
        new Date(b.test_date).getTime() - new Date(a.test_date).getTime()
      );

      setSubmissions(allEvents);
      if (allEvents.length > 0) {
        setSelectedAttempt(allEvents[0]);
      }
    } catch (err) {
      console.error("Failed to load attempts:", err);
      setToast({ message: "Could not load your test history.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAttempt) {
      setToast({ message: "Please select a course or test you've attempted.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      
      const messageBody = `Activity: ${selectedAttempt.course_name} (${selectedAttempt.level})
Learning Experience: ${formData.rating}/5
Question Quality: ${formData.quality_rating}/5
Difficulty: ${formData.difficulty_level}

Comments: ${formData.message || 'None'}`;

      await contactService.submit({
        name: formData.anonymous ? 'Anonymous Student' : (user.name || 'Student'),
        email: formData.anonymous ? 'anonymous@example.com' : (user.email || 'N/A'),
        subject: `Student Feedback: ${selectedAttempt.course_name}`,
        message: messageBody,
      });

      setToast({ message: "Feedback submitted successfully! Thank you.", type: "success" });
      setFormData({
        rating: 5,
        difficulty_level: 'Just Right',
        quality_rating: 5,
        message: '',
        anonymous: false
      });
    } catch (err) {
      console.error("Submit feedback error:", err);
      setToast({ message: "Failed to submit feedback. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ value, label, onSelect, icon: Icon = FiStar }) => (
    <div className="space-y-2">
      <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onSelect(star)}
            className={`p-2 rounded-lg transition-all ${
              value >= star 
                ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' 
                : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
            }`}
          >
            <Icon className={`w-6 h-6 ${value >= star ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-[#E53935]" />
          <p className="text-gray-500 font-medium">Preparing feedback center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 font-sans">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center justify-center p-3 bg-red-100 dark:bg-red-900/20 text-[#E53935] rounded-2xl mb-4"
          >
            <SafeIcon icon={FiMessageSquare} className="w-8 h-8" />
          </motion.div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Student Feedback</h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Your feedback helps us improve. Tell us about your experience with the tests and courses you've completed.
          </p>
        </header>

        {submissions.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <SafeIcon icon={FiAlertCircle} className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Attempts Detected</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
              You haven't attempted any tests or courses yet. Start your learning journey to provide feedback!
            </p>
            <button
              onClick={() => window.location.href = '/student/courses'}
              className="px-8 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg"
            >
              Browse Courses
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Sidebar info */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Selected Attempt</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-sky-100 dark:bg-sky-900/20 text-sky-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <SafeIcon icon={FiBookOpen} className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Course</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[150px]">
                        {selectedAttempt?.course_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <SafeIcon icon={FiAward} className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">Level / Date</p>
                      <p className="text-sm font-black text-gray-900 dark:text-white">
                        {selectedAttempt?.level} • {selectedAttempt?.test_date ? new Date(selectedAttempt.test_date).toLocaleDateString() : 'Recently'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl shadow-xl text-white">
                <h3 className="font-bold text-lg mb-2">Why Feedback?</h3>
                <p className="text-blue-100 text-sm leading-relaxed mb-4">
                  We use your input to adjust difficulty levels and improve question quality to ensure the best learning path for everyone.
                </p>
                <div className="flex items-center gap-2 text-xs font-bold bg-white/10 p-2 rounded-lg">
                  <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-300" />
                  Processed by Academic Team
                </div>
              </div>
            </div>

            {/* Main Form */}
            <div className="md:col-span-2">
              <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 space-y-8">
                {/* Attempt Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Select Activity to Review</label>
                  <div className="relative">
                    <select
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none appearance-none font-medium text-gray-900 dark:text-white"
                      value={selectedAttempt?.id}
                      onChange={(e) => {
                        const attempt = submissions.find(s => s.id === e.target.value);
                        setSelectedAttempt(attempt);
                      }}
                    >
                      {submissions.map((s) => (
                        <option key={s.id} value={s.id} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                          {s.course_name} ({s.level || s.type}) - {s.test_date ? new Date(s.test_date).toLocaleDateString() : 'N/A'}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown className="absolute right-3 top-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <StarRating 
                    label="Learning Experience" 
                    value={formData.rating} 
                    onSelect={(val) => setFormData({...formData, rating: val})} 
                  />
                  <StarRating 
                    label="Question Quality" 
                    value={formData.quality_rating} 
                    onSelect={(val) => setFormData({...formData, quality_rating: val})} 
                    icon={FiCheckCircle}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Difficulty Level</label>
                  <div className="flex flex-wrap gap-2">
                    {['Too Easy', 'Just Right', 'Challenging', 'Too Hard'].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setFormData({...formData, difficulty_level: lvl})}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${
                          formData.difficulty_level === lvl
                            ? 'bg-[#E53935] text-white border-transparent shadow-md'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-100 dark:border-gray-700 hover:border-red-200'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Tell us more (Optional)</label>
                  <textarea
                    rows={4}
                    placeholder="What did you like? What could be better?"
                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-[#E53935] outline-none font-medium text-gray-900 dark:text-white resize-none"
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-gray-300 text-[#E53935] focus:ring-[#E53935]"
                      checked={formData.anonymous}
                      onChange={(e) => setFormData({...formData, anonymous: e.target.checked})}
                    />
                    <span className="text-xs font-bold text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                      Submit Anonymously
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-8 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <FiLoader className="w-4 h-4 animate-spin" />
                    ) : (
                      <FiSend className="w-4 h-4" />
                    )}
                    Submit Feedback
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentFeedback;
