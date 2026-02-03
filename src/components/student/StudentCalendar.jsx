import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { calendarService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday,
    parseISO
} from 'date-fns';

const {
    FiCalendar, FiChevronLeft, FiChevronRight, FiCheckCircle,
    FiClock, FiPlus, FiTrash2, FiEdit2, FiX, FiInfo,
    FiBook, FiZap, FiFlag, FiTrendingUp
} = FiIcons;

const TASK_TYPES = {
    task: { label: 'Study Task', color: 'blue', icon: FiBook, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    test: { label: 'Practice Test', color: 'red', icon: FiFlag, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    practice: { label: 'Practice Session', color: 'green', icon: FiZap, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' }
};

const StudentCalendar = () => {
    const { user } = useAuth();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        type: 'task',
        status: 'planned',
        duration: 0
    });

    useEffect(() => {
        if (user) loadTasks();
    }, [user, currentMonth]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const month = currentMonth.getMonth();
            const year = currentMonth.getFullYear();
            const { data, error } = await calendarService.getTasks(user.id, month, year);
            if (error) throw error;
            setTasks(data || []);
        } catch (error) {
            console.error("Failed to load tasks:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveTask = async (e) => {
        e.preventDefault();
        if (!formData.title) return;

        setSaving(true);
        try {
            const taskPayload = {
                ...formData,
                user_id: user.id,
                date: format(selectedDate, 'yyyy-MM-dd')
            };

            if (editingTask) {
                await calendarService.updateTask(editingTask.id, taskPayload);
            } else {
                await calendarService.createTask(taskPayload);
            }

            await loadTasks();
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error("Error saving task:", error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTask = async (id) => {
        if (!window.confirm("Are you sure you want to delete this activity?")) return;
        try {
            await calendarService.deleteTask(id);
            await loadTasks();
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    };

    const handleStatusToggle = async (task) => {
        const newStatus = task.status === 'completed' ? 'planned' : 'completed';
        try {
            await calendarService.updateTask(task.id, { status: newStatus });
            await loadTasks();
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            type: 'task',
            status: 'planned',
            duration: 0
        });
        setEditingTask(null);
    };

    const openEditModal = (task) => {
        setFormData({
            title: task.title,
            description: task.description || '',
            type: task.type,
            status: task.status,
            duration: task.duration || 0
        });
        setEditingTask(task);
        setShowModal(true);
    };

    // Calendar Helpers
    const days = eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth)),
        end: endOfWeek(endOfMonth(currentMonth))
    });

    const selectedDateTasks = tasks.filter(t => isSameDay(parseISO(t.date), selectedDate));

    const completionStats = tasks.length > 0 ? {
        completed: tasks.filter(t => t.status === 'completed').length,
        total: tasks.length
    } : { completed: 0, total: 0 };

    return (
        <div className="bg-[#FAFAFA] dark:bg-gray-900 min-h-screen p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                            Study Calendar
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-black uppercase rounded-full tracking-widest">Live</span>
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">Manage your daily goals and track your study time.</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Stats Badge */}
                        <div className="hidden lg:flex items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase">Monthly Progress</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-green-500 transition-all duration-500"
                                            style={{ width: `${(completionStats.completed / (completionStats.total || 1)) * 100}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        {completionStats.completed}/{completionStats.total}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 shadow-xl border border-gray-100 dark:border-gray-700 p-2 rounded-2xl">
                            <button
                                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
                            >
                                <SafeIcon icon={FiChevronLeft} className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                            <span className="font-black text-sm md:text-base w-36 text-center text-gray-900 dark:text-white">
                                {format(currentMonth, 'MMMM yyyy')}
                            </span>
                            <button
                                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
                            >
                                <SafeIcon icon={FiChevronRight} className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                            </button>
                        </div>

                        <button
                            onClick={() => { resetForm(); setShowModal(true); }}
                            className="p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center gap-2 font-bold"
                        >
                            <SafeIcon icon={FiPlus} className="w-5 h-5" />
                            <span className="hidden sm:inline">Add Activity</span>
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Calendar Grid - 8 columns */}
                    <div className="lg:col-span-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                <div key={day} className="py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7">
                            {days.map((day, idx) => {
                                const dayTasks = tasks.filter(t => isSameDay(parseISO(t.date), day));
                                const isSelected = isSameDay(day, selectedDate);
                                const isCurrentMonth = isSameMonth(day, currentMonth);

                                return (
                                    <div
                                        key={day.toString()}
                                        onClick={() => setSelectedDate(day)}
                                        className={`
                      min-h-[100px] md:min-h-[130px] border-b border-r border-gray-50 dark:border-gray-700 p-2 cursor-pointer transition-all relative group
                      ${!isCurrentMonth ? 'bg-gray-50/30' : 'bg-white dark:bg-gray-800'}
                      ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-500 z-10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                    `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`
                         text-xs md:text-sm font-black w-7 h-7 flex items-center justify-center rounded-xl transition-all
                         ${isToday(day) ? 'bg-[#E53935] text-white shadow-lg' : isSelected ? 'bg-blue-500 text-white' : 'text-gray-400 dark:text-gray-500'}
                         ${!isCurrentMonth ? 'opacity-30' : ''}
                       `}>
                                                {format(day, 'd')}
                                            </span>
                                            {dayTasks.some(t => t.status === 'completed') && dayTasks.every(t => t.status === 'completed') && (
                                                <SafeIcon icon={FiCheckCircle} className="w-3 h-3 text-green-500" />
                                            )}
                                        </div>

                                        <div className="space-y-1 overflow-hidden">
                                            {dayTasks.slice(0, 3).map(task => (
                                                <div
                                                    key={task.id}
                                                    className={`text-[9px] md:text-[10px] truncate px-1.5 py-1 rounded-lg border font-bold ${TASK_TYPES[task.type].bg} ${TASK_TYPES[task.type].text} ${TASK_TYPES[task.type].border} transition-transform hover:scale-95`}
                                                >
                                                    {task.status === 'completed' && '✓ '}{task.title}
                                                </div>
                                            ))}
                                            {dayTasks.length > 3 && (
                                                <div className="text-[9px] text-gray-400 font-bold px-1.5">
                                                    + {dayTasks.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Side Planner - 4 columns */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-gray-700 h-full">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-black text-gray-900 dark:text-white">{format(selectedDate, 'EEEE')}</h2>
                                    <p className="text-gray-500 text-sm font-bold uppercase tracking-wider">{format(selectedDate, 'MMMM do')}</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                                    <SafeIcon icon={FiCalendar} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                                {selectedDateTasks.length > 0 ? (
                                    selectedDateTasks.map((task) => (
                                        <motion.div
                                            key={task.id}
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className={`group p-4 rounded-2xl border transition-all ${task.status === 'completed' ? 'bg-gray-50 dark:bg-gray-900/50' : 'bg-white dark:bg-gray-800 hover:shadow-md'}`}
                                        >
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => handleStatusToggle(task)}
                                                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0
                             ${task.status === 'completed' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-200 hover:border-blue-500'}`}
                                                >
                                                    {task.status === 'completed' && <SafeIcon icon={FiIcons.FiCheck} className="w-4 h-4" />}
                                                </button>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <h3 className={`font-bold text-sm truncate ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                                                            {task.title}
                                                        </h3>
                                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => openEditModal(task)} className="p-1 hover:text-blue-600 text-gray-400"><FiEdit2 className="w-3 h-3" /></button>
                                                            <button onClick={() => handleDeleteTask(task.id)} className="p-1 hover:text-red-600 text-gray-400"><FiTrash2 className="w-3 h-3" /></button>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${TASK_TYPES[task.type].bg} ${TASK_TYPES[task.type].text}`}>
                                                            {TASK_TYPES[task.type].label}
                                                        </span>
                                                        {task.duration > 0 && (
                                                            <span className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                                                                <FiClock className="w-3 h-3" /> {task.duration}m
                                                            </span>
                                                        )}
                                                    </div>

                                                    {task.description && (
                                                        <p className="text-xs text-gray-500 mt-2 line-clamp-2 italic">
                                                            "{task.description}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-700">
                                        <p className="text-gray-400 font-bold text-sm italic mb-2">No activities for today</p>
                                        <button
                                            onClick={() => setShowModal(true)}
                                            className="text-blue-600 font-black text-xs hover:underline flex items-center gap-1 mx-auto"
                                        >
                                            <FiPlus className="w-3 h-3" /> Plan Something
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Overlay */}
                <AnimatePresence>
                    {showModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="bg-white dark:bg-gray-800 rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full relative border border-gray-100 dark:border-gray-700"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 rounded-full transition-all">
                                    <FiX className="w-5 h-5 text-gray-400" />
                                </button>

                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-3xl flex items-center justify-center">
                                        <SafeIcon icon={FiCalendar} className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                                            {editingTask ? 'Edit Activity' : 'New Activity'}
                                        </h2>
                                        <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">{format(selectedDate, 'MMMM do, yyyy')}</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSaveTask} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-gray-400 mb-2 tracking-widest">Activity Title</label>
                                        <input
                                            autoFocus
                                            required
                                            type="text"
                                            placeholder="e.g., Geometry Area Quiz"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-gray-400 mb-2 tracking-widest">Category</label>
                                            <select
                                                value={formData.type}
                                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white appearance-none"
                                            >
                                                {Object.keys(TASK_TYPES).map(t => (
                                                    <option key={t} value={t}>{TASK_TYPES[t].label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] uppercase font-black text-gray-400 mb-2 tracking-widest">Est. Minutes</label>
                                            <input
                                                type="number"
                                                value={formData.duration}
                                                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                                                className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] uppercase font-black text-gray-400 mb-2 tracking-widest">Description (Optional)</label>
                                        <textarea
                                            placeholder="Add some details or notes..."
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all text-gray-900 dark:text-white h-24"
                                        />
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 p-4 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={saving}
                                            className="flex-[2] p-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 dark:shadow-none transition-all disabled:opacity-50"
                                        >
                                            {saving ? 'Saving...' : (editingTask ? 'Update Activity' : 'Save Activity')}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default StudentCalendar;