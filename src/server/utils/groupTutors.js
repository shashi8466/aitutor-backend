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
