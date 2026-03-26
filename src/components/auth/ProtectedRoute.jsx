import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiLoader } = FiIcons;

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // CRITICAL FIX: Show loading spinner while Auth checks status.
  // This prevents redirecting to /login effectively "bouncing" the user
  // and causing the perceived "slowness" or "glitchy" behavior.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <SafeIcon icon={FiLoader} className="w-8 h-8 animate-spin text-[#E53935]" />
          <p className="text-gray-500 text-sm font-medium">Verifying access...</p>
        </div>
      </div>
    );
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

  if (role && user.role !== role) {
    const fallbacks = {
      admin: '/admin',
      tutor: '/tutor',
      parent: '/parent',
      student: '/student'
    };
    return <Navigate to={fallbacks[user.role] || '/student'} />;
  }

  return children;
};

export default ProtectedRoute;