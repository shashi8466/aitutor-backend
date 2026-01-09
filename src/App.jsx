import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/layout/Navbar';
import HomePage from './components/layout/HomePage';
import Login from './components/auth/Login';
import Signup from './components/auth/Signup';
import StudentDashboard from './components/student/StudentDashboard';
import StudentCourseList from './components/student/StudentCourseList';
import CourseView from './components/student/CourseView';
import LevelDashboard from './components/student/LevelDashboard';
import VideoPlayer from './components/student/VideoPlayer';
import QuizInterface from './components/student/QuizInterface';
import AdminDashboard from './components/admin/AdminDashboard';
import ProtectedRoute from './components/auth/ProtectedRoute';
import StudentLayout from './components/layout/StudentLayout';
import ContactPage from './components/layout/ContactPage';
import Leaderboard from './components/student/Leaderboard';
import Worksheets from './components/student/Worksheets';
import StudentSettings from './components/student/StudentSettings';
import Support from './components/student/Support';
import StudentCalendar from './components/student/StudentCalendar';
import AITutorAgent from './components/student/agents/AITutorAgent';
import StudyPlanPage from './components/student/agents/StudyPlanPage';
import WeaknessDrills from './components/student/agents/WeaknessDrills';
import TestReview from './components/student/agents/TestReview';
import CollegeAdvisor from './components/student/agents/CollegeAdvisor';
import ParentConnect from './components/student/agents/ParentConnect';
import PaymentSuccess from './components/student/PaymentSuccess';
import SalesBot from './components/common/SalesBot';

//============================================
// CRITICAL: Configure Axios Base URL
//============================================
import axios from 'axios';

// FIXED: Use relative path by default to allow Vite Proxy to handle routing.
// This is essential for WebContainer/StackBlitz environments.
// FIXED: Force Render URL on Firebase hosting, use relative path on localhost
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const isFirebase = window.location.hostname.includes('aitutor-4431c') || window.location.hostname.includes('firebaseapp.com');
const PROD_URL = 'https://aitutor-backend-u7h3.onrender.com';

const BACKEND_URL = isFirebase ? PROD_URL : (import.meta.env.VITE_BACKEND_URL || '');

console.log('📡 [API Connectivity]');
console.log('  - Hostname:', window.location.hostname);
console.log('  - Environment:', isLocal ? 'Local Development' : isFirebase ? 'Production (Firebase)' : 'Unknown');
console.log('  - Backend URL:', BACKEND_URL || '(Relative Path / Proxy)');

axios.defaults.baseURL = BACKEND_URL;
axios.defaults.withCredentials = true;

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log(`📡 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('📡 Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
axios.interceptors.response.use(
  (response) => {
    // console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response.status}`);
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

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isStudentRoute = location.pathname.startsWith('/student');
  const isAuthRoute = location.pathname === '/login' || location.pathname === '/signup';
  const showNavbar = !isAdminRoute && !isStudentRoute && !isAuthRoute;

  return (
    <div className="app-container">
      {showNavbar && <Navbar />}
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
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
            <Route path="course/:courseId" element={<CourseView />} />
            <Route path="course/:courseId/level/:level" element={<LevelDashboard />} />
            <Route path="course/:courseId/level/:level/video" element={<VideoPlayer />} />
            <Route path="course/:courseId/level/:level/quiz" element={<QuizInterface />} />

            {/* New Sidebar Features */}
            <Route path="calendar" element={<StudentCalendar />} />
            <Route path="worksheets" element={<Worksheets />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="settings" element={<StudentSettings />} />
            <Route path="support" element={<Support />} />

            {/* AI Agents */}
            <Route path="tutor" element={<AITutorAgent />} />
            <Route path="plan" element={<StudyPlanPage />} />
            <Route path="drills" element={<WeaknessDrills />} />
            <Route path="test-review" element={<TestReview />} />
            <Route path="college" element={<CollegeAdvisor />} />
            <Route path="parent" element={<ParentConnect />} />

            {/* Payment */}
            <Route path="payment-success" element={<PaymentSuccess />} />
          </Route>

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AnimatePresence>
      {!isAdminRoute && !isStudentRoute && <SalesBot />}
    </div>
  );
}

export default App;