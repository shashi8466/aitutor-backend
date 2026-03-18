-- ==========================================================
-- Notifications + Reporting System (Outbox Pattern)
-- ==========================================================

-- 1) Notification outbox (single source of truth for sends)
create table if not exists public.notification_outbox (
  id bigserial primary key,
  event_type text not null check (event_type in ('TEST_COMPLETED','WEEKLY_REPORT','DUE_DATE_REMINDER')),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('student','parent')),
  channels jsonb not null default '["email","sms","whatsapp"]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_outbox_status_scheduled_idx
  on public.notification_outbox(status, scheduled_for);

-- 2) Notification preferences (per profile)
create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default true,
  whatsapp_enabled boolean not null default true,
  phone_e164 text,
  whatsapp_e164 text,
  test_completed_enabled boolean not null default true,
  weekly_report_enabled boolean not null default true,
  due_date_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) Weekly report runs (audit)
create table if not exists public.report_runs (
  id bigserial primary key,
  week_start date not null,
  week_end date not null,
  status text not null default 'pending' check (status in ('pending','running','done','failed')),
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4) Test assignments (due-date reminders)
create table if not exists public.test_assignments (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id bigint not null references public.courses(id) on delete cascade,
  level text,
  due_at timestamptz not null,
  created_by uuid references public.profiles(id),
  status text not null default 'assigned' check (status in ('assigned','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id, level, due_at)
);

create index if not exists test_assignments_user_due_idx
  on public.test_assignments(user_id, due_at);

-- 5) Updated_at helpers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_outbox_updated_at on public.notification_outbox;
create trigger trg_notification_outbox_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

drop trigger if exists trg_report_runs_updated_at on public.report_runs;
create trigger trg_report_runs_updated_at
before update on public.report_runs
for each row execute function public.set_updated_at();

drop trigger if exists trg_test_assignments_updated_at on public.test_assignments;
create trigger trg_test_assignments_updated_at
before update on public.test_assignments
for each row execute function public.set_updated_at();

-- 6) RLS (optional; service role bypasses RLS)
alter table public.notification_outbox enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.report_runs enable row level security;
alter table public.test_assignments enable row level security;

-- Preferences: user can view/update their own preferences
drop policy if exists "prefs_select_own" on public.notification_preferences;
create policy "prefs_select_own"
  on public.notification_preferences for select
  using (auth.uid() = profile_id);

drop policy if exists "prefs_upsert_own" on public.notification_preferences;
create policy "prefs_upsert_own"
  on public.notification_preferences for insert
  with check (auth.uid() = profile_id);

drop policy if exists "prefs_update_own" on public.notification_preferences;
create policy "prefs_update_own"
  on public.notification_preferences for update
  using (auth.uid() = profile_id);

-- Outbox / report_runs / assignments are managed by backend (service role).
-- We do not add broad client policies here.

