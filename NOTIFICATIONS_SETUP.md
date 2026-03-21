## Notifications & Reporting Setup

This project implements an **outbox-based notification system**:

- **Student completes test** → backend enqueues notifications → sender processes outbox → sends to **student + linked parents**
- **Weekly reports** → cron hits endpoint → enqueues → sender processes
- **Due-date reminders** → cron hits endpoint → enqueues → sender processes

### Database migration

Apply the migration:

- `src/supabase/migrations/1769200000000-notifications_outbox_and_reports.sql`

This creates:
- `notification_outbox`
- `notification_preferences`
- `report_runs`
- `test_assignments`

### Providers

The current implementation supports:
- **Email** via SMTP (`nodemailer`)
- **SMS** via Twilio REST API
- **WhatsApp** via Twilio WhatsApp REST API

If provider credentials are missing, that channel is skipped (graceful degrade).

### Environment variables

#### App
- **`APP_NAME`**: Display name (default: `AI Tutor Platform`)
- **`APP_URL`**: Public URL used in email CTA links (optional)

#### Email (SMTP)
- **`EMAIL_USER`**
- **`EMAIL_PASS`**
- **`EMAIL_HOST`** (default: `smtp.gmail.com`)
- **`EMAIL_PORT`** (default: `465`)

#### Twilio (SMS + WhatsApp)
- **`TWILIO_ACCOUNT_SID`**
- **`TWILIO_AUTH_TOKEN`**
- **`TWILIO_PHONE_NUMBER`** (E.164, e.g. `+15551234567`)
- **`TWILIO_WHATSAPP_NUMBER`** (E.164 or `whatsapp:+...`, e.g. `+14155238886`)

#### Cron protection (recommended)
- **`CRON_SECRET`**: If set, cron endpoints require header `x-cron-secret: <CRON_SECRET>`

#### Worker
- **`NOTIFICATION_WORKER_INTERVAL_MS`** (default: `15000`)

### Running the sender

Run a background worker that continuously processes pending notifications:

```bash
npm run worker:notifications
```

### Triggering scheduled jobs

These endpoints enqueue messages and also process the outbox once:

- **Process pending outbox**
  - `POST /api/notifications/process-outbox`

- **Weekly report (last 7 days)**
  - `POST /api/notifications/run-weekly`

- **Due-date reminders (next 72 hours by default)**
  - `POST /api/notifications/run-due-reminders`
  - Body: `{ "horizonHours": 72 }`

If `CRON_SECRET` is set, include:
- Header: `x-cron-secret: <CRON_SECRET>`

### Due-date reminders: assigning tests

Due-date reminders use `test_assignments`.

Insert assignments like:
- `user_id` (student profile id)
- `course_id`
- `level` (optional)
- `due_at`

When a student completes the assignment, set `status` to `completed`.

