import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { leaderboardService, adminService, tutorService } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { TAXONOMY } from '../../utils/taxonomy';

const {
    FiAward, FiFilter, FiUser, FiCheckCircle, FiBookOpen,
    FiBarChart2, FiUsers, FiStar, FiChevronDown, FiTarget
} = FiIcons;

const CATEGORIES = [
    { id: 'SAT', label: 'SAT Overall' },
    { id: 'SAT Math', label: 'SAT Math' },
    { id: 'SAT Math — Topic', label: 'SAT Math — Topic' },
    { id: 'SAT Math — Subtopic', label: 'SAT Math — Subtopic' },
    { id: 'SAT Reading & Writing', label: 'SAT Reading & Writing' },
    { id: 'SAT Reading & Writing — Topic', label: 'SAT Reading & Writing — Topic' },
    { id: 'SAT Reading & Writing — Subtopic', label: 'SAT Reading & Writing — Subtopic' },
    { id: 'AP', label: 'AP Performance' },
    { id: 'AP — Topic', label: 'AP — Topic' },
    { id: 'AP — Subtopic', label: 'AP — Subtopic' },
    { id: 'Full-Length Test', label: 'Full-Length Test' }
];

/**
 * Universal Shared Leaderboard System with Topic & Subtopic Engine
 * Roles supported: 'student', 'tutor', 'admin', 'parent'
 */
const UniversalLeaderboard = ({
    role = 'student',
    targetStudentId = null,
    title = 'Leaderboard',
    subtitle = 'Track student performance and rankings across SAT, AP, and Full-Length tests'
}) => {
    const { user } = useAuth();
    
    // Selectors state
    const [category, setCategory] = useState('SAT');
    const [selectedApCourseId, setSelectedApCourseId] = useState('all');
    const [selectedTestCourseId, setSelectedTestCourseId] = useState('all');
    const [selectedGroupId, setSelectedGroupId] = useState('all');
    const [selectedTopic, setSelectedTopic] = useState('');
    const [selectedSubtopic, setSelectedSubtopic] = useState('');

    // Available options
    const [groupsList, setGroupsList] = useState([]);
    const [apCourses, setApCourses] = useState([]);
    const [fullLengthTests, setFullLengthTests] = useState([]);
    const [topicsList, setTopicsList] = useState([]);
    const [subtopicsList, setSubtopicsList] = useState([]);

    // Leaderboard Data
    const [rankings, setRankings] = useState([]);
    const [top5, setTop5] = useState([]);
    const [featuredRank, setFeaturedRank] = useState(null);
    const [assignedCount, setAssignedCount] = useState(null);
    const [completedCount, setCompletedCount] = useState(null);
    const [highestScore, setHighestScore] = useState(null);
    const [averageScore, setAverageScore] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 25;

    // Fetch initial group options for Admin/Tutor
    useEffect(() => {
        const fetchScopeGroups = async () => {
            try {
                if (role === 'tutor') {
                    const res = await tutorService.getGroups();
                    setGroupsList(res.data.groups || []);
                } else if (role === 'admin') {
                    const res = await adminService.getAllGroups();
                    setGroupsList(res.data.groups || []);
                }
            } catch (err) {
                console.error('Failed to load scope groups:', err);
            }
        };
        fetchScopeGroups();
    }, [role]);

    // Resolve which taxonomy tree + subject key a Topic/Subtopic category should read from
    const resolveTaxonomyLocation = () => {
        if (category.includes('AP')) {
            const selectedAp = apCourses.find(c => String(c.id) === String(selectedApCourseId));
            const apSubjects = Object.keys(TAXONOMY['AP'] || {});
            let subjectKey = apSubjects[0];
            if (selectedAp?.name) {
                const nameLower = selectedAp.name.toLowerCase();
                const matched = apSubjects.find(s => nameLower.includes(s.toLowerCase()) || s.toLowerCase().includes(nameLower));
                if (matched) subjectKey = matched;
            }
            return { mainKey: 'AP', subjectKey };
        }
        if (category.includes('Reading & Writing')) {
            return { mainKey: 'SAT', subjectKey: 'SAT Reading & Writing' };
        }
        return { mainKey: 'SAT', subjectKey: 'SAT Math' };
    };

    // Build Topic list based on Category and Group assigned content
    useEffect(() => {
        const { mainKey, subjectKey } = resolveTaxonomyLocation();

        const taxonomyTopics = TAXONOMY[mainKey]?.[subjectKey] || {};
        let availableTopics = Object.keys(taxonomyTopics);

        // Filter by Group assigned_content if group selected
        if (selectedGroupId !== 'all') {
            const grp = groupsList.find(g => String(g.id) === String(selectedGroupId));
            if (grp && grp.assigned_content?.[mainKey]?.[subjectKey]) {
                const assignedDomains = Object.keys(grp.assigned_content[mainKey][subjectKey]);
                if (assignedDomains.length > 0) {
                    availableTopics = assignedDomains;
                }
            }
        }

        setTopicsList(availableTopics);
        if (availableTopics.length > 0) {
            if (!availableTopics.includes(selectedTopic)) {
                setSelectedTopic(availableTopics[0]);
            }
        } else {
            setSelectedTopic('');
        }
    }, [category, selectedGroupId, groupsList, selectedApCourseId, apCourses]);

    // Build Subtopic list based on Selected Topic and Group assigned content
    useEffect(() => {
        if (!selectedTopic) {
            setSubtopicsList([]);
            setSelectedSubtopic('');
            return;
        }

        const { mainKey, subjectKey } = resolveTaxonomyLocation();

        let availableSubs = TAXONOMY[mainKey]?.[subjectKey]?.[selectedTopic] || [];

        if (selectedGroupId !== 'all') {
            const grp = groupsList.find(g => String(g.id) === String(selectedGroupId));
            if (grp && grp.assigned_content?.[mainKey]?.[subjectKey]?.[selectedTopic]) {
                const assignedSubs = grp.assigned_content[mainKey][subjectKey][selectedTopic];
                if (Array.isArray(assignedSubs) && assignedSubs.length > 0) {
                    availableSubs = assignedSubs;
                }
            }
        }

        setSubtopicsList(availableSubs);
        if (availableSubs.length > 0) {
            if (!availableSubs.includes(selectedSubtopic)) {
                setSelectedSubtopic(availableSubs[0]);
            }
        } else {
            setSelectedSubtopic('');
        }
    }, [category, selectedTopic, selectedGroupId, groupsList, selectedApCourseId, apCourses]);

    // Main Leaderboard Data Loader
    useEffect(() => {
        setPage(1);
        loadLeaderboardData();
    }, [category, selectedApCourseId, selectedTestCourseId, selectedGroupId, selectedTopic, selectedSubtopic, targetStudentId]);

    const loadLeaderboardData = async () => {
        setLoading(true);
        try {
            const params = {
                category,
                apCourseId: category.startsWith('AP') ? selectedApCourseId : undefined,
                testCourseId: category.startsWith('Full-Length Test') ? selectedTestCourseId : undefined,
                groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
                topicName: category.includes('Topic') ? selectedTopic : undefined,
                subtopicName: category.includes('Subtopic') ? selectedSubtopic : undefined,
                targetStudentId: targetStudentId || (role === 'student' ? user?.id : undefined)
            };

            const res = await leaderboardService.getUniversalLeaderboard(params);
            const data = res.data || {};

            setRankings(data.rankings || []);
            setTop5(data.top5 || []);
            setFeaturedRank(data.featuredRank || null);
            setApCourses(data.apCourses || []);
            setFullLengthTests(data.fullLengthTests || []);
            setAssignedCount(typeof data.assignedCount === 'number' ? data.assignedCount : null);
            setCompletedCount(typeof data.completedCount === 'number' ? data.completedCount : null);
            setHighestScore(data.highestScore ?? null);
            setAverageScore(typeof data.averageScore === 'number' ? data.averageScore : null);

            if (category.startsWith('Full-Length Test') && (selectedTestCourseId === 'all' || !data.fullLengthTests?.some(t => t.id.toString() === selectedTestCourseId)) && data.fullLengthTests?.length > 0) {
                setSelectedTestCourseId(data.fullLengthTests[0].id.toString());
            }
        } catch (err) {
            console.error('Failed to load universal leaderboard:', err);
        } finally {
            setLoading(false);
        }
    };

    // Helper for Rank Badge
    const getRankDisplay = (rank) => {
        if (rank === 1) return <span className="text-xl">🥇</span>;
        if (rank === 2) return <span className="text-xl">🥈</span>;
        if (rank === 3) return <span className="text-xl">🥉</span>;
        return <span className="font-black text-slate-400 text-sm">#{rank}</span>;
    };

    const isTopicOrSubtopic = category.includes('Topic') || category.includes('Subtopic');
    const podiumRank1 = top5[0] || null;
    const podiumRank2 = top5[1] || null;
    const podiumRank3 = top5[2] || null;

    const effectiveStudentId = targetStudentId || (role === 'student' ? user?.id : null);

    return (
        <div className="w-full bg-[#0B0D14] text-white p-4 sm:p-8 rounded-[32px] font-sans border border-slate-800 shadow-2xl">
            {/* Header Title Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-800 pb-6">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                            <SafeIcon icon={FiAward} className="w-6 h-6" />
                        </div>
                        {title}
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">{subtitle}</p>
                </div>

                {/* Filter Selector Controls Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full md:w-auto">
                    {/* Category Selector */}
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Category</label>
                        <select
                            value={category}
                            onChange={(e) => {
                                setCategory(e.target.value);
                                setSelectedApCourseId('all');
                                setSelectedTestCourseId('all');
                            }}
                            className="px-4 py-2.5 bg-[#141824] border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Group Scope Selector (For Admin & Tutor) */}
                    {(role === 'admin' || role === 'tutor') && groupsList.length > 0 && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Group</label>
                            <select
                                value={selectedGroupId}
                                onChange={(e) => setSelectedGroupId(e.target.value)}
                                className="px-4 py-2.5 bg-[#141824] border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                            >
                                <option value="all">All Groups</option>
                                {groupsList.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Secondary AP Selector */}
                    {category.startsWith('AP') && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AP Course</label>
                            <select
                                value={selectedApCourseId}
                                onChange={(e) => setSelectedApCourseId(e.target.value)}
                                className="px-4 py-2.5 bg-[#141824] border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                            >
                                <option value="all">All AP Courses</option>
                                {apCourses.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Secondary Full-Length Test Selector */}
                    {category.startsWith('Full-Length Test') && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Select Test</label>
                            <select
                                value={selectedTestCourseId}
                                onChange={(e) => setSelectedTestCourseId(e.target.value)}
                                className="px-4 py-2.5 bg-[#141824] border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                            >
                                <option value="all">All Full-Length Tests</option>
                                {fullLengthTests.map(t => (
                                    <option key={t.id} value={t.id.toString()}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Dependent Topic Selector */}
                    {isTopicOrSubtopic && topicsList.length > 0 && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Topic</label>
                            <select
                                value={selectedTopic}
                                onChange={(e) => setSelectedTopic(e.target.value)}
                                className="px-4 py-2.5 bg-[#141824] border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                            >
                                {topicsList.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Dependent Subtopic Selector */}
                    {category.includes('Subtopic') && subtopicsList.length > 0 && (
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtopic</label>
                            <select
                                value={selectedSubtopic}
                                onChange={(e) => setSelectedSubtopic(e.target.value)}
                                className="px-4 py-2.5 bg-[#141824] border border-slate-700 rounded-xl text-white text-xs font-bold focus:ring-2 focus:ring-green-500 focus:outline-none cursor-pointer"
                            >
                                {subtopicsList.map(st => (
                                    <option key={st} value={st}>{st}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Featured Rank Banner (for Student or Parent) */}
            {(role === 'student' || role === 'parent') && featuredRank && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-6 mb-8 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl relative overflow-hidden ${
                        role === 'parent'
                            ? 'bg-gradient-to-r from-purple-950/80 via-indigo-900/60 to-slate-900 border-purple-500/40'
                            : 'bg-gradient-to-r from-blue-950/80 via-indigo-900/60 to-slate-900 border-blue-500/40'
                    }`}
                >
                    <div className="flex items-center gap-5 relative z-10">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl ${
                            role === 'parent'
                                ? 'bg-purple-600/30 text-purple-300 border border-purple-400/30'
                                : 'bg-blue-600/30 text-blue-300 border border-blue-400/30'
                        }`}>
                            #{featuredRank.rank}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                    role === 'parent' ? 'text-purple-400' : 'text-blue-400'
                                }`}>
                                    {role === 'parent' ? 'YOUR CHILD' : 'YOUR RANK'}
                                </span>
                                {role === 'student' && selectedGroupId !== 'all' && (
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-md text-[9px] font-bold border border-blue-500/30">
                                        Group Rank #{featuredRank.rank}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl sm:text-2xl font-black text-white">{featuredRank.name}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Accuracy: <span className="text-white font-bold">{featuredRank.accuracy}%</span> • Correct: <span className="text-white font-bold">{featuredRank.totalCorrect || 0}/{featuredRank.totalQuestions || 0}</span> • Attempts: <span className="text-white font-bold">{featuredRank.completedTests || 0}</span>
                            </p>
                        </div>
                    </div>
                    <div className="text-left sm:text-right relative z-10">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category Score</span>
                        <p className="text-2xl sm:text-3xl font-black text-white mt-0.5">{featuredRank.scoreDisplay}</p>
                    </div>
                </motion.div>
            )}

            {(role === 'student' || role === 'parent') && !featuredRank && !loading && (
                <div className="p-5 mb-8 rounded-2xl border border-slate-700 bg-[#141824] text-center text-sm font-semibold text-slate-400">
                    {role === 'parent' ? 'Your child has' : 'You have'} not completed this test/category yet.
                </div>
            )}

            {/* Loading State */}
            {loading ? (
                <div className="py-24 text-center">
                    <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-400 font-medium text-sm">Calculating rankings for selected category...</p>
                </div>
            ) : (
                <>
                    {/* Top 5 Podium Section */}
                    {top5.length > 0 && (
                        <div className="mb-12">
                            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest text-center mb-6">
                                Top 5 Performers
                            </h3>

                            {/* Top 3 Elevated Podium */}
                            <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl mx-auto mb-6">
                                {/* Rank 2 (Silver - Left) */}
                                {podiumRank2 ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-[#141824] border border-slate-700/80 rounded-2xl p-4 text-center shadow-lg relative flex flex-col items-center h-44 justify-between"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-slate-700/60 border border-slate-500 flex items-center justify-center text-sm shadow-md -mt-7">
                                            🥈
                                        </div>
                                        <div>
                                            <p className="text-xs sm:text-sm font-black text-white truncate max-w-[110px]">{podiumRank2.name}</p>
                                            <p className="text-lg font-black text-slate-200 mt-1">{podiumRank2.scoreDisplay}</p>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold">Accuracy {podiumRank2.accuracy}%</div>
                                    </motion.div>
                                ) : <div className="h-44" />}

                                {/* Rank 1 (Gold - Center Elevated) */}
                                {podiumRank1 ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-gradient-to-b from-amber-500/20 via-[#181C2B] to-[#141824] border-2 border-amber-500/60 rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(245,158,11,0.2)] relative flex flex-col items-center h-52 justify-between"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-amber-500/30 border border-amber-400 flex items-center justify-center text-xl shadow-lg -mt-8">
                                            🥇
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest">#1 CHAMPION</span>
                                            <p className="text-sm sm:text-base font-black text-white truncate max-w-[130px] mt-0.5">{podiumRank1.name}</p>
                                            <p className="text-2xl font-black text-amber-300 mt-1">{podiumRank1.scoreDisplay}</p>
                                        </div>
                                        <div className="text-[10px] text-amber-200/80 font-bold">Accuracy {podiumRank1.accuracy}%</div>
                                    </motion.div>
                                ) : <div className="h-52" />}

                                {/* Rank 3 (Bronze - Right) */}
                                {podiumRank3 ? (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-[#141824] border border-amber-900/40 rounded-2xl p-4 text-center shadow-lg relative flex flex-col items-center h-40 justify-between"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-amber-900/40 border border-amber-700 flex items-center justify-center text-sm shadow-md -mt-7">
                                            🥉
                                        </div>
                                        <div>
                                            <p className="text-xs sm:text-sm font-black text-white truncate max-w-[110px]">{podiumRank3.name}</p>
                                            <p className="text-lg font-black text-amber-400 mt-1">{podiumRank3.scoreDisplay}</p>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold">Accuracy {podiumRank3.accuracy}%</div>
                                    </motion.div>
                                ) : <div className="h-40" />}
                            </div>

                            {/* Rank 4 & 5 Cards */}
                            {top5.length > 3 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                                    {top5.slice(3, 5).map(st => (
                                        <div key={st.student_id} className="bg-[#141824] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-extrabold text-xs text-slate-400">
                                                    #{st.rank}
                                                </span>
                                                <span className="font-bold text-sm text-white truncate max-w-[120px]">{st.name}</span>
                                            </div>
                                            <span className="font-extrabold text-sm text-slate-200">{st.scoreDisplay}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* All Students Ranking Table */}
                    <div className="bg-[#111420] rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                        <div className="p-5 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">All Students Ranking</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-end">
                                {assignedCount !== null && (
                                    <span className="text-xs font-bold text-slate-400">Assigned: {assignedCount}</span>
                                )}
                                {completedCount !== null && (
                                    <span className="text-xs font-bold text-slate-400">Completed: {completedCount}</span>
                                )}
                                {highestScore !== null && (
                                    <span className="text-xs font-bold text-slate-400">Highest: {highestScore}</span>
                                )}
                                {averageScore !== null && (
                                    <span className="text-xs font-bold text-slate-400">Average: {averageScore}</span>
                                )}
                                <span className="text-xs font-bold text-slate-400">{rankings.length} Ranked Students</span>
                            </div>
                        </div>

                        {rankings.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 text-sm font-medium">
                                No students have completed this test/category yet. Once students submit it, rankings will appear here.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#0B0D14] text-[10px] uppercase tracking-widest text-slate-400 border-b border-slate-800">
                                        <tr>
                                            <th className="py-4 px-6 font-black">Rank</th>
                                            <th className="py-4 px-6 font-black">Student</th>
                                            {isTopicOrSubtopic ? (
                                                <>
                                                    <th className="py-4 px-6 font-black">Scaled Score</th>
                                                    <th className="py-4 px-6 font-black">Accuracy</th>
                                                    <th className="py-4 px-6 font-black">Correct</th>
                                                    <th className="py-4 px-6 font-black">Questions</th>
                                                    <th className="py-4 px-6 font-black">Attempts</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="py-4 px-6 font-black">Score</th>
                                                    <th className="py-4 px-6 font-black">Accuracy</th>
                                                    <th className="py-4 px-6 font-black">Tests Completed</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {rankings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(st => {
                                            const isHighlight = effectiveStudentId && String(st.student_id) === String(effectiveStudentId);
                                            return (
                                                <tr
                                                    key={st.student_id}
                                                    className={`transition-colors ${
                                                        isHighlight 
                                                            ? 'bg-blue-600/15 border-l-4 border-l-blue-500 font-bold' 
                                                            : 'hover:bg-[#161A29]'
                                                    }`}
                                                >
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-2">
                                                            {getRankDisplay(st.rank)}
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-white">{st.name}</span>
                                                            {isHighlight && (
                                                                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-[9px] font-black tracking-wider uppercase border border-blue-500/30">
                                                                    {role === 'parent' ? 'CHILD' : 'YOU'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    {isTopicOrSubtopic ? (
                                                        <>
                                                            <td className="py-4 px-6 font-black text-white">{st.scoreDisplay}</td>
                                                            <td className="py-4 px-6 font-black text-green-400">{st.accuracy}%</td>
                                                            <td className="py-4 px-6 font-semibold text-slate-300">{st.totalCorrect || 0}</td>
                                                            <td className="py-4 px-6 font-semibold text-slate-400">{st.totalQuestions || 0}</td>
                                                            <td className="py-4 px-6 font-semibold text-slate-400">{st.completedTests || 0}</td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td className="py-4 px-6 font-black text-white">{st.scoreDisplay}</td>
                                                            <td className="py-4 px-6 font-semibold text-slate-300">{st.accuracy}%</td>
                                                            <td className="py-4 px-6 font-semibold text-slate-400">{st.completedTests}</td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {rankings.length > PAGE_SIZE && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 text-xs font-bold text-slate-400">
                                <span>
                                    Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rankings.length)} of {rankings.length} students
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1.5 rounded-lg bg-[#141824] border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-500"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-slate-500">
                                        Page {page} of {Math.ceil(rankings.length / PAGE_SIZE)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPage(p => Math.min(Math.ceil(rankings.length / PAGE_SIZE), p + 1))}
                                        disabled={page >= Math.ceil(rankings.length / PAGE_SIZE)}
                                        className="px-3 py-1.5 rounded-lg bg-[#141824] border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-500"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default UniversalLeaderboard;
