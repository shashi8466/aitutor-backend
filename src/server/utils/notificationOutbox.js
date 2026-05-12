import supabase from '../../supabase/supabaseAdmin.js';
import { 
  sendNotification, 
  buildTestCompletionEmail, 
  buildWeeklyReportEmail, 
  buildDueDateReminderEmail, 
  buildWelcomeEmail,
  buildContactSubmissionEmail
} from './notificationEngine.js';
import { getInternalSettings } from './internalSettings.js';

const DEFAULT_CHANNELS = ['email', 'sms', 'whatsapp'];

function normalizeChannels(channels) {
  if (!channels) return DEFAULT_CHANNELS;
  if (Array.isArray(channels)) return channels;
  if (typeof channels === 'string') {
    try {
      const parsed = JSON.parse(channels);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Not JSON, handle as single channel string or comma-separated
      if (channels.includes(',')) return channels.split(',').map(c => c.trim());
    }
    return [channels];
  }
  return DEFAULT_CHANNELS;
}

async function getPreferences(profileId) {
  // Use the canonical preferences table (matches migrations + API routes)
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

async function getProfile(profileId) {
  const { data } = await supabase
    .from('profiles')
    .select('id, name, email, mobile, father_name, father_mobile, role, notification_preferences, phone_number, whatsapp_number')
    .eq('id', profileId)
    .single();
  return data;
}

function channelsFromPrefs(prefs, channelsRequested, eventType, profile = null) {
  const requested = normalizeChannels(channelsRequested);
  
  // Merge profile.notification_preferences (JSONB) into prefs if available
  const profilePrefs = profile?.notification_preferences || {};
  
  // FIXED: Prioritize profilePrefs (UI toggle) over legacy table. 
  // If explicitly set to false in the profile, it stays false even if the table says true.
  // CRITICAL: We treat null/undefined in profilePrefs as 'not set', allowing fallback.
  // But if the UI shows 'OFF', it should ideally be explicitly 'false'.
  const isEmailEnabled = (profilePrefs.email ?? prefs?.email_enabled ?? true) !== false;
  const isSmsEnabled = (profilePrefs.sms ?? prefs?.sms_enabled ?? true) !== false; // DEFAULT TO TRUE for required SMS
  const isWhatsappEnabled = (profilePrefs.whatsapp ?? prefs?.whatsapp_enabled ?? false) !== false;

  // Eligibility check: IF user is inactive/suspended, no notifications go out.
  const status = (profile?.status || 'active').toLowerCase();
  if (status === 'inactive' || status === 'suspended') {
    return [];
  }

  // FIXED: Event-level toggles should also be strict.
  // Previous bug: !== false meant undefined was allowed.
  // We prioritize profilePrefs (e.g. testCompletion) over legacy prefs.
  const testCompEnabled = (profilePrefs.testCompletion ?? prefs?.test_completed_enabled ?? true) !== false;
  const weeklyRepEnabled = (profilePrefs.weeklyProgress ?? prefs?.weekly_report_enabled ?? true) !== false;
  const dueDateEnabled = (profilePrefs.testDueDate ?? prefs?.due_date_enabled ?? true) !== false;

  const allowEvent =
    (eventType === 'WELCOME_EMAIL') ||
    (eventType === 'CONTACT_SUBMISSION') ||
    (eventType === 'TEST_COMPLETED' && testCompEnabled) ||
    (eventType === 'WEEKLY_REPORT' && weeklyRepEnabled) ||
    (eventType === 'DUE_DATE_REMINDER' && dueDateEnabled);

  if (!allowEvent) {
    console.log(`ℹ️ [NotificationOutbox] Blocked Event: ${profile?.email} | Event: ${eventType} | Student/Parent Toggles: testCompletion=${testCompEnabled}, weekly=${weeklyRepEnabled}, due=${dueDateEnabled}`);
    return [];
  }

  const enabled = [];
  if (requested.includes('email') && isEmailEnabled) enabled.push('email');
  if (requested.includes('sms') && isSmsEnabled) enabled.push('sms');
  if (requested.includes('whatsapp') && isWhatsappEnabled) enabled.push('whatsapp');
  
  console.log(`🔍 [NotificationOutbox] Final Preference Check: ${profile?.email} | Event: ${eventType} | Requested: [${requested}] | Enabled: [${enabled}] | profilePrefs: ${JSON.stringify(profilePrefs)} | tablePrefs: ${JSON.stringify(prefs || {})}`);

  if (enabled.length < requested.length) {
    const reason = !allowEvent ? 'event_type_disabled' : 'channel_disabled';
    console.log(`ℹ️ [NotificationOutbox] Preference Filter: ${profile?.email} | Requested: [${requested}] | Enabled: [${enabled}] | reason: ${reason}`);
  }

  return enabled;
}

function resolvePhone({ recipientProfile, prefs, fallbackPhone }) {
  return prefs?.phone_e164 || recipientProfile?.phone_number || recipientProfile?.mobile || fallbackPhone || null;
}

function resolveWhatsApp({ recipientProfile, prefs, fallbackPhone }) {
  return prefs?.whatsapp_e164 || recipientProfile?.whatsapp_number || recipientProfile?.phone_number || recipientProfile?.mobile || fallbackPhone || null;
}

async function buildContent({ eventType, payload, recipientName, isParent }) {
  console.log(`🔍 [NotificationOutbox] Building content for event: "${eventType}"`);
  console.log(`📦 [NotificationOutbox] Payload keys: ${Object.keys(payload || {}).join(', ')}`);

  // 1. Try DB settings for production URL
  const dbSettings = await getInternalSettings();
  const siteConfig = dbSettings?.site_config || {};
  
  let appUrl = siteConfig.appUrl || process.env.APP_URL || process.env.VITE_APP_URL || '';
  // Prefer the frontend base URL if available (especially on Render).
  // HashRouter URLs need the full origin; if appUrl is empty, we lose the `#` deep link.
  appUrl = appUrl || process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || '';
  if (appUrl.endsWith('/')) {
    appUrl = appUrl.slice(0, -1);
  }
  const appName = process.env.APP_NAME || 'AIPrep365';

  const normalizedEventType = (eventType || '').trim().toUpperCase();

  if (normalizedEventType === 'TEST_COMPLETED') {
    const subject = 'Test Completed – Performance Summary';
    console.log(`✨ [NotificationOutbox] Using subject: "${subject}" for event: "${eventType}"`);
    
    // Construct deep-link report URL
    const reportPath = isParent
      ? `/parent/child/${payload.studentId}/course/${payload.courseId}/difficulty/${payload.level?.toLowerCase() || 'medium'}/test/${payload.submissionId}`
      : `/student/detailed-review/${payload.submissionId}`;
    
    // Email clients sometimes strip `#` fragments. Include a `?redirect=...`
    // fallback so the app can still navigate to the exact report route.
    const redirectParam = `?redirect=${encodeURIComponent(reportPath)}`;

    // Include the hash route too (HashRouter expects it).
    const hashPart = `#${reportPath}`;

    // `appUrl` is expected to be something like `https://.../dashboard` already,
    // so we should NOT insert an extra `/` before `?redirect=`.
    const finalUrl = appUrl ? `${appUrl}${redirectParam}${hashPart}` : `/${redirectParam}${hashPart}`;

    const emailHtml = buildTestCompletionEmail({
      studentName: payload.studentName,
      testName: payload.testName,
      courseName: payload.courseName,
      score: payload.rawPercentage,
      totalQuestions: payload.totalQuestions,
      correctAnswers: payload.rawScore,
      scaledScore: payload.scaledScore,
      testDate: payload.testDate,
      appUrl,
      reportUrl: finalUrl,
      modularScores: payload.modularScores
    });
    const smsMessage =
      `${appName}: ${payload.studentName || 'Student'} completed ${payload.courseName || 'a test'} (Comprehensive). ` +
      `Status: Completed | Score: ${Math.round(payload.rawPercentage || 0)}% | Scaled: ${payload.scaledScore || 'N/A'} | ` +
      `Time: ${new Date(payload.testDate || Date.now()).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}.`;
    return { subject, emailHtml, smsMessage };
  }

  if (normalizedEventType === 'WEEKLY_REPORT') {
    const subject = `Weekly Progress Report${isParent ? `: ${payload.studentName || ''}` : ''}`;
    
    // Construct dedicated weekly report URL
    const weekStartPart = payload.weekStart ? payload.weekStart.split('T')[0] : new Date().toISOString().split('T')[0];
    const dashboardPath = isParent
      ? `/parent/weekly-report/${payload.studentId}/${weekStartPart}`
      : `/student/weekly-report/${weekStartPart}`;
    
    // Direct URL with fallback
    const separator = appUrl.endsWith('/') ? '' : '/';
    const redirectParam = `?redirect=${encodeURIComponent(dashboardPath)}`;
    const hashPart = `#${dashboardPath}`;
    const finalUrl = appUrl ? `${appUrl}${separator}${redirectParam}${hashPart}` : dashboardPath;

    const emailHtml = buildWeeklyReportEmail({
      recipientName,
      studentName: payload.studentName,
      submissions: payload.submissions || [],
      weekStart: payload.weekStart,
      weekEnd: payload.weekEnd,
      appUrl,
      isParent,
      reportUrl: finalUrl
    });
    const smsMessage =
      `${appName}: Weekly Progress Summary${isParent ? ` for ${payload.studentName}` : ''}. ` +
      `Total Tests: ${payload.totalTests || 0} | Avg Score: ${payload.avgScore || 0}% | Best: ${payload.bestScore || 0}%. ` +
      `Keep up the great work!`;
    return { subject, emailHtml, smsMessage };
  }

  if (normalizedEventType === 'DUE_DATE_REMINDER') {
    const subject = `Upcoming Test Due Dates${isParent ? `: ${payload.studentName || ''}` : ''}`;
    
    // Construct target URL (dashboard)
    const targetPath = isParent
      ? `/parent/child/${payload.studentId}`
      : `/student`;
    
    // Direct URL with fallback
    const separator = appUrl.endsWith('/') ? '' : '/';
    const redirectParam = `?redirect=${encodeURIComponent(targetPath)}`;
    const hashPart = `#${targetPath}`;
    const finalUrl = appUrl ? `${appUrl}${separator}${redirectParam}${hashPart}` : targetPath;

    const emailHtml = buildDueDateReminderEmail({
      recipientName,
      studentName: payload.studentName,
      dueItems: payload.dueItems || [],
      appUrl,
      isParent,
      reportUrl: finalUrl
    });
    const first = (payload.dueItems || [])[0];
    const smsMessage =
      `${appName}: Upcoming test reminder${isParent ? ` for ${payload.studentName}` : ''}. ` +
      (first ? `${first.course_name || 'Course'} is due on ${new Date(first.due_date).toLocaleDateString()}. ` : '') +
      `Please complete the test on time to stay on track!`;
    return { subject, emailHtml, smsMessage };
  }

  if (normalizedEventType === 'WELCOME_EMAIL') {
    const subject = `Welcome to ${appName} 🎉`;
    const emailHtml = buildWelcomeEmail({
      name: payload.name || recipientName,
      appUrl: appUrl || '#'
    });
    const smsMessage = `Welcome to ${appName}! You have successfully registered. Start learning today 🚀`;
    return { subject, emailHtml, smsMessage };
  }

  if (normalizedEventType === 'CONTACT_SUBMISSION') {
    console.log(`✅ [NotificationOutbox] Handling CONTACT_SUBMISSION logic for ${payload.email}`);
    // If it's a support ticket, use the subject directly as requested.
    // If it's a generic contact form, use [Contact Form] prefix.
    let subjectLine = payload.subject || 'New Contact Submission';
    if (payload.type === 'Support Ticket' || payload.subject) {
      subjectLine = payload.subject;
    } else {
      subjectLine = `[Contact Form] ${payload.name || 'New Submission'}`;
    }

    const subject = subjectLine;
    const emailHtml = buildContactSubmissionEmail({
      name: payload.name,
      email: payload.email,
      mobile: payload.mobile || payload.phone, // Support both keys
      subject: payload.subject,
      type: payload.type,
      message: payload.message,
      appName: appName,
      additionalDetailsHtml: payload.additionalDetailsHtml
    });
    const smsMessage = `${appName}: New ${payload.type || 'contact'} from ${payload.name}. Subject: ${payload.subject}`;
    return { subject, emailHtml, smsMessage };
  }

  console.warn(`⚠️ [NotificationOutbox] No match found for event type: "${eventType}". Normalized: "${normalizedEventType}"`);
  return { 
    subject: `${appName} Notification`, 
    emailHtml: `<h2>${appName} Notification</h2><p>You have a new alert regarding ${eventType}. Please check your dashboard.</p>`, 
    smsMessage: `${appName}: You have a new notification.` 
  };
}

export async function enqueueNotification({
  eventType,
  recipientProfileId,
  recipientType,
  channels = DEFAULT_CHANNELS,
  payload = {},
  scheduledFor = new Date().toISOString()
}) {
  // Idempotency / de-dupe for high-frequency events (esp. TEST_COMPLETED).
  // Prevents duplicate sends when:
  // - cron runs multiple instances
  // - manual "reset failed -> pending" is executed
  // - endpoints are retried by clients
  const submissionId = payload?.submissionId ?? payload?.submission_id ?? null;
  const recipientEmail = payload?.recipientEmail ? String(payload.recipientEmail).trim().toLowerCase() : null;

  if (eventType === 'TEST_COMPLETED' && submissionId) {
    // 🔒 CRITICAL: Cross-profile de-duplication.
    // Use raw JSONB text cast to match BOTH numeric and string stored values.
    // .contains() is type-strict and silently misses the alternative form.
    const submissionIdStr = String(submissionId);

    const { data: existing, error: existingErr } = await supabase
      .from('notification_outbox')
      .select('id, status, attempts, scheduled_for')
      .eq('event_type', eventType)
      .or(
        recipientEmail
          ? `recipient_profile_id.eq.${recipientProfileId},payload->>recipientEmail.eq.${recipientEmail}`
          : `recipient_profile_id.eq.${recipientProfileId}`
      )
      // Filter by submissionId using raw text cast (handles number/string mismatch)
      .filter('payload->>submissionId', 'eq', submissionIdStr)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!existingErr && existing?.length) {
      const row = existing[0];

      // TERMINAL STATE: already sent — NEVER re-send.
      if (row.status === 'sent') {
        console.log(`✅ [Outbox] Already SENT for sub ${submissionId} → ${recipientProfileId}. Blocked.`);
        return row.id;
      }

      // Queued or processing — skip to avoid duplicates.
      if (row.status === 'pending' || row.status === 'processing') {
        console.log(`ℹ️ [Outbox] Duplicate skipped for ${recipientProfileId} (Status: ${row.status})`);
        return row.id;
      }

      // Previously failed — re-queue the SAME row if under max attempts.
      const maxAttempts = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);
      if (row.status === 'failed' && (row.attempts || 0) < maxAttempts) {
        const { data: requeued, error: requeueErr } = await supabase
          .from('notification_outbox')
          .update({ status: 'pending', scheduled_for: scheduledFor, last_error: null })
          .eq('id', row.id)
          .select('id')
          .single();
        if (!requeueErr && requeued?.id) return requeued.id;
      } else if (row.status === 'failed') {
        // Max attempts exhausted — do NOT create a new row.
        console.log(`⚠️ [Outbox] Sub ${submissionId} → ${recipientProfileId} exhausted retries. Blocking.`);
        return row.id;
      }
    }
  }

  const { data, error } = await supabase
    .from('notification_outbox')
    .insert({
      event_type: eventType,
      recipient_profile_id: recipientProfileId,
      recipient_type: recipientType,
      status: 'pending',
      channels,
      payload,
      scheduled_for: scheduledFor
    })
    .select('id')
    .single();

  if (error) {
    // Postgres unique constraint violation (23505) = row already exists.
    // Return the existing row's ID instead of throwing — makes this idempotent.
    if (error.code === '23505') {
      console.log(`ℹ️ [Outbox] Unique constraint hit for ${recipientProfileId} / sub ${payload?.submissionId} — fetching existing row.`);
      const subIdStr = String(payload?.submissionId ?? '');
      const { data: existing } = await supabase
        .from('notification_outbox')
        .select('id')
        .eq('event_type', eventType)
        .eq('recipient_profile_id', recipientProfileId)
        .filter('payload->>submissionId', 'eq', subIdStr)
        .limit(1)
        .maybeSingle();
      return existing?.id ?? null;
    }
    throw error;
  }

  console.log(`📬 [Outbox] Enqueued NEW notification ${data.id} for ${recipientProfileId}`);
  return data.id;
}

export async function processOutboxOnce({ limit = 25 } = {}) {
  // Fetch pending items due now
  const { data: items, error } = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 🟢 FIX: Ignore items older than 24h
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!items?.length) return { processed: 0 };

  let processed = 0;

  for (const item of items) {
    // Claim
    const { data: claimed, error: claimError } = await supabase
      .from('notification_outbox')
      .update({ status: 'processing' })
      .eq('id', item.id)
      .eq('status', 'pending')
      .select('id');

    // If another worker claimed it first, this update returns 0 rows (no error).
    if (claimError || !claimed?.length) continue;

    // 🟢 FIX: Immediate payload validation to prevent 'Mixed Data' errors
    if (!item.payload || typeof item.payload !== 'object') {
        console.error(`❌ [Outbox] Item ${item.id} has invalid payload - skipping.`);
        await supabase.from('notification_outbox').update({ status: 'failed', last_error: 'Invalid payload' }).eq('id', item.id);
        continue;
    }

    // emailWasSent must be declared OUTSIDE try so catch can read it.
    // If email was dispatched and then ANY post-send code throws (e.g. DB update hiccup),
    // the catch must NOT retry as 'pending' (which would re-send the email).
    let emailWasSent = false;

    try {
      const recipientProfileId = item.recipient_profile_id;
      const recipientProfile = recipientProfileId ? await getProfile(recipientProfileId) : null;
      const prefs = recipientProfileId ? await getPreferences(recipientProfileId) : null;

      const enabledChannels = channelsFromPrefs(prefs, item.channels, item.event_type, recipientProfile);
      const deliveredChannels = item.delivered_channels || [];
      const pendingChannels = (enabledChannels || []).filter(c => !deliveredChannels.includes(c));

      if (!pendingChannels.length) {
        await supabase
          .from('notification_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: item.attempts + 1 })
          .eq('id', item.id);
        processed++;
        continue;
      }

      // The row is already claimed ('processing') by the first atomic update at line ~395.
      // No second lock needed here.
      const isParent = item.recipient_type === 'parent';
      const recipientName = recipientProfile?.name || (isParent ? 'Parent' : 'Student');

      const fallbackPhone = item.payload?.fallbackPhone || recipientProfile?.father_mobile || null;

      const content = await buildContent({
        eventType: item.event_type,
        payload: item.payload || {},
        recipientName,
        isParent
      });

      const phone = resolvePhone({ recipientProfile, prefs, fallbackPhone });
      const whatsappPhone = resolveWhatsApp({ recipientProfile, prefs, fallbackPhone });

      // Handle both recipientEmail (singular) and recipientEmails (array)
      let recipientEmails = item.payload?.recipientEmails || [];
      if (recipientEmails.length === 0 && item.payload?.recipientEmail) {
          recipientEmails = [item.payload.recipientEmail];
      }
      if (recipientEmails.length === 0 && recipientProfile?.email) {
          recipientEmails = [recipientProfile.email];
      }

      // Gracefully degrade enabled channels if destination contact info is missing
      const actualChannels = [];
      if (pendingChannels.includes('email') && recipientEmails.length > 0) actualChannels.push('email');
      if (pendingChannels.includes('sms') && (phone || whatsappPhone)) actualChannels.push('sms');
      if (pendingChannels.includes('whatsapp') && (phone || whatsappPhone)) actualChannels.push('whatsapp');

      if (actualChannels.length === 0) {
        console.warn(`⚠️ [Outbox] No valid contact methods for remaining channels in ${item.event_type} → ${item.recipient_profile_id}. Marking sent.`);
        await supabase
          .from('notification_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: (item.attempts || 0) + 1 })
          .eq('id', item.id);
        processed++;
        continue;
      }

      console.log(`📡 [NotificationOutbox] Dispatching ${actualChannels.join(',')} (Skipping: ${deliveredChannels.join(',')}) to ${recipientEmails.join(',')} for ${item.event_type} (Sub: ${item.payload?.submissionId})`);
      const results = await sendNotification({
        email: actualChannels.includes('email') ? recipientEmails.join(',') : null,
        phone: actualChannels.includes('whatsapp') ? whatsappPhone : (actualChannels.includes('sms') ? phone : null),
        subject: content.subject,
        emailHtml: content.emailHtml,
        smsMessage: content.smsMessage,
        channels: actualChannels
      });

      // Track which channels were successfully delivered
      const newlyDelivered = [...deliveredChannels];
      if (actualChannels.includes('email') && results.email?.ok) {
        newlyDelivered.push('email');
        emailWasSent = true; // Set BEFORE anything else that might throw
      }
      if (actualChannels.includes('sms') && results.sms?.ok) newlyDelivered.push('sms');
      if (actualChannels.includes('whatsapp') && results.whatsapp?.ok) newlyDelivered.push('whatsapp');

      const emailAttempted = actualChannels.includes('email');
      const emailDelivered = emailAttempted ? results.email.ok : true; // If not attempted, treat as ok

      console.log(`✅ [NotificationOutbox] Result: Email=${results.email?.ok ? 'Sent ✓' : (emailAttempted ? 'FAILED ✗' : 'N/A')}, SMS=${results.sms?.ok ? 'Sent ✓' : 'N/A or Failed'}`);

      const nextAttempts = (item.attempts || 0) + 1;
      const maxAttempts = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);
      const backoffMinutes = Math.min(30, Math.pow(2, Math.max(0, nextAttempts - 1)));
      const retryAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

      // ─── KEY FIX ────────────────────────────────────────────────────────────
      // Email is the PRIMARY channel. If email was delivered (or not required),
      // the notification is DONE — mark as 'sent' immediately.
      // SMS/WhatsApp are secondary: their failure must NEVER cause an email re-send.
      // Before this fix: ok = emailOk && smsOk → SMS failure → row retried → email re-sent.
      // ────────────────────────────────────────────────────────────────────────
      if (emailDelivered) {
        // Email sent (or wasn't required) → mark whole notification as done.
        await supabase
          .from('notification_outbox')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            attempts: nextAttempts,
            last_error: null,
            delivered_channels: newlyDelivered
          })
          .eq('id', item.id);
      } else {
        // Email failed → retry (but log clearly so we know it's email-only retry)
        const failureReasons = [results.email?.error || 'email_delivery_failed'];
        await supabase
          .from('notification_outbox')
          .update({
            status: nextAttempts < maxAttempts ? 'pending' : 'failed',
            sent_at: null,
            attempts: nextAttempts,
            last_error: failureReasons.join(' | '),
            scheduled_for: nextAttempts < maxAttempts ? retryAt : item.scheduled_for,
            delivered_channels: newlyDelivered
          })
          .eq('id', item.id);
      }

      processed++;
    } catch (err) {
      const nextAttempts = (item.attempts || 0) + 1;
      const maxAttempts = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);
      const backoffMinutes = Math.min(30, Math.pow(2, Math.max(0, nextAttempts - 1)));
      const retryAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

      if (emailWasSent) {
        // Email was already delivered — NEVER retry as 'pending'.
        // Mark 'failed' so this row is permanently closed and won't re-send.
        console.error(`⚠️ [Outbox] Post-send error for ${item.id} (email already sent) — marking failed:`, err?.message);
        await supabase.from('notification_outbox').update({
          status: 'failed',
          attempts: nextAttempts,
          last_error: `Email delivered but post-send error: ${err?.message}`,
          delivered_channels: ['email']
        }).eq('id', item.id);
      } else {
        // Email not yet sent — safe to retry.
        console.error(`❌ [Outbox] Error processing ${item.id} (email not sent) — scheduling retry:`, err?.message);
        await supabase.from('notification_outbox').update({
          status: nextAttempts < maxAttempts ? 'pending' : 'failed',
          attempts: nextAttempts,
          last_error: err?.message || String(err),
          scheduled_for: nextAttempts < maxAttempts ? retryAt : item.scheduled_for
        }).eq('id', item.id);
      }
      processed++;
    }
  }

  return { processed };
}

