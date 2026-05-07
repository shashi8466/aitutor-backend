import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';

const { FiCalendar, FiX, FiCheckCircle, FiFlag, FiAlertCircle, FiRefreshCw, FiChevronDown, FiChevronUp, FiClock, FiList } = FiIcons;

const FullScheduleModal = ({ plan, onClose }) => {
  const [expandedWeek, setExpandedWeek] = useState(null);

  // Robust check: handle different AI formats (studyPlan, weeks, schedule)
  const rawWeeks = plan?.weeks || plan?.studyPlan || plan?.schedule || [];

  const normalizedWeeks = Array.isArray(rawWeeks) ? rawWeeks.map((w, idx) => ({
    week: w.week || w.month || idx + 1,
    focus: w.focus || w.mathFocus || w.topic || "General Focus",
    goals: Array.isArray(w.goals) ? w.goals : (w.englishFocus ? [w.englishFocus] : []),
    action_item: w.action_item || w.description || "Review weekly concepts",
    daily_plan: Array.isArray(w.daily_plan) ? w.daily_plan : []
  })) : [];

  const hasWeeks = normalizedWeeks.length > 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-black p-6 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <SafeIcon icon={FiCalendar} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl">Your Master Schedule</h3>
              <p className="text-gray-400 text-xs">
                Target: {plan?.predicted_score_range || plan?.prediction || "Score Improvement"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <SafeIcon icon={FiX} className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50 dark:bg-gray-900">
          {!hasWeeks ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <SafeIcon icon={FiAlertCircle} className="w-16 h-16 mb-4 opacity-50" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Schedule Not Available</h3>
              <p className="max-w-md mx-auto mb-6">It looks like the detailed schedule wasn't generated correctly. This can happen if the AI response was interrupted.</p>
              <button onClick={onClose} className="px-6 py-2 bg-[#E53935] text-white rounded-lg font-bold hover:bg-red-700 transition-colors flex items-center gap-2">
                <SafeIcon icon={FiRefreshCw} className="w-4 h-4" /> Close & Recalculate
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {normalizedWeeks.map((week, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition-shadow"
                >
                  {/* Week Indicator */}
                  <div className="flex-shrink-0 flex md:flex-col items-center gap-2 md:w-24 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700 pb-4 md:pb-0 md:pr-4">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Week</span>
                    <span className="text-4xl font-extrabold text-black dark:text-white">{week.week}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <SafeIcon icon={FiFlag} className="text-[#E53935]" /> {week.focus}
                    </h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 uppercase">Goals</p>
                        {week.goals?.map((goal, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-500 mt-0.5" />
                            <span>{goal}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                        <p className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1">Key Action Item</p>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{week.action_item}</p>
                      </div>
                    </div>

                    {/* Daily Plan Section */}
                    {week.daily_plan && week.daily_plan.length > 0 && (
                      <div className="mt-6 border-t border-gray-100 dark:border-gray-700 pt-4">
                        <button 
                          onClick={() => setExpandedWeek(expandedWeek === idx ? null : idx)}
                          className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors w-full"
                        >
                          <SafeIcon icon={expandedWeek === idx ? FiChevronUp : FiChevronDown} className="w-5 h-5" />
                          {expandedWeek === idx ? 'Hide Daily Schedule' : 'View Daily Schedule'}
                        </button>
                        
                        <AnimatePresence>
                          {expandedWeek === idx && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {week.daily_plan.map((day, dIdx) => (
                                  <div key={dIdx} className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-xs font-bold text-gray-500 uppercase">Day {day.day}</span>
                                      {day.time_allocation && (
                                        <span className="flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-white dark:bg-gray-900 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-700">
                                          <SafeIcon icon={FiClock} className="w-3 h-3" />
                                          {day.time_allocation}
                                        </span>
                                      )}
                                    </div>
                                    <h5 className="font-bold text-sm text-gray-900 dark:text-white mb-2">{day.title}</h5>
                                    <ul className="space-y-1.5">
                                      {Array.isArray(day.tasks) ? day.tasks.map((task, tIdx) => (
                                        <li key={tIdx} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                          <SafeIcon icon={FiList} className="w-3 h-3 mt-0.5 text-gray-400 flex-shrink-0" />
                                          <span className="leading-snug">{task}</span>
                                        </li>
                                      )) : (
                                        <li className="text-xs text-gray-600 dark:text-gray-400">{day.tasks}</li>
                                      )}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default FullScheduleModal;