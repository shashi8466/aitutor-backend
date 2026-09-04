import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { parentService } from '../../services/api';
import LoadingSpinner from '../common/LoadingSpinner';

const {
    FiHome, FiGrid, FiBook, FiPieChart, FiBarChart2, FiActivity, FiSettings, FiLogOut, FiMenu, FiX, FiUsers, FiCheck, FiFlag
} = FiIcons;

// Reused as-is from the Student/Tutor sides - the whole point of this shell is that every page
// it mounts is the SAME component a student or tutor already sees, never a parent-specific copy.
// StudentDashboard in particular is the exact page a student sees on their own /student
// dashboard - given a studentId/student prop it renders read-only for that linked student
// instead of the logged-in user.
const StudentDashboard = lazy(() => import('../student/StudentDashboard'));
const TestReview = lazy(() => import('../student/agents/TestReview'));
const TopicReportReview = lazy(() => import('../student/TopicReportReview'));
const DetailedTestReview = lazy(() => import('../student/DetailedTestReview'));
const FullTestReport = lazy(() => import('../common/FullTestReport'));
const UniversalLeaderboard = lazy(() => import('../common/UniversalLeaderboard'));
const WeeklyReport = lazy(() => import('../common/WeeklyReport'));
const ParentDashboardHome = lazy(() => import('./ParentDashboardHome'));
const ParentCourseBreakdown = lazy(() => import('./ParentCourseBreakdown'));
const ParentStudentAnalytics = lazy(() => import('./ParentStudentAnalytics'));
const ParentProfileSettings = lazy(() => import('./ParentProfileSettings'));
const ParentSupport = lazy(() => import('./ParentSupport'));

const SELECTED_STUDENT_KEY_PREFIX = 'parent_selected_student_';

const ParentDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
    const [children, setChildren] = useState([]);
    const [loadingChildren, setLoadingChildren] = useState(true);
    const [selectedStudentId, setSelectedStudentId] = useState(null);

    useEffect(() => {
        if (!user) navigate('/login');
    }, [user, navigate]);

    useEffect(() => {
        const fetchChildren = async () => {
            setLoadingChildren(true);
            try {
                const res = await parentService.getMyChildren();
                const list = res.data?.children || [];
                setChildren(list);

                const storageKey = SELECTED_STUDENT_KEY_PREFIX + user?.id;
                const stored = localStorage.getItem(storageKey);
                const storedStillLinked = stored && list.some(c => String(c.id) === String(stored));
                setSelectedStudentId(storedStillLinked ? stored : (list[0]?.id || null));
            } catch (err) {
                console.error('Failed to load linked children:', err.message);
                setChildren([]);
            } finally {
                setLoadingChildren(false);
            }
        };
        if (user) fetchChildren();
    }, [user]);

    const selectChild = (childId) => {
        setSelectedStudentId(childId);
        localStorage.setItem(SELECTED_STUDENT_KEY_PREFIX + user?.id, childId);
    };

    const selectedChild = children.find(c => String(c.id) === String(selectedStudentId)) || null;

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const menuItems = [
        { path: '/parent', icon: FiHome, label: 'Dashboard', exact: true },
        { path: '/parent/overview', icon: FiGrid, label: 'Overview' },
        { path: '/parent/courses', icon: FiBook, label: 'Course Breakdown' },
        { path: '/parent/test-history', icon: FiPieChart, label: 'Test History & Review' },
        { path: '/parent/leaderboard', icon: FiBarChart2, label: 'Leaderboard' },
        { path: '/parent/analytics', icon: FiActivity, label: 'Student Analytics' },
        { path: '/parent/support', icon: FiFlag, label: 'Help & Support' },
        { path: '/parent/settings', icon: FiSettings, label: 'Profile Settings' },
    ];

    const isActivePath = (path, exact = false) => {
        if (exact) return location.pathname === path;
        return location.pathname.startsWith(path);
    };

    // No student linked yet - nothing downstream has data to show.
    const noChildren = !loadingChildren && children.length === 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Mobile backdrop - dismisses the sidebar on outside click below lg */}
            <div
                onClick={() => setSidebarOpen(false)}
                className={`fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            />

            {/* Sidebar - always mounted, position:fixed spanning the full viewport height
                (top-0 bottom-0, not h-screen+sticky) so it stays visible top-to-bottom no matter
                how tall the routed page's content grows, matching StudentSidebar.jsx's proven
                pattern. Toggled via a plain CSS transform (no framer-motion) since applying a
                framer-motion transform to a sticky/fixed element is what broke this earlier -
                translate-x-0 vs -translate-x-full is enough for the mobile slide in/out. */}
            <aside
                className={`fixed top-0 bottom-0 left-0 w-72 shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out
                    lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                        <div className="p-6 pb-0 shrink-0">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                                        <SafeIcon icon={FiUsers} className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Parent Portal</h2>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Parent: {user?.name || 'Parent'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                                >
                                    <SafeIcon icon={FiX} className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Student Switcher - exactly one student active at a time across the whole portal */}
                            <div className="mb-6">
                                <p className="px-1 text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Students</p>
                                {loadingChildren ? (
                                    <div className="px-3 py-2 text-xs text-gray-400">Loading...</div>
                                ) : noChildren ? (
                                    <div className="px-3 py-2 text-xs text-gray-400">No students linked yet.</div>
                                ) : (
                                    <div className="space-y-1">
                                        {children.map(child => {
                                            const active = String(child.id) === String(selectedStudentId);
                                            return (
                                                <button
                                                    key={child.id}
                                                    onClick={() => selectChild(child.id)}
                                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${active
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'}`}
                                                >
                                                    <span className="flex items-center gap-2 truncate">
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${active ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                                        <span className="truncate">{child.name || 'Student'}</span>
                                                    </span>
                                                    {active && <SafeIcon icon={FiCheck} className="w-4 h-4 flex-shrink-0" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <nav className="flex-1 overflow-y-auto px-6 space-y-1">
                            {menuItems.map((item) => (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${isActivePath(item.path, item.exact)
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-200 dark:shadow-none'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <SafeIcon icon={item.icon} className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            ))}
                        </nav>

                        <div className="p-6 pt-6 shrink-0 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                                    {(user?.name || 'P').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.name || 'Parent'}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-200 dark:border-red-800"
                            >
                                <SafeIcon icon={FiLogOut} className="w-5 h-5" />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
            </aside>

            {/* Content column - offset by the sidebar's fixed width on lg+, full width below
                that (sidebar overlays as a slide-in panel there). */}
            <div className="lg:ml-72 flex flex-col min-h-screen">
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            <SafeIcon icon={sidebarOpen ? FiX : FiMenu} className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                {menuItems.find(item => isActivePath(item.path, item.exact))?.label || 'Dashboard'}
                            </h1>
                            {location.pathname !== '/parent/settings' && location.pathname !== '/parent/support' && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Viewing: {selectedChild?.name || (loadingChildren ? 'Loading...' : 'No student selected')}
                                </p>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 overflow-auto">
                    {location.pathname === '/parent/settings' || location.pathname === '/parent/support' ? (
                        // Account-level, not student-scoped - always reachable, even before any
                        // child is linked/selected.
                        <Suspense fallback={<LoadingSpinner fullPage={false} />}>
                            <Routes>
                                <Route path="settings" element={<ParentProfileSettings />} />
                                <Route path="support" element={<ParentSupport />} />
                            </Routes>
                        </Suspense>
                    ) : noChildren ? (
                        <div className="py-16 text-center bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400 font-medium">No student accounts are linked to this parent profile yet.</p>
                        </div>
                    ) : loadingChildren || !selectedStudentId ? (
                        <LoadingSpinner fullPage={false} />
                    ) : (
                        <Suspense fallback={<LoadingSpinner fullPage={false} />}>
                            <Routes>
                                <Route index element={<StudentDashboard studentId={selectedStudentId} student={selectedChild} />} />
                                <Route path="overview" element={<ParentDashboardHome studentId={selectedStudentId} student={selectedChild} />} />
                                <Route path="courses" element={<ParentCourseBreakdown studentId={selectedStudentId} student={selectedChild} />} />
                                <Route path="test-history" element={<TestReview studentId={selectedStudentId} basePath="/parent" parentMode />} />
                                <Route path="topic-report/:studentId/:courseId" element={<TopicReportReview parentMode />} />
                                <Route path="detailed-review/:submissionId" element={<DetailedTestReview />} />
                                <Route path="report/:submissionId" element={<FullTestReport adminMode={true} />} />
                                <Route
                                    path="leaderboard"
                                    element={
                                        <UniversalLeaderboard
                                            role="parent"
                                            targetStudentId={selectedStudentId}
                                            title={`${selectedChild?.name || 'Student'}'s Leaderboard Rank`}
                                            subtitle="Compare performance with peer rankings across SAT, AP, and Full-Length Tests."
                                        />
                                    }
                                />
                                <Route path="analytics" element={<ParentStudentAnalytics studentId={selectedStudentId} student={selectedChild} />} />
                                {/* Reached from weekly-digest emails (notificationOutbox.js), independent of the
                                    sidebar's currently-selected student - keeps its own studentId from the URL. */}
                                <Route path="weekly-report/:studentId/:weekStart" element={<WeeklyReport isParentView={true} />} />
                            </Routes>
                        </Suspense>
                    )}
                </main>
            </div>
        </div>
    );
};

export default ParentDashboard;
