// Defense-in-depth check for the grading routes, which write via a
// service-role client that bypasses RLS entirely. Calls the same
// is_course_accessible() Postgres function the RLS policies use, so there is
// exactly one place that defines "can this student access this course".
export async function assertCourseAccessible(supabaseAdmin, userId, courseId) {
  const { data, error } = await supabaseAdmin.rpc('is_course_accessible', {
    p_user_id: userId,
    p_course_id: courseId,
  });

  if (error) {
    throw Object.assign(new Error('Access check failed'), { statusCode: 500 });
  }
  if (!data) {
    throw Object.assign(new Error('You do not have access to this course.'), { statusCode: 403 });
  }
}
