import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import AITutorModal from '../AITutorModal';
import { aiService, planService, progressService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const { FiTarget, FiCrosshair, FiZap, FiCheckCircle, FiRefreshCw, FiAlertTriangle, FiEye, FiEyeOff, FiMessageCircle, FiLoader } = FiIcons;

const WeaknessDrills = () => {
  const { user } = useAuth();
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [generated, setGenerated] = useState(false);
  
  // Dynamic Weaknesses from Plan/DB
  const [weaknessList, setWeaknessList] = useState([]);

  // Interactive States
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [showAI, setShowAI] = useState(false);
  const [selectedDrill, setSelectedDrill] = useState(null);

  useEffect(() => {
    if (user?.id) loadWeaknesses();
  }, [user]);

  const loadWeaknesses = async () => {
    setLoadingContext(true);
    try {
      // 1. Try to get AI generated plan first
      const { data: planData } = await planService.getPlan(user.id);
      let detected = [];

      if (planData && planData.generated_plan?.weeks) {
        // Extract focus topics from the first 2 weeks of the plan
        detected = planData.generated_plan.weeks.slice(0, 2).map(w => ({
          topic: w.focus,
          reason: "From Master Plan",
          priority: "High"
        }));
      }

      // 2. Supplement with real failed progress
      const { data: progress } = await progressService.getAllUserProgress(user.id);
      const failedItems = progress.filter(p => !p.passed || p.score < 65);
      
      failedItems.forEach(p => {
        // Only add if not already covered by plan
        const topicName = p.courses?.name || "General Topic";
        if (!detected.find(d => d.topic.includes(topicName))) {
          detected.push({
            topic: `${topicName} (${p.level})`,
            reason: "Low Quiz Score",
            priority: "Critical"
          });
        }
      });

      // 3. Fallback if empty
      if (detected.length === 0) {
        detected = [
          { topic: "Algebra Basics", reason: "Standard Assessment", priority: "Medium" },
          { topic: "Grammar & Punctuation", reason: "Standard Assessment", priority: "Medium" }
        ];
      }

      setWeaknessList(detected);
    } catch (err) {
      console.error("Failed to load weakness context", err);
    } finally {
      setLoadingContext(false);
    }
  };

  const handleGenerateDrill = async (topic) => {
    setLoading(true);
    setGenerated(false);
    setRevealedAnswers({});
    
    try {
      // Use the Quiz Gen AI endpoint but customized for a specific topic drill
      // We'll create a prompt context that forces it to be a drill
      const context = `Generate a set of 2 challenging SAT practice questions specifically for the topic: "${topic}". Focus on common student traps.`;
      const res = await aiService.generateQuizFromContent(context); // Reusing quiz gen for structure
      
      const rawQuiz = res.data?.quiz || [];
      // Map to local format
      const drillSet = rawQuiz.map((q, i) => ({
        id: i + 1,
        question: q.question,
        answer: q.correctAnswer,
        explanation: q.explanation || "No explanation provided."
      }));

      if (drillSet.length === 0) throw new Error("AI returned empty drills");

      setDrills(drillSet);
      setGenerated(true);
    } catch (err) {
      console.error("Drill gen failed", err);
      alert("Failed to generate drills. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleAnswer = (id) => {
    setRevealedAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExplain = (drill) => {
    setSelectedDrill({
      question: drill.question,
      correct_answer: drill.answer,
      explanation: drill.explanation,
      type: 'short_answer',
      level: 'Adaptive'
    });
    setShowAI(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-wider mb-4">
            <SafeIcon icon={FiCrosshair} className="w-4 h-4" />
            Precision Training
          </div>
          <h1 className="text-4xl font-extrabold mb-4">Weakness Detection & Drill Agent</h1>
          <p className="text-purple-200 max-w-2xl text-lg">
            I've analyzed your Master Plan and recent quiz failures. Select a detected weakness below to generate instant, targeted practice drills.
          </p>
        </div>
        {/* Decor */}
        <div className="absolute right-0 top-0 w-64 h-64 bg-purple-500/30 blur-[100px] rounded-full mix-blend-overlay"></div>
      </div>

      {loadingContext ? (
        <div className="text-center py-12">
          <SafeIcon icon={FiLoader} className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-2"/>
          <p className="text-gray-500">Analyzing your performance data...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {weaknessList.map((w, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ delay: i * 0.1 }}
              key={i} 
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${w.priority === 'Critical' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                  <SafeIcon icon={FiAlertTriangle} className="w-6 h-6" />
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${w.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                  {w.priority}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{w.topic}</h3>
              <p className="text-gray-500 text-sm mb-6">Source: <span className="font-bold">{w.reason}</span></p>
              
              <button 
                onClick={() => handleGenerateDrill(w.topic)}
                disabled={loading}
                className="w-full py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold hover:opacity-80 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <SafeIcon icon={FiZap} /> {loading ? 'Generating...' : 'Generate Drills'}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {generated && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <SafeIcon icon={FiTarget} className="text-green-500" /> Your Custom Drill Set
          </h3>
          <div className="space-y-6">
            {drills.map((d, i) => (
              <div key={d.id} className="p-6 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-700">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Question {i + 1}</span>
                <p className="font-medium text-lg text-gray-900 dark:text-white mb-4">{d.question}</p>
                
                {/* Answer Display */}
                {revealedAnswers[d.id] && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 overflow-hidden">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-xl border border-green-100 dark:border-green-800">
                      <p className="font-bold">Answer: {d.answer}</p>
                    </div>
                  </motion.div>
                )}

                <div className="flex gap-3">
                  <button 
                    onClick={() => toggleAnswer(d.id)}
                    className="px-6 py-2 border-2 border-gray-200 dark:border-gray-600 rounded-lg font-bold text-gray-600 dark:text-gray-300 hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white transition-colors flex items-center gap-2"
                  >
                    <SafeIcon icon={revealedAnswers[d.id] ? FiEyeOff : FiEye} className="w-4 h-4" /> 
                    {revealedAnswers[d.id] ? "Hide Answer" : "Show Answer"}
                  </button>
                  <button 
                    onClick={() => handleExplain(d)}
                    className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg font-bold hover:opacity-80 transition-colors flex items-center gap-2"
                  >
                    <SafeIcon icon={FiMessageCircle} className="w-4 h-4" /> Explain with AI
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* AI Tutor Modal */}
      {showAI && selectedDrill && (
        <AITutorModal 
          question={selectedDrill} 
          userAnswer=""
          correctAnswer={selectedDrill.correct_answer}
          onClose={() => setShowAI(false)} 
        />
      )}
    </div>
  );
};

export default WeaknessDrills;