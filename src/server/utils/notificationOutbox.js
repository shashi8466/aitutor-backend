import supabase from '../../supabase/supabaseAdmin.js';
import { sendNotification, buildTestCompletionEmail, buildWeeklyReportEmail, buildDueDateReminderEmail } from './notificationService.js';

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
  const { data } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', profileId)
    .single();
  return data?.notification_preferences || null;
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

  // Use keys matching the UI (AdminNotificationManager)
  const allowEvent =
    (eventType === 'TEST_COMPLETED' && (prefs.testCompletion !== false)) ||
    (eventType === 'WEEKLY_REPORT' && (prefs.weeklyProgress !== false)) ||
    (eventType === 'DUE_DATE_REMINDER' && (prefs.testDueDate !== false));

  if (!allowEvent) return [];

  const enabled = [];
  if (requested.includes('email') && (prefs.email !== false)) enabled.push('email');
  if (requested.includes('sms') && (prefs.sms !== false)) enabled.push('sms');
  if (requested.includes('whatsapp') && (prefs.whatsapp !== false)) enabled.push('whatsapp');
  return enabled;
}

function resolvePhone({ recipientProfile, prefs, fallbackPhone }) {
  return prefs?.phone_e164 || recipientProfile?.phone_number || recipientProfile?.mobile || fallbackPhone || null;
}

function resolveWhatsApp({ recipientProfile, prefs, fallbackPhone }) {
  return prefs?.whatsapp_e164 || recipientProfile?.whatsapp_number || recipientProfile?.phone_number || recipientProfile?.mobile || fallbackPhone || null;
}

function buildContent({ eventType, payload, recipientName, isParent }) {
  const appUrl = process.env.APP_URL || process.env.VITE_APP_URL || '';
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
    const { error: claimError } = await supabase
      .from('notification_outbox')
      .update({ status: 'processing' })
      .eq('id', item.id)
      .eq('status', 'pending');

    if (claimError) continue;

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

      const content = buildContent({
        eventType: item.event_type,
        payload: item.payload || {},
        recipientName,
        isParent
      });

      const phone = resolvePhone({ recipientProfile, prefs, fallbackPhone });
      const whatsappPhone = resolveWhatsApp({ recipientProfile, prefs, fallbackPhone });

      const results = await sendNotification({
        email: recipientProfile?.email,
        phone: enabledChannels.includes('whatsapp') ? whatsappPhone : phone,
        subject: content.subject,
        emailHtml: content.emailHtml,
        smsMessage: content.smsMessage,
        channels: enabledChannels
      });

      const ok = (
        (enabledChannels.includes('email') ? results.email : true) &&
        (enabledChannels.includes('sms') && phone && !phone.includes('12345') ? results.sms : true) &&
        (enabledChannels.includes('whatsapp') && whatsappPhone && !whatsappPhone.includes('12345') ? results.whatsapp : true)
      );

      await supabase
        .from('notification_outbox')
        .update({
          status: ok ? 'sent' : 'failed',
          sent_at: ok ? new Date().toISOString() : null,
          attempts: item.attempts + 1,
          last_error: ok ? null : 'One or more channels failed'
        })
        .eq('id', item.id);

      processed++;
    } catch (err) {
      await supabase
        .from('notification_outbox')
        .update({
          status: 'failed',
          attempts: item.attempts + 1,
          last_error: err?.message || String(err)
        })
        .eq('id', item.id);
      processed++;
    }
  }

  return { processed };
}

