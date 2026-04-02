import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import supabase from './supabase/supabase';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminProtectedRoute from './components/auth/AdminProtectedRoute';
import StudentLayout from './components/layout/StudentLayout';
import LoadingSpinner from './components/common/LoadingSpinner';

// Lazy imports for pages
const HomePage = lazy(() => import('./components/layout/HomePage'));
const UnifiedLogin = lazy(() => import('./components/auth/UnifiedLogin'));
const Signup = lazy(() => import('./components/auth/Signup'));
const ContactPage = lazy(() => import('./components/layout/ContactPage'));

// Student Pages
const StudentDashboard = lazy(() => import('./components/student/StudentDashboard'));
const StudentCourseList = lazy(() => import('./components/student/StudentCourseList'));
const CourseView = lazy(() => import('./components/student/CourseView'));
const LevelDashboard = lazy(() => import('./components/student/LevelDashboard'));
const VideoPlayer = lazy(() => import('./components/student/VideoPlayer'));
const QuizInterface = lazy(() => import('./components/student/QuizInterface'));
const Leaderboard = lazy(() => import('./components/student/Leaderboard'));
const StudentSettings = lazy(() => import('./components/student/StudentSettings'));
const Support = lazy(() => import('./components/student/Support'));
const StudentCalendar = lazy(() => import('./components/student/StudentCalendar'));
const EnrollmentKeyInput = lazy(() => import('./components/student/EnrollmentKeyInput'));
const AITutorAgent = lazy(() => import('./components/student/agents/AITutorAgent'));
const StudyPlanPage = lazy(() => import('./components/student/agents/StudyPlanPage'));
const WeaknessDrills = lazy(() => import('./components/student/agents/WeaknessDrills'));
const TestReview = lazy(() => import('./components/student/agents/TestReview'));
const CollegeAdvisor = lazy(() => import('./components/student/agents/CollegeAdvisor'));
const ParentConnect = lazy(() => import('./components/student/agents/ParentConnect'));
const PaymentSuccess = lazy(() => import('./components/student/PaymentSuccess'));
const PracticeTests = lazy(() => import('./components/student/PracticeTests'));
const DetailedTestReview = lazy(() => import('./components/student/DetailedTestReview'));
const WeeklyReport = lazy(() => import('./components/common/WeeklyReport'));
const SalesBot = lazy(() => import('./components/common/SalesBot'));

// Notification Components - ADMIN ONLY
// const NotificationPreferences = lazy(() => import('./components/common/NotificationPreferences'));
// const NotificationHistory = lazy(() => import('./components/common/NotificationHistory'));
// Students cannot manage their own notifications - Admin controls all

// Dashboards
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const AdminNotificationManager = lazy(() => import('./components/admin/AdminNotificationManager'));
const TutorDashboard = lazy(() => import('./components/tutor/TutorDashboard'));
const ParentDashboard = lazy(() => import('./components/parent/ParentDashboard'));


//============================================
// CRITICAL: Configure Axios Base URL
//============================================
import axios from 'axios';

// FIXED: Use relative path by default to allow Vite Proxy to handle routing.
// This is essential for WebContainer/StackBlitz environments.
// FIXED: Force Render URL on Firebase hosting, use relative path on localhost
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isFirebase =
  window.location.hostname.includes('aitutor-4431c') ||
  window.location.hostname.includes('firebaseapp.com') ||
  window.location.hostname.includes('web.app');

const PROD_URL = 'https://aitutor-backend-u7h3.onrender.com';

// Priority: 1. Environment Variable, 2. Production URL (if on Firebase), 3. Relative path (Local)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ((isFirebase || !isLocal) ? PROD_URL : '');

console.log('📡 [API Connectivity]');
console.log('  - Hostname:', window.location.hostname);
console.log('  - Environment:', isLocal ? 'Local Development' : isFirebase ? 'Production (Firebase)' : 'Unknown');
console.log('  - Backend URL:', BACKEND_URL || '(Relative Path / Proxy)');
console.log('  - Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('  - Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('  - NODE_ENV:', import.meta.env.NODE_ENV);

axios.defaults.baseURL = BACKEND_URL;
axios.defaults.withCredentials = true;
// CRITICAL FIX: Add global timeout to prevent hanging requests
axios.defaults.timeout = 15000; // 15 seconds timeout for all requests

// Add request interceptor for auth and debugging
axios.interceptors.request.use(
  async (config) => {
    // console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.url}`);

    try {
      // Get the session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (error) {
      console.error('📡 Auth Interceptor Error:', error);
    }

    return config;
  },
  (error) => {
    console.error('📡 Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging and retry logic
const retryRequests = new Map(); // Track retry attempts

axios.interceptors.response.use(
  (response) => {
    // console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  async (error) => {
    const config = error.config;
    
    // Handle timeout errors specifically
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error(`⏰ API Timeout: ${config.method?.toUpperCase()} ${config.url} - Request took too long (>15s)`);
      
      // Check if we should retry
      if (!config.__retryCount) {
        config.__retryCount = 0;
      }
      
      // Retry once for timeout errors
      if (config.__retryCount < 1 && !config.skipRetry) {
        config.__retryCount++;
        console.log(`🔄 Retrying request (${config.__retryCount}/1): ${config.url}`);
        
        // Add a small delay before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return axios(config);
      }
    }
    
    // Handle other errors
    if (error.response) {
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config.url} - ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else if (error.request) {
      console.error('❌ Network Error: No response received', error.message);
    } else {
      console.error('❌ Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);
//============================================
// Home Redirector Component
//============================================
const HomeRedirector = () => {
  const { user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (loading) return;

    // 1. Check for explicit redirect query param (both pre-hash and post-hash)
    const browserParams = new URLSearchParams(window.location.search);
    const queryRedirect = searchParams.get('redirect') || browserParams.get('redirect');
    
    if (queryRedirect) {
      let targetPath = queryRedirect;
      try {
        if (/%2F/i.test(targetPath)) targetPath = decodeURIComponent(targetPath);
      } catch { /* ignore */ }
      
      const finalTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;

      // Clear redirect param to prevent loops
      if (window.location.search.includes('redirect=')) {
        console.log('🧹 [Home] Stripping redirect param');
        const url = new URL(window.location.href);
        url.searchParams.delete('redirect');
        const newUrl = url.pathname + url.search + url.hash; // Preserve hash and other params
        window.history.replaceState({}, '', newUrl);
      }

      if (user) {
        console.log('🚀 [Home] Auth user redirecting to:', finalTarget);
        navigate(finalTarget, { replace: true });
      } else {
        console.log('🔑 [Home] Unauth user redirecting to login, then:', finalTarget);
        navigate(`/login?redirect=${encodeURIComponent(finalTarget)}`, { replace: true });
      }
      return;
    }

    if (user) {
       // 2. Default Role Redirection
       const roleMap = { admin: '/admin', tutor: '/tutor', parent: '/parent', student: '/student' };
       navigate(roleMap[user.role] || '/student', { replace: true });
    }
  }, [user, loading, searchParams, navigate]);
  
  if (loading) return <LoadingSpinner />;
  if (!user) return <HomePage />;
  return <LoadingSpinner />; // UI bridge
};

//============================================
// App Component
//============================================
const App = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isStudentRoute = location.pathname.startsWith('/student');
  const isTutorRoute = location.pathname.startsWith('/tutor');
  const isAuthRoute = location.pathname.startsWith('/login') || location.pathname.startsWith('/signup');
  const isHomeRoute = location.pathname === '/';
  const showNavbar = !isAdminRoute && !isStudentRoute && !isTutorRoute && !isAuthRoute && !isHomeRoute;

  return (
    <div className="app-container">
      {showNavbar && <Navbar />}
      <AnimatePresence mode="wait">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes location={location} key={location.pathname}>
            {/* Public Routes with Auto-Redirection for Auth Users */}
            <Route path="/" element={<HomeRedirector />} />

            {/* Unified Authentication Route */}
            <Route path="/login" element={<UnifiedLogin />} />

            {/* Redirect legacy role-specific login paths to unified login */}
            <Route path="/login/admin" element={<UnifiedLogin />} />
            <Route path="/login/tutor" element={<UnifiedLogin />} />
            <Route path="/login/student" element={<UnifiedLogin />} />
            <Route path="/login/parent" element={<UnifiedLogin />} />

            <Route path="/signup" element={<Signup />} />
            <Route path="/contact" element={<ContactPage />} />

            {/* Student Routes */}
            <Route
              path="/student"
              element={
                <ProtectedRoute role="student">
                  <StudentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentDashboard />} />
              <Route path="courses" element={<StudentCourseList />} />
              <Route path="enroll" element={<EnrollmentKeyInput />} />
              <Route path="course/:courseId" element={<CourseView />} />
              <Route path="course/:courseId/level/:level" element={<LevelDashboard />} />
              <Route path="course/:courseId/level/:level/video" element={<VideoPlayer />} />
              <Route path="course/:courseId/level/:level/quiz" element={<QuizInterface />} />

              {/* New Sidebar Features */}
              <Route path="calendar" element={<StudentCalendar />} />
              <Route path="practice-tests" element={<PracticeTests />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="settings" element={<StudentSettings />} />
              <Route path="support" element={<Support />} />

              {/* AI Agents */}
              <Route path="tutor" element={<AITutorAgent />} />
              <Route path="plan" element={<StudyPlanPage />} />
              <Route path="drills" element={<WeaknessDrills />} />
              <Route path="test-review" element={<TestReview />} />
              <Route path="detailed-review/:submissionId" element={<DetailedTestReview />} />
              <Route path="weekly-report/:weekStart" element={<WeeklyReport />} />
              <Route path="college" element={<CollegeAdvisor />} />
              <Route path="parent" element={<ParentConnect />} />

              {/* Payment */}
              <Route path="payment-success" element={<PaymentSuccess />} />
            </Route>

            {/* Tutor Routes */}
            <Route
              path="/tutor/*"
              element={
                <ProtectedRoute role="tutor">
                  <TutorDashboard />
                </ProtectedRoute>
              }
            />

            {/* Parent Routes */}
            <Route
              path="/parent/*"
              element={
                <ProtectedRoute role="parent">
                  <ParentDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin/*"
              element={
                <AdminProtectedRoute>
                  <AdminDashboard />
                </AdminProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </AnimatePresence>
      <Suspense fallback={null}>
        {!isAdminRoute && !isStudentRoute && !isTutorRoute && !location.pathname.startsWith('/parent') && <SalesBot />}
      </Suspense>
    </div>
  );
}

export default App;