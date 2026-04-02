import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import supabase from '../supabase/supabase';

const AuthContext = createContext();

const normalizeRole = (role) => (role ?? '').toString().trim().toLowerCase();
const normalizeName = (name, fallback = 'User') => {
  const s = (name ?? '').toString().trim();
  return s || fallback;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const getInitialState = () => {
    if (typeof window === 'undefined') return { user: null, loading: false };
    
    try {
        // 1. FAST SYNC CHECK: Look for Supabase session in LocalStorage
        const authKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
        const sessionStr = authKey ? localStorage.getItem(authKey) : null;
        
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const user = session?.user;
            
            if (user) {
                // 2. CHECK CACHED PROFILE
                const profileStr = localStorage.getItem(`auth_profile_${user.id}`);
                const profile = profileStr ? JSON.parse(profileStr) : null;
                
                // 3. CHECK CACHE AGE
                const cacheAge = profile ? Date.now() - (profile.timestamp || 0) : Infinity;
                const CACHE_TTL = 3 * 60 * 1000; // 3 minutes
                
                if (profile && cacheAge < CACHE_TTL) {
                    const initialRole = normalizeRole(profile?.role || user.user_metadata?.role || 'student');
                    const initialName = normalizeName(profile?.name || user.user_metadata?.name || 'User');
                    
                    console.log(`🚀 [Auth] Pre-init: Found UNBLOCKED cached session for ${user.email} (${initialRole})`);
                    
                    return {
                        user: { ...user, ...profile, role: initialRole, name: initialName, _optimistic: true },
                        loading: false // CACHE IS FRESH - START UNBLOCKED
                    };
                } else {
                    // STALE CACHE or NO PROFILE - START BLOCKED to prevent redirects
                    const initialRole = normalizeRole(user.user_metadata?.role || 'student');
                    const initialName = normalizeName(user.user_metadata?.name || 'User');
                    
                    console.log(`⚡ [Auth] Session found but cache stale/missing. Starting BLOCKED for ${user.email}`);
                    
                    return {
                        user: { ...user, role: initialRole, name: initialName, _pending_sync: true },
                        loading: true // START BLOCKED to prevent jumping to login
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[Auth] Sync recovery failed', e);
    }
    
    // Default: If no session found in localStorage, we can safely start unblocked (user is null)
    const hasPossibleSession = Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    return { user: null, loading: hasPossibleSession }; 
};

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(getInitialState);
  const { user, loading } = state;

  const setUser = (u) => setState(prev => ({ 
    ...prev, 
    user: typeof u === 'function' ? u(prev.user) : u 
  }));
  const setLoading = (l) => setState(prev => ({ 
    ...prev, 
    loading: typeof l === 'function' ? l(prev.loading) : l 
  }));

  // CRITICAL: Prevent infinite loading loops
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('🚨 [Auth] Loading stuck - forcing completion');
        setLoading(false);
      }
    }, 3000); // 3 second timeout

    return () => clearTimeout(timeout);
  }, [loading]);

  // Background Sync Function
  const syncProfile = async (currentUser) => {
    if (!currentUser?.id) return;
    
    // Check cache first to avoid repeated DB calls
    const cacheKey = `auth_profile_${currentUser.id}`;
    const cached = localStorage.getItem(cacheKey);
    const cacheAge = cached ? Date.now() - (JSON.parse(cached).timestamp || 0) : Infinity;
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    if (cached && cacheAge < CACHE_TTL) {
      const cachedProfile = JSON.parse(cached).profile;
      if (cachedProfile) {
        console.log('🚀 [Auth] Using cached profile for', currentUser.email);
        setUser(prev => {
          const normalizedRole = normalizeRole(cachedProfile.role) || 'student';
          const normalizedProfile = { ...cachedProfile, role: normalizedRole };
          
          const metaName =
            currentUser?.user_metadata?.name ||
            currentUser?.user_metadata?.full_name ||
            currentUser?.name ||
            'User';
          const finalName = normalizeName(cachedProfile?.name, normalizeName(metaName));
          
          if (!prev) return { ...currentUser, ...normalizedProfile, name: finalName };
          if (prev.role !== normalizedRole || prev.name !== finalName || 
              JSON.stringify(prev.linked_students) !== JSON.stringify(cachedProfile.linked_students)) {
            return { ...prev, ...normalizedProfile, name: finalName };
          }
          return prev;
        });
        return;
      }
    }
    
    try {
      const profile = await authService.getDbProfile(currentUser.id);
      if (profile) {
        // Cache the profile
        localStorage.setItem(cacheKey, JSON.stringify({
          profile,
          timestamp: Date.now()
        }));
        
        console.log('🔄 [Auth] Profile sync successful:', profile.role);
        setUser(prev => {
          const normalizedRole = normalizeRole(profile.role) || 'student';
          const normalizedProfile = { ...profile, role: normalizedRole };
          
          // Prioritize database profile name over metadata
          const metaName =
            currentUser?.user_metadata?.name ||
            currentUser?.user_metadata?.full_name ||
            currentUser?.name ||
            'User';
          const finalName = normalizeName(profile?.name, normalizeName(metaName));
          
          if (!prev) return { ...currentUser, ...normalizedProfile, name: finalName };
          if (prev.role !== normalizedRole || prev.name !== finalName || 
              JSON.stringify(prev.linked_students) !== JSON.stringify(profile.linked_students)) {
            return { ...prev, ...normalizedProfile, name: finalName };
          }
          return prev;
        });
      } else {
        console.warn('⚠️ [Auth] Profile sync: No profile records found for user', currentUser.email);
        // Fallback to metadata name if no profile exists
        setUser(prev => {
          if (!prev) {
            const metadataName = currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || 'User';
            return { ...currentUser, name: metadataName };
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('❌ [Auth] Profile sync fatal error:', err.message);
      // Ensure we always have a name even on error
      setUser(prev => {
        if (!prev) {
          const metadataName = currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || 'User';
          return { ...currentUser, name: metadataName };
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    console.log('🔍 [AuthContext] Starting auth initialization...');

    // CRITICAL: Overall timeout for auth initialization
    const globalTimeout = setTimeout(() => {
      console.error('🚨 [AuthContext] Auth init timeout - forcing loading=false');
      if (mounted) {
        setLoading(false);
        // Try to recover user from localStorage as last resort
        try {
          const authKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
          if (authKey) {
            const session = JSON.parse(localStorage.getItem(authKey));
            if (session?.user) {
              console.warn('⚠️ [AuthContext] Recovered user from localStorage after timeout');
              setUser({ 
                ...session.user, 
                role: normalizeRole(session.user.user_metadata?.role || 'student'),
                name: normalizeName(session.user.user_metadata?.name || 'User')
              });
            }
          }
        } catch (e) {
          console.error('Failed to recover from localStorage:', e);
        }
      }
    }, 8000); // 8 second absolute max

    // 1. FAST INITIAL CHECK (Session Only)
    const initAuth = async () => {
      try {
        console.log('🔍 [AuthContext] Checking session...');
        const sessionUser = await authService.getSessionUser();
        console.log('🔍 [AuthContext] Session result:', sessionUser ? 'FOUND USER' : 'NO SESSION');
        
        if (mounted) {
          clearTimeout(globalTimeout);
          
            if (sessionUser) {
                console.log('🚀 [AuthContext] Setting user from session:', sessionUser.email);
                // Set user immediately with optimistic role - FAST PATH
                const initialRole = normalizeRole(sessionUser.user_metadata?.role || sessionUser.role || 'student');
                const initialName = normalizeName(
                  sessionUser.name ||
                  sessionUser.user_metadata?.name ||
                  sessionUser.user_metadata?.full_name ||
                  'User'
                );
                const optimisticUser = {
                  ...sessionUser,
                  role: (initialRole === 'authenticated' || !initialRole) ? 'student' : initialRole,
                  name: initialName,
                  _pending_sync: true // Flag that we haven't hit DB yet
                };
                setUser(optimisticUser);
                console.log('✅ [AuthContext] User set, unblocking UI');
                setLoading(false); // <--- UNBLOCK UI IMMEDIATELY
                
                // Start background sync NON-BLOCKING
                setTimeout(() => syncProfile(optimisticUser), 100);
            } else {
                console.log('⚠️ [AuthContext] No session found, setting loading=false');
                setLoading(false); // No session, MUST UNBLOCK
                setUser(null);
            }
        }
      } catch (e) {
        console.error("❌ [AuthContext] Auth init error:", e.message);
        if (mounted) {
          clearTimeout(globalTimeout);
          setLoading(false);
        }
      }
    };

    initAuth();

    // 3. EVENT LISTENER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log(`🔐 [Auth] State Change Event: ${event}`, session ? 'Has Session' : 'No Session');

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const rawUser = session?.user;
        if (rawUser) {
          console.log('📥 [Auth] Processing SIGNED_IN/TOKEN_REFRESHED for:', rawUser.email);
          let nextUserForSync = null;
          let shouldSync = false;

          setUser(prev => {
            // Check if we already have this user to prevent loop
            if (prev?.id === rawUser.id && prev.role && prev.name) {
              console.log('⚠️ [Auth] User already set, skipping update');
              shouldSync = false;
              return prev;
            }

            const initialRole = normalizeRole(rawUser.user_metadata?.role || rawUser.role || 'student');
            const initialName = normalizeName(
              rawUser.user_metadata?.name ||
              rawUser.user_metadata?.full_name ||
              'User'
            );

            const optimisticUser = {
              ...rawUser,
              role: (initialRole === 'authenticated' || !initialRole) ? 'student' : initialRole,
              name: initialName
            };

            nextUserForSync = optimisticUser;
            shouldSync = true;
            console.log('✅ [Auth] Setting user from auth state change');
            return optimisticUser;
          });

          // BACKGROUND SYNC - Don't await it here unless it's a critical boot
          // This allows setLoading(false) to happen instantly
          if (shouldSync && nextUserForSync) {
            syncProfile(nextUserForSync); // Start in background
          }

          console.log('✅ [Auth] Setting loading=false from auth state change');
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('📤 [Auth] Processing SIGNED_OUT');
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (credentials) => {
    // Return immediately to let UI redirect
    const result = await authService.login(credentials);
    if (result.success) {
      // Ensure user has at least basic info even if profile doesn't exist
      const userWithFallbacks = {
        ...result.user,
        name: normalizeName(
          result.user.name ||
          result.user.user_metadata?.name ||
          result.user.user_metadata?.full_name ||
          'User'
        ),
        role: normalizeRole(result.user.role) || 'student'
      };
      setUser(userWithFallbacks);
    }
    return result;
  };

  const signup = async (credentials) => {
    const result = await authService.signup(credentials);
    if (result.success && result.user) {
      // Optimistically prepare the user object with role and name
      const role = normalizeRole(credentials.role || 'student');
      const name = normalizeName(credentials.name || 'User');
      
      const optimisticUser = {
        ...result.user,
        role: role === 'authenticated' ? 'student' : (role || 'student'),
        name
      };
      
      setUser(optimisticUser);
      // Keep loading true briefly so ProtectedRoute doesn't render while the
      // session/token is still settling (prevents intermittent 401/white page).
      setLoading(true);
      try {
        await syncProfile(optimisticUser);
      } finally {
        setLoading(false);
      }
    }
    return result;
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const value = {
    user,
    login,
    signup,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};