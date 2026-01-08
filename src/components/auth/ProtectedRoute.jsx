import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiLoader } = FiIcons;

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth();

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
    return <Navigate to="/login" />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} />;
  }

  return children;
};

export default ProtectedRoute;