import axios from 'axios';
import supabase from '../supabase/supabase';

// GLOBAL AXIOS CONFIGURATION
// Use full URL for production to bypass CORS/Routing issues on specific hosts
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
axios.defaults.baseURL = BACKEND_URL;
axios.defaults.timeout = 60000; // Increased to 60 seconds globally to allow for AI warm-ups and processing
axios.defaults.withCredentials = true;

// GLOBAL REQUEST INTERCEPTOR
// Automatically attach the Supabase access token to every request
axios.interceptors.request.use(async (config) => {
  try {
    // Only add token if it's an API request to our own backend
    if (config.url && (config.url.startsWith('/api') || config.url.startsWith(BACKEND_URL))) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    }
  } catch (error) {
    console.warn('⚠️ [API Interceptor] Could not attach auth token:', error.message);
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Pre-emptively "warm up" the backend (best effort)
if (BACKEND_URL) {
  fetch(`${BACKEND_URL}/api/health`).catch(() => {});
}

// Helper to get error message
const getError = (error) => {
  return error.response?.data?.error || error.message || 'An error occurred';
};

// CONSTANTS
const STORAGE_BUCKET = 'documents'; // Updated to new bucket

// --- AUTH SERVICE ---
export const authService = {
  login: async ({ email, password }) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // Fetch profile to get role
      const profile = await authService.getDbProfile(data.user.id);

      // Merge user data, ensuring profile properties (like custom role) 
      // override the default Supabase user properties (like role: 'authenticated')
      const profileRole = (profile?.role || data.user.user_metadata?.role || 'student').toLowerCase();
      const userWithProfile = {
        ...data.user,
        ...profile,
        // Explicitly force the role from profile if it exists
        role: profileRole === 'authenticated' ? 'student' : profileRole
      };

      console.log('Login successful for:', email, 'Role:', userWithProfile.role);

      return { success: true, user: userWithProfile };
    } catch (error) {
      console.error('Login service error:', error.message);
      return { success: false, error: error.message };
    }
  },
  signup: async ({ email, password, name, role, mobile, fatherName, fatherMobile }) => {
    try {
      console.log('🔄 [SIGNUP] Starting signup for:', email);
      
      // Pass metadata for trigger to pick up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
            mobile,
            father_name: fatherName,
            father_mobile: fatherMobile
          }
        }
      });
      
      if (error) {
        console.error('❌ [SIGNUP] Supabase auth error:', error.message);
        throw error;
      }
      
      console.log('✅ [SIGNUP] User created:', data.user?.id);

      // CRITICAL: Return immediately with success
      // Background tasks run separately without blocking signup
      if (data.user) {
        // Run background tasks asynchronously without awaiting
        authService._runSignupBackgroundTasks(data.user, { email, name, role, mobile, fatherName, fatherMobile });
      }

      return { success: true, session: data.session, user: data.user };
    } catch (error) {
      console.error('💥 [SIGNUP] Fatal error:', error.message);
      return { success: false, error: error.message };
    }
  },

  // Background tasks helper (non-blocking)
  _runSignupBackgroundTasks: async (user, userData) => {
    const userId = user.id;
    const userName = userData.name || 'Student';
    const normalizedRole = (userData.role || 'student').toString().trim().toLowerCase() || 'student';

    console.log('🎯 [BACKGROUND] Starting background tasks for:', userName, '<', userData.email, '>');

    try {
      // Task 1: Profile upsert - CRITICAL for dashboard name display
      try {
        console.log('📝 [BACKGROUND] Upserting profile...');
        
        // Determine initial status based on role
        // Admin and Tutor roles require manual approval
        const initialStatus = (normalizedRole === 'admin' || normalizedRole === 'tutor') ? 'pending' : 'active';
        
        await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: userData.email,
            name: userName,
            role: normalizedRole,
            mobile: userData.mobile || null,
            father_name: userData.fatherName || null,
            father_mobile: userData.fatherMobile || null,
            status: initialStatus,
            plan_type: 'free',
            plan_status: 'active',
            payment_status: 'unpaid'
          }, { onConflict: 'id' });
        console.log('✅ [BACKGROUND] Profile upserted successfully with status:', initialStatus);
      } catch (profileError) {
        console.error('⚠️ [BACKGROUND] Profile upsert failed:', profileError?.message);
      }

      // Task 2: Welcome email queue (best-effort)
      try {
        await supabase.rpc('add_to_welcome_queue', {
          user_email: userData.email,
          user_name: userName,
          user_id: userId
        });
        console.log('✅ [BACKGROUND] Added to welcome queue via RPC');
      } catch (rpcError) {
        console.warn('⚠️ [BACKGROUND] Welcome queue RPC failed:', rpcError?.message);
        // Fallback: direct insert
        try {
          await supabase.from('welcome_email_queue').insert({
            user_id: userId,
            email: userData.email,
            name: userName,
            status: 'pending'
          });
          console.log('✅ [BACKGROUND] Added to welcome queue via direct insert');
        } catch (insertError) {
          console.warn('⚠️ [BACKGROUND] Direct queue insert failed:', insertError?.message);
        }
      }

      // Task 3: Welcome email endpoint (best-effort)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

        console.log('📧 [BACKGROUND] Calling welcome email endpoint...');
        await axios.post('/api/auth/welcome-email', {
          email: userData.email,
          name: userName,
          userId
        }, { 
          headers,
          timeout: 5000 // 5 second timeout to prevent hanging
        });

        console.log('✅ [BACKGROUND] Welcome email sent successfully via endpoint');
      } catch (endpointError) {
        console.warn('⚠️ [BACKGROUND] Welcome email endpoint failed:', endpointError?.message);
      }

      console.log('🎉 [BACKGROUND] All background tasks completed');

    } catch (error) {
      console.error('❌ [BACKGROUND] Unexpected error in background tasks:', error?.message);
    }
  },
  logout: async () => {
    // Clear local cache on logout
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('auth_profile_')) localStorage.removeItem(key);
      });
    }
    await supabase.auth.signOut();
  },
  
  // FAST version for initial boot
  getSessionUser: async () => {
    try {
      // CRITICAL: Add timeout to prevent hanging
      const getUserPromise = supabase.auth.getUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('getUser timeout')), 5000)
      );
      
      // 1. Get user from Supabase Auth (fast, often from local storage)
      const { data: { user }, error: authError } = await Promise.race([
        getUserPromise,
        timeoutPromise
      ]).catch((err) => {
        console.error('⏰ getUser timed out:', err.message);
        return { data: { user: null }, error: err };
      });
      
      if (authError || !user) {
        console.warn('⚠️ No user from getUser:', authError?.message);
        return null;
      }

      // 2. CHECK LOCAL CACHE for profile (extremely fast)
      let cachedProfile = null;
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem(`auth_profile_${user.id}`);
          if (stored) cachedProfile = JSON.parse(stored);
        } catch (e) {
          console.warn('Failed to parse cached profile', e);
        }
      }

      // If we have a cached profile, return it immediately with user
      if (cachedProfile) {
        console.log('✅ getSessionUser: Returning cached profile');
        return { ...user, ...cachedProfile, _fromCache: true };
      }

      // 3. Fallback: Return user with metadata if no cache exists yet
      console.log('✅ getSessionUser: Returning user with metadata');
      return { 
        ...user, 
        role: user.user_metadata?.role || 'student',
        name: user.user_metadata?.name || user.user_metadata?.full_name || 'User'
      };
    } catch (e) {
      console.error('getSessionUser error', e);
      return null;
    }
  },

  getDbProfile: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [api] getDbProfile database error:', error.message);
        return null;
      }

      // Update local cache for next refresh
      if (data && typeof window !== 'undefined') {
        localStorage.setItem(`auth_profile_${userId}`, JSON.stringify(data));
      }

      return data;
    } catch (err) {
      console.error('💥 [api] getDbProfile fatal error:', err.message);
      return null;
    }
  },
  updateRole: async (userId, role) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,assigned_courses,linked_students,plan_type,plan_status,payment_status')
      .single();
    if (error) throw error;
    return { data };
  },
  // OPTIMIZED: Unified profile fetch with filtering and pagination
  getAllProfiles: async ({ role = null, limit = 1000, offset = 0 } = {}) => {
    try {
      let query = supabase
        .from('profiles')
        .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,linked_students,notification_preferences,phone_number,whatsapp_number,last_active_at,status,plan_type,plan_status,payment_status')
        .order('created_at', { ascending: false });

      if (role) {
        query = query.eq('role', role);
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) throw error;
      return { data };
    } catch (error) {
      console.error('💥 [api] getAllProfiles error:', error.message);
      throw error;
    }
  },

  // EFFICIENT: Fetch only specific role (Student/Parent/Tutor)
  getProfilesByRole: async (role, limit = 1000) => {
    return authService.getAllProfiles({ role, limit });
  },

  wakeUp: async () => {
    // Simple health check or warm-up
    try {
      await axios.get('/api/health');
    } catch (e) {
      // Ignore
    }
  },
  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return { data };
  },
  updateEmail: async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
    return { success: true };
  },
  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { success: true };
  },
  resendVerification: async (email) => {
    return await supabase.auth.resend({
      type: 'signup',
      email: email,
    });
  }
};

// --- PROFILE SERVICE ---
export const profileService = {
  getProfile: async (userId) => authService.getDbProfile(userId),
  getById: async (userId) => authService.getDbProfile(userId),
  getAll: async () => authService.getAllProfiles(),
  update: async (userId, updates) => authService.updateProfile(userId, updates)
};

// --- COURSE SERVICE ---
export const courseService = {
  getAll: async (filters = {}) => {
    let query = supabase.from('courses').select('*').order('created_at', { ascending: false });
    if (filters.isPractice !== undefined) {
      query = query.eq('is_practice', filters.isPractice);
    }
    const { data: courses, error } = await query;
    if (error) return { data: [], error };

    // Fetch live data for mapping (only active status uploads)
    const [uploadsRes, questionsRes] = await Promise.all([
      supabase.from('uploads')
        .select('id, course_id, level, category, questions_count, status, created_at')
        .eq('category', 'quiz_document')
        .in('status', ['completed', 'warning']),
      supabase.from('questions')
        .select('course_id, upload_id')
    ]);

    const uploadToCourseMap = {};
    (uploadsRes.data || []).forEach(u => {
      if (u.course_id) uploadToCourseMap[u.id] = String(u.course_id);
    });

    const enriched = (courses || []).map(c => {
      const courseIdStr = String(c.id);
      
      // 1. Manual Questions for this course
      const manualCount = (questionsRes.data || []).filter(q => 
        String(q.course_id) === courseIdStr && !q.upload_id
      ).length;

      // 2. Sum questions from the LATEST upload per level (matches Student/CourseDetail view)
      const levels = ['Easy', 'Medium', 'Hard'];
      let latestQuizQuestionsCount = 0;

      levels.forEach(level => {
        const latestUpload = (uploadsRes.data || [])
          .filter(u => String(u.course_id) === courseIdStr && u.level === level)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
        
        if (latestUpload) {
          latestQuizQuestionsCount += (latestUpload.questions_count || 0);
        }
      });

      return {
        ...c,
        questions_count: manualCount + latestQuizQuestionsCount
      };
    });

    return { data: enriched };
  },
  getById: async (id) => {
    return await supabase.from('courses').select('*').eq('id', id).maybeSingle();
  },
  create: async (courseData) => {
    return await supabase.from('courses').insert([courseData]).select().single();
  },
  update: async (id, courseData) => {
    return await supabase.from('courses').update(courseData).eq('id', id).select().single();
  },
  delete: async (id) => {
    return await supabase.from('courses').delete().eq('id', id);
  },
  /**
   * Uploads a file to the server for processing/storage
   * @param {string} courseId 
   * @param {File} file 
   * @param {Object} metadata { category, level, parse }
   */
  uploadFile: async (courseId, file, metadata = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', courseId);

    // Append metadata
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });

    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.warn('Auth session error:', sessionError.message);
    }

    const headers = {
      'Content-Type': 'multipart/form-data',
    };

    // Only add authorization header if session exists
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    // CRITICAL: Set large timeout (10 mins) for file uploads and heavy parsing logic
    return axios.post('/api/upload', formData, { 
      headers,
      timeout: 600000 // 10 minutes
    });
  }
};

// --- UPLOAD SERVICE ---
export const uploadService = {
  getAll: async (filters = {}) => {
    // 🕵️ Preview Mode Support: Using axios ensures the identity-swap header is sent
    // Convert array filters to comma-separated strings for backend
    const params = { ...filters };
    if (Array.isArray(params.courseIds)) params.courseIds = params.courseIds.join(',');

    let res = { data: { data: [] } };
    try {
      let query = supabase.from('uploads').select('*, courses(name)').order('created_at', { ascending: false });
      if (params.courseId) query = query.eq('course_id', params.courseId);
      if (params.category) query = query.eq('category', params.category);
      if (params.courseIds) {
        const ids = Array.isArray(params.courseIds) ? params.courseIds : params.courseIds.split(',');
        query = query.in('course_id', ids);
      }
      const { data, error } = await query;
      if (!error) res = { data: { data } };
    } catch (e) {
      console.warn("Direct upload fetch failed, using empty array");
    }
    
    // Flatten course name for easier consumption (keep same format as original)
    const flattened = (res.data?.data || []).map(item => ({
      ...item,
      courseName: item.courses?.name || item.courseName?.name || 'Unknown'
    }));

    return { data: flattened };
  },
  delete: async (id) => {
    try {
      return await axios.delete(`/api/upload/${id}`);
    } catch (error) {
      // Some deployed backends may not expose DELETE /api/upload/:id yet.
      // Fallback to direct Supabase deletion so admin UX still works.
      if (error?.response?.status !== 404) throw error;

      const uploadId = String(id);
      const { data: uploadRow, error: fetchErr } = await supabase
        .from('uploads')
        .select('id,file_url')
        .eq('id', uploadId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!uploadRow) {
        const notFound = new Error('Upload record not found');
        notFound.status = 404;
        throw notFound;
      }

      // Keep data integrity: remove dependent questions first.
      const { error: qErr } = await supabase
        .from('questions')
        .delete()
        .eq('upload_id', uploadId);
      if (qErr) throw qErr;

      const { error: uploadErr } = await supabase
        .from('uploads')
        .delete()
        .eq('id', uploadId);
      if (uploadErr) throw uploadErr;

      // Best-effort storage cleanup from public URL.
      if (uploadRow.file_url) {
        try {
          const parts = String(uploadRow.file_url).split('/documents/');
          if (parts.length > 1) {
            await supabase.storage.from('documents').remove([parts[1]]);
          }
        } catch (_) {
          // no-op: DB cleanup already succeeded
        }
      }

      return { data: { success: true, fallback: true } };
    }
  },
  getStats: async () => {
    const { count: uploadsCount } = await supabase
      .from('uploads')
      .select('*', { count: 'exact', head: true });

    const { count: usersCount } = await supabase
      .from('profiles')
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile', { count: 'exact', head: true })

    const { count: questionsCount } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });

    return { uploadsCount, usersCount, questionsCount };
  },
  update: async (id, updates) => {
    return await supabase.from('uploads').update(updates).eq('id', id);
  }
};

// --- QUESTION SERVICE ---
export const questionService = {
  getAll: async (filters = {}) => {
    let query = supabase.from('questions').select('*').order('created_at', { ascending: true });

    if (filters.courseId) query = query.eq('course_id', filters.courseId);
    if (filters.level) query = query.eq('level', filters.level);
    if (filters.type) query = query.eq('type', filters.type);
    if (filters.uploadId) query = query.eq('upload_id', filters.uploadId);

    return await query;
  },
  getTopics: async () => {
    return await supabase.from('questions').select('topic').not('topic', 'is', null);
  },
  create: async (data) => {
    return await supabase.from('questions').insert([data]).select().single();
  },
  update: async (id, data) => {
    return await supabase.from('questions').update(data).eq('id', id).select().single();
  },
  delete: async (id) => {
    return await supabase.from('questions').delete().eq('id', id);
  },
  uploadImage: async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `q_img_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `question_images/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET) // Using 'documents'
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);

    return { publicUrl: data.publicUrl };
  }
};

// --- AI SERVICE ---
export const aiService = {
  chatWithContent: async (message, context, history, difficulty = 'Medium') => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    return axios.post('/api/ai/chat', { message, context, history, difficulty }, { headers });
  },
  tutorChat: async (message, difficulty = 'Medium') => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    return axios.post('/api/ai/personal-tutor', { message, difficulty }, { headers });
  },
  getExplanation: async (question, userAnswer, correctAnswer) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    return axios.post('/api/ai/explain', { question, userAnswer, correctAnswer }, { headers });
  },
  generateSimilarQuestion: async (question, previousQuestions = []) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    const payload = {
      question,
      previousQuestions: previousQuestions.slice(-5)
    };
    return axios.post('/api/ai/generate-similar', payload, { headers });
  },
  generateStudyPlan: async (data) => axios.post('/api/ai/generate-plan', { diagnosticData: data }),
  reviewTest: async (data) => axios.post('/api/ai/review-test', { testData: data }),
  salesChat: async (msg, hist) => axios.post('/api/ai/sales-chat', { message: msg, history: hist }),
  summarizeContent: async (ctx) => axios.post('/api/ai/summarize', { context: ctx }),
  generateFlashcards: async (ctx) => axios.post('/api/ai/flashcards', { context: ctx }),
  generateQuizFromContent: async (ctx, count = 10, concise = false) => axios.post('/api/ai/quiz-from-content', { context: ctx, count, concise }),
  generateExam: async (ctx, difficulty, count) => axios.post('/api/ai/generate-exam', { context: ctx, difficulty, count }),
  generateChapters: async (ctx) => axios.post('/api/ai/chapters', { context: ctx }),
  generatePodcastScript: async (ctx) => axios.post('/api/ai/podcast', { context: ctx }),
  prep365Chat: async (message, difficulty, count = 10, excludeIds = []) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    return axios.post('/api/ai/prep365-chat', { message, difficulty, count, excludeIds }, { headers });
  },
  kbQuiz: async (topic, level, count = 10, excludeIds = [], userId = null) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
    return axios.post('/api/kb-quiz', { topic, level, count, excludeIds, userId }, { headers });
  },

  kbTopics: async () => {
    return axios.get('/api/kb-quiz/topics');
  },

  extractContent: async (file, url) => {
    // If it's a file, we might need a different endpoint that handles multipart
    if (file) {
      // For now, client-side extraction is often used in this architecture
      // But if we want server extraction:
      const formData = new FormData();
      formData.append('file', file);
      if (url) formData.append('url', url);

      // Note: This endpoint needs to exist in server/routes/ai.js or similar
      // Currently using a placeholder or client-side logic in components
      // We'll use the client parser utility mostly, but here is the API stub:
      return axios.post('/api/ai/extract', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return axios.post('/api/ai/extract', { url });
  }
};

// ENROLLMENT SERVICE ---
export const enrollmentService = {
  /**
   * Initiate Stripe Checkout for paid enrollment
   * For free courses, directly enrolls the student
   */
  initiateEnrollment: async (userId, courseId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};

    return axios.post('/api/payment/create-checkout-session', {
      userId,
      courseId
    }, { headers });
  },

  // Direct enroll (free courses only - backend will validate)
  // This method has been removed to enforce enrollment key requirement
  // All enrollments must now go through the proper enrollment flow
  // that checks for enrollment key requirements

  isEnrolled: async (userId, courseId) => {
    const { data } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .single();
    return !!data;
  },

  getCourseStudents: async (courseId) => {
    const response = await axios.get(`/api/enrollment/course-students/${courseId}`);
    const flattened = (response.data.students || []).map(s => ({
      ...(s.profiles || {}),
      enrolled_at: s.enrolled_at
    })).filter(s => s.id); // Ensure we have valid profiles
    return { data: flattened, error: null };
  },

  validateKeyLength: (keyCode) => {
    const code = (keyCode || '').trim();
    return code.length >= 4 && code.length <= 12;
  },

  getStudentEnrollments: async (userId) => {
    try {
      const { data, error } = await supabase.from('enrollments').select('*').eq('user_id', userId);
      if (error) throw error;
      return { data: data || [] };
    } catch {
      return { data: [] };
    }
  },

  // Verify Stripe payment session
  verifyPaymentSession: async (sessionId) => {
    return axios.get(`/api/payment/verify-session/${sessionId}`);
  },

  // Use an enrollment key to enroll in a course
  useKey: async (keyCode) => {
    return axios.post('/api/enrollment/use-key', { keyCode });
  },

  getKeys: async (courseId = null) => {
    const url = courseId && courseId !== 'all' ? `/api/enrollment/keys?courseId=${courseId}` : '/api/enrollment/keys';
    return axios.get(url);
  },

  createKey: async (data) => {
    return axios.post('/api/enrollment/create-key', data);
  },

  deleteKey: async (id) => {
    return axios.delete(`/api/enrollment/key/${id}`);
  }
};

// --- PROGRESS SERVICE ---
export const progressService = {
  saveProgress: async (userId, courseId, level, score, passed) => {
    const { data, error } = await supabase
      .from('student_progress')
      .upsert(
        { user_id: userId, course_id: courseId, level, score, passed, created_at: new Date().toISOString() },
        { onConflict: 'user_id, course_id, level' }
      )
      .select();

    if (error) throw error;
    return { success: true, message: 'Progress saved', isNewHigh: true }; // Simplified response
  },
  getAllUserProgress: async (userId) => {
    try {
      const { data, error } = await supabase.from('student_progress').select('*').eq('user_id', userId);
      return { data: data || [] };
    } catch {
      return { data: [] };
    }
  },
};

// --- PLAN SERVICE ---
export const planService = {
  savePlan: async (userId, diagnosticData, generatedPlan) => {
    // Check if plan exists
    const { data: existing } = await supabase
      .from('student_plans')
      .select('id')
      .eq('user_id', userId)
      .single();

    const payload = {
      user_id: userId,
      diagnostic_data: diagnosticData,
      generated_plan: generatedPlan,
      predicted_score_range: generatedPlan.prediction || generatedPlan.predicted_score_range,
      created_at: new Date().toISOString()
    };

    if (existing) {
      return await supabase.from('student_plans').update(payload).eq('id', existing.id);
    } else {
      return await supabase.from('student_plans').insert([payload]);
    }
  },
  getPlan: async (userId) => {
    try {
      const { data, error } = await supabase.from('student_plans').select('*').eq('user_id', userId).single();
      return { data: data || null };
    } catch {
      return { data: null };
    }
  },

  // --- NEW SUBSCRIPTION PLAN METHODS ---
  getSettings: async () => {
    return await supabase.from('plan_settings').select('*');
  },
  updateSettings: async (planType, settings) => {
    return await supabase.from('plan_settings').upsert({
      plan_type: planType,
      ...settings,
      updated_at: new Date().toISOString()
    });
  },
  getContentAccess: async () => {
    return await supabase.from('plan_content_access').select('*');
  },
  addContentAccess: async (accessData) => {
    return await supabase.from('plan_content_access').insert([accessData]).select();
  },
  removeContentAccess: async (id) => {
    return await supabase.from('plan_content_access').delete().eq('id', id);
  },
  requestUpgrade: async (userId) => {
    try {
      // Set plan_status to pending_upgrade and payment_status to paid
      const { data, error } = await supabase.from('profiles').update({
        payment_status: 'paid',
        plan_status: 'pending_upgrade',
        updated_at: new Date().toISOString()
      }).eq('id', userId).select();
      
      if (error) throw error;
      return { data, success: true };
    } catch (err) {
      console.error('requestUpgrade error:', err.message);
      throw err;
    }
  },
  verifyUpgrade: async (userId) => {
    return await supabase.from('profiles').update({
      plan_type: 'premium',
      plan_status: 'active',
      updated_at: new Date().toISOString()
    }).eq('id', userId);
  },
  getUsageStats: async (userId) => {
    // Count questions answered in grading_submissions
    const { data: submissions } = await supabase.from('grading_submissions').select('question_ids, upload_id').eq('user_id', userId);
    const questionCount = (submissions || []).reduce((acc, sub) => acc + (sub.question_ids?.length || 0), 0);
    
    // Count unique tests (uploads) attempted
    const uniqueTests = new Set((submissions || []).map(s => s.upload_id).filter(Boolean));
    
    return { totalQuestions: questionCount, totalTests: uniqueTests.size };
  },
  checkAccess: async (userId, contentType, contentId, planType = 'free') => {
    // 1. Get user profile
    const { data: profile } = await supabase.from('profiles').select('plan_type, plan_status').eq('id', userId).single();
    const userPlan = (profile?.plan_type || 'free').toLowerCase();
    
    // Premium tier gets full access to all topics and tests by default
    if (userPlan === 'premium') return true;
    
    // 2. Direct whitelist check
    const { data: directAccess } = await supabase
      .from('plan_content_access')
      .select('id')
      .eq('content_type', contentType)
      .eq('content_id', contentId)
      .eq('plan_type', userPlan)
      .maybeSingle();
      
    if (directAccess) return true;

    // 3. Inherited logic: If course is assigned, so are its topics/tests
    if (contentType === 'topic') {
      // Find courses that contain this topic
      const { data: coursesWithTopic } = await supabase
        .from('questions')
        .select('course_id')
        .eq('topic', contentId);
        
      const courseIds = (coursesWithTopic || []).map(q => q.course_id).filter(Boolean);
      if (courseIds.length > 0) {
        const { data: courseAccess } = await supabase
          .from('plan_content_access')
          .select('id')
          .eq('content_type', 'course')
          .in('content_id', courseIds)
          .eq('plan_type', userPlan);
          
        if (courseAccess?.length > 0) return true;
      }
    }

    if (contentType === 'test') {
      // Find course for this test (upload)
      const { data: upload } = await supabase
        .from('uploads')
        .select('course_id')
        .eq('id', contentId)
        .maybeSingle();
        
      if (upload?.course_id) {
        const { data: courseAccess } = await supabase
          .from('plan_content_access')
          .select('id')
          .eq('content_type', 'course')
          .eq('content_id', upload.course_id)
          .eq('plan_type', userPlan)
          .maybeSingle();
          
        if (courseAccess) return true;
      }
    }
      
    return false;
  }
};

// --- SETTINGS SERVICE ---
export const settingsService = {
  get: async () => {
    try {
      const res = await axios.get('/api/settings/general');
      return { data: res.data?.data, error: null };
    } catch (err) {
      return { data: null, error: err.response?.data || err };
    }
  },
  update: async (appName, logoFile) => {
    let logoUrl = null;
    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(`public/${fileName}`, logoFile);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(`public/${fileName}`);

      logoUrl = data.publicUrl;
    }

    try {
      const res = await axios.put('/api/settings/general', {
        app_name: appName,
        logo_url: logoUrl || undefined
      });
      return { data: res.data?.data, error: null };
    } catch (err) {
      return { data: null, error: err.response?.data || err };
    }
  },
  getAdvanced: async () => {
    try {
      const res = await axios.get('/api/settings/advanced');
      return { data: res.data?.data, error: null };
    } catch (err) {
      return { data: null, error: err.response?.data || err };
    }
  },
  updateAdvanced: async (config) => {
    try {
      const res = await axios.put('/api/settings/advanced', config);
      return { data: res.data?.data, error: null };
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to update settings';
      return { data: null, error: new Error(errMsg) };
    }
  }
};

// --- CONTACT SERVICE ---
export const contactService = {
  submit: async (formData) => {
    try {
      console.log('📬 [api] Submitting contact form...', formData);
      
      // 1. Post to backend which handles DB storage (admin) and Email notifications
      const response = await axios.post('/api/contact', {
        name: formData.fullName || formData.name,
        email: formData.email,
        mobile: formData.mobile,
        subject: formData.subject || 'Direct Contact',
        message: formData.message,
        type: formData.subject ? 'Support Ticket' : 'General Inquiry'
      });
      
      console.log('✅ [api] Contact form submitted successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error("❌ Contact service encountered an error:", error);
      throw error;
    }
  }
};

// --- LEADERBOARD SERVICE ---
export const testReviewService = {
  saveReview: async (userId, testData, analysis) => {
    const payload = {
      user_id: userId,
      test_data: testData,
      analysis: analysis,
      score: testData.score || 0
    };

    return await supabase.from('test_reviews').insert([payload]).select().single();
  },

  getReviews: async (userId) => {
    return await supabase
      .from('test_reviews')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
  },

  getReview: async (reviewId) => {
    return await supabase
      .from('test_reviews')
      .select('*')
      .eq('id', reviewId)
      .single();
  }
};

// --- GRADING SERVICE ---
export const gradingService = {
  submitTest: async (data) => {
    // data: { courseId, level, questionIds, answers, duration }
    return axios.post('/api/grading/submit-test', data);
  },
  getSubmission: async (id) => {
    return axios.get(`/api/grading/submission/${id}`);
  },
  getAllMyScores: async (userId) => {
    return axios.get('/api/grading/all-my-scores', { params: { userId } });
  },
  getMyScores: async (courseId) => {
    return axios.get(`/api/grading/my-scores/${courseId}`);
  },
  getSectionAnalysis: async (courseId) => {
    return axios.get(`/api/grading/section-analysis/${courseId}`);
  },
  configureScale: async (data) => {
    return axios.post('/api/grading/configure-scale', data);
  },
  getScales: async (courseId) => {
    return axios.get(`/api/grading/scales/${courseId}`);
  },
  getWeakTopics: async () => {
    return axios.get('/api/grading/weak-topics');
  }
};

// --- TUTOR SERVICE (GROUPS & MANAGEMENT) ---
export const tutorService = {
  getDashboard: async () => {
    return axios.get('/api/tutor/dashboard');
  },
  getGroups: async (courseId = null) => {
    const url = courseId ? `/api/tutor/groups?courseId=${courseId}` : '/api/tutor/groups';
    return axios.get(url);
  },
  createGroup: async (data) => {
    return axios.post('/api/tutor/groups', data);
  },
  addGroupMembers: async (groupId, studentIds) => {
    return axios.post(`/api/tutor/groups/${groupId}/members`, { studentIds });
  },
  removeGroupMember: async (groupId, studentId) => {
    return axios.delete(`/api/tutor/groups/${groupId}/members/${studentId}`);
  },
  deleteGroup: async (groupId) => {
    return axios.delete(`/api/tutor/groups/${groupId}`);
  },
  getStudents: async (courseId = null) => {
    const url = courseId ? `/api/tutor/students?courseId=${courseId}` : '/api/tutor/students';
    return axios.get(url);
  },
  // New analytics endpoints
  getGroupMembers: async (groupId) => {
    return axios.get(`/api/tutor/groups/${groupId}/members`);
  },
  getGroupAnalytics: async (groupId, startDate = null, endDate = null) => {
    let url = `/api/tutor/groups/${groupId}/analytics`;
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    if (queryString) url += `?${queryString}`;
    return axios.get(url);
  },
  compareGroups: async (groupIds) => {
    // groupIds should be an array of group IDs
    const idsString = Array.isArray(groupIds) ? groupIds.join(',') : groupIds;
    return axios.get(`/api/tutor/groups/compare?groupIds=${idsString}`);
  },
  getStudentProgress: async (studentId) => {
    return axios.get(`/api/tutor/student-progress/${studentId}`);
  }
};

// --- ADMIN SERVICE (GROUP MANAGEMENT) ---
export const adminService = {
  getAllTutors: async () => {
    return axios.get('/api/admin/tutors');
  },
  getAllGroups: async () => {
    return axios.get('/api/admin/groups');
  },
  getTutorGroups: async (tutorId) => {
    return axios.get(`/api/admin/tutors/${tutorId}/groups`);
  },
  reassignGroup: async (groupId, tutorId) => {
    return axios.post(`/api/admin/groups/${groupId}/assign-tutor`, { tutorId });
  },
  bulkAssignStudents: async (groupId, studentIds) => {
    return axios.post(`/api/admin/groups/${groupId}/assign-students`, { studentIds });
  },
  getUnassignedStudents: async (courseId) => {
    return axios.get(`/api/admin/unassigned-students?courseId=${courseId}`);
  },
  deleteGroup: async (groupId) => {
    return axios.delete(`/api/admin/groups/${groupId}`);
  },
  getGroupMembers: async (groupId) => {
    return axios.get(`/api/admin/groups/${groupId}/members`);
  },
  getGroupAnalytics: async (groupId) => {
    return axios.get(`/api/admin/groups/${groupId}/analytics`);
  },
  createParent: async (parentData) => {
    return axios.post('/api/admin/parents', parentData);
  },
  getParents: async () => {
    return axios.get('/api/admin/parents');
  },
  updateParent: async (parentId, parentData) => {
    return axios.put(`/api/admin/parents/${parentId}`, parentData);
  },
  deleteParent: async (parentId) => {
    return axios.delete(`/api/admin/parents/${parentId}`);
  },
  updateUserStatus: async (userId, status) => {
    return axios.put(`/api/admin/users/${userId}/status`, { status });
  }
};

export const leaderboardService = {
  getTopStudents: async () => {
    return await axios.get('/api/grading/global-leaderboard');
  },
  getCourseRankings: async (courseId) => {
    return await axios.get(`/api/grading/leaderboard/${courseId}`);
  }
};

// --- CALENDAR SERVICE ---
export const calendarService = {
  getTasks: async (userId, month, year) => {
    // Fetches tasks for a specific month/year
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    return await supabase
      .from('study_tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('date', start.split('T')[0])
      .lte('date', end.split('T')[0])
      .order('date', { ascending: true });
  },
  createTask: async (taskData) => {
    return await supabase.from('study_tasks').insert([taskData]).select().single();
  },
  updateTask: async (id, taskData) => {
    return await supabase.from('study_tasks').update(taskData).eq('id', id).select().single();
  },
  deleteTask: async (id) => {
    return await supabase.from('study_tasks').delete().eq('id', id);
  }
};

// --- PARENT SERVICE ---
export const parentService = {
  getStudentReports: async (studentId) => {
    return axios.get(`/api/grading/parent/student/${studentId}/submissions`);
  },
  getDashboardData: async (studentId) => {
    return axios.get(`/api/grading/parent/student/${studentId}/dashboard-data`);
  },
  getMyChildren: async () => {
    return axios.get('/api/grading/parent/my-children');
  }
};
export const feedbackService = {
  submit: (data) => axios.post('/api/feedback/submit', data),
  getAll: () => axios.get('/api/feedback/all')
};
