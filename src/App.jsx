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
import PreviewBanner from './components/common/PreviewBanner';

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
const AdaptivePreTest = lazy(() => import('./components/student/AdaptivePreTest'));
const ExamInterface = lazy(() => import('./components/student/ExamInterface'));
const AdaptiveExamInterface = lazy(() => import('./components/student/AdaptiveExamInterface'));
const LegacyQuizInterface = lazy(() => import('./components/student/QuizInterface'));
const Leaderboard = lazy(() => import('./components/student/Leaderboard'));
const StudentSettings = lazy(() => import('./components/student/StudentSettings'));
const Support = lazy(() => import('./components/student/Support'));
const FeatureGate = lazy(() => import('./components/common/FeatureGate'));
const StudentCalendar = lazy(() => import('./components/student/StudentCalendar'));
const EnrollmentKeyInput = lazy(() => import('./components/student/EnrollmentKeyInput'));
const AITutorAgent = lazy(() => import('./components/student/agents/AITutorAgent'));
const StudyPlanPage = lazy(() => import('./components/student/agents/StudyPlanPage'));
const WeaknessDrills = lazy(() => import('./components/student/agents/WeaknessDrills'));
const TestReview = lazy(() => import('./components/student/agents/TestReview'));
const CollegeAdvisor = lazy(() => import('./components/student/agents/CollegeAdvisor'));
const ScorePredictor = lazy(() => import('./components/student/ScorePredictor'));
const ParentConnect = lazy(() => import('./components/student/agents/ParentConnect'));
const PaymentSuccess = lazy(() => import('./components/student/PaymentSuccess'));
const PracticeTests = lazy(() => import('./components/student/PracticeTests'));
const DetailedTestReview = lazy(() => import('./components/student/DetailedTestReview'));
const WeeklyReport = lazy(() => import('./components/common/WeeklyReport'));
const SalesBot = lazy(() => import('./components/common/SalesBot'));
const UpgradePlan = lazy(() => import('./components/student/UpgradePlan'));
const Worksheets = lazy(() => import('./components/student/Worksheets'));
const StudentFeedback = lazy(() => import('./components/student/StudentFeedback'));

// Demo Pages
const PublicDemoCourseView = lazy(() => import('./components/demo/PublicDemoCourseView'));
const PublicDemoQuizInterface = lazy(() => import('./components/demo/PublicDemoQuizInterface'));

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
// Detect local development (localhost, 127.0.0.1, or local network IPs)
const isLocal = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.startsWith('192.168.') || 
  window.location.hostname.startsWith('10.') || 
  window.location.hostname.endsWith('.local');
const isFirebase =
  window.location.hostname.includes('aitutor-4431c') ||
  window.location.hostname.includes('firebaseapp.com') ||
  window.location.hostname.includes('web.app');

const PROD_URL = 'https://aitutor-backend-u7h3.onrender.com';

// Priority: 1. Local Development -> Empty string (uses Vite Proxy)
// 2. Environment Variable -> Use it if provided
// 3. Firebase/Production -> Use PROD_URL
const BACKEND_URL = isLocal ? '' : (import.meta.env.VITE_BACKEND_URL || PROD_URL);

console.log('📡 [API Connectivity]');
console.log('  - Hostname:', window.location.hostname);
console.log('  - Environment:', isLocal ? 'Local Development' : isFirebase ? 'Production (Firebase)' : 'Unknown');
console.log('  - Backend URL:', BACKEND_URL || '(Relative Path / Proxy)');
console.log('  - Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('  - Has Anon Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log('  - NODE_ENV:', import.meta.env.NODE_ENV);

axios.defaults.baseURL = BACKEND_URL;
axios.defaults.withCredentials = true;
// CRITICAL FIX: Increased global timeout to prevent hanging requests and allow for heavy AI processing
axios.defaults.timeout = 60000; // 60 seconds timeout for all requests

// Add request interceptor for auth and debugging
axios.interceptors.request.use(
  async (config) => {
    try {
      // 1. Only add token if it's an API request to our own backend (relative or matching BACKEND_URL)
      const isInternalApi = config.url && (
        config.url.startsWith('/api') || 
        (BACKEND_URL && config.url.startsWith(BACKEND_URL)) ||
        !config.url.startsWith('http')
      );

      if (isInternalApi) {
        // 2. Get the session from Supabase with a timeout to prevent hanging the entire app
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Supabase session request timed out')), 10000)
        );

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        }
      }

      // 🕵️ Preview Mode Header (Synced from AuthContext via localStorage)
      const previewUserId = localStorage.getItem('preview_user_id');
      if (previewUserId && config.headers) {
        config.headers['X-Preview-User-Id'] = previewUserId;
      }
    } catch (error) {
      console.warn('📡 [Auth Interceptor] Non-fatal info:', error.message);
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
      console.error(`⏰ API Timeout: ${config.method?.toUpperCase()} ${config.url} - Request took too long (>60s)`);
      
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
// Quiz Dispatcher (Routes between Old vs New Exam Engine)
//============================================
const QuizDispatcher = () => {
    const [searchParams] = useSearchParams();
    const isPractice = searchParams.get('mode') === 'practice';
    
    // Practice Quiz => Old Legacy Interface (Dark Styled)
    // Take the Quiz => New high-fidelity Exam Interface (Light Styled)
    return isPractice ? <LegacyQuizInterface /> : <ExamInterface />;
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
  const isDemoRoute = location.pathname.startsWith('/demo');
  const isAuthRoute = location.pathname.startsWith('/login') || location.pathname.startsWith('/signup');
  const isHomeRoute = location.pathname === '/';
  const showNavbar = !isAdminRoute && !isStudentRoute && !isTutorRoute && !isAuthRoute && !isHomeRoute && !isDemoRoute;

  return (
    <div className="app-container">
      <PreviewBanner />
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

            {/* Public Demo Routes */}
            <Route path="/demo/:courseId" element={<PublicDemoCourseView />} />
            <Route path="/demo/:courseId/level/:level" element={<PublicDemoQuizInterface />} />

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
              <Route path="adaptive-pre-test/:courseId" element={<AdaptivePreTest />} />
              <Route path="course/:courseId/level/:level" element={<LevelDashboard />} />
              <Route path="adaptive-test/:courseId" element={<AdaptiveExamInterface />} />
              <Route path="course/:courseId/level/:level/video" element={<VideoPlayer />} />
              <Route path="course/:courseId/level/:level/quiz" element={<QuizDispatcher />} />

              {/* New Sidebar Features */}
              <Route path="calendar" element={<StudentCalendar />} />
              <Route path="practice-tests" element={<PracticeTests />} />
              {/* AI Agents */}
              <Route path="tutor" element={<FeatureGate featureKey="feature_ai_tutor"><AITutorAgent /></FeatureGate>} />
              <Route path="plan" element={<FeatureGate featureKey="feature_study_planner"><StudyPlanPage /></FeatureGate>} />
              <Route path="drills" element={<FeatureGate featureKey="feature_weakness_drills"><WeaknessDrills /></FeatureGate>} />
              <Route path="test-review" element={<FeatureGate featureKey="feature_test_review"><TestReview /></FeatureGate>} />
              <Route path="detailed-review/:submissionId" element={<FeatureGate featureKey="feature_test_review"><DetailedTestReview /></FeatureGate>} />
              <Route path="score-predictor" element={<FeatureGate featureKey="feature_score_predictor"><ScorePredictor /></FeatureGate>} />
              <Route path="leaderboard" element={<FeatureGate featureKey="feature_leaderboard"><Leaderboard /></FeatureGate>} />
              <Route path="college" element={<FeatureGate featureKey="feature_college_advisor"><CollegeAdvisor /></FeatureGate>} />
              <Route path="feedback" element={<StudentFeedback />} />
              
              <Route path="settings" element={<StudentSettings />} />
              <Route path="support" element={<Support />} />
              <Route path="weekly-report/:weekStart" element={<WeeklyReport />} />
              <Route path="parent" element={<ParentConnect />} />

              {/* Payment */}
              <Route path="payment-success" element={<PaymentSuccess />} />
              <Route path="upgrade" element={<UpgradePlan />} />
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