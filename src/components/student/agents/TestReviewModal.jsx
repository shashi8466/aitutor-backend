import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../../common/SafeIcon';
import { aiService, testReviewService } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

const { FiFileText, FiCpu, FiAlertTriangle, FiCheckCircle, FiClock, FiX, FiLoader, FiPieChart, FiPlus, FiTrash2 } = FiIcons;

const TestReviewModal = ({ onClose }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const { user } = useAuth();

  // Add keyboard event listener for Escape key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);

    // Cleanup the event listener on component unmount
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);

  // Enhanced Form State
  const [formData, setFormData] = useState({
    score: '',
    sectionScores: { math: '', rw: '' },
    mistakesText: '',
    // New: Structured Breakdown
    topicBreakdown: [] // { topic: 'Algebra', mistakes: 3 }
  });

  const [newTopic, setNewTopic] = useState({ topic: '', mistakes: '' });

  const addTopic = () => {
    if (newTopic.topic && newTopic.mistakes) {
      setFormData(prev => ({
        ...prev,
        topicBreakdown: [...prev.topicBreakdown, { ...newTopic }]
      }));
      setNewTopic({ topic: '', mistakes: '' });
    }
  };

  const removeTopic = (index) => {
    setFormData(prev => ({
      ...prev,
      topicBreakdown: prev.topicBreakdown.filter((_, i) => i !== index)
    }));
  };

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await aiService.reviewTest({
        score: formData.score,
        sectionScores: formData.sectionScores,
        mistakesText: formData.mistakesText,
        topicBreakdown: formData.topicBreakdown
      });
      setAnalysis(res.data);
      setStep(2);
    } catch (error) {
      console.error(error);
      alert("Failed to analyze. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()} // Prevent click propagation to modal content
      >
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg"><SafeIcon icon={FiCpu} className="w-6 h-6" /></div>
            <div>
              <h3 className="font-bold text-xl">Practice Test Review Agent</h3>
              <p className="text-blue-100 text-xs">Automated Analysis & Strategy</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
              onClose();
            }}
            className="text-white hover:text-gray-300 focus:outline-none"
            aria-label="Close modal"
          >
            <SafeIcon icon={FiX} className="w-6 h-6 hover:opacity-75" />
          </button>
        </div>

        {/* Add click outside to close functionality - using onMouseDown to prevent bubbling */}
        <div className="absolute inset-0 -z-10" onMouseDown={onClose}></div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <SafeIcon icon={FiLoader} className="w-12 h-12 animate-spin text-blue-600" />
              <p className="text-gray-500 font-medium animate-pulse">Analyzing your performance patterns...</p>
            </div>
          ) : step === 1 ? (
            <div className="space-y-6">
              {/* Scores */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Total Score</label>
                  <input type="number" placeholder="1250" className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-700" value={formData.score} onChange={e => setFormData({ ...formData, score: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Math Score</label>
                  <input type="number" placeholder="620" className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-700" value={formData.sectionScores.math} onChange={e => setFormData({ ...formData, sectionScores: { ...formData.sectionScores, math: e.target.value } })} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">R&W Score</label>
                  <input type="number" placeholder="630" className="w-full p-3 border rounded-xl dark:bg-gray-800 dark:border-gray-700" value={formData.sectionScores.rw} onChange={e => setFormData({ ...formData, sectionScores: { ...formData.sectionScores, rw: e.target.value } })} />
                </div>
              </div>

              {/* Topic Breakdown (Granular Input) */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Topic-wise Mistakes (Optional but Recommended)</label>

                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Topic (e.g. Algebra)"
                    className="flex-1 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                    value={newTopic.topic}
                    onChange={e => setNewTopic({ ...newTopic, topic: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="# Wrong"
                    className="w-24 p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600"
                    value={newTopic.mistakes}
                    onChange={e => setNewTopic({ ...newTopic, mistakes: e.target.value })}
                  />
                  <button onClick={addTopic} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
                    <SafeIcon icon={FiPlus} className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formData.topicBreakdown.map((item, idx) => (
                    <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 px-3 py-1 rounded-full flex items-center gap-2 text-sm shadow-sm">
                      <span className="font-medium">{item.topic}: {item.mistakes}</span>
                      <button onClick={() => removeTopic(idx)} className="text-red-500 hover:text-red-700"><SafeIcon icon={FiTrash2} className="w-3 h-3" /></button>
                    </div>
                  ))}
                  {formData.topicBreakdown.length === 0 && <span className="text-xs text-gray-400 italic">No specific topics added yet.</span>}
                </div>
              </div>

              {/* General Notes */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  General Notes / Time Management Issues
                </label>
                <textarea
                  rows="3"
                  className="w-full p-4 border rounded-xl dark:bg-gray-800 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Ran out of time on reading last passage..."
                  value={formData.mistakesText}
                  onChange={e => setFormData({ ...formData, mistakesText: e.target.value })}
                />
              </div>

              <button
                onClick={analyze}
                disabled={!formData.score}
                className="w-full py-4 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <SafeIcon icon={FiPieChart} /> Analyze Test
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Score Summary Card */}
              {analysis.score_summary && (
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 rounded-2xl text-white shadow-lg">
                  <p className="font-bold text-lg">{analysis.score_summary}</p>
                </div>
              )}

              {/* Primary Issue Analysis */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                <h4 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                  <SafeIcon icon={FiAlertTriangle} className="text-blue-600" /> Primary Issue: {analysis.issue_type || 'Analysis Complete'}
                </h4>
                <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                  {analysis.analysis || 'Review your breakdown below for detailed insights.'}
                </p>
              </div>

              {/* Priority Order */}
              {analysis.priority_order && analysis.priority_order.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200 dark:border-amber-800">
                  <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                    <SafeIcon icon={FiClock} className="text-amber-600" /> Study Priority Order
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.priority_order.map((item, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded-full text-sm font-bold">
                        <span className="w-5 h-5 bg-amber-600 text-white rounded-full flex items-center justify-center text-xs">{i + 1}</span>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Breakdown */}
              {analysis.breakdown && analysis.breakdown.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4">Performance Breakdown</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {analysis.breakdown.map((item, i) => (
                      <div key={i} className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-800 dark:border-gray-700">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-gray-900 dark:text-gray-100">{item.category}</span>
                          <span className={`text-xs px-2 py-1 rounded font-bold ${item.status === 'Weak' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                              item.status === 'Strong' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}>{item.status}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.advice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {analysis.next_actions && analysis.next_actions.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white mb-4">Recommended Next Actions</h4>
                  <div className="space-y-3">
                    {analysis.next_actions.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800">
                        <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                        <span className="text-green-900 dark:text-green-100 font-medium">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50">Back</button>
                <button
                  onClick={async () => {
                    if (user && analysis) {
                      setSaveLoading(true);
                      try {
                        await testReviewService.saveReview(user.id, formData, analysis);
                        // Optionally show a success message
                        alert('Test review saved successfully!');
                        onClose(); // Close the modal after saving
                      } catch (error) {
                        console.error('Error saving test review:', error);
                        alert('Failed to save test review. Please try again.');
                        setSaveLoading(false);
                      }
                    } else {
                      onClose(); // Close if no user or analysis
                    }
                  }}
                  disabled={saveLoading}
                  className="flex-1 py-3 bg-black text-white rounded-xl font-bold hover:bg-gray-800 disabled:opacity-50"
                >
                  {saveLoading ? 'Saving...' : 'Save to Dashboard'}
                </button>
              </div>

              {/* Close button as an alternative */}
              <div className="pt-2 text-center">
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700 text-sm underline"
                >
                  Close without saving
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default TestReviewModal;