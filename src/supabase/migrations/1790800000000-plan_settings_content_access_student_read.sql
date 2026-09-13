/*
# Let every authenticated user read plan_settings and plan_content_access

These two tables are admin-configured feature flags / content-access rules, but they were only
ever readable by the admin who configures them - there was no SELECT policy granting any other
role access at all, so a direct client-side query from a student session (planService.getSettings
/ getContentAccess) silently comes back with zero rows (Postgres RLS returns an empty result, not
an error, when no policy matches).

The visible symptom: every sidebar item gated by a plan_settings feature flag (Test Review Agent,
College Advisor, Weakness Drills, Study Plan Agent, Score Predictor, Leaderboard) appeared
"disabled by Admin" for every student regardless of the actual configured value, since
planSettings always resolved to undefined. Practice Tests similarly appeared empty, since
plan_content_access (which grants specific courses/tests to a plan) also came back empty.

Both tables are read-only reference/config data with nothing user-specific or sensitive in them -
safe to expose for SELECT to any authenticated user. Only INSERT/UPDATE/DELETE need to stay
admin-only, and this migration does not touch those.
*/

ALTER TABLE public.plan_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_content_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view plan settings" ON public.plan_settings;
CREATE POLICY "Authenticated users can view plan settings"
ON public.plan_settings FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can view plan content access" ON public.plan_content_access;
CREATE POLICY "Authenticated users can view plan content access"
ON public.plan_content_access FOR SELECT
TO authenticated
USING (true);
