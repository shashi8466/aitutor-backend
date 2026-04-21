import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { planService } from '../../services/api';

const { FiLock, FiStar, FiSlash, FiArrowRight } = FiIcons;

const FeatureGate = ({ children, featureKey }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, allowed, locked

  useEffect(() => {
    if (user) checkAccess();
  }, [user, featureKey]);

  const checkAccess = async () => {
    try {
      const { data } = await planService.getSettings();
      const planSettings = (data || []).find(s => s.plan_type === user.plan_type);
      
      if (planSettings?.[featureKey]) {
        setStatus('allowed');
      } else {
        setStatus('locked');
      }
    } catch (err) {
      console.error("Feature control check failed:", err);
      // Fallback to allowed to prevent breaking the app on minor glitches
      setStatus('allowed');
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Verifying Access...</p>
      </div>
    );
  }

  if (status === 'locked') {
    const isFree = user?.plan_type === 'free';
    
    return (
      <div className="max-w-4xl mx-auto py-20 px-6">
        <div className="bg-white dark:bg-gray-800 rounded-[3rem] p-12 text-center border border-gray-100 dark:border-gray-700 shadow-2xl">
          <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-500/10">
            <SafeIcon icon={isFree ? FiLock : FiSlash} className="w-10 h-10" />
          </div>
          
          <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4">
            {isFree ? 'Premium Feature' : 'Feature Unavailable'}
          </h1>
          
          <p className="text-gray-500 dark:text-gray-400 text-lg max-w-lg mx-auto mb-10 leading-relaxed font-medium">
            {isFree 
              ? "This advanced tool is part of our Premium Suite. Upgrade now to unlock precision-targeted practice and AI-powered insights."
              : "This feature has been currently disabled by the administrator for your plan level. Please contact support if you believe this is an error."}
          </p>

          {isFree ? (
            <button
              onClick={() => navigate('/student/upgrade')}
              className="px-10 py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl flex items-center gap-4 mx-auto"
            >
              <SafeIcon icon={FiStar} className="text-yellow-400" />
              Upgrade to Premium
              <SafeIcon icon={FiArrowRight} />
            </button>
          ) : (
            <button
              onClick={() => navigate('/student')}
              className="px-10 py-5 bg-black dark:bg-white text-white dark:text-black rounded-2xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl mx-auto"
            >
              Return to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  return children;
};

export default FeatureGate;
