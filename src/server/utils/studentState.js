import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!SUPABASE_KEY) throw new Error('SUPABASE_KEY is required.');
  return createClient(SUPABASE_URL, SUPABASE_KEY);
};

// ── In-memory fallback (used when DB write fails) ──
const memoryStore = new Map();

const defaultState = () => ({
  current_state: 'Start Session',
  preferences: {},
  practice_module: { active: false, quiz_data: null },
  teaching_module: { active: false, step: 'INIT', topic: '' },
  seen_question_texts: [],
  session_log: [],
  error_patterns: {},
  baseline: null,
});

export const getStudentState = async (userId) => {
  // Always return in-memory first if we have it (faster, avoids DB race)
  if (memoryStore.has(userId)) return memoryStore.get(userId);

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('student_states')
      .select('state_data')
      .eq('user_id', userId)
      .maybeSingle();         // maybeSingle() — no error if row missing

    if (!error && data?.state_data) {
      const state = { ...defaultState(), ...data.state_data, user_id: userId };
      memoryStore.set(userId, state);
      return state;
    }
  } catch (err) {
    console.warn('⚠️ [State] DB read failed, using in-memory:', err.message);
  }

  const freshState = { ...defaultState(), user_id: userId };
  memoryStore.set(userId, freshState);
  return freshState;
};

export const updateStudentState = async (userId, newState) => {
  newState.user_id = userId;
  newState.updated_at = new Date().toISOString();

  // Always keep in memory (authoritative during session)
  memoryStore.set(userId, newState);

  // ── Persist only the tutor session blob to state_data (JSONB) ──
  const stateBlob = {
    current_state: newState.current_state,
    preferences: newState.preferences,
    practice_module: newState.practice_module,
    teaching_module: newState.teaching_module,
    seen_question_texts: newState.seen_question_texts,
    error_patterns: newState.error_patterns,
    baseline: newState.baseline,
    // Trim session log to last 20 entries to keep DB size manageable
    session_log: (newState.session_log || []).slice(-20),
  };

  try {
    const supabase = getSupabase();

    // Check if row exists
    const { data: existing } = await supabase
      .from('student_states')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('student_states')
        .update({ state_data: stateBlob, updated_at: newState.updated_at })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('student_states')
        .insert([{ user_id: userId, state_data: stateBlob, updated_at: newState.updated_at }]);
    }
  } catch (err) {
    console.warn('⚠️ [State] DB write failed, state kept in memory:', err.message);
  }

  return newState;
};



