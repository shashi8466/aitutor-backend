/**
 * Notification Service
 * Handles Email (SMTP/nodemailer), SMS (Twilio), and WhatsApp (Twilio) notifications
 * All channels gracefully degrade if credentials are not configured.
 */

import nodemailer from 'nodemailer';
import https from 'https';

const { getInternalSettings } = await import('./internalSettings.js').catch(() => ({
    getInternalSettings: async () => ({})
}));

// ─── Email Transport ────────────────────────────────────────────────────────

let cachedTransporter = null;
let cachedTransporterKey = null;

/** Call this after changing SMTP settings to force new connection. */
export function resetTransporterCache() {
    cachedTransporter = null;
    cachedTransporterKey = null;
    console.log('🔄 [Email] Transporter cache cleared – will reconnect on next send.');
}

function getEmailConfigKey({ host, port, secure, user }) {
    return `${host}:${port}:${secure ? 'secure' : 'starttls'}:${user}`;
}

async function createEmailTransporter() {
    // 1. Try DB settings first
    const settings = await getInternalSettings();
    const emailConfig = settings?.email_config || {};

    let user, pass, host, port, secure, fromEmail;

    if (emailConfig.enabled && emailConfig.user && emailConfig.pass) {
        user = emailConfig.user;
        pass = emailConfig.pass;
        host = emailConfig.host || 'smtp.gmail.com';
        port = parseInt(emailConfig.port || '587');
        fromEmail = emailConfig.from_email || user;
        // Use the explicit secure bit from DB if it exists, otherwise check port
        secure = (emailConfig.secure !== undefined) ? emailConfig.secure : (port === 465);
    } else {
        // 2. Fallback to process.env
        user = process.env.EMAIL_USER;
        pass = process.env.EMAIL_PASS;
        host = process.env.EMAIL_HOST || 'smtp.gmail.com';
        port = parseInt(process.env.EMAIL_PORT || '587');
        fromEmail = process.env.EMAIL_FROM || user;
        const secureEnv = process.env.EMAIL_SECURE;
        const secureParsed = typeof secureEnv === 'string'
            ? (secureEnv.toLowerCase() === 'true' || secureEnv === '1')
            : (port === 465);
        secure = secureParsed;
    }

    if (!user || !pass) {
        console.warn('⚠️ [Notifications] SMTP credentials missing – email notifications disabled.');
        return null;
    }

    const key = getEmailConfigKey({ host, port, secure, user });
    if (cachedTransporter && cachedTransporterKey === key) return cachedTransporter;

    cachedTransporterKey = key;
    cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure, // true for 465, false for 587 (STARTTLS)
        auth: { user, pass },
        tls: {
            rejectUnauthorized: false // Helps in cloud environments
        },
        // Render/cloud networks can hang on SMTP connect/handshake.
        // Increased for robustness with slow mail servers.
        connectionTimeout: 20000, // 20s
        greetingTimeout: 15000,    // 15s
        socketTimeout: 25000,     // 25s
        pool: true,
        maxConnections: 2,
        maxMessages: 50
    });
    console.log(`📡 [Email] Initialized transporter (Host: ${host}, Port: ${port}, Secure: ${secure})`);
    cachedTransporter.fromEmail = fromEmail;
    return cachedTransporter;
}

/**
 * Send an HTML email via custom domain SMTP (gigatechservices.org).
 * @param {object} opts - { to, subject, html, text }
 * @returns {Promise<object>} - { ok: boolean, error?: string }
 */
export async function sendEmail({ to, subject, html, text }) {
    if (!to) {
        console.warn('⚠️ [Email] No recipient provided – skipping.');
        return { ok: false, error: 'No recipient provided' };
    }

    const transporter = await createEmailTransporter();
    if (!transporter) {
        console.error('❌ [Email] No email transporter available – check EMAIL_HOST/USER/PASS env vars.');
        return { ok: false, error: 'SMTP transporter not configured' };
    }

    const appName = process.env.APP_NAME || 'AIPrep365';
    const fromEmail = transporter.fromEmail || process.env.EMAIL_FROM || process.env.EMAIL_USER;

    try {
        if (!transporter.__verified) {
            await transporter.verify().catch((e) => {
                console.warn(`⚠️ [Email] SMTP verify warning: ${e.message}`);
            });
            transporter.__verified = true;
        }

        const info = await transporter.sendMail({
            from: `"${appName}" <${fromEmail}>`,
            to,
            subject,
            text: text || '',
            html: html || text || ''
        });
        console.log(`✅ [Email] Sent via SMTP to ${to} | MessageId: ${info.messageId}`);
        return { ok: true, id: info.messageId };
    } catch (err) {
        const errorMsg = err.message || String(err);
        console.error(`❌ [Email] SMTP failed to send to ${to}: ${errorMsg}`);
        return { ok: false, error: errorMsg };
    }
}

// ─── Twilio Helper (SMS + WhatsApp) ─────────────────────────────────────────

/**
 * Make a Twilio REST API call using Node https (avoids requiring twilio npm pkg).
 */
async function twilioSend({ from, to, body }) {
    const settings = await getInternalSettings();
    const smsConfig = settings?.sms_config || {};

    let accountSid, authToken;

    if (smsConfig.enabled && smsConfig.account_sid && smsConfig.auth_token) {
        accountSid = smsConfig.account_sid;
        authToken = smsConfig.auth_token;
    } else {
        accountSid = process.env.TWILIO_ACCOUNT_SID;
        authToken  = process.env.TWILIO_AUTH_TOKEN;
    }

    if (!accountSid || !authToken) {
        return { ok: false, error: 'Twilio credentials missing' };
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
                        resolve({ ok: true });
                    } else {
                        console.error(`❌ [Twilio] Error ${res.statusCode}:`, data);
                        resolve({ ok: false, error: `Twilio Error ${res.statusCode}: ${data}` });
                    }
                });
            }
        );
        req.on('error', (err) => {
            console.error('❌ [Twilio] Request error:', err.message);
            resolve({ ok: false, error: err.message });
        });
        req.write(postData);
        req.end();
    });
}

export async function sendSMS({ to, message }) {
    if (!to) return { ok: false, error: 'No phone number' };
    const settings = await getInternalSettings();
    const smsConfig = settings?.sms_config || {};
    let from = (smsConfig.enabled && smsConfig.from_number) ? smsConfig.from_number : process.env.TWILIO_PHONE_NUMBER;
    if (!from) return { ok: false, error: 'TWILIO_PHONE_NUMBER missing' };
    return twilioSend({ from, to, body: message });
}

export async function sendWhatsApp({ to, message }) {
    if (!to) return { ok: false, error: 'No phone number' };
    const settings = await getInternalSettings();
    const smsConfig = settings?.sms_config || {};
    let fromRaw = (smsConfig.enabled && smsConfig.whatsapp_number) ? (smsConfig.whatsapp_number || smsConfig.from_number) : (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER);
    if (!fromRaw) return { ok: false, error: 'TWILIO_WHATSAPP_NUMBER missing' };
    const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
    const toWA  = to.startsWith('whatsapp:')      ? to       : `whatsapp:${to}`;
    return twilioSend({ from, to: toWA, body: message });
}

// ─── Helper: send via all channels ──────────────────────────────────────────

export async function sendNotification({ email, phone, subject, emailHtml, smsMessage, channels }) {
    const enabledChannels = channels || ['email', 'sms', 'whatsapp'];
    const results = { email: { ok: true }, sms: { ok: true }, whatsapp: { ok: true } };
    const tasks = [];

    if (enabledChannels.includes('email')) {
        if (email) {
            tasks.push(sendEmail({ to: email, subject, html: emailHtml, text: smsMessage }).then(res => { results.email = res; }));
        } else {
            results.email = { ok: false, error: 'missing_destination' };
        }
    }
    if (enabledChannels.includes('sms')) {
        if (phone) {
            tasks.push(sendSMS({ to: phone, message: smsMessage }).then(res => { results.sms = res; }));
        } else {
            results.sms = { ok: false, error: 'missing_destination' };
        }
    }
    if (enabledChannels.includes('whatsapp')) {
        if (phone) {
            tasks.push(sendWhatsApp({ to: phone, message: smsMessage }).then(res => { results.whatsapp = res; }));
        } else {
            results.whatsapp = { ok: false, error: 'missing_destination' };
        }
    }
    await Promise.allSettled(tasks);
    return results;
}

// ─── Email HTML Templates ────────────────────────────────────────────────────

const BASE_STYLES = `
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f0f4f8; color: #1a202c; -webkit-text-size-adjust: 100%; }
    .wrapper { max-width: 600px; margin: 0 auto; width: 100%; padding: 20px 10px; }
    .card { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); width: 100%; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 24px 20px; color: #fff; text-align: center; }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 8px; line-height: 1.2; }
    .header p  { font-size: 14px; opacity: 0.9; margin: 0; }
    .body { padding: 24px; }
    
    /* Responsive Score Grid (Fallback for email clients) */
    .score-row { width: 100%; text-align: center; margin: 20px 0; }
    .score-box { display: inline-block; width: 31%; min-width: 110px; background: #f7f9fc; border-radius: 10px; padding: 16px 8px; margin: 0 1% 10px; text-align: center; border: 1px solid #e2e8f0; vertical-align: top; box-sizing: border-box; }
    
    .score-box .val { font-size: 24px; font-weight: 800; color: #667eea; line-height: 1.2; }
    .score-box .lbl { font-size: 12px; color: #718096; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .section-title { font-size: 16px; font-weight: 700; color: #2d3748; margin: 24px 0 12px; text-align: left; }
    
    /* Table styling */
    .table-container { width: 100%; overflow-x: auto; margin-bottom: 16px; }
    table { width: 100%; min-width: 400px; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { background: #f7f9fc; color: #4a5568; padding: 12px; font-weight: 700; border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; color: #2d3748; }
    tr:last-child td { border-bottom: none; }
    
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; white-space: nowrap; }
    .badge-green  { background: #c6f6d5; color: #22543d; }
    .badge-yellow { background: #fefcbf; color: #744210; }
    .badge-red    { background: #fed7d7; color: #742a2a; }
    
    .cta { display: block; max-width: 250px; margin: 25px auto 10px; background: #667eea; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 8px; font-size: 15px; font-weight: 700; text-align: center; }
    
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #a0aec0; background: #f8fafc; border-top: 1px solid #e2e8f0; }
    .tip-box, .reminder-box { border-radius: 8px; padding: 14px 16px; margin: 20px 0; font-size: 14px; line-height: 1.5; text-align: left; }
    .tip-box { background: #ebf8ff; border-left: 4px solid #3182ce; color: #2c5282; }
    .reminder-box { background: #fff5f5; border-left: 4px solid #fc8181; color: #742a2a; }

    /* Mobile specifically */
    @media only screen and (max-width: 480px) {
      .wrapper { padding: 10px; }
      .header { padding: 25px 15px 15px; }
      .body { padding: 16px; }
      .score-box { width: 47%; min-width: 47%; margin: 0 1% 10px; padding: 14px 8px; }
      .score-box .val { font-size: 20px; }
      .cta { width: 100%; max-width: 100%; margin-top: 20px; }
      th, td { padding: 10px 8px; font-size: 12px; }
    }
  </style>`;

export function buildTestCompletionEmail({ studentName, testName, courseName, score, totalQuestions, correctAnswers, scaledScore, testDate, appUrl, reportUrl }) {
    const appName = process.env.APP_NAME || 'AIPrep365';
    const pct = Math.round(score);
    const badge = pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red';
    const grade = pct >= 70 ? '🏆 Excellent' : pct >= 40 ? '✅ Passing' : '📚 Needs Work';
    const finalReportUrl = reportUrl || (appUrl ? `${appUrl}/student/detailed-review` : '#');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>📝 Test Completed!</h1><p>${appName} — ${new Date(testDate || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p></div><div class="body"><p>Hello <strong>${studentName || 'Student'}</strong>,</p><p style="margin-top:10px;">Your test for <strong>${courseName || 'the course'}</strong> has been graded. Here are your results:</p><div class="score-row"><div class="score-box"><div class="val">${pct}%</div><div class="lbl">Percentage</div></div>${scaledScore ? `<div class="score-box"><div class="val">${scaledScore}</div><div class="lbl">Scaled Score</div></div>` : ''}<div class="score-box"><div class="val">${correctAnswers}/${totalQuestions}</div><div class="lbl">Correct</div></div><div class="score-box"><div class="val"><span class="badge ${badge}">${grade}</span></div><div class="lbl">Grade</div></div></div><div class="tip-box">💡 Review your incorrect answers to improve your next score. Every mistake is a learning opportunity!</div><a class="cta" href="${finalReportUrl}">View Full Report →</a></div><div class="footer">${appName} • Unsubscribe anytime from your account settings.</div></div></div></body></html>`;
}

export function buildWeeklyReportEmail({ recipientName, studentName, submissions, weekStart, weekEnd, appUrl, isParent, reportUrl }) {
    const appName = process.env.APP_NAME || 'AIPrep365';
    const totalTests = submissions.length;
    const avgScore = totalTests > 0 ? Math.round(submissions.reduce((s, sub) => s + (sub.raw_score_percentage || 0), 0) / totalTests) : 0;
    const bestScore = totalTests > 0 ? Math.round(Math.max(...submissions.map(s => s.raw_score_percentage || 0))) : 0;
    const rows = submissions.map(sub => {
        const pct = Math.round(sub.raw_score_percentage || 0);
        const badge = pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red';
        return `<tr><td>${new Date(sub.test_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td><td>${sub.courses?.name || 'Test'}</td><td>${sub.level || 'N/A'}</td><td><span class="badge ${badge}">${pct}%</span></td>${sub.scaled_score ? `<td>${sub.scaled_score}</td>` : '<td>–</td>'}</tr>`;
    }).join('');
    const finalDashboardUrl = reportUrl || (isParent 
      ? (appUrl ? `${appUrl}/parent/child/${submissions[0]?.user_id || ''}` : '#')
      : (appUrl ? `${appUrl}/student` : '#'));

    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>📊 Weekly Progress Report</h1><p>${appName} • Week of ${new Date(weekStart).toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${new Date(weekEnd).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p></div><div class="body"><p>Hello <strong>${recipientName || 'there'}</strong>,</p><p style="margin-top:8px;">Here is the weekly performance summary${isParent ? ` for <strong>${studentName}</strong>` : ''}.</p><div class="score-row"><div class="score-box"><div class="val">${totalTests}</div><div class="lbl">Tests Taken</div></div><div class="score-box"><div class="val">${avgScore}%</div><div class="lbl">Avg Score</div></div><div class="score-box"><div class="val">${bestScore}%</div><div class="lbl">Best Score</div></div></div>${totalTests > 0 ? `<p class="section-title">Test History This Week</p><div class="table-container"><table><thead><tr><th>Date</th><th>Course</th><th>Level</th><th>Score</th><th>Scaled</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="tip-box">📚 No tests were taken this week. Encourage regular practice for better outcomes!</div>'}${totalTests === 0 ? '' : `<div class="tip-box">🎯 Consistent practice is the key to improvement. Keep going!</div>`}<a class="cta" href="${finalDashboardUrl}">${isParent ? 'Open Parent Dashboard →' : 'Open Student Dashboard →'}</a></div><div class="footer">${appName} • Weekly reports are sent every Monday.</div></div></div></body></html>`;
}

export function buildDueDateReminderEmail({ recipientName, studentName, dueItems, appUrl, isParent, reportUrl }) {
    const appName = process.env.APP_NAME || 'AIPrep365';
    const rows = dueItems.map(item => {
        const daysLeft = Math.ceil((new Date(item.due_date) - Date.now()) / 86400000);
        const urgency = daysLeft <= 1 ? 'badge-red' : daysLeft <= 3 ? 'badge-yellow' : 'badge-green';
        return `<tr><td>${item.course_name || 'Test'}</td><td>${item.level || 'N/A'}</td><td>${new Date(item.due_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td><td><span class="badge ${urgency}">${daysLeft <= 0 ? 'Due Today!' : `${daysLeft}d left`}</span></td></tr>`;
    }).join('');
    const finalUrl = reportUrl || (isParent 
      ? (appUrl ? `${appUrl}/parent/child/${dueItems[0]?.user_id || ''}` : '#')
      : (appUrl ? `${appUrl}/student` : '#'));

    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>⏰ Upcoming Test Reminders</h1><p>${appName} • Don't miss these deadlines!</p></div><div class="body"><p>Hello <strong>${recipientName || 'there'}</strong>,</p><p style="margin-top:8px;">This is a friendly reminder about upcoming test deadlines${isParent ? ` for <strong>${studentName}</strong>` : ''}.</p><div class="reminder-box">⚠️ Please ensure all pending tests are completed before the due date to avoid missing your progress goals.</div><p class="section-title">Pending Tests</p><div class="table-container"><table><thead><tr><th>Course</th><th>Level</th><th>Due Date</th><th>Time Left</th></tr></thead><tbody>${rows}</tbody></table></div><a class="cta" href="${finalUrl}">Take Test Now →</a></div><div class="footer">${appName} • Reminders are sent 7, 3, and 1 day(s) before due date.</div></div></div></body></html>`;
}

export function buildWelcomeEmail({ name, appUrl }) {
    const appName = process.env.APP_NAME || 'AIPrep365';
    const finalUrl = appUrl || '#';
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>Welcome to ${appName} 🎉</h1><p>Your journey starts here!</p></div><div class="body"><p>Hi <strong>${name || 'Student'}</strong>,</p><p style="margin-top:15px; font-size: 16px; line-height: 1.6;">You have successfully registered on ${appName} platform. Start learning and improve your skills 🚀</p><div class="tip-box">📚 Explore your dashboard to find assigned courses and start your first test.</div><a class="cta" href="${finalUrl}">Start Learning Now →</a><p style="margin-top:20px; font-size: 14px; color: #4a5568;">Thanks,<br><strong>AIPrep365 Team</strong></p></div><div class="footer">${appName} • Thank you for joining our community.</div></div></div></body></html>`;
}
