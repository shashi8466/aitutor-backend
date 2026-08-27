import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { groupInviteService } from '../../services/api';

const { FiUsers, FiCheckCircle, FiAlertCircle, FiLoader, FiArrowLeft, FiLogOut, FiUserPlus, FiLock, FiShield, FiStar, FiArrowRight } = FiIcons;

// Fixed, hand-placed scatter (not random - a re-shuffle on every render would look jittery) for
// the invite card's decorative sparkle layer. 'shape' picks star icon, round dot, or a thin
// ribbon streamer.
const INVITE_SPARKLES = [
  { top: '8%', left: '10%', rotate: '-15deg', color: 'text-amber-300', shape: 'star', size: 'w-3 h-3' },
  { top: '15%', left: '22%', rotate: '10deg', color: 'text-pink-400', shape: 'ribbon', size: 'w-1 h-4' },
  { top: '6%', left: '38%', rotate: '20deg', color: 'text-sky-300', shape: 'dot', size: 'w-1.5 h-1.5' },
  { top: '4%', left: '58%', rotate: '-10deg', color: 'text-purple-300', shape: 'star', size: 'w-3 h-3' },
  { top: '18%', left: '72%', rotate: '15deg', color: 'text-amber-300', shape: 'dot', size: 'w-2 h-2' },
  { top: '10%', left: '85%', rotate: '-20deg', color: 'text-sky-400', shape: 'dot', size: 'w-1.5 h-1.5' },
  { top: '30%', left: '5%', rotate: '25deg', color: 'text-pink-400', shape: 'ribbon', size: 'w-1 h-4' },
  { top: '28%', left: '92%', rotate: '-25deg', color: 'text-purple-400', shape: 'ribbon', size: 'w-1 h-4' },
  { top: '2%', left: '90%', rotate: '18deg', color: 'text-red-400', shape: 'star', size: 'w-3 h-3' }
];

const InviteSparkles = () => (
  <div className="pointer-events-none absolute inset-x-0 top-0 h-40 overflow-hidden">
    {INVITE_SPARKLES.map((s, i) => (
      <span
        key={i}
        className={`absolute ${s.color}`}
        style={{ top: s.top, left: s.left, transform: `rotate(${s.rotate})` }}
      >
        {s.shape === 'star' && <SafeIcon icon={FiStar} className={s.size} />}
        {s.shape !== 'star' && <span className={`block ${s.shape === 'dot' ? 'rounded-full' : 'rounded-sm'} bg-current ${s.size}`} />}
      </span>
    ))}
  </div>
);

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

  const renderCard = (children, { decorated = false } = {}) => (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 bg-[#0a0e1f]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-6 relative"
      >
        <div className="absolute -top-12 left-0">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-indigo-300 transition-colors"
          >
            <SafeIcon icon={FiArrowLeft} className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
        <div className="relative overflow-hidden bg-[#111a33] p-8 rounded-2xl shadow-[0_0_40px_-15px_rgba(99,102,241,0.35)] border border-indigo-500/20 text-center">
          {decorated && <InviteSparkles />}
          <div className="relative">{children}</div>
        </div>
      </motion.div>
    </div>
  );

  // Still resolving the invite token itself
  if (infoLoading) {
    return renderCard(
      <div className="flex flex-col items-center gap-3 py-6">
        <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-indigo-400" />
        <p className="text-slate-400 text-sm font-medium">Loading invitation…</p>
      </div>
    );
  }

  // Invalid/expired token
  if (infoError) {
    return renderCard(
      <>
        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Invalid Invitation</h2>
        <p className="text-slate-300">{infoError}</p>
      </>
    );
  }

  // Auth still hydrating - avoid flashing the wrong branch (mirrors ProtectedRoute's guard)
  if (!authSettled) {
    return renderCard(
      <div className="flex flex-col items-center gap-3 py-6">
        <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-indigo-400" />
        <p className="text-slate-400 text-sm font-medium">Verifying access rights…</p>
      </div>
    );
  }

  // Logged in, but not a student account
  if (user && user.role !== 'student') {
    return renderCard(
      <>
        <div className="w-16 h-16 bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-yellow-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Student Accounts Only</h2>
        <p className="text-slate-300 mb-6">
          You're signed in as a {user.role}. Only student accounts can join a group via this link.
        </p>
        <button
          onClick={() => logout()}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-slate-600 text-sm font-bold rounded-lg text-slate-200 bg-slate-800 hover:bg-slate-700 transition-all"
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
          <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiAlertCircle} className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Couldn't Join Group</h2>
          <p className="text-slate-300">{joinError}</p>
        </>
      );
    }

    if (joinStatus === 'success' || joinStatus === 'already') {
      return renderCard(
        <>
          <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <SafeIcon icon={FiCheckCircle} className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {joinStatus === 'already' ? "You're Already a Member" : 'Congratulations!'}
          </h2>
          <p className="text-slate-300 mb-2">
            {joinStatus === 'already'
              ? <>You're already a member of <strong className="text-white">{groupInfo?.name}</strong>.</>
              : <>You've successfully joined <strong className="text-white">{groupInfo?.name}</strong>.</>}
          </p>
          <p className="text-sm text-slate-400">Redirecting to your dashboard…</p>
        </>
      );
    }

    // joining or idle (about to join)
    return renderCard(
      <div className="flex flex-col items-center gap-3 py-6">
        <SafeIcon icon={FiLoader} className="w-10 h-10 animate-spin text-indigo-400" />
        <p className="text-slate-400 text-sm font-medium">Joining {groupInfo?.name}…</p>
      </div>
    );
  }

  // Logged out - show the invite and let them log in / sign up
  return renderCard(
    <>
      <div className="relative w-16 h-16 mx-auto mb-4">
        <div className="absolute inset-0 rounded-full bg-indigo-500/30 blur-xl scale-125" />
        <div className="relative w-16 h-16 rounded-full bg-indigo-950 border-2 border-indigo-400/60 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.5)]">
          <SafeIcon icon={FiUsers} className="w-7 h-7 text-indigo-300" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-white mb-2">You've Been Invited!</h2>
      <div className="flex items-center justify-center gap-2 mb-4 opacity-70">
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-indigo-400/60" />
        <SafeIcon icon={FiStar} className="w-3 h-3 text-indigo-300" />
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-indigo-400/60" />
      </div>
      <p className="text-slate-300 mb-6">
        Join <strong className="text-indigo-300">{groupInfo?.name}</strong> on{' '}
        <strong className="text-pink-400">{settings.appName}</strong>. Log in or create a student account to continue.
      </p>
      <div className="space-y-3">
        <Link
          to="/signup"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.6)] transition-all"
        >
          <SafeIcon icon={FiUserPlus} className="w-4 h-4" />
          Sign Up
          <SafeIcon icon={FiArrowRight} className="w-4 h-4" />
        </Link>
        <Link
          to="/login"
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 border border-slate-700 text-sm font-bold rounded-lg text-slate-200 bg-slate-800/60 hover:bg-slate-800 transition-all"
        >
          <SafeIcon icon={FiLock} className="w-4 h-4" />
          Log In
          <SafeIcon icon={FiArrowRight} className="w-4 h-4" />
        </Link>
      </div>
      <div className="flex items-center gap-3 my-5">
        <span className="h-px flex-1 bg-slate-700" />
        <span className="text-xs text-slate-500 font-medium">or</span>
        <span className="h-px flex-1 bg-slate-700" />
      </div>
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-400">
        <SafeIcon icon={FiShield} className="w-3.5 h-3.5" />
        Secure &amp; Private
      </div>
    </>,
    { decorated: true }
  );
};

export default JoinGroupInvite;
