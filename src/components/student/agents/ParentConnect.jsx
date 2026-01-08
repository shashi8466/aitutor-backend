import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { useAuth } from '../../../contexts/AuthContext';
import { progressService, planService } from '../../../services/api';
import { calculateStudentScore } from '../../../utils/scoreCalculator';
import { useSettings } from '../../../contexts/SettingsContext';

const { FiTrendingUp, FiCheckCircle, FiMail, FiSmile, FiShare2, FiLoader, FiCheck } = FiIcons;

const ParentConnect = () => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user?.id) loadStudentData();
  }, [user]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Plan & Progress
      const [planRes, progressRes] = await Promise.all([
        planService.getPlan(user.id),
        progressService.getAllUserProgress(user.id)
      ]);

      const plan = planRes.data || {};
      const progress = progressRes.data || [];
      const diagnostic = plan.diagnostic_data || {};

      // 2. Calc Scores using standard util
      const scoreData = calculateStudentScore(progress, diagnostic);

      // 3. Construct Report
      setReportData({
        mathScore: scoreData.math,
        englishScore: scoreData.rw,
        totalScore: scoreData.current,
        targetScore: scoreData.target,
        mathDisplay: scoreData.isMathMaxed ? "800 (Max)" : scoreData.math,
        englishDisplay: scoreData.isRWMaxed ? "800 (Max)" : scoreData.rw,
        drillsCount: progress.length, // approximation
        improvement: Math.round(((scoreData.current - 800) / 800) * 100) || 0, // rough baseline calc
        studentName: user.user_metadata?.name || "Student"
      });
    } catch (err) {
      console.error("Failed to load parent data", err);
    } finally {
      setLoading(false);
    }
  };

  const getReportBody = () => {
    if (!reportData) return "";
    return `
Dear Parent,

We’re happy to share ${reportData.studentName}’s weekly SAT preparation progress.

📊 Weekly Progress Summary

Math Score: ${reportData.mathDisplay}
English Score: ${reportData.englishDisplay}

Practice Completed:
${reportData.drillsCount} focused practice drills

Current Total SAT Score: ${reportData.totalScore}
Target Score: ${reportData.targetScore}

📈 Progress Outlook
Your child is making consistent progress and is on track toward the ${reportData.targetScore} goal.

Warm regards,
${settings.appName} Learning Team
    `.trim();
  };

  const handleSend = () => {
    setSending(true);

    // Use mailto for real functional email opening
    const subject = `Weekly SAT Progress Update – ${reportData?.studentName}`;
    const body = encodeURIComponent(getReportBody());
    // Pre-fill student in CC so both parent and student get the report
    window.location.href = `mailto:?cc=${user.email}&subject=${encodeURIComponent(subject)}&body=${body}`;

    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    }, 1000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'My SAT Progress',
        text: getReportBody(),
        url: window.location.href,
      }).catch(console.error);
    } else {
      // Fallback copy to clipboard
      navigator.clipboard.writeText(getReportBody());
      alert("Report copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <SafeIcon icon={FiLoader} className="animate-spin w-8 h-8 text-purple-600" />
        <span className="ml-3 text-gray-500">Preparing report...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3">Parent Communication Agent</h1>
        <p className="text-gray-600 dark:text-gray-400 font-medium">Keeping your parents updated with your wins, so you don't have to.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden relative"
      >
        {/* Success Overlay */}
        <AnimatePresence>
          {sent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-green-500/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white"
            >
              <div className="bg-white text-green-600 p-4 rounded-full shadow-lg mb-4">
                <SafeIcon icon={FiCheck} className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold">Email Client Opened!</h3>
              <p className="opacity-90">Please send the pre-filled email.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-green-50 dark:bg-green-900/20 p-8 border-b border-green-100 dark:border-green-800/30 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
            <SafeIcon icon={FiSmile} className="w-8 h-8 text-green-600 dark:text-green-200" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">Weekly Summary Ready!</h3>
            <p className="text-green-800 dark:text-green-200 leading-relaxed text-sm sm:text-base">
              "Great news! Calculated Current Score is <span className="font-bold">{reportData?.totalScore}</span>. They are on track for their {reportData?.targetScore} goal!"
            </p>
          </div>
        </div>

        <div className="p-8">
          <h4 className="font-bold text-gray-900 dark:text-white mb-6 text-lg">What's included in this report:</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-blue-600">
                <SafeIcon icon={FiTrendingUp} className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Math Score</p>
                <p className="text-lg text-blue-600 font-extrabold">{reportData?.mathDisplay}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-purple-600">
                <SafeIcon icon={FiTrendingUp} className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">English Score</p>
                <p className="text-lg text-purple-600 font-extrabold">{reportData?.englishDisplay}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-green-600">
                <SafeIcon icon={FiCheckCircle} className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Target Score</p>
                <p className="text-sm text-gray-500">Goal: {reportData?.targetScore}</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-orange-600">
                <SafeIcon icon={FiSmile} className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Drills Done</p>
                <p className="text-sm text-gray-500">{reportData?.drillsCount} sessions completed</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {sending ? <SafeIcon icon={FiLoader} className="animate-spin w-5 h-5" /> : <SafeIcon icon={FiMail} className="w-5 h-5" />}
              {sending ? 'Opening Email...' : 'Send to Parent Email'}
            </button>
            <button
              onClick={handleShare}
              className="flex-1 py-4 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <SafeIcon icon={FiShare2} className="w-5 h-5" />
              Share Report Link
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ParentConnect;