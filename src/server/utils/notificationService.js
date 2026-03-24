/**
 * Notification Service
 * Handles Email (SMTP/nodemailer), SMS (Twilio), and WhatsApp (Twilio) notifications
 * All channels gracefully degrade if credentials are not configured.
 */

import nodemailer from 'nodemailer';
import https from 'https';
import { createRequire } from 'module';
import { getInternalSettings } from './internalSettings.js';

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

async function sendEmailViaResend({ to, subject, html, text }) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { attempted: false, ok: false };

    // User explicitly requested to ALWAYS use this sender address
    const from = 'onboarding@resend.dev';

    const controller = new AbortController();
    const timeoutMs = Number(process.env.EMAIL_API_TIMEOUT_MS || 10000);
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        console.log("📧 Sending to:", to);

        const resp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from,
                to: Array.isArray(to) ? to : String(to).split(',').map(s => s.trim()).filter(Boolean),
                subject,
                html: html || undefined,
                text: text || undefined
            }),
            signal: controller.signal
        });

        const bodyText = await resp.text().catch(() => '');

        if (!resp.ok) {
            console.error(`❌ [Email] Resend error ${resp.status}: ${bodyText}`.slice(0, 500));
            return { attempted: true, ok: false, error: `Resend error ${resp.status}` };
        }

        // Successfully sent via Resend API
        let responseJson = {};
        try { responseJson = JSON.parse(bodyText); } catch(e) {}
        
        console.log(`✅ Resend response:`, responseJson);
        console.log(`✅ [Email] Sent via Resend (from: ${from}) to ${to}`);
        return { attempted: true, ok: true, id: responseJson.id };
    } catch (err) {
        console.error(`❌ [Email] Resend failed to send to ${to}:`, err?.message || String(err));
        return { attempted: true, ok: false, error: err?.message || String(err) };
    } finally {
        clearTimeout(t);
    }
}

async function sendEmailViaSendGrid({ to, subject, html, text }) {
    const settings = await getInternalSettings();
    const apiKey = process.env.SENDGRID_API_KEY || settings?.email_config?.sendgrid_api_key;
    if (!apiKey) return { attempted: false, ok: false };

    const from = process.env.EMAIL_FROM || settings?.email_config?.from_email || process.env.SENDGRID_FROM || 'ssky57771@gmail.com';

    const controller = new AbortController();
    const timeoutMs = Number(process.env.EMAIL_API_TIMEOUT_MS || 10000);
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const toArray = Array.isArray(to) ? to : String(to).split(',').map(s => s.trim()).filter(Boolean);
        const personalizations = toArray.map(email => ({ to: [{ email }] }));

        const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations,
                from: { email: from, name: "AI Tutor Platform" },
                subject,
                content: [
                    ...(text ? [{ type: 'text/plain', value: text }] : []),
                    ...(html ? [{ type: 'text/html', value: html }] : [])
                ]
            }),
            signal: controller.signal
        });

        if (!resp.ok) {
            const body = await resp.text().catch(() => '');
            console.error(`❌ [Email] SendGrid error ${resp.status}: ${body}`.slice(0, 1000));
            return { attempted: true, ok: false, error: `SendGrid error ${resp.status}: ${body}` };
        }

        console.log(`✅ [Email] Sent via SendGrid to ${to}`);
        return { attempted: true, ok: true };
    } catch (err) {
        console.error(`❌ [Email] SendGrid failed to send to ${to}:`, err?.message || String(err));
        return { attempted: true, ok: false, error: err?.message || String(err) };
    } finally {
        clearTimeout(t);
    }
}

/**
 * Send an HTML email.
 * @param {object} opts - { to, subject, html, text }
 * @returns {Promise<object>} - { ok: boolean, error?: string }
 */

export async function sendEmail({ to, subject, html, text }) {
    if (!to) {
        console.warn('⚠️ [Email] No recipient provided – skipping.');
        return { ok: false, error: 'No recipient provided' };
    }

    // 1. Try Resend first (HTTP API — no SMTP port issues)
    const resend = await sendEmailViaResend({ to, subject, html, text });
    if (resend.attempted && resend.ok) return resend;

    // 2. Try SendGrid (HTTP API)
    const sendgrid = await sendEmailViaSendGrid({ to, subject, html, text });
    if (sendgrid.attempted && sendgrid.ok) return sendgrid;

    // 3. Try Gmail SMTP — tried BEFORE custom SMTP because Gmail uses Google's
    //    own servers which are reachable on any network (including Render/cloud).
    //    Custom SMTP ports 465/587 are blocked by Render and many ISPs.
    //    Fallback credentials provided so this works even without env vars on Render.
    const gmailUser = process.env.GMAIL_USER || process.env.EMAIL_USER || 'ssky57771@gmail.com';
    const gmailPass = process.env.GMAIL_APP_PASS || process.env.EMAIL_PASS || 'hxlhrbzchvlugvud';
    try {
        const gmailTransport = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: gmailUser, pass: gmailPass },
            connectionTimeout: 15000,
            tls: { rejectUnauthorized: false }
        });
        const info = await gmailTransport.sendMail({
            from: `"AI Tutor Platform" <${gmailUser}>`,
            to, subject,
            text: text || '',
            html: html || text || ''
        });
        console.log(`✅ [Email] Sent via Gmail to ${to} | MessageId: ${info.messageId}`);
        return { ok: true };
    } catch (gmailErr) {
        console.warn(`⚠️ [Email] Gmail SMTP failed: ${gmailErr.message}`);
    }

    // 4. Try Custom SMTP (DB-configured, e.g. gigatechservices.org)
    //    This is last because custom SMTP ports may be blocked by ISP/firewall
    //    in local/cloud environments. Works best in dedicated server environments.
    const transporter = await createEmailTransporter();
    if (transporter) {
        const appName = process.env.APP_NAME || 'AI Tutor Platform';
        const fromEmail = transporter.fromEmail || process.env.EMAIL_USER;

        try {
            if (!transporter.__verified) {
                await transporter.verify().catch(() => null);
                transporter.__verified = true;
            }
            const info = await transporter.sendMail({
                from: `"${appName}" <${fromEmail}>`,
                to, subject,
                text: text || '',
                html: html || text || ''
            });
            console.log(`✅ [Email] Sent via Custom SMTP to ${to} | MessageId: ${info.messageId}`);
            return { ok: true };
        } catch (err) {
            const errorMsg = err.message || String(err);
            console.warn(`⚠️ [Email] Custom SMTP Failed (${errorMsg})`);

            // Port 465 → 587 fallback for custom SMTP
            const transporterRaw = await createEmailTransporter();
            const currentPort = transporterRaw?.options?.port;
            if (currentPort === 465 && (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || errorMsg.includes('timeout'))) {
                console.log(`🔄 [Email] Trying custom SMTP on Port 587...`);
                try {
                    const fallbackTransporter = nodemailer.createTransport({
                        ...transporterRaw.options,
                        port: 587,
                        secure: false,
                        connectionTimeout: 10000,
                        greetingTimeout: 5000
                    });
                    const fallbackInfo = await fallbackTransporter.sendMail({
                        from: `"${appName}" <${fromEmail}>`,
                        to, subject,
                        text: text || '',
                        html: html || text || ''
                    });
                    console.log(`✅ [Email] Sent via Custom SMTP Port 587 to ${to} | MessageId: ${fallbackInfo.messageId}`);
                    return { ok: true };
                } catch (fallbackErr) {
                    console.error(`❌ [Email] Custom SMTP Port 587 also failed: ${fallbackErr.message}`);
                }
            } else {
                console.error(`❌ [Email] Custom SMTP failed to send to ${to}: ${errorMsg}`);
            }
        }
    }

    return { ok: false, error: 'All email methods failed' };
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
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; color: #1a202c; }
    .wrapper { max-width: 620px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 32px 24px; color: #fff; }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .header p  { font-size: 14px; opacity: 0.85; }
    .body { padding: 28px 32px; }
    .score-row { display: flex; flex-wrap: wrap; gap: 12px; margin: 20px 0; }
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
    .cta { display: block; width: fit-content; margin: 24px auto 0; background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 50px; font-size: 15px; font-weight: 600; text-align: center; }
    .footer { text-align: center; padding: 20px 32px; font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0; }
    .tip-box { background: #ebf8ff; border-left: 4px solid #3182ce; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 14px; color: #2c5282; }
    .reminder-box { background: #fff5f5; border-left: 4px solid #fc8181; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 14px; color: #742a2a; }
  </style>`;

export function buildTestCompletionEmail({ studentName, testName, courseName, score, totalQuestions, correctAnswers, scaledScore, testDate, appUrl }) {
    const appName = process.env.APP_NAME || 'AI Tutor Platform';
    const pct = Math.round(score);
    const badge = pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red';
    const grade = pct >= 70 ? '🏆 Excellent' : pct >= 40 ? '✅ Passing' : '📚 Needs Work';
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>📝 Test Completed!</h1><p>${appName} — ${new Date(testDate || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p></div><div class="body"><p>Hello <strong>${studentName || 'Student'}</strong>,</p><p style="margin-top:10px;">Your test for <strong>${courseName || 'the course'}</strong> has been graded. Here are your results:</p><div class="score-row"><div class="score-box"><div class="val">${pct}%</div><div class="lbl">Percentage</div></div>${scaledScore ? `<div class="score-box"><div class="val">${scaledScore}</div><div class="lbl">Scaled Score</div></div>` : ''}<div class="score-box"><div class="val">${correctAnswers}/${totalQuestions}</div><div class="lbl">Correct</div></div><div class="score-box"><div class="val"><span class="badge ${badge}">${grade}</span></div><div class="lbl">Grade</div></div></div><div class="tip-box">💡 Review your incorrect answers to improve your next score. Every mistake is a learning opportunity!</div>${appUrl ? `<a class="cta" href="${appUrl}/dashboard">View Full Report →</a>` : ''}</div><div class="footer">${appName} • Unsubscribe anytime from your account settings.</div></div></div></body></html>`;
}

export function buildWeeklyReportEmail({ recipientName, studentName, submissions, weekStart, weekEnd, appUrl, isParent }) {
    const appName = process.env.APP_NAME || 'AI Tutor Platform';
    const totalTests = submissions.length;
    const avgScore = totalTests > 0 ? Math.round(submissions.reduce((s, sub) => s + (sub.raw_score_percentage || 0), 0) / totalTests) : 0;
    const bestScore = totalTests > 0 ? Math.round(Math.max(...submissions.map(s => s.raw_score_percentage || 0))) : 0;
    const rows = submissions.map(sub => {
        const pct = Math.round(sub.raw_score_percentage || 0);
        const badge = pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red';
        return `<tr><td>${new Date(sub.test_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td><td>${sub.courses?.name || 'Test'}</td><td>${sub.level || 'N/A'}</td><td><span class="badge ${badge}">${pct}%</span></td>${sub.scaled_score ? `<td>${sub.scaled_score}</td>` : '<td>–</td>'}</tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>📊 Weekly Progress Report</h1><p>${appName} • Week of ${new Date(weekStart).toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${new Date(weekEnd).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p></div><div class="body"><p>Hello <strong>${recipientName || 'there'}</strong>,</p><p style="margin-top:8px;">Here is the weekly performance summary${isParent ? ` for <strong>${studentName}</strong>` : ''}.</p><div class="score-row"><div class="score-box"><div class="val">${totalTests}</div><div class="lbl">Tests Taken</div></div><div class="score-box"><div class="val">${avgScore}%</div><div class="lbl">Avg Score</div></div><div class="score-box"><div class="val">${bestScore}%</div><div class="lbl">Best Score</div></div></div>${totalTests > 0 ? `<p class="section-title">Test History This Week</p><table><thead><tr><th>Date</th><th>Course</th><th>Level</th><th>Score</th><th>Scaled</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="tip-box">📚 No tests were taken this week. Encourage regular practice for better outcomes!</div>'}${totalTests === 0 ? '' : `<div class="tip-box">🎯 Consistent practice is the key to improvement. Keep going!</div>`}${appUrl ? `<a class="cta" href="${appUrl}/dashboard">Open Dashboard →</a>` : ''}</div><div class="footer">${appName} • Weekly reports are sent every Monday.</div></div></div></body></html>`;
}

export function buildDueDateReminderEmail({ recipientName, studentName, dueItems, appUrl, isParent }) {
    const appName = process.env.APP_NAME || 'AI Tutor Platform';
    const rows = dueItems.map(item => {
        const daysLeft = Math.ceil((new Date(item.due_date) - Date.now()) / 86400000);
        const urgency = daysLeft <= 1 ? 'badge-red' : daysLeft <= 3 ? 'badge-yellow' : 'badge-green';
        return `<tr><td>${item.course_name || 'Test'}</td><td>${item.level || 'N/A'}</td><td>${new Date(item.due_date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td><td><span class="badge ${urgency}">${daysLeft <= 0 ? 'Due Today!' : `${daysLeft}d left`}</span></td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>⏰ Upcoming Test Reminders</h1><p>${appName} • Don't miss these deadlines!</p></div><div class="body"><p>Hello <strong>${recipientName || 'there'}</strong>,</p><p style="margin-top:8px;">This is a friendly reminder about upcoming test deadlines${isParent ? ` for <strong>${studentName}</strong>` : ''}.</p><div class="reminder-box">⚠️ Please ensure all pending tests are completed before the due date to avoid missing your progress goals.</div><p class="section-title">Pending Tests</p><table><thead><tr><th>Course</th><th>Level</th><th>Due Date</th><th>Time Left</th></tr></thead><tbody>${rows}</tbody></table>${appUrl ? `<a class="cta" href="${appUrl}/dashboard">Take Test Now →</a>` : ''}</div><div class="footer">${appName} • Reminders are sent 7, 3, and 1 day(s) before due date.</div></div></div></body></html>`;
}
