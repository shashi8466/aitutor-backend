import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { planService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { FiCalendar, FiChevronLeft, FiChevronRight, FiCheckCircle, FiCircle, FiFlag } = FiIcons;

const StudentCalendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

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
      console.error("Failed to load plan for calendar", error);
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const changeMonth = (offset) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const renderCalendar = () => {
    const days = [];
    const totalDays = daysInMonth(currentDate);
    const startDay = firstDayOfMonth(currentDate);
    const today = new Date();

    // Empty slots for start of month
    for (let i = 0; i < startDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-24 bg-gray-50/50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800"></div>);
    }

    // Days
    for (let d = 1; d <= totalDays; d++) {
        const isToday = d === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
        
        // Mock logic to map plan weeks to calendar days
        // In real app, we'd map specific dates from the plan structure
        const hasTask = plan && (d % 3 === 0 || d % 4 === 0);
        const isQuiz = plan && (d % 7 === 0);

        days.push(
            <div key={d} className={`h-24 border border-gray-100 dark:border-gray-700 p-2 relative group hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-900'}`}>
                <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-[#E53935] text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                    {d}
                </span>
                
                <div className="mt-2 space-y-1">
                    {hasTask && (
                        <div className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 rounded truncate font-medium">
                            Algebra Drill
                        </div>
                    )}
                    {isQuiz && (
                        <div className="text-[10px] bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1">
                            <SafeIcon icon={FiFlag} className="w-2 h-2" /> Practice Test
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return days;
  };

  return (
    <div className="bg-white dark:bg-gray-900 min-h-screen p-6">
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Study Calendar</h1>
                    <p className="text-gray-500 dark:text-gray-400">Track your upcoming drills and practice tests.</p>
                </div>
                <div className="flex items-center gap-4 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-2 rounded-xl">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <SafeIcon icon={FiChevronLeft} className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    <span className="font-bold text-lg w-32 text-center text-gray-900 dark:text-white">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                        <SafeIcon icon={FiChevronRight} className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-500">Loading schedule...</div>
            ) : (
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="p-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {renderCalendar()}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default StudentCalendar;