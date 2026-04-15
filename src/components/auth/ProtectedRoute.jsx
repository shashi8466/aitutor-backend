import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiLoader } = FiIcons;

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isStuck, setIsStuck] = useState(false);
  const [showError, setShowError] = useState(false);

  // CRITICAL: Break loading loop after 5 seconds
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn(' [ProtectedRoute] Auth loading stuck - breaking loop');
        setIsStuck(true);
        
        // Show error message after 8 seconds
        const errorTimeout = setTimeout(() => {
          setShowError(true);
        }, 3000);
        
        return () => clearTimeout(errorTimeout);
      }, 5000); // 5 second timeout

      return () => clearTimeout(timeout);
    } else {
      setIsStuck(false);
      setShowError(false);
    }
  }, [loading]);

  const requestedRole = role ? role.toString().trim().toLowerCase() : null;
  const userRole = (user?.role ?? '').toString().trim().toLowerCase();

  // If stuck in loading, show helpful error with retry option
  if (isStuck && !user) {
    console.warn(' [ProtectedRoute] Breaking auth loop - showing error');
    
    if (showError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <SafeIcon icon={FiIcons.FiAlertCircle} className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Issue</h2>
            <p className="text-gray-600 mb-6">
              We're having trouble connecting to the server. This might be due to network issues or high server load.
            </p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <SafeIcon icon={FiIcons.FiRefreshCw} className="inline w-4 h-4 mr-2" />
                Retry Connection
              </button>
              <button 
                onClick={() => {
                  localStorage.clear();
                  window.location.reload();
                }}
                className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Clear Cache & Reload
              </button>
              <a 
                href="/login"
                className="block w-full px-6 py-3 text-center text-gray-600 hover:text-gray-800 transition-colors"
              >
                Back to Login
              </a>
            </div>
          </div>
        </div>
      );
    }
    
    // Still waiting during stuck state
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <SafeIcon icon={FiIcons.FiLoader} className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Setting up your session...</p>
          <p className="text-sm text-gray-400 mt-2">This shouldn't take more than a few seconds</p>
        </div>
      </div>
    );
  }

  // If we have a user but still loading for more than 2 seconds, proceed anyway
  if (loading && user) {
    console.log(' [ProtectedRoute] Have user but loading - proceeding to prevent loop');
    // Don't return anything, let the component render below
  }

  if (!user) {
    // Prefer the explicit redirect query param coming from emails (works with HashRouter too).
    // It should look like: redirect=/student/detailed-review/<submissionId>
    const query = new URLSearchParams(window.location.search);
    const redirectFromEmail = query.get('redirect');

    if (redirectFromEmail) {
      let target = redirectFromEmail;
      try {
        target = decodeURIComponent(redirectFromEmail);
      } catch {
        // keep as-is
      }
      if (!target.startsWith('/')) target = `/${target}`;
      return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} />;
    }

    // Fallback: if the user clicked a HashRouter deep-link, the route is in `window.location.hash`.
    // Example hash: `#/student/detailed-review/118`
    const hash = window.location.hash || '';
    if (hash.startsWith('#')) {
      const hashTarget = hash.replace(/^#/, ''); // "/student/..."
      if (hashTarget) {
        const target = hashTarget.startsWith('/') ? hashTarget : `/${hashTarget}`;
        return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} />;
      }
    }

    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} />;
  }

  // Account status check - ALL protected routes require an ACTIVE status
  if (user.status === 'pending') {
    console.warn(`⏳ [ProtectedRoute] Approval pending for ${user.email}. Redirecting to login.`);
    return <Navigate to="/login" replace />;
  }
  
  if (user.status === 'suspended' || user.status === 'inactive') {
    console.warn(`🚨 [ProtectedRoute] Account ${user.status} for ${user.email}. Redirecting to login.`);
    return <Navigate to="/login" replace />;
  }

  // Prevent redirect loops during the first render after signup or refresh.
  // Supabase may briefly set role to `authenticated` (or an empty value),
  // while the user is actually expected to be a different role.
  if (requestedRole && userRole !== requestedRole) {
    // If we're STILL SYNCING (pending sync), don't redirect yet!
    // This gives syncProfile a chance to finish and set the correct role.
    if (loading || user._pending_sync || user._optimistic) {
      console.log(`⏳ [ProtectedRoute] Role mismatch but pending sync - waiting for correct role (${requestedRole})`);
      
      // If we are definitely a student and requesting student, proceed
      if (requestedRole === 'student' && (!userRole || userRole === 'authenticated')) {
        return children;
      }
      
      // Otherwise stay on loading screen to prevent jumpy redirects
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col items-center gap-3">
            <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-[#E53935]" />
            <p className="text-gray-500 text-sm font-medium">Verifying access rights...</p>
          </div>
        </div>
      );
    }

    const fallbacks = {
      admin: '/admin',
      tutor: '/tutor',
      parent: '/parent',
      student: '/student'
    };
    console.warn(`🚨 [ProtectedRoute] Unauthorized: ${userRole} != ${requestedRole}. Redirecting to ${fallbacks[userRole] || '/student'}`);
    return <Navigate to={fallbacks[userRole] || '/student'} />;
  }

  return children;
};

export default ProtectedRoute;