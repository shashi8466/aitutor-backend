import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { aiService, planService, progressService, courseService } from '../../../services/api';

const { FiTarget, FiCalendar, FiActivity, FiCheck, FiCpu, FiArrowRight, FiX, FiBarChart2, FiAlertCircle } = FiIcons;

const DiagnosticWizard = ({ user, onClose, onPlanCreated }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  
  // Enhanced Form Data
  const [formData, setFormData] = useState({
    mathScore: '',
    rwScore: '',
    targetScore: '1400',
    testDate: '',
    hoursPerWeek: '5',
    weaknesses: '', // User manual input
    performanceContext: [] // Auto-detected from DB
  });

  // Load User Data on Mount
  useEffect(() => {
    const analyzePerformance = async () => {
      setAnalyzing(true);
      try {
        const [progressRes, coursesRes] = await Promise.all([
          progressService.getAllUserProgress(user.id),
          courseService.getAll()
        ]);

        const progress = progressRes.data || [];
        const courses = coursesRes.data || [];

        // 1. Calculate approximate current scores based on progress
        // (Simple heuristic: Base 400 + points for passed levels)
        let calcMath = 400;
        let calcRW = 400;
        
        const detectedWeaknesses = [];

        progress.forEach(p => {
          const course = courses.find(c => c.id === p.course_id);
          const courseName = course?.name || 'General';
          const isMath = course?.tutor_type?.includes('Math') || courseName.includes('Math') || courseName.includes('Algebra');
          
          // Detect Weakness: Failed levels or low scores (< 60%)
          if (!p.passed || p.score < 60) {
            detectedWeaknesses.push({
              topic: courseName,
              level: p.level,
              score: p.score,
              issue: !p.passed ? "Failed Level" : "Low Accuracy"
            });
          }

          // Add to score if passed
          if (p.passed) {
            const points = p.level === 'Hard' ? 50 : p.level === 'Medium' ? 30 : 20;
            if (isMath) calcMath += points;
            else calcRW += points;
          }
        });

        // Update Form Data with detected insights
        setFormData(prev => ({
          ...prev,
          mathScore: prev.mathScore || Math.min(800, calcMath).toString(),
          rwScore: prev.rwScore || Math.min(800, calcRW).toString(),
          performanceContext: detectedWeaknesses
        }));

      } catch (err) {
        console.error("Analysis failed:", err);
      } finally {
        setAnalyzing(false);
      }
    };

    if (user?.id) {
      analyzePerformance();
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // 1. Prepare detailed payload
      // Combine manual weaknesses with detected ones
      const autoWeaknessString = formData.performanceContext
        .map(w => `${w.topic} (${w.level}): ${w.score}% - ${w.issue}`)
        .join('; ');
      
      const fullWeaknessContext = `
        Manual Notes: ${formData.weaknesses}. 
        Detected System Data: ${autoWeaknessString || "No specific failures recorded yet."}
      `;

      const payload = {
        ...formData,
        weaknesses: fullWeaknessContext
      };

      // 2. Call AI Agent
      const res = await aiService.generateStudyPlan(payload);
      const plan = res.data;

      // 3. Save to Supabase
      await planService.savePlan(user.id, payload, plan);

      // 4. Finish
      onPlanCreated(plan);
      onClose();
    } catch (error) {
      console.error("Plan Gen Error:", error);
      alert("Failed to generate plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative"
      >
        {/* Header */}
        <div className="bg-black p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E53935] rounded-full flex items-center justify-center shadow-lg shadow-red-900/50">
              <SafeIcon icon={FiActivity} className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-xl">AI Diagnostic Agent</h3>
              <p className="text-gray-400 text-xs">Analyzing quiz history & generating master plan</p>
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <SafeIcon icon={FiX} className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }} 
                className="w-20 h-20 border-4 border-gray-200 border-t-[#E53935] rounded-full mb-6" 
              />
              <h4 className="text-2xl font-bold text-gray-900 mb-2">Generating Master Plan...</h4>
              <p className="text-gray-500 animate-pulse">Correlating your quiz mistakes with SAT topics</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                  <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-bold text-gray-900">Step 1: Baseline Scores</h4>
                    {analyzing && <span className="text-xs text-blue-600 animate-pulse flex items-center gap-1"><SafeIcon icon={FiCpu} className="w-3 h-3"/> Auto-detecting...</span>}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Math Score</label>
                      <input 
                        type="number" 
                        name="mathScore" 
                        placeholder="e.g., 600" 
                        value={formData.mathScore} 
                        onChange={handleChange} 
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Reading & Writing Score</label>
                      <input 
                        type="number" 
                        name="rwScore" 
                        placeholder="e.g., 620" 
                        value={formData.rwScore} 
                        onChange={handleChange} 
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none"
                      />
                    </div>
                  </div>

                  {formData.performanceContext.length > 0 && (
                    <div className="mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100">
                      <h5 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                        <SafeIcon icon={FiAlertCircle} className="w-4 h-4"/> Detected Weak Areas
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {formData.performanceContext.map((w, i) => (
                          <span key={i} className="text-xs bg-white border border-orange-200 text-orange-700 px-2 py-1 rounded-md font-medium">
                            {w.topic} ({w.level})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button onClick={() => setStep(2)} className="px-6 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 flex items-center gap-2">
                      Next Step <SafeIcon icon={FiArrowRight} />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -20, opacity: 0 }}>
                  <h4 className="text-xl font-bold text-gray-900 mb-6">Step 2: Goals & Customization</h4>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Target Score</label>
                      <div className="relative">
                        <SafeIcon icon={FiTarget} className="absolute left-3 top-3.5 text-gray-400" />
                        <input 
                          type="number" 
                          name="targetScore" 
                          value={formData.targetScore} 
                          onChange={handleChange} 
                          className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Test Date</label>
                      <div className="relative">
                        <SafeIcon icon={FiCalendar} className="absolute left-3 top-3.5 text-gray-400" />
                        <input 
                          type="date" 
                          name="testDate" 
                          value={formData.testDate} 
                          onChange={handleChange} 
                          className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Additional Notes / Specific Weaknesses</label>
                    <textarea 
                      name="weaknesses" 
                      rows="2" 
                      placeholder="e.g. 'I struggle with geometry time management' or 'Punctuation rules confuse me'..." 
                      value={formData.weaknesses} 
                      onChange={handleChange} 
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#E53935] outline-none"
                    />
                  </div>

                  <div className="flex justify-between">
                    <button onClick={() => setStep(1)} className="text-gray-500 font-bold hover:text-black">Back</button>
                    <button 
                      onClick={handleGenerate} 
                      className="px-8 py-3 bg-[#E53935] text-white rounded-xl font-bold hover:bg-[#d32f2f] shadow-lg shadow-red-200 flex items-center gap-2"
                    >
                      <SafeIcon icon={FiCpu} /> Generate Master Plan
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default DiagnosticWizard;