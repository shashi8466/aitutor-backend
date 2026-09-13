/*
# Add a Custom Prep feature toggle to plan_settings

Custom Prep (the student sidebar's "Custom Prep" AI agent) had no per-plan gating at all - the
Admin Feature Toggles screen is being consolidated to cover exactly the student sidebar's
configurable features (see the accompanying app changes), and Custom Prep belongs in that list
alongside Study Plan Agent, Weakness Drills, Test Review Agent, etc.

Defaults to true for both plans so existing behavior (Custom Prep freely accessible) is
unchanged until an admin explicitly turns it off for a plan.
*/

ALTER TABLE public.plan_settings
  ADD COLUMN IF NOT EXISTS feature_custom_prep boolean NOT NULL DEFAULT true;
