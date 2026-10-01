// Admin > Plan Management > Course & Recording Visibility - backend enforcement for the "My
// Courses" side (the "Recordings" side lives directly in src/server/routes/recordings.js, which
// already goes through this same service-role client for every read). This is a SEPARATE global
// layer from plan_settings' per-plan feature toggles: that controls whether a PLAN can use a
// feature at all, this controls which CATEGORIES are visible platform-wide, regardless of plan.
//
// Mirrors StudentCourseList.jsx's own mainCat derivation (duplicated intentionally rather than
// shared, so this backend check can never be affected by edits to that frontend-only component)
// exactly, so a course that renders under one category card on the frontend is gated by the
// SAME category here - a course can never show as "AP" to the student and be checked as "SAT"
// server-side, which would make this check meaningless.
export const deriveMainCategory = (course) => {
  let mainCat = course.main_category || (
    (course.is_adaptive || (course.tutor_type || '').toLowerCase().includes('sat')) ? 'SAT' :
    (course.tutor_type || '').toLowerCase().includes('act') ? 'ACT' :
    ['physics', 'chemistry', 'biology', 'calculus', 'algebra', 'geometry', 'science', 'psychology', 'history', 'government', 'english', 'environmental'].some((kw) => (course.tutor_type || '').toLowerCase().includes(kw)) ? 'AP' : 'SAT'
  );
  if (mainCat === 'FULL LENGTH TESTs' || course.is_adaptive || (course.tutor_type || '').toUpperCase() === 'LINEAR SAT') {
    mainCat = 'FULL LENGTH TESTS';
  }
  return mainCat;
};

/**
 * Throws a 403 if `courseId`'s category has been globally hidden via Course & Recording
 * Visibility. Fails OPEN (never throws) if the category_visibility_settings table isn't
 * migrated onto this environment yet, or the course/category can't be resolved - this is a
 * visibility REFINEMENT on top of normal course access, never the primary access gate.
 */
export async function assertCategoryVisible(supabaseAdmin, courseId) {
  if (!courseId) return;
  try {
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('main_category, tutor_type, is_adaptive')
      .eq('id', courseId)
      .maybeSingle();
    if (!course) return;

    const mainCat = deriveMainCategory(course);
    const { data: row, error } = await supabaseAdmin
      .from('category_visibility_settings')
      .select('enabled')
      .eq('context', 'my_courses')
      .eq('category', mainCat)
      .maybeSingle();
    if (error) {
      console.error('[CategoryVisibility] Failed to read category_visibility_settings - has that migration been run?', error.message);
      return;
    }
    if (row && row.enabled === false) {
      throw Object.assign(new Error('This category is not currently available.'), { statusCode: 403 });
    }
  } catch (err) {
    if (err.statusCode === 403) throw err;
    console.error('[CategoryVisibility] Non-fatal error checking category visibility:', err.message);
  }
}
