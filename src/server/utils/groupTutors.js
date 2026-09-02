// Shared "Group Co-Tutor" authorization helpers for tutor.js and admin-groups.js.
// Routes that already fetch the `group` row for `created_by` should OR this
// into their existing boolean condition rather than refetching group state.
export const isCoTutorOf = async (supabase, groupId, userId) => {
  const { data } = await supabase
    .from('group_tutors')
    .select('id')
    .eq('group_id', groupId)
    .eq('tutor_id', userId)
    .maybeSingle();
  return !!data;
};

// Returns the group_ids for which userId is a co-tutor. Used by list/filter
// routes that need to expand a `created_by` filter into "owned OR co-tutor".
export const getCoTutorGroupIds = async (supabase, userId) => {
  const { data } = await supabase
    .from('group_tutors')
    .select('group_id')
    .eq('tutor_id', userId);
  return (data || []).map(r => r.group_id);
};

// Unique student_ids across every group this tutor owns or co-tutors. This is "this tutor's
// students" - deliberately narrower than profiles.assigned_courses (which is "students enrolled
// in any course this tutor is assigned to teach," a broader, course-staffing concept unrelated
// to which students the tutor has actually organized into their own Student Groups). Used by the
// Tutor Student Roster and Tutor Dashboard stats so both reflect the same "my students" set.
export const getTutorGroupStudentIds = async (supabase, userId) => {
  const coTutorGroupIds = await getCoTutorGroupIds(supabase, userId);
  let groupQuery = supabase.from('student_groups').select('id');
  groupQuery = coTutorGroupIds.length > 0
    ? groupQuery.or(`created_by.eq.${userId},id.in.(${coTutorGroupIds.join(',')})`)
    : groupQuery.eq('created_by', userId);
  const { data: groups } = await groupQuery;
  const groupIds = (groups || []).map(g => g.id);
  if (groupIds.length === 0) return [];

  const uniqueStudentIds = new Set();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from('group_members')
      .select('student_id')
      .in('group_id', groupIds)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!page || page.length === 0) break;
    page.forEach(r => uniqueStudentIds.add(r.student_id));
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return Array.from(uniqueStudentIds);
};
