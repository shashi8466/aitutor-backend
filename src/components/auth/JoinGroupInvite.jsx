import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { groupInviteService } from '../../services/api';

const { FiUsers, FiCheckCircle, FiAlertCircle, FiLoader, FiArrowLeft, FiLogOut } = FiIcons;

export const PENDING_GROUP_INVITE_KEY = 'pendingGroupInviteToken';

const JoinGroupInvite = () => {
  const { token } = useParams();
  const { user, loading: authLoading, logout } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [groupInfo, setGroupInfo] = useState(null);
  const [infoError, setInfoError] = useState('');
  const [infoLoading, setInfoLoading] = useState(true);

  const [joinStatus, setJoinStatus] = useState('idle'); // idle | joining | success | already | error
  const [joinError, setJoinError] = useState('');
  const hasAttemptedJoin = useRef(false);

  // Preserve the token across a Login/Sign Up detour so it survives the auth flow.
  useEffect(() => {
    if (token) {
      localStorage.setItem(PENDING_GROUP_INVITE_KEY, token);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await groupInviteService.getInfo(token);
        if (!cancelled) setGroupInfo(res?.data?.group || null);
      } catch (err) {
        if (!cancelled) setInfoError(err?.response?.data?.error || 'This invitation link is invalid or has expired.');
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  // Note: `_pending_sync`/`_optimistic` are set on the user object during profile
  // hydration but are never cleared afterwards (AuthContext's syncProfile spreads
  // the previous user forward without deleting them) - they aren't a reliable
  // "has auth settled" signal here. `loading` alone is what actually flips to
  // false once a session check completes, so gate on that only.
  const authSettled = !authLoading;

  useEffect(() => {
    if (!authSettled || !user || user.role !== 'student' || hasAttemptedJoin.current) return;
    hasAttemptedJoin.current = true;

    (async () => {
      setJoinStatus('joining');
      try {
        const res = await groupInviteService.join(token);
        localStorage.removeItem(PENDING_GROUP_INVITE_KEY);
        setJoinStatus(res?.data?.alreadyMember ? 'already' : 'success');
        setGroupInfo(prev => prev || { name: res?.data?.groupName });
        setTimeout(() => navigate('/student', { replace: true }), 1800);
      } catch (err) {
        setJoinStatus('error');
        setJoinError(err?.response?.data?.error || 'Failed to join the group. Please try again.');
      }
    })();
  }, [authSettled, user, token, navigate]);

  const renderCard = (children) => (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 bg-[#FAFAFA] dark:bg-gray-900 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-6 relative"
      >
        <div className="absolute -top-12 left-0">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#E53935] transition-colors"
          >
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-center">
          {children}
        </div>
      </motion.div>
    </div>
  );

  // Still resolving the invite token itself
  if (infoLoading) {
    return renderCard(
      <div className="flex flex-col items-center gap-3 py-6">
        <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-[#E53935]" />
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Loading invitation…</p>
      </div>
    );
  }

  // Invalid/expired token
  if (infoError) {
    return renderCard(
      <>
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-black dark:text-white mb-2">Invalid Invitation</h2>
        <p className="text-gray-600 dark:text-gray-300">{infoError}</p>
      </>
    );
  }

  // Auth still hydrating - avoid flashing the wrong branch (mirrors ProtectedRoute's guard)
  if (!authSettled) {
    return renderCard(
      <div className="flex flex-col items-center gap-3 py-6">
        <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-[#E53935]" />
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Verifying access rights…</p>
      </div>
    );
  }

  // Logged in, but not a student account
  if (user && user.role !== 'student') {
    return renderCard(
      <>
        <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
        </div>
        <h2 className="text-xl font-bold text-black dark:text-white mb-2">Student Accounts Only</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          You're signed in as a {user.role}. Only student accounts can join a group via this link.
        </p>
        <button
          onClick={() => logout()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm font-bold rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
        >
          <SafeIcon icon={FiLogOut} className="w-4 h-4" />
          Log Out
        </button>
      </>
    );
  }

  // Logged in as student - joining/joined states
  if (user && user.role === 'student') {
    if (joinStatus === 'error') {
      return renderCard(
        <>
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-black dark:text-white mb-2">Couldn't Join Group</h2>
          <p className="text-gray-600 dark:text-gray-300">{joinError}</p>
        </>
      );
    }

    if (joinStatus === 'success' || joinStatus === 'already') {
      return renderCard(
        <>
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiCheckCircle} className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-black dark:text-white mb-2">
            {joinStatus === 'already' ? "You're Already a Member" : 'Congratulations!'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            {joinStatus === 'already'
              ? <>You're already a member of <strong className="text-black dark:text-white">{groupInfo?.name}</strong>.</>
              : <>You've successfully joined <strong className="text-black dark:text-white">{groupInfo?.name}</strong>.</>}
          </p>
          <p className="text-sm text-gray-400">Redirecting to your dashboard…</p>
        </>
      );
    }

    // joining or idle (about to join)
    return renderCard(
      <div className="flex flex-col items-center gap-3 py-6">
        <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-[#E53935]" />
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Joining {groupInfo?.name}…</p>
      </div>
    );
  }

  // Logged out - show the invite and let them log in / sign up
  return renderCard(
    <>
      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <SafeIcon icon={FiUsers} className="w-8 h-8 text-blue-600 dark:text-blue-400" />
      </div>
      <h2 className="text-xl font-bold text-black dark:text-white mb-2">You've Been Invited!</h2>
      <p className="text-gray-600 dark:text-gray-300 mb-6">
        Join <strong className="text-black dark:text-white">{groupInfo?.name}</strong> on{' '}
        <strong className="text-[#E53935]">{settings.appName}</strong>. Log in or create a student account to continue.
      </p>
      <div className="space-y-3">
        <Link
          to="/signup"
          className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-bold rounded-lg text-white bg-[#E53935] hover:bg-[#d32f2f] transition-all"
        >
          Sign Up
        </Link>
        <Link
          to="/login"
          className="w-full inline-flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-gray-600 text-sm font-bold rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
        >
          Log In
        </Link>
      </div>
    </>
  );
};

export default JoinGroupInvite;
