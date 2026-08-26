import supabase from '../supabase/supabase';
import { enrollmentService, planService } from '../services/api';

/**
 * Single source of truth for "does this student currently have access to this course/topic."
 * Group-granted access is resolved live from student_groups.assigned_course_ids (via the
 * get_my_group_granted_course_ids RPC, backed by RESTRICTIVE RLS on courses/questions) instead
 * of the `enrollments` table, which is only a one-time snapshot written at group-join time and
 * never re-synced when a tutor later adds content to a group the student already belongs to.
 * Every access-check site (course/topic view, practice test listing, practice test start, quiz
 * start, full-length test start) must call this instead of re-deriving its own access logic, so
 * a newly assigned topic is granted the same way everywhere.
 */
export async function getGroupGrantedCourseIds() {
  try {
    const { data } = await supabase.rpc('get_my_group_granted_course_ids');
    return new Set(data || []);
  } catch (err) {
    console.warn('Group access check failed:', err);
    return new Set();
  }
}

export async function resolveCourseAccess({ userId, courseId, userPlan = 'free', isTutorUser = false, isDemo = false }) {
  if (isTutorUser) {
    return { isEnrolled: true, hasGroupAccess: false, groupAccessIds: new Set(), planAccess: [] };
  }

  const courseIdNum = parseInt(courseId, 10);
  const plan = (userPlan || 'free').toLowerCase();

  const [isEnrolledRes, planAccessRes, groupAccessIds] = await Promise.all([
    enrollmentService.isEnrolled(userId, courseIdNum).catch(err => {
      console.warn('Enrollment check failed:', err);
      return false;
    }),
    planService.getContentAccess(plan).catch(() => ({ data: [] })),
    getGroupGrantedCourseIds()
  ]);

  const accessData = planAccessRes.data || [];
  const hasGroupAccess = groupAccessIds.has(courseIdNum);

  let hasTopicAccess = false;
  if (plan !== 'premium') {
    const assignedTopics = accessData
      .filter(a => a.content_type === 'topic' && a.plan_type === 'free')
      .map(a => a.content_id);

    if (assignedTopics.length > 0) {
      try {
        const { data: topicMaps } = await supabase
          .from('questions')
          .select('course_id')
          .in('topic', assignedTopics)
          .eq('course_id', courseIdNum);
        hasTopicAccess = !!(topicMaps && topicMaps.length > 0);
      } catch (err) {
        console.warn('Topic access check failed:', err);
      }
    }
  }

  const hasDirectAccess = accessData.some(a => a.content_type === 'course' && String(a.content_id) === String(courseId) && a.plan_type === plan);
  const isPremiumUser = plan === 'premium';

  let isEnrolled = isEnrolledRes || hasDirectAccess || hasTopicAccess || isPremiumUser || hasGroupAccess;
  if (!isEnrolled && isDemo) isEnrolled = true;

  return { isEnrolled, hasGroupAccess, groupAccessIds, planAccess: accessData };
}
