// Shared parent-role authorization check, used by every NEW parent-scoped analytics route in
// grading.js. Mirrors the inline check already duplicated across the 3 pre-existing parent
// routes (submissions, my-children, dashboard-data) - those are left untouched since they
// already work; this exists so future parent routes don't keep copy-pasting the same 4 lines.
export async function verifyParentAccess(supabase, userId, studentId) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, linked_students')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return { ok: false, status: 500, error: 'Failed to verify parent profile' };
  }
  if (profile.role !== 'parent') {
    return { ok: false, status: 403, error: 'Only parents can access this endpoint' };
  }

  const linked = profile.linked_students || [];
  const isLinked = linked.some(id => String(id).trim() === String(studentId).trim());
  if (!isLinked) {
    return { ok: false, status: 403, error: "You are not authorized to view this student's reports" };
  }

  return { ok: true };
}
