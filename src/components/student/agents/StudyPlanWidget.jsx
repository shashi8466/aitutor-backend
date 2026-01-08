import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import FullScheduleModal from './FullScheduleModal';

const { FiTrendingUp, FiCheckCircle, FiFlag, FiActivity, FiTarget } = FiIcons;

const StudyPlanWidget = ({ plan }) => {
  const [showFull, setShowFull] = useState(false);

  if (!plan) return null;

  // Safety check: Ensure weeks exist
  const hasWeeks = plan.weeks && Array.isArray(plan.weeks) && plan.weeks.length > 0;
  const currentWeek = hasWeeks ? plan.weeks[0] : null;

  return (
    <>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 p-6 relative overflow-hidden group hover:shadow-2xl transition-all"
      >
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-800 rounded-bl-full opacity-50"></div>
        
        <div className="flex justify-between items-start mb-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <SafeIcon icon={FiActivity} className="w-3 h-3" /> Live Plan
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">Your AI Roadmap</h3>
            <p className="text-gray-500 text-sm dark:text-gray-400">{plan.summary || "Customized path to success"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Predicted Score</p>
            <p className="text-3xl font-black text-[#E53935]">{plan.predicted_score_range || plan.prediction || "Calculating..."}</p>
          </div>
        </div>

        {currentWeek ? (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-5 border border-gray-100 dark:border-gray-600 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <SafeIcon icon={FiFlag} className="text-blue-600" /> Week {currentWeek.week}: {currentWeek.focus}
              </h4>
            </div>
            <div className="space-y-2">
              {currentWeek.goals?.map((goal, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <SafeIcon icon={FiCheckCircle} className="w-4 h-4 text-green-500 mt-0.5" />
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl border border-yellow-100 dark:border-yellow-800 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">Plan outline is ready, but weekly details are generating. Please check back or recalculate.</p>
          </div>
        )}

        {hasWeeks && (
          <button 
            onClick={() => setShowFull(true)}
            className="w-full py-3 border-2 border-gray-100 dark:border-gray-700 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-all"
          >
            View Full Schedule
          </button>
        )}
      </motion.div>

      {/* Modal Integration */}
      {showFull && <FullScheduleModal plan={plan} onClose={() => setShowFull(false)} />}
    </>
  );
};

export default StudyPlanWidget;