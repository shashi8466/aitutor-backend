import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { planService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import StudyPlanWidget from './StudyPlanWidget';
import DiagnosticWizard from './DiagnosticWizard';

const { FiActivity, FiArrowRight, FiCpu } = FiIcons;

const StudyPlanPage = () => {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (user) loadPlan();
  }, [user]);

  const loadPlan = async () => {
    try {
      const { data } = await planService.getPlan(user.id);
      if (data && data.generated_plan) {
        setPlan(data.generated_plan);
      }
    } catch (error) {
      console.error("Failed to load plan", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Your Master Plan</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">AI-generated roadmap to your target score.</p>
        </div>
        {!plan && !loading && (
          <button 
            onClick={() => setShowWizard(true)}
            className="px-6 py-3 bg-[#E53935] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-[#d32f2f] transition-colors"
          >
            <SafeIcon icon={FiCpu} /> Create New Plan
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading your schedule...</div>
      ) : plan ? (
        <div className="space-y-8">
          <StudyPlanWidget plan={plan} />
          
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Why this plan works</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
              This schedule is adapted from your diagnostic results. It prioritizes high-impact topics where you have the most room for improvement, ensuring you reach your target score of <strong>{plan.prediction?.split('-')[1] || "1500+"}</strong> by test day.
            </p>
            <button 
              onClick={() => setShowWizard(true)}
              className="text-[#E53935] font-bold hover:underline flex items-center gap-1"
            >
              Recalculate Plan <SafeIcon icon={FiArrowRight} className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-3xl border border-gray-200 dark:border-gray-700 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <SafeIcon icon={FiActivity} className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Plan Active</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            You haven't generated a study plan yet. Let our AI analyze your goals and create a custom schedule.
          </p>
          <button 
            onClick={() => setShowWizard(true)}
            className="px-8 py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
          >
            Start Diagnostic
          </button>
        </div>
      )}

      {showWizard && (
        <DiagnosticWizard 
          user={user} 
          onClose={() => setShowWizard(false)} 
          onPlanCreated={(newPlan) => {
            setPlan(newPlan);
            setShowWizard(false);
          }} 
        />
      )}
    </div>
  );
};

export default StudyPlanPage;