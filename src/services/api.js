import axios from 'axios';
import supabase from '../supabase/supabase';

// GLOBAL AXIOS CONFIGURATION
// Use full URL for production to bypass CORS/Routing issues on specific hosts
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
axios.defaults.baseURL = BACKEND_URL;
axios.defaults.timeout = 30000; // Increased to 30 seconds for warm-ups and heavy AI processing
axios.defaults.withCredentials = true;

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
        this._runSignupBackgroundTasks(data.user, { email, name, role, mobile, fatherName, fatherMobile });
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
        await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: userData.email,
            name: userName,
            role: normalizedRole,
            mobile: userData.mobile || null,
            father_name: userData.fatherName || null,
            father_mobile: userData.fatherMobile || null
          }, { onConflict: 'id' });
        console.log('✅ [BACKGROUND] Profile upserted successfully with name:', userName);
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
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,assigned_courses,linked_students')
      .single();
    if (error) throw error;
    return { data };
  },
  // OPTIMIZED: Unified profile fetch with filtering and pagination
  getAllProfiles: async ({ role = null, limit = 1000, offset = 0 } = {}) => {
    try {
      let query = supabase
        .from('profiles')
        .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,linked_students,notification_preferences,phone_number,whatsapp_number,last_active_at,status')
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
  getAll: async () => {
    return await supabase.from('courses').select('*').order('created_at', { ascending: false });
  },
  getById: async (id) => {
    return await supabase.from('courses').select('*').eq('id', id).single();
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

    return axios.post('/api/upload', formData, { headers });
  }
};

// --- UPLOAD SERVICE ---
export const uploadService = {
  getAll: async (filters = {}) => {
    let query = supabase.from('uploads')
      .select(`
        *,
        courseName:courses(name)
      `)
      .order('created_at', { ascending: false });

    if (filters.courseId) {
      query = query.eq('course_id', filters.courseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Flatten course name for easier consumption
    const flattened = data.map(item => ({
      ...item,
      courseName: item.courseName?.name || 'Unknown'
    }));

    return { data: flattened };
  },
  delete: async (id) => {
    // 1. Get file path first
    const { data: fileRecord } = await supabase
      .from('uploads')
      .select('file_url')
      .eq('id', id)
      .single();

    if (fileRecord?.file_url) {
      // Extract storage path from URL
      // Now using BUCKET_NAME constant 'documents'
      const path = fileRecord.file_url.split(`/${STORAGE_BUCKET}/`)[1];
      if (path) {
        await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      }
    }

    // 2. Delete DB record
    return await supabase.from('uploads').delete().eq('id', id);
  },
  getStats: async () => {
    const { count: uploadsCount } = await supabase
      .from('uploads')
      .select('*', { count: 'exact', head: true });

    const { count: usersCount } = await supabase
      .from('profiles')
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile', { count: 'exact', head: true })

    return { uploadsCount, usersCount };
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
    return await supabase
      .from('enrollments')
      .select('course_id, enrolled_at, courses(*)')
      .eq('user_id', userId);
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
    return await supabase
      .from('student_progress')
      .select('*, courses(name, tutor_type)')
      .eq('user_id', userId);
  }
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
    return await supabase
      .from('student_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
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
  getAllMyScores: async () => {
    return axios.get('/api/grading/all-my-scores');
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
