import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { feedbackService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';
import Toast from '../common/Toast';

const { 
  FiMessageSquare, 
  FiStar, 
  FiUser, 
  FiCalendar, 
  FiFilter, 
  FiSearch, 
  FiBook, 
  FiEye, 
  FiX, 
  FiSmile, 
  FiFrown, 
  FiMeh,
  FiActivity
} = FiIcons;

const AdminFeedback = () => {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const res = await feedbackService.getAll();
      setFeedback(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load feedback:", err);
      setToast({ message: "Could not load feedback data.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = feedback.filter(f => 
    (f.profiles?.name || '').toLowerCase().includes(filter.toLowerCase()) ||
    (f.courses?.name || '').toLowerCase().includes(filter.toLowerCase()) ||
    (f.message || '').toLowerCase().includes(filter.toLowerCase())
  );

  const getDifficultyColor = (lvl) => {
    switch (lvl) {
      case 'Too Easy': return 'text-green-600 bg-green-50 border-green-100';
      case 'Just Right': return 'text-sky-600 bg-sky-50 border-sky-100';
      case 'Challenging': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'Too Hard': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-gray-600 bg-gray-50 border-gray-100';
    }
  };

  const renderStars = (num) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <FiStar key={s} className={`w-3 h-3 ${s <= num ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );

  if (loading) return <LoadingSpinner fullPage={false} />;

  return (
    <div className="space-y-6">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <SafeIcon icon={FiMessageSquare} className="text-[#E53935]" />
            Student Feedback
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Review student experiences across courses and tests</p>
        </div>
        
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter by student or course..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#E53935] outline-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Activity / Course</th>
                <th className="px-6 py-4 text-center">Rating</th>
                <th className="px-6 py-4">Experience</th>
                <th className="px-6 py-4">Difficulty</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                        {item.anonymous ? '?' : (item.profiles?.name?.charAt(0) || 'U')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.anonymous ? 'Anonymous Student' : (item.profiles?.name || 'Unknown')}
                        </p>
                        {!item.anonymous && <p className="text-[10px] text-slate-500">{item.profiles?.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <SafeIcon icon={item.test_id ? FiActivity : FiBook} className="w-3.5 h-3.5 text-sky-500" />
                       <div>
                         <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.courses?.name || 'General'}</p>
                         {item.test_id && <p className="text-[10px] text-slate-500">Test ID: {item.test_id.slice(0, 8)}...</p>}
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex flex-col items-center">
                      <div className="text-sm font-black text-slate-900 dark:text-white">{item.rating}/5</div>
                      {renderStars(item.rating)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex flex-col gap-1">
                       <div className="flex items-center gap-1.5">
                         <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Quality:</span>
                         {renderStars(item.quality_rating)}
                       </div>
                       <p className="text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1 max-w-[200px]">
                         "{item.message || 'No comment'}"
                       </p>
                     </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyColor(item.difficulty_level)}`}>
                      {item.difficulty_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => setSelectedItem(item)}
                      className="p-2 text-slate-400 hover:text-[#E53935] hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    >
                      <FiEye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-20 text-center">
                    <SafeIcon icon={FiMessageSquare} className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">No feedback entries found matching your criteria.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/20 text-[#E53935] rounded-xl">
                    <FiMessageSquare className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-white">Feedback Details</h3>
                </div>
                <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 text-xl font-bold uppercase shadow-inner">
                    {selectedItem.anonymous ? '?' : (selectedItem.profiles?.name?.charAt(0) || 'U')}
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                      {selectedItem.anonymous ? 'Anonymous Student' : (selectedItem.profiles?.name || 'Unknown')}
                    </h4>
                    <p className="text-sm text-slate-500 font-medium">
                      {selectedItem.anonymous ? 'Identity hidden by student' : selectedItem.profiles?.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Course Activity</p>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedItem.courses?.name || 'General'}</p>
                    {selectedItem.test_id && (
                      <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 bg-sky-100/50 text-sky-600 text-[9px] font-bold rounded-lg w-fit">
                        <FiActivity className="w-2.5 h-2.5" />
                        TEST ATTEMPT
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Difficulty Feedback</p>
                    <p className={`text-sm font-bold ${getDifficultyColor(selectedItem.difficulty_level).split(' ')[0]}`}>
                      {selectedItem.difficulty_level}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-amber-50/50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/20">
                     <span className="text-xs font-bold text-amber-800 dark:text-amber-400">Experience Rating</span>
                     {renderStars(selectedItem.rating)}
                  </div>
                  <div className="flex justify-between items-center p-4 bg-green-50/50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20">
                     <span className="text-xs font-bold text-green-800 dark:text-green-400">Question Quality</span>
                     {renderStars(selectedItem.quality_rating)}
                  </div>
                </div>

                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 min-h-[120px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Student Message</p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm italic leading-relaxed">
                    "{selectedItem.message || 'No additional comments provided.'}"
                  </p>
                </div>

                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-tighter">
                  <FiCalendar className="w-3 h-3" />
                  Submitted on {new Date(selectedItem.created_at).toLocaleString()}
                </div>

                <button
                  onClick={() => setSelectedItem(null)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminFeedback;
