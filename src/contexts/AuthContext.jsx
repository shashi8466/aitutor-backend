import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import supabase from '../supabase/supabase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Background Sync Function
  const syncProfile = async (currentUser) => {
    if (!currentUser?.id) return;
    const profile = await authService.getDbProfile(currentUser.id);
    if (profile) {
      // Only update state if meaningful changes exist to prevent loops
      setUser(prev => {
        if (prev?.role !== profile.role || prev?.name !== profile.name) {
          return { ...prev, ...profile };
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    let mounted = true;

    // 1. FAST INITIAL CHECK (Session Only)
    const initAuth = async () => {
      try {
        const sessionUser = await authService.getSessionUser();
        if (mounted) {
          setUser(sessionUser);
          setLoading(false); // <--- UNBLOCK UI IMMEDIATELY
        }
        // 2. SLOW SYNC (Background)
        if (sessionUser) {
          syncProfile(sessionUser);
        }
      } catch (e) {
        console.error("Auth init error", e);
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // 3. EVENT LISTENER
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Optimistic update
        const rawUser = session?.user;
        if (rawUser) {
          const optimisticUser = {
            ...rawUser,
            role: rawUser.user_metadata?.role || 'student',
            name: rawUser.user_metadata?.name || 'Student'
          };
          setUser(optimisticUser);
          setLoading(false); 
          syncProfile(optimisticUser);
        }
      } else if (event === 'SIGNED_OUT') {
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
      setUser(result.user); // Optimistic set
    }
    return result;
  };

  const signup = async (credentials) => {
    const result = await authService.signup(credentials);
    if (result.success && result.session) {
      setUser(result.user); // Optimistic set
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