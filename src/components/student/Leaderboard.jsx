import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { leaderboardService, courseService } from '../../services/api';

const { FiAward, FiArrowLeft, FiTrendingUp, FiUser, FiStar, FiFilter } = FiIcons;

const Leaderboard = () => {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (courses.length > 0 || selectedCourseId === '') {
      loadLeaderboard();
    }
  }, [selectedCourseId]);

  const loadCourses = async () => {
    try {
      const { data } = await courseService.getAll();
      setCourses(data || []);
      // If specific course scores are desired by default, uncomment next line:
      // if (data.length > 0) setSelectedCourseId(data[0].id);
    } catch (error) {
      console.error("Failed to load courses", error);
    }
  };

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      let data;
      if (selectedCourseId) {
        // Fetch specific course rankings (SAT Score)
        const res = await leaderboardService.getCourseRankings(selectedCourseId);
        data = res.data;
      } else {
        // Fetch global rankings (Total Points/XP)
        const res = await leaderboardService.getTopStudents();
        data = res.data;
      }
      setStudents(data || []);
    } catch (error) {
      console.error("Failed to load leaderboard", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg">1</div>;
    if (rank === 2) return <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white font-bold shadow-lg">2</div>;
    if (rank === 3) return <div className="w-8 h-8 bg-orange-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg">3</div>;
    return <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold">{rank}</div>;
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/student" className="flex items-center gap-2 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white font-bold transition-colors self-start md:self-auto">
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" /> Back
          </Link>
          
          <div className="text-center md:text-right">
            <h1 className="text-3xl font-extrabold text-black dark:text-white flex items-center gap-2 justify-center md:justify-end">
              <SafeIcon icon={FiAward} className="text-[#E53935]" /> Leaderboard
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Top performing students</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-8 flex items-center gap-4">
          <SafeIcon icon={FiFilter} className="text-gray-400 w-5 h-5" />
          <select 
            value={selectedCourseId} 
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white font-bold text-sm cursor-pointer outline-none"
          >
            <option value="">Global Leaderboard (Total XP)</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.name} (SAT Score)</option>
            ))}
          </select>
        </div>

        {/* Podium (Top 3) */}
        {!loading && students.length >= 3 && (
          <div className="flex justify-center items-end gap-4 mb-12">
            {[students[1], students[0], students[2]].map((student, idx) => {
              if (!student) return null;
              const isFirst = idx === 1; // Center item
              const rank = isFirst ? 1 : (idx === 0 ? 2 : 3);
              const scoreDisplay = selectedCourseId ? student.score : student.total_points;
              
              return (
                <motion.div 
                  key={student.user_id} 
                  initial={{ y: 50, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  transition={{ delay: idx * 0.2 }}
                  className={`flex flex-col items-center ${isFirst ? 'order-2 -mt-8' : idx === 0 ? 'order-1' : 'order-3'}`}
                >
                  <div className={`relative mb-3 ${isFirst ? 'w-24 h-24' : 'w-16 h-16'}`}>
                    <div className={`w-full h-full rounded-full border-4 flex items-center justify-center overflow-hidden bg-white dark:bg-gray-800 ${isFirst ? 'border-yellow-400' : rank === 2 ? 'border-gray-300' : 'border-orange-400'}`}>
                      <SafeIcon icon={FiUser} className={`text-gray-300 ${isFirst ? 'w-10 h-10' : 'w-6 h-6'}`} />
                    </div>
                    <div className={`absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${isFirst ? 'bg-yellow-400' : rank === 2 ? 'bg-gray-400' : 'bg-orange-400'}`}>
                      {rank}
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm mb-1">{student.name}</p>
                  <p className="text-[#E53935] font-extrabold text-xs">
                    {scoreDisplay} {selectedCourseId ? 'Score' : 'Pts'}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* List View */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex justify-between items-center">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <SafeIcon icon={FiTrendingUp} className="text-blue-500" /> 
              {selectedCourseId ? 'Course Rankings' : 'Global Rankings'}
            </h2>
            <span className="text-xs font-bold bg-black text-white px-3 py-1 rounded-full">{students.length} Students</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading rankings...</div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {students.map((student, index) => {
                const scoreDisplay = selectedCourseId ? student.score : student.total_points;
                const label = selectedCourseId ? 'SAT Score' : 'Points';
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    transition={{ delay: index * 0.05 }}
                    key={student.user_id} 
                    className="p-4 flex items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="w-12 text-center mr-4">
                      {getRankBadge(index + 1)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">{student.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                        Level {student.levels_completed || 0} Achiever
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block font-extrabold text-[#E53935] text-lg">{scoreDisplay}</span>
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">{label}</span>
                    </div>
                  </motion.div>
                );
              })}
              
              {students.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No rankings available yet. Start solving quizzes!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;