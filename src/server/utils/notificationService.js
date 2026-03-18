/**
 * Notification Service
 * Handles Email (SMTP/nodemailer), SMS (Twilio), and WhatsApp (Twilio) notifications
 * All channels gracefully degrade if credentials are not configured.
 */

import nodemailer from 'nodemailer';
import https from 'https';
import { createRequire } from 'module';

// ─── Email Transport ────────────────────────────────────────────────────────

function createEmailTransporter() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.EMAIL_PORT || '587'); // Switch to 587 for Render

    if (!user || !pass) {
        console.warn('⚠️ [Notifications] SMTP credentials missing – email notifications disabled.');
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: false, // false for 587
        auth: { user, pass },
        tls: {
            rejectUnauthorized: false // Helps in cloud environments
        }
    });
}

/**
 * Send an HTML email.
 * @param {object} opts - { to, subject, html, text }
 * @returns {Promise<boolean>}
 */
export async function sendEmail({ to, subject, html, text }) {
    if (!to) {
        console.warn('⚠️ [Email] No recipient provided – skipping.');
        return false;
    }

    const transporter = createEmailTransporter();
    if (!transporter) return false;

    const appName = process.env.APP_NAME || 'AI Tutor Platform';
    const fromEmail = process.env.EMAIL_USER;

    try {
        const info = await transporter.sendMail({
            from: `"${appName}" <${fromEmail}>`,
            to,
            subject,
            text: text || '',
            html: html || text || ''
        });
        console.log(`✅ [Email] Sent to ${to} | MessageId: ${info.messageId}`);
        return true;
    } catch (err) {
        console.error(`❌ [Email] Failed to send to ${to}:`, err.message);
        return false;
    }
}

// ─── Twilio Helper (SMS + WhatsApp) ─────────────────────────────────────────

/**
 * Make a Twilio REST API call using Node https (avoids requiring twilio npm pkg).
 * @param {string} from - Twilio number (e.g. "+15005550006" or "whatsapp:+14155238886")
 * @param {string} to   - Recipient number (e.g. "+91XXXXXXXXXX" or "whatsapp:+91XXXXXXXXXX")
 * @param {string} body - Message body
 */
async function twilioSend({ from, to, body }) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken  = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        console.warn('⚠️ [Twilio] TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing – skipping.');
        return false;
    }

    const params = new URLSearchParams({ From: from, To: to, Body: body });
    const postData = params.toString();

    return new Promise((resolve) => {
        const req = https.request(
            {
                hostname: 'api.twilio.com',
                port: 443,
                path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
                method: 'POST',
                auth: `${accountSid}:${authToken}`,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(postData)
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log(`✅ [Twilio] Message sent to ${to}`);
                        resolve(true);
                    } else {
                        console.error(`❌ [Twilio] Error ${res.statusCode}:`, data);
                        resolve(false);
                    }
                });
            }
        );
        req.on('error', (err) => {
            console.error('❌ [Twilio] Request error:', err.message);
            resolve(false);
        });
        req.write(postData);
        req.end();
    });
}

/**
 * Send an SMS message via Twilio.
 * @param {object} opts - { to, message }  (to = E.164 phone number e.g. "+91XXXXXXXXXX")
 */
export async function sendSMS({ to, message }) {
    if (!to) {
        console.warn('⚠️ [SMS] No phone number provided – skipping.');
        return false;
    }

    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!from) {
        console.warn('⚠️ [SMS] TWILIO_PHONE_NUMBER missing – skipping.');
        return false;
    }

    return twilioSend({ from, to, body: message });
}

/**
 * Send a WhatsApp message via Twilio WhatsApp API.
 * @param {object} opts - { to, message }  (to = E.164 phone number)
 */
export async function sendWhatsApp({ to, message }) {
    if (!to) {
        console.warn('⚠️ [WhatsApp] No phone number provided – skipping.');
        return false;
    }

    const fromRaw = process.env.TWILIO_WHATSAPP_NUMBER;
    if (!fromRaw) {
        console.warn('⚠️ [WhatsApp] TWILIO_WHATSAPP_NUMBER missing – skipping.');
        return false;
    }

    const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
    const toWA  = to.startsWith('whatsapp:')      ? to       : `whatsapp:${to}`;

    return twilioSend({ from, to: toWA, body: message });
}

// ─── Helper: send via all channels ──────────────────────────────────────────

/**
 * Send a notification through all available channels (email, sms, whatsapp).
 * Missing credentials for any channel are silently skipped.
 *
 * @param {object} opts
 * @param {string} [opts.email]       - Recipient email
 * @param {string} [opts.phone]       - Recipient phone (E.164)
 * @param {string}  opts.subject      - Email subject
 * @param {string}  opts.emailHtml    - HTML body for email
 * @param {string}  opts.smsMessage   - Plain-text message for SMS/WhatsApp
 * @param {string[]} [opts.channels]  - Optional subset: ['email','sms','whatsapp']
 * @returns {Promise<{email:boolean, sms:boolean, whatsapp:boolean}>}
 */
export async function sendNotification({ email, phone, subject, emailHtml, smsMessage, channels }) {
    const enabledChannels = channels || ['email', 'sms', 'whatsapp'];

    // Default to true for any channel not attempted or missing data
    // (a missing phone number shouldn't count as a system "failure")
    const results = { email: true, sms: true, whatsapp: true };

    const tasks = [];

    if (enabledChannels.includes('email')) {
        if (email) {
            tasks.push(
                sendEmail({ to: email, subject, html: emailHtml, text: smsMessage })
                    .then((ok) => { results.email = ok; })
            );
        } else {
            console.warn('⚠️ [Notification] Skip email: No address');
        }
    }

    if (enabledChannels.includes('sms')) {
        if (phone) {
            tasks.push(
                sendSMS({ to: phone, message: smsMessage })
                    .then((ok) => { results.sms = ok; })
            );
        } else {
            console.warn('⚠️ [Notification] Skip SMS: No phone');
        }
    }

    if (enabledChannels.includes('whatsapp')) {
        if (phone) {
            tasks.push(
                sendWhatsApp({ to: phone, message: smsMessage })
                    .then((ok) => { results.whatsapp = ok; })
            );
        } else {
            console.warn('⚠️ [Notification] Skip WhatsApp: No phone');
        }
    }

    await Promise.allSettled(tasks);
    return results;
}

// ─── Email HTML Templates ────────────────────────────────────────────────────

const BASE_STYLES = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #1a202c; }
    .wrapper { max-width: 620px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 32px 24px; color: #fff; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .header p  { font-size: 14px; opacity: 0.85; }
    .body { padding: 28px 32px; }
    .score-row { display: flex; gap: 12px; flex-wrap: wrap; margin: 20px 0; }
    .score-box { flex: 1; min-width: 120px; background: #f7f9fc; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e2e8f0; }
    .score-box .val { font-size: 28px; font-weight: 800; color: #667eea; }
    .score-box .lbl { font-size: 12px; color: #718096; margin-top: 4px; }
    .section-title { font-size: 16px; font-weight: 700; color: #2d3748; margin: 24px 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { background: #667eea; color: #fff; padding: 10px 14px; text-align: left; font-weight: 600; }
    td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #f7f9fc; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .badge-green  { background: #c6f6d5; color: #276749; }
    .badge-yellow { background: #fefcbf; color: #975a16; }
    .badge-red    { background: #fed7d7; color: #9b2c2c; }
    .cta { display: block; width: fit-content; margin: 24px auto 0; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-size: 15px; font-weight: 600; }
    .footer { text-align: center; padding: 20px 32px; font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0; }
    .tip-box { background: #ebf8ff; border-left: 4px solid #3182ce; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 14px; color: #2c5282; }
    .reminder-box { background: #fff5f5; border-left: 4px solid #fc8181; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 14px; color: #742a2a; }
  </style>`;

/**
 * Build the test completion email HTML
 */
export function buildTestCompletionEmail({ studentName, testName, courseName, score, totalQuestions, correctAnswers, scaledScore, testDate, appUrl }) {
    const appName = process.env.APP_NAME || 'AI Tutor Platform';
    const pct = Math.round(score);
    const badge = pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red';
    const grade = pct >= 70 ? '🏆 Excellent' : pct >= 40 ? '✅ Passing' : '📚 Needs Work';

    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>📝 Test Completed!</h1>
      <p>${appName} — ${new Date(testDate || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
    </div>
    <div class="body">
      <p>Hello <strong>${studentName || 'Student'}</strong>,</p>
      <p style="margin-top:10px;">Your test for <strong>${courseName || 'the course'}</strong> has been graded. Here are your results:</p>

      <div class="score-row">
        <div class="score-box">
          <div class="val">${pct}%</div>
          <div class="lbl">Percentage</div>
        </div>
        ${scaledScore ? `<div class="score-box"><div class="val">${scaledScore}</div><div class="lbl">Scaled Score</div></div>` : ''}
        <div class="score-box">
          <div class="val">${correctAnswers}/${totalQuestions}</div>
          <div class="lbl">Correct</div>
        </div>
        <div class="score-box">
          <div class="val"><span class="badge ${badge}">${grade}</span></div>
          <div class="lbl">Grade</div>
        </div>
      </div>

      <div class="tip-box">
        💡 Review your incorrect answers to improve your next score. Every mistake is a learning opportunity!
      </div>

      ${appUrl ? `<a class="cta" href="${appUrl}/dashboard">View Full Report →</a>` : ''}
    </div>
    <div class="footer">${appName} • Unsubscribe anytime from your account settings.</div>
  </div>
</div></body></html>`;
}

/**
 * Build the weekly progress report email HTML
 */
export function buildWeeklyReportEmail({ recipientName, studentName, submissions, weekStart, weekEnd, appUrl, isParent }) {
    const appName = process.env.APP_NAME || 'AI Tutor Platform';
    const totalTests = submissions.length;
    const avgScore = totalTests > 0
        ? Math.round(submissions.reduce((s, sub) => s + (sub.raw_score_percentage || 0), 0) / totalTests)
        : 0;
    const bestScore = totalTests > 0
        ? Math.round(Math.max(...submissions.map(s => s.raw_score_percentage || 0)))
        : 0;

    const rows = submissions.map(sub => {
        const pct = Math.round(sub.raw_score_percentage || 0);
        const badge = pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red';
        const date = new Date(sub.test_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        return `<tr>
          <td>${date}</td>
          <td>${sub.courses?.name || 'Test'}</td>
          <td>${sub.level || 'N/A'}</td>
          <td><span class="badge ${badge}">${pct}%</span></td>
          ${sub.scaled_score ? `<td>${sub.scaled_score}</td>` : '<td>–</td>'}
        </tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>📊 Weekly Progress Report</h1>
      <p>${appName} • Week of ${new Date(weekStart).toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${new Date(weekEnd).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
    </div>
    <div class="body">
      <p>Hello <strong>${recipientName || 'there'}</strong>,</p>
      <p style="margin-top:8px;">Here is the weekly performance summary${isParent ? ` for <strong>${studentName}</strong>` : ''}.</p>

      <div class="score-row">
        <div class="score-box">
          <div class="val">${totalTests}</div>
          <div class="lbl">Tests Taken</div>
        </div>
        <div class="score-box">
          <div class="val">${avgScore}%</div>
          <div class="lbl">Avg Score</div>
        </div>
        <div class="score-box">
          <div class="val">${bestScore}%</div>
          <div class="lbl">Best Score</div>
        </div>
      </div>

      ${totalTests > 0 ? `
      <p class="section-title">Test History This Week</p>
      <table>
        <thead><tr><th>Date</th><th>Course</th><th>Level</th><th>Score</th><th>Scaled</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<div class="tip-box">📚 No tests were taken this week. Encourage regular practice for better outcomes!</div>'}

      ${totalTests === 0 ? '' : `<div class="tip-box">🎯 Consistent practice is the key to improvement. Keep going!</div>`}

      ${appUrl ? `<a class="cta" href="${appUrl}/dashboard">Open Dashboard →</a>` : ''}
    </div>
    <div class="footer">${appName} • Weekly reports are sent every Monday.</div>
  </div>
</div></body></html>`;
}

/**
 * Build the test due-date reminder email HTML
 */
export function buildDueDateReminderEmail({ recipientName, studentName, dueItems, appUrl, isParent }) {
    const appName = process.env.APP_NAME || 'AI Tutor Platform';

    const rows = dueItems.map(item => {
        const daysLeft = Math.ceil((new Date(item.due_date) - Date.now()) / 86400000);
        const urgency = daysLeft <= 1 ? 'badge-red' : daysLeft <= 3 ? 'badge-yellow' : 'badge-green';
        return `<tr>
          <td>${item.course_name || 'Test'}</td>
          <td>${item.level || 'N/A'}</td>
          <td>${new Date(item.due_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
          <td><span class="badge ${urgency}">${daysLeft <= 0 ? 'Due Today!' : `${daysLeft}d left`}</span></td>
        </tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <h1>⏰ Upcoming Test Reminders</h1>
      <p>${appName} • Don't miss these deadlines!</p>
    </div>
    <div class="body">
      <p>Hello <strong>${recipientName || 'there'}</strong>,</p>
      <p style="margin-top:8px;">This is a friendly reminder about upcoming test deadlines${isParent ? ` for <strong>${studentName}</strong>` : ''}.</p>

      <div class="reminder-box">
        ⚠️ Please ensure all pending tests are completed before the due date to avoid missing your progress goals.
      </div>

      <p class="section-title">Pending Tests</p>
      <table>
        <thead><tr><th>Course</th><th>Level</th><th>Due Date</th><th>Time Left</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>

      ${appUrl ? `<a class="cta" href="${appUrl}/dashboard">Take Test Now →</a>` : ''}
    </div>
    <div class="footer">${appName} • Reminders are sent 7, 3, and 1 day(s) before due date.</div>
  </div>
</div></body></html>`;
}
