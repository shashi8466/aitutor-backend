/*
# Add a Recordings feature toggle to plan_settings

Recordings (the student/tutor sidebar's video library) had no per-plan gating - add it to the
same Feature Toggles list as Score Predictor, Custom Prep, Test Review Agent, etc.

Defaults to true for both plans so existing behavior (Recordings freely accessible) is unchanged
until an admin explicitly turns it off for a plan.
*/

ALTER TABLE public.plan_settings
  ADD COLUMN IF NOT EXISTS feature_recordings boolean NOT NULL DEFAULT true;
