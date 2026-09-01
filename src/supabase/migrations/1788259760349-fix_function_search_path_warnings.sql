-- ==========================================================
-- FIX: Supabase Security Advisor - "Function Search Path Mutable" (107 warnings)
-- ==========================================================
-- Every SQL/PL/pgSQL function in the public schema that doesn't explicitly pin its
-- search_path is vulnerable to search-path hijacking: a role that can create objects in a
-- schema earlier in the resolution order (or manipulate its own session search_path before
-- calling the function) could get the function to resolve an unqualified table/function name
-- to an attacker-controlled object instead of the intended public.* one, especially dangerous
-- for SECURITY DEFINER functions that run with the definer's privileges.
--
-- Fix: pin search_path = public on every function in the public schema that doesn't already
-- have one set, via ALTER FUNCTION - this doesn't change behavior for any function that (like
-- essentially all of this app's functions) only ever references public-schema objects; it just
-- makes that resolution explicit instead of relying on the caller's mutable session setting.
-- Done as one dynamic loop over pg_proc rather than one ALTER per function, so this covers
-- every currently-flagged function (and any the Advisor's live list includes beyond what was
-- visible on screen) without needing the exact enumerated list.
-- ==========================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind IN ('f', 'p') -- normal functions and procedures (not aggregates/window fns)
          AND NOT EXISTS (
              SELECT 1
              FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) AS cfg
              WHERE cfg LIKE 'search_path=%'
          )
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.func_signature);
    END LOOP;
END $$;
