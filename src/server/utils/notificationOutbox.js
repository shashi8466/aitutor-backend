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
    .select('id, name, email, mobile, father_name, father_mobile, role')
    .eq('id', profileId)
    .single();
  return data;
}

function channelsFromPrefs(prefs, channelsRequested, eventType) {
  const requested = normalizeChannels(channelsRequested);
  if (!prefs) return requested;

  // Canonical columns from `notification_preferences` (see migration)
  const allowEvent =
    (eventType === 'WELCOME_EMAIL') ||
    (eventType === 'CONTACT_SUBMISSION') ||
    (eventType === 'TEST_COMPLETED' && (prefs.test_completed_enabled !== false)) ||
    (eventType === 'WEEKLY_REPORT' && (prefs.weekly_report_enabled !== false)) ||
    (eventType === 'DUE_DATE_REMINDER' && (prefs.due_date_enabled !== false));

  if (!allowEvent) return [];

  const enabled = [];
  if (requested.includes('email') && (prefs.email_enabled !== false)) enabled.push('email');
  if (requested.includes('sms') && (prefs.sms_enabled !== false)) enabled.push('sms');
  if (requested.includes('whatsapp') && (prefs.whatsapp_enabled !== false)) enabled.push('whatsapp');
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
    const subject = `Test Completed: ${payload.courseName || 'Course'} (${payload.level || ''})`;
    
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
      reportUrl: finalUrl
    });
    const smsMessage =
      `${appName}: ${payload.studentName || 'Student'} completed ${payload.courseName || 'a test'} (${payload.level || ''}). ` +
      `Score: ${Math.round(payload.rawPercentage || 0)}% | Scaled: ${payload.scaledScore || 'N/A'}.`;
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
      `${appName}: Weekly report${isParent ? ` for ${payload.studentName}` : ''}. ` +
      `Tests: ${payload.totalTests || 0}, Avg: ${payload.avgScore || 0}%, Best: ${payload.bestScore || 0}%.`;
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
      `${appName}: Upcoming test due dates${isParent ? ` for ${payload.studentName}` : ''}. ` +
      (first ? `Next: ${first.course_name || 'Course'} due ${new Date(first.due_date).toLocaleDateString()}.` : '');
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
  if (eventType === 'TEST_COMPLETED' && submissionId) {
    const { data: existing, error: existingErr } = await supabase
      .from('notification_outbox')
      .select('id, status, attempts, scheduled_for')
      .eq('event_type', eventType)
      .eq('recipient_profile_id', recipientProfileId)
      .contains('payload', { submissionId })
      .order('created_at', { ascending: false })
      .limit(1);

    if (!existingErr && existing?.length) {
      const row = existing[0];

      // If it's already queued/processing/sent, don't create another row.
      if (row.status === 'pending' || row.status === 'processing' || row.status === 'sent') {
        return row.id;
      }

      // If it previously failed, re-queue the SAME row (no duplicates).
      const maxAttempts = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);
      if (row.status === 'failed' && (row.attempts || 0) < maxAttempts) {
        const { data: requeued, error: requeueErr } = await supabase
          .from('notification_outbox')
          .update({
            status: 'pending',
            scheduled_for: scheduledFor,
            last_error: null
          })
          .eq('id', row.id)
          .select('id')
          .single();

        if (!requeueErr && requeued?.id) return requeued.id;
      } else if (row.status === 'failed') {
        // Give back the row id so callers can inspect it.
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
      // Be explicit to avoid DB default mismatches
      status: 'pending',
      channels,
      payload,
      scheduled_for: scheduledFor
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function processOutboxOnce({ limit = 25 } = {}) {
  // Fetch pending items due now
  const { data: items, error } = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
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

    try {
      const recipientProfileId = item.recipient_profile_id;
      const recipientProfile = recipientProfileId ? await getProfile(recipientProfileId) : null;
      const prefs = recipientProfileId ? await getPreferences(recipientProfileId) : null;

      const enabledChannels = channelsFromPrefs(prefs, item.channels, item.event_type);
      if (!enabledChannels.length) {
        await supabase
          .from('notification_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: item.attempts + 1 })
          .eq('id', item.id);
        processed++;
        continue;
      }

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

      const recipientEmails = item.payload?.recipientEmails || (recipientProfile?.email ? [recipientProfile.email] : []);

      // Gracefully degrade enabled channels if destination contact info is missing
      const actualChannels = [];
      if (enabledChannels.includes('email') && recipientEmails.length > 0) actualChannels.push('email');
      if (enabledChannels.includes('sms') && (phone || whatsappPhone)) actualChannels.push('sms');
      if (enabledChannels.includes('whatsapp') && (phone || whatsappPhone)) actualChannels.push('whatsapp');

      if (actualChannels.length === 0) {
        console.warn(`⚠️ [Outbox] No valid contact methods for ${item.event_type} → ${item.recipient_profile_id}. Marking sent.`);
        await supabase
          .from('notification_outbox')
          .update({ status: 'sent', sent_at: new Date().toISOString(), attempts: (item.attempts || 0) + 1, last_error: 'no_valid_contact_method' })
          .eq('id', item.id);
        processed++;
        continue;
      }

      const results = await sendNotification({
        email: recipientEmails.join(','),
        phone: actualChannels.includes('whatsapp') ? whatsappPhone : phone,
        subject: content.subject,
        emailHtml: content.emailHtml,
        smsMessage: content.smsMessage,
        channels: actualChannels
      });

      const dbSettings = await getInternalSettings();
      const emailConfig = dbSettings?.email_config || {};
      const smsConfig = dbSettings?.sms_config || {};

      const twilioConfigured = Boolean(
        (smsConfig.enabled && smsConfig.account_sid && smsConfig.auth_token) ||
        (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
      );
      const smsGatewayConfigured = twilioConfigured && Boolean(
        (smsConfig.enabled && smsConfig.from_number) ||
        process.env.TWILIO_PHONE_NUMBER
      );
      const waGatewayConfigured = twilioConfigured && Boolean(
        (smsConfig.enabled && (smsConfig.whatsapp_number || smsConfig.from_number)) ||
        process.env.TWILIO_WHATSAPP_NUMBER
      );

      const emailGatewayConfigured = Boolean(
        process.env.BREVO_API_KEY ||
        (emailConfig.enabled && emailConfig.user && emailConfig.pass)
      );

      // Consider a channel "required" only if:
      // - user has that channel enabled
      // - the destination exists (email/phone)
      // - the gateway is configured (for Email/SMS/WhatsApp)
      const emailRequired = enabledChannels.includes('email') && Boolean(recipientProfile?.email) && emailGatewayConfigured;
      const smsRequired = enabledChannels.includes('sms') && Boolean(phone) && smsGatewayConfigured && !String(phone).includes('12345');
      const waRequired = enabledChannels.includes('whatsapp') && Boolean(whatsappPhone) && waGatewayConfigured && !String(whatsappPhone).includes('12345');

      const ok = (
        (emailRequired ? results.email.ok : true) &&
        (smsRequired ? results.sms.ok : true) &&
        (waRequired ? results.whatsapp.ok : true)
      );

      const failureReasons = [];
      if (enabledChannels.includes('email') && recipientProfile?.email && !emailGatewayConfigured) failureReasons.push('email_gateway_missing');
      if (emailRequired && !results.email.ok) failureReasons.push(results.email.error || 'email_failed');
      if (enabledChannels.includes('sms') && phone && !smsGatewayConfigured) failureReasons.push('sms_gateway_missing');
      if (smsRequired && !results.sms.ok) failureReasons.push(results.sms.error || 'sms_failed');
      if (enabledChannels.includes('whatsapp') && whatsappPhone && !waGatewayConfigured) failureReasons.push('whatsapp_gateway_missing');
      if (waRequired && !results.whatsapp.ok) failureReasons.push(results.whatsapp.error || 'whatsapp_failed');

      const nextAttempts = (item.attempts || 0) + 1;
      const maxAttempts = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);

      // Exponential-ish backoff: 1m, 2m, 4m, 8m... capped at 30m
      const backoffMinutes = Math.min(30, Math.pow(2, Math.max(0, nextAttempts - 1)));
      const retryAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

      await supabase
        .from('notification_outbox')
        .update({
          status: ok ? 'sent' : (nextAttempts < maxAttempts ? 'pending' : 'failed'),
          sent_at: ok ? new Date().toISOString() : null,
          attempts: nextAttempts,
          last_error: ok ? null : (failureReasons.join(' | ') || 'Delivery failed'),
          scheduled_for: ok ? item.scheduled_for : (nextAttempts < maxAttempts ? retryAt : item.scheduled_for)
        })
        .eq('id', item.id);

      processed++;
    } catch (err) {
      const nextAttempts = (item.attempts || 0) + 1;
      const maxAttempts = Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5);
      const backoffMinutes = Math.min(30, Math.pow(2, Math.max(0, nextAttempts - 1)));
      const retryAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();

      await supabase
        .from('notification_outbox')
        .update({
          status: nextAttempts < maxAttempts ? 'pending' : 'failed',
          attempts: nextAttempts,
          last_error: err?.message || String(err),
          scheduled_for: nextAttempts < maxAttempts ? retryAt : item.scheduled_for
        })
        .eq('id', item.id);
      processed++;
    }
  }

  return { processed };
}

