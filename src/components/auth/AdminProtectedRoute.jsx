import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiLoader } = FiIcons;

const AdminProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [isStuck, setIsStuck] = useState(false);
  const [forceProceed, setForceProceed] = useState(false);

  // Break loading loop after a more reasonable time for admin
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn('🚨 [AdminProtectedRoute] Admin auth loading stuck - breaking loop');
        setIsStuck(true);
      }, 5000); // 5 seconds instead of 1

      return () => clearTimeout(timeout);
    } else {
      setIsStuck(false);
      setForceProceed(false);
    }
  }, [loading]);

  // Force proceed if we have user data even if loading (helps with _pending_sync)
  useEffect(() => {
    if (loading && user) {
      const timeout = setTimeout(() => {
        console.warn('🚨 [AdminProtectedRoute] Forcing admin access - have user data');
        setForceProceed(true);
      }, 3000); // 3 seconds to allow syncProfile to finish

      return () => clearTimeout(timeout);
    }
  }, [loading, user]);

  // CRITICAL: Admin-specific cache refresh on mount
  useEffect(() => {
    // Force refresh admin cache on every admin route access
    if (user?.role === 'admin') {
      console.log('🔄 [AdminProtectedRoute] Refreshing admin cache');
      
      // Clear any stale loading states
      const adminTimeout = setTimeout(() => {
        if (loading) {
          console.warn('🚨 [AdminProtectedRoute] Admin cache refresh timeout - forcing access');
          setForceProceed(true);
        }
      }, 1500);

      return () => clearTimeout(adminTimeout);
    }
  }, [user?.role, loading]);

  // CRITICAL: Check for email redirect params and handle them immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    
    if (redirect && user?.role === 'admin') {
      console.log('📧 [AdminProtectedRoute] Email redirect detected for admin:', redirect);
      
      // Clear redirect param and navigate immediately
      const url = new URL(window.location.href);
      url.searchParams.delete('redirect');
      const newUrl = url.pathname + url.search + url.hash;
      window.history.replaceState({}, '', newUrl);
      
      // Force navigation without showing loading
      setForceProceed(true);
      setIsStuck(false);
    }
  }, [user?.role, location.search]);

  const userRole = (user?.role ?? '').toString().trim().toLowerCase();
  const isAdmin = userRole === 'admin';

  // CRITICAL: Multiple escape hatches for admin routes
  if (isStuck || (loading && !user)) {
    console.warn('🚨 [AdminProtectedRoute] Breaking admin auth loop - redirecting to login');
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} />;
  }

  // AGGRESSIVE: Force proceed if we have user and admin role, even if loading
  if (forceProceed || (user && isAdmin && loading)) {
    console.log('⚡ [AdminProtectedRoute] Forcing admin access - have admin user');
    // Don't show loading, proceed to admin dashboard
  }

  // Normal loading check (but much shorter for admin)
  if (loading && !isStuck && !forceProceed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <SafeIcon icon={FiLoader} className="w-8 h-8 animate-spin text-[#E53935]" />
          <p className="text-gray-500 text-sm font-medium">Verifying admin access...</p>
          <p className="text-gray-400 text-xs">Admin priority access - loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.warn('🚨 [AdminProtectedRoute] No user found - redirecting to login');
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} />;
  }

  // Account status check - ALL protected routes require an ACTIVE status
  if (user.status === 'pending') {
    console.warn(`⏳ [AdminProtectedRoute] Approval pending for admin ${user.email}. Redirecting to login.`);
    return <Navigate to="/login" replace />;
  }

  // Check admin role
  if (!isAdmin) {
    console.warn('🚨 [AdminProtectedRoute] User is not admin - redirecting');
    const fallbacks = {
      student: '/student',
      tutor: '/tutor',
      parent: '/parent'
    };
    return <Navigate to={fallbacks[userRole] || '/student'} />;
  }

  // Success - render admin content
  console.log('✅ [AdminProtectedRoute] Admin access granted');
  return children;
};

export default AdminProtectedRoute;
