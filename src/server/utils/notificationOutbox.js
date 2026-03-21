import supabase from '../../supabase/supabaseAdmin.js';
import { sendNotification, buildTestCompletionEmail, buildWeeklyReportEmail, buildDueDateReminderEmail } from './notificationService.js';
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
  // 1. Try DB settings for production URL
  const dbSettings = await getInternalSettings();
  const siteConfig = dbSettings?.site_config || {};
  
  const appUrl = siteConfig.appUrl || process.env.APP_URL || process.env.VITE_APP_URL || '';
  const appName = process.env.APP_NAME || 'AI Tutor Platform';

  if (eventType === 'TEST_COMPLETED') {
    const subject = `Test Completed: ${payload.courseName || 'Course'} (${payload.level || ''})`;
    const emailHtml = buildTestCompletionEmail({
      studentName: payload.studentName,
      testName: payload.testName,
      courseName: payload.courseName,
      score: payload.rawPercentage,
      totalQuestions: payload.totalQuestions,
      correctAnswers: payload.rawScore,
      scaledScore: payload.scaledScore,
      testDate: payload.testDate,
      appUrl
    });
    const smsMessage =
      `${appName}: ${payload.studentName || 'Student'} completed ${payload.courseName || 'a test'} (${payload.level || ''}). ` +
      `Score: ${Math.round(payload.rawPercentage || 0)}% | Scaled: ${payload.scaledScore || 'N/A'}.`;
    return { subject, emailHtml, smsMessage };
  }

  if (eventType === 'WEEKLY_REPORT') {
    const subject = `Weekly Progress Report${isParent ? `: ${payload.studentName || ''}` : ''}`;
    const emailHtml = buildWeeklyReportEmail({
      recipientName,
      studentName: payload.studentName,
      submissions: payload.submissions || [],
      weekStart: payload.weekStart,
      weekEnd: payload.weekEnd,
      appUrl,
      isParent
    });
    const smsMessage =
      `${appName}: Weekly report${isParent ? ` for ${payload.studentName}` : ''}. ` +
      `Tests: ${payload.totalTests || 0}, Avg: ${payload.avgScore || 0}%, Best: ${payload.bestScore || 0}%.`;
    return { subject, emailHtml, smsMessage };
  }

  if (eventType === 'DUE_DATE_REMINDER') {
    const subject = `Upcoming Test Due Dates${isParent ? `: ${payload.studentName || ''}` : ''}`;
    const emailHtml = buildDueDateReminderEmail({
      recipientName,
      studentName: payload.studentName,
      dueItems: payload.dueItems || [],
      appUrl,
      isParent
    });
    const first = (payload.dueItems || [])[0];
    const smsMessage =
      `${appName}: Upcoming test due dates${isParent ? ` for ${payload.studentName}` : ''}. ` +
      (first ? `Next: ${first.course_name || 'Course'} due ${new Date(first.due_date).toLocaleDateString()}.` : '');
    return { subject, emailHtml, smsMessage };
  }

  return { subject: `${appName} Notification`, emailHtml: '', smsMessage: '' };
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
      const recipientProfile = await getProfile(item.recipient_profile_id);
      const prefs = await getPreferences(item.recipient_profile_id);

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

      // If a channel is enabled but we lack the destination, treat as a failure
      // so it shows up clearly and doesn't get marked as "sent" without delivery.
      const missing = [];
      if (enabledChannels.includes('email') && !recipientProfile?.email) missing.push('email');
      if ((enabledChannels.includes('sms') || enabledChannels.includes('whatsapp')) && !phone && !whatsappPhone) missing.push('phone');
      if (missing.length) {
        throw new Error(`Missing recipient ${missing.join('+')} for enabled channel(s)`);
      }

      const results = await sendNotification({
        email: recipientProfile?.email,
        phone: enabledChannels.includes('whatsapp') ? whatsappPhone : phone,
        subject: content.subject,
        emailHtml: content.emailHtml,
        smsMessage: content.smsMessage,
        channels: enabledChannels
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
        (emailConfig.enabled && emailConfig.user && emailConfig.pass) ||
        (process.env.EMAIL_USER && process.env.EMAIL_PASS) ||
        process.env.RESEND_API_KEY
      );

      // Consider a channel "required" only if:
      // - user has that channel enabled
      // - the destination exists (email/phone)
      // - the gateway is configured (for Email/SMS/WhatsApp)
      const emailRequired = enabledChannels.includes('email') && Boolean(recipientProfile?.email) && emailGatewayConfigured;
      const smsRequired = enabledChannels.includes('sms') && Boolean(phone) && smsGatewayConfigured && !String(phone).includes('12345');
      const waRequired = enabledChannels.includes('whatsapp') && Boolean(whatsappPhone) && waGatewayConfigured && !String(whatsappPhone).includes('12345');

      const ok = (
        (emailRequired ? results.email : true) &&
        (smsRequired ? results.sms : true) &&
        (waRequired ? results.whatsapp : true)
      );

      const failureReasons = [];
      if (enabledChannels.includes('email') && recipientProfile?.email && !emailGatewayConfigured) failureReasons.push('email_gateway_missing');
      if (emailRequired && !results.email) failureReasons.push('email_failed');
      if (enabledChannels.includes('sms') && phone && !smsGatewayConfigured) failureReasons.push('sms_gateway_missing');
      if (smsRequired && !results.sms) failureReasons.push('sms_failed');
      if (enabledChannels.includes('whatsapp') && whatsappPhone && !waGatewayConfigured) failureReasons.push('whatsapp_gateway_missing');
      if (waRequired && !results.whatsapp) failureReasons.push('whatsapp_failed');

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
          last_error: ok ? null : (failureReasons.join(',') || 'One or more channels failed'),
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

