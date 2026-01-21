import axios from 'axios';
import supabase from '../supabase/supabase';

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
      const userWithProfile = {
        ...data.user,
        ...profile,
        // Explicitly force the role from profile if it exists
        role: profile?.role || data.user.user_metadata?.role || 'student'
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
      // Pass metadata for the trigger to pick up
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
      if (error) throw error;
      return { success: true, session: data.session, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
  logout: async () => {
    await supabase.auth.signOut();
  },
  getSessionUser: async () => {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      const profile = await authService.getDbProfile(data.user.id);
      return { ...data.user, ...profile };
    }
    return null;
  },
  getDbProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,assigned_courses')
      .eq('id', userId)
      .single();
    return data;
  },
  updateRole: async (userId, role) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId)
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,assigned_courses')
      .single();
    if (error) throw error;
    return { data };
  },
  getAllProfiles: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,assigned_courses')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { data };
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
      .select('id,email,name,role,created_at,updated_at,tutor_approved,mobile,assigned_courses')
      .single();
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
  generateQuizFromContent: async (ctx) => axios.post('/api/ai/quiz-from-content', { context: ctx }),
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
    return { data: response.data.students || [], error: null };
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
      .single();
  }
};

// --- SETTINGS SERVICE ---
export const settingsService = {
  get: async () => {
    return await supabase.from('site_settings').select('*').eq('id', 1).single();
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

    const updates = { app_name: appName, updated_at: new Date() };
    if (logoUrl) updates.logo_url = logoUrl;

    return await supabase.from('site_settings').update(updates).eq('id', 1).select().single();
  },
  getAdvanced: async () => {
    return await supabase.from('internal_settings').select('*').eq('id', 1).single();
  },
  updateAdvanced: async (config) => {
    return await supabase.from('internal_settings').update({ ...config, updated_at: new Date() }).eq('id', 1).select().single();
  }
};

// --- CONTACT SERVICE ---
export const contactService = {
  submit: async (formData) => {
    // 1. Save to DB for history
    await supabase.from('contact_messages').insert([{
      full_name: formData.fullName || formData.name,
      email: formData.email,
      mobile: formData.mobile,
      message: formData.message
    }]);

    // 2. Post to backend to send Email
    return axios.post('/api/contact', {
      name: formData.fullName || formData.name,
      email: formData.email,
      mobile: formData.mobile,
      subject: formData.subject || 'Direct Contact',
      message: formData.message,
      type: formData.subject ? 'Support Ticket' : 'General Inquiry'
    });
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
  }
};

export const leaderboardService = {
  getTopStudents: async () => {
    return await supabase.rpc('get_global_leaderboard');
  },
  getCourseRankings: async (courseId) => {
    return await supabase.rpc('get_course_leaderboard', { target_course_id: courseId });
  }
};