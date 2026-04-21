/**
 * Notification Service
 * Handles Email (Brevo HTTP API), SMS (Twilio), and WhatsApp (Twilio) notifications
 * All channels gracefully degrade if credentials are not configured.
 */

import https from 'https';

const { getInternalSettings } = await import('./internalSettings.js').catch(() => ({
    getInternalSettings: async () => ({})
}));

// ─── Email via Brevo HTTP API ────────────────────────────────────────────────

/**
 * Send an HTML email via Brevo (Sendinblue) Transactional Email HTTP API.
 * Works on Render and all cloud environments — no SMTP port restrictions.
 * Requires BREVO_API_KEY env var.
 *
 * @param {object} opts - { to, subject, html, text }
 * @returns {Promise<object>} - { ok: boolean, id?: string, error?: string }
 */
export async function sendEmail({ to, subject, html, text }) {
    if (!to) {
        console.warn('⚠️ [Email] No recipient provided – skipping.');
        return { ok: false, error: 'No recipient provided' };
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error('❌ [Email] BREVO_API_KEY not set – email disabled.');
        return { ok: false, error: 'BREVO_API_KEY not configured' };
    }

    const senderEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'ssky57771@gmail.com';
    const senderName  = process.env.APP_NAME  || 'AIPrep365';

    const toList = Array.isArray(to)
        ? to
        : String(to).split(',').map(s => s.trim()).filter(Boolean);

    const payload = {
        sender:      { email: senderEmail, name: senderName },
        to:          toList.map(email => ({ email })),
        subject:     String(subject || '(No Subject)').trim(),
        htmlContent: html || text || '<p>Notification</p>',
        ...(text && !html ? { textContent: text } : {}),
    };

    const body = JSON.stringify(payload);

    return new Promise((resolve) => {
        const req = https.request(
            {
                hostname: 'api.brevo.com',
                path:     '/v3/smtp/email',
                method:   'POST',
                headers: {
                    'api-key':        apiKey,
                    'Content-Type':   'application/json',
                    'Accept':         'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    let parsed = {};
                    try { parsed = JSON.parse(data); } catch(e) {}

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log(`✅ [Email] Sent via Brevo to ${toList.join(', ')} | MessageId: ${parsed.messageId}`);
                        resolve({ ok: true, id: parsed.messageId });
                    } else {
                        const errMsg = parsed.message || data.slice(0, 200);
                        console.error(`❌ [Email] Brevo error ${res.statusCode}: ${errMsg}`);
                        resolve({ ok: false, error: `Brevo ${res.statusCode}: ${errMsg}` });
                    }
                });
            }
        );

        req.on('error', (err) => {
            console.error('❌ [Email] Brevo request error:', err.message);
            resolve({ ok: false, error: err.message });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            console.error('❌ [Email] Brevo request timed out');
            resolve({ ok: false, error: 'Brevo request timed out' });
        });

        req.write(body);
        req.end();
    });
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
        req.setTimeout(15000, () => {
            req.destroy();
            console.error('❌ [Twilio] Request timed out');
            resolve({ ok: false, error: 'Twilio request timed out' });
        });
        req.write(postData);
        req.end();
    });
}

export async function sendSMS({ to, message }) {
    if (!to) return { ok: false, error: 'No phone number' };
    const settings = await getInternalSettings();
    const smsConfig = settings?.sms_config || {};
    let from = (smsConfig.enabled && smsConfig.from_number) ? smsConfig.from_number : (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER);
    if (!from) return { ok: false, error: 'TWILIO_FROM_NUMBER missing' };
    return twilioSend({ from, to, body: message });
}

export async function sendWhatsApp({ to, message }) {
    if (!to) return { ok: false, error: 'No phone number' };
    const settings = await getInternalSettings();
    const smsConfig = settings?.sms_config || {};
    let fromRaw = (smsConfig.enabled && smsConfig.whatsapp_number) ? (smsConfig.whatsapp_number || smsConfig.from_number) : (process.env.TWILIO_WHATSAPP_NUMBER || process.env.WHATSAPP_FROM_NUMBER || process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER);
    if (!fromRaw) return { ok: false, error: 'TWILIO_WHATSAPP_NUMBER missing' };
    const from = fromRaw.startsWith('whatsapp:') ? fromRaw : `whatsapp:${fromRaw}`;
    const toWA  = to.startsWith('whatsapp:')      ? to       : `whatsapp:${to}`;
    return twilioSend({ from, to: toWA, body: message });
}

// ─── Helper: send via all channels ──────────────────────────────────────────

export async function sendNotification({ email, phone, subject, emailHtml, smsMessage, channels }) {
    const enabledChannels = channels || ['email', 'sms', 'whatsapp'];
    const results = { 
        email: { ok: true, skipped: true }, 
        sms: { ok: true, skipped: true }, 
        whatsapp: { ok: true, skipped: true } 
    };
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
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #ffffff; line-height: 1.6; -webkit-text-size-adjust: 100%; }
    .wrapper { max-width: 600px; margin: 0 auto; width: 100%; padding: 20px 15px; }
    .card { background-color: #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.3); width: 100%; border: 1px solid rgba(255,255,255,0.05); }
    .header { background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 40px 24px 30px; color: #ffffff; text-align: center; }
    .header h1 { font-size: 30px; font-weight: 800; margin-bottom: 12px; line-height: 1.2; letter-spacing: -0.5px; color: #ffffff; }
    .header p  { font-size: 16px; opacity: 0.95; margin: 0; font-weight: 500; color: #ffffff; }
    .body { padding: 32px 24px; color: #ffffff; }
    
    .intro-text { color: #ffffff !important; font-size: 16px !important; line-height: 1.6 !important; margin-bottom: 24px !important; }
    .intro-heading { color: #ffffff !important; font-size: 18px !important; font-weight: 700 !important; margin-bottom: 12px !important; display: block; }
    
    /* Responsive Score Grid (Fallback for email clients) */
    .score-row { width: 100%; margin: 24px 0; text-align: center; }
    .score-box { display: inline-block; width: 30%; min-width: 100px; background: rgba(255,255,255,0.03); border-radius: 16px; padding: 20px 10px; margin: 5px; text-align: center; border: 1px solid rgba(255,255,255,0.08); vertical-align: top; }
    .score-box .val { font-size: 26px; font-weight: 800; color: #818cf8; line-height: 1.1; }
    .score-box .lbl { font-size: 11px; color: #94a3b8; margin-top: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
    .section-title { font-size: 18px; font-weight: 700; color: #f8fafc; margin: 32px 0 16px; text-align: left; }
    
    /* Table styling */
    .table-container { width: 100%; overflow-x: auto; margin-bottom: 20px; border-radius: 12px; background: rgba(0,0,0,0.2); }
    table { width: 100%; min-width: 450px; border-collapse: collapse; font-size: 14px; text-align: left; }
    th { background: rgba(255,255,255,0.05); color: #94a3b8; padding: 14px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1); }
    td { padding: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #e2e8f0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .badge-green  { background: rgba(34, 197, 94, 0.2); color: #4ade80; }
    .badge-yellow { background: rgba(234, 179, 8, 0.2); color: #facc15; }
    .badge-red    { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .cta { display: block; max-width: 280px; margin: 32px auto 8px; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; padding: 16px 24px; border-radius: 12px; font-size: 16px; font-weight: 700; text-align: center; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3); }
    .footer { text-align: center; padding: 24px; font-size: 12px; color: #64748b; background: rgba(0,0,0,0.1); border-top: 1px solid rgba(255,255,255,0.05); }
    .tip-box, .reminder-box { border-radius: 12px; padding: 16px 20px; margin: 24px 0; font-size: 14px; line-height: 1.6; }
    .tip-box { background: rgba(59, 130, 246, 0.15); border-left: 4px solid #3b82f6; color: #ffffff !important; }
    .reminder-box { background: rgba(239, 68, 68, 0.15); border-left: 4px solid #ef4444; color: #ffffff !important; }

    @media only screen and (max-width: 480px) {
      .body { padding: 24px 16px; }
      .header h1 { font-size: 24px; }
      .score-box { width: 46%; margin: 2%; padding: 16px 8px; }
      .score-box .val { font-size: 22px; }
      .cta { width: 100%; max-width: 100%; }
      th, td { padding: 12px 8px; font-size: 13px; }
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

    return `<!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body><div class="wrapper"><div class="card"><div class="header"><h1>📊 Weekly Progress Report</h1><p>${appName} • Week of ${new Date(weekStart).toLocaleDateString('en-IN', { dateStyle: 'medium' })} – ${new Date(weekEnd).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p></div><div class="body"><p>Hello <strong>${recipientName || 'there'}</strong>,</p><p style="margin-top:8px;">Here is the weekly performance summary${isParent ? ` for <strong>${studentName}</strong>` : ''}.</p><div class="score-row"><div class="score-box"><div class="val">${totalTests}</div><div class="lbl">Tests Taken</div></div><div class="score-box"><div class="val">${avgScore}%</div><div class="lbl">Avg Score</div></div><div class="score-box"><div class="val">${bestScore}%</div><div class="lbl">Best Score</div></div></div>${totalTests > 0 ? `<p class="section-title">Test History This Week</p><div class="table-container"><table><thead><tr><th>Date</th><th>Course</th><th>Level</th><th>Score</th><th>Scaled</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="tip-box">📚 No tests were taken this week. Encourage regular practice for better outcomes!</div>'}${totalTests === 0 ? '' : `<div class="tip-box">🎯 Consistent practice is the key to improvement. Keep going!</div>`}<a class="cta" href="${finalDashboardUrl}">${isParent ? 'Open Parent Dashboard →' : 'Open Student Dashboard →'}</a></div><div class="footer">${appName} • Weekly reports are sent every Saturday.</div></div></div></body></html>`;
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

export function buildDemoScoreEmail({ studentName, courseName, level, scoreDetails }) {
    const appName = process.env.APP_NAME || 'AIPrep365';
    const allLevels = scoreDetails?.allLevels || {};
    const isComprehensive = scoreDetails?.comprehensive && (allLevels.easy || allLevels.medium || allLevels.hard);
    
    // Always prefer comprehensive data for final prediction
    const finalPredictedScore = scoreDetails?.comprehensive?.finalPredictedScore || scoreDetails?.scaledScore || 0;
    const overallAccuracy = scoreDetails?.comprehensive?.overallAccuracy || Math.round(scoreDetails?.currentLevelPercentage || scoreDetails?.percentage || 0);
    const totalQuestions = scoreDetails?.comprehensive?.totalQuestions || scoreDetails?.totalQuestions || 0;
    const totalCorrect = scoreDetails?.comprehensive?.totalCorrect || scoreDetails?.correctCount || 0;
    
    const performance = finalPredictedScore >= 700 ? 'Expert' : finalPredictedScore >= 550 ? 'Strong' : finalPredictedScore >= 400 ? 'Developing' : 'Starting Out';
    const badge = finalPredictedScore >= 700 ? 'badge-green' : finalPredictedScore >= 550 ? 'badge-blue' : 'badge-yellow';

    // Helper function to get detailed level score display
    const getLevelDisplay = (levelData) => {
        if (!levelData) return '<div class="score-box"><div class="val">—</div><div class="lbl">Not Completed</div></div>';
        
        const accuracy = Math.round((levelData.correctCount || 0) / (levelData.totalQuestions || 1) * 100);
        return `
            <div class="score-box">
                <div class="val">${levelData.scaledScore || '—'}</div>
                <div class="lbl">${Math.round(accuracy)}%</div>
                <div class="lbl">${levelData.correctCount || 0}/${levelData.totalQuestions || 0}</div>
            </div>
        `;
    };

    // Helper function to get detailed level row display
    const getLevelRow = (levelName, levelData) => {
        if (!levelData) return `<div style="margin-bottom: 15px;"><strong>${levelName.toUpperCase()}:</strong> Not Completed</div>`;
        
        const accuracy = Math.round((levelData.correctCount || 0) / (levelData.totalQuestions || 1) * 100);
        return `
            <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 15px; font-size: 16px;">
                <strong style="min-width: 80px;">${levelName.toUpperCase()}:</strong>
                <span style="font-weight: 600; color: #818cf8; font-size: 18px;">${levelData.scaledScore || '---'}</span>
                <span style="color: #94a3b8;">| ${Math.round(accuracy)}%</span>
                <span style="color: #64748b;">| ${levelData.correctCount || 0}/${levelData.totalQuestions || 0}</span>
            </div>
        `;
    };

    return `
    <!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body>
    <div class="wrapper"><div class="card">
        <div class="header">
            <h1>🎓 Final Predicted Score</h1>
            <p>${courseName || 'SAT Practice'} • Full Demo Completed</p>
        </div>
        <div class="body">
            <p class="intro-heading">Hello ${studentName || 'Student'},</p>
            <p class="intro-text">
                Congratulations! You have completed the intensive 3-stage demo for <strong>${courseName}</strong>. Based on your performance across all levels, here is your comprehensive final report:
            </p>
            
            <!-- Individual Level Results -->
            <p class="section-title">Performance by Level</p>
            <div style="margin-bottom: 30px; background: rgba(255,255,255,0.03); border-radius: 12px; padding: 20px;">
                ${getLevelRow('Easy', allLevels.easy)}
                ${getLevelRow('Medium', allLevels.medium)}
                ${getLevelRow('Hard', allLevels.hard)}
            </div>

            <!-- Overall Results -->
            <p class="section-title">Overall Performance</p>
            <div class="score-row">
                <div class="score-box" style="flex: 2;"><div class="val" style="font-size: 32px; color: #E53935;">${finalPredictedScore}</div><div class="lbl">Final Combined SAT Score</div></div>
                <div class="score-box"><div class="val">${overallAccuracy}%</div><div class="lbl">Accuracy</div></div>
                <div class="score-box"><div class="val">${totalCorrect}/${totalQuestions}</div><div class="lbl">Questions</div></div>
            </div>

            <div class="tip-box">
                <strong>Status: ${performance}</strong><br/>
                Our engine analyzed your consistency and adaptive responses to calculate this final prediction. You are ready for the real test!
            </div>

            <p class="section-title">Unlock Your Potential</p>
            <p style="font-size: 16px; color: #ffffff !important; margin-bottom: 24px; line-height: 1.6;">
                The full AIPrep365 experience includes 5000+ practice questions, 15 full-length mock tests, and our signature <strong>Genius AI Tutor</strong> that explains every mistake in real-time.
            </p>

            <a class="cta" href="${process.env.FRONTEND_URL || 'https://aiprep365.com'}">Get Full Unlimited Access →</a>
        </div>
        <div class="footer">${appName} • The Ultimate AI-Powered Test Prep Platform</div>
    </div></div></body></html>`;
}

export function buildDemoAdminEmail({ fullName, grade, email, phone, courseName, level, scoreDetails, submittedAt }) {
    const appName = process.env.APP_NAME || 'AIPrep365';
    const allLevels = scoreDetails?.allLevels || {};
    const isComprehensive = scoreDetails?.comprehensive && (allLevels.easy || allLevels.medium || allLevels.hard);
    
    const finalPredictedScore = scoreDetails?.comprehensive?.finalPredictedScore || scoreDetails?.scaledScore || 0;
    const overallAccuracy = scoreDetails?.comprehensive?.overallAccuracy || Math.round(scoreDetails?.percentage || 0);
    
    // Helper function for level display
    const getLevelRow = (levelName, levelData) => {
        if (!levelData) return `<div style="margin-bottom: 10px;"><strong>${levelName.toUpperCase()}:</strong> Not Completed</div>`;
        
        const accuracy = Math.round((levelData.correctCount || 0) / (levelData.totalQuestions || 1) * 100);
        return `
            <div style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                <strong style="min-width: 70px;">${levelName.toUpperCase()}:</strong>
                <span style="font-weight: 600; color: #818cf8;">${levelData.scaledScore || '---'}</span>
                <span style="color: #94a3b8;">| ${Math.round(accuracy)}%</span>
                <span style="color: #64748b;">| ${levelData.correctCount || 0}/${levelData.totalQuestions || 0}</span>
            </div>
        `;
    };

    const demoResultsHtml = isComprehensive ? `
        <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 15px; margin: 15px 0;">
            ${getLevelRow('Easy', allLevels.easy)}
            ${getLevelRow('Medium', allLevels.medium)}
            ${getLevelRow('Hard', allLevels.hard)}
        </div>
        <div style="margin: 15px 0;">
            <strong>Final Predicted Score:</strong> <span style="color: #E53935; font-size: 18px; font-weight: 600;">${finalPredictedScore}</span>
        </div>
    ` : ``;

    return `
    <!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body>
    <div class="wrapper"><div class="card">
        <div class="header">
            <h1>NEW DEMO LEAD</h1>
            <p>${appName} ${courseName || 'Demo Course'} Submission</p>
        </div>
        <div class="body">
            <p class="intro-heading">NEW LEAD: ${fullName}</p>
            <p class="intro-text" style="color: #ffffff !important; font-size: 16px !important; margin-bottom: 24px;">A new user has completed the demo test and submitted their details:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 0; font-weight: 700; width: 140px;">Full Name:</td><td>${fullName || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Grade:</td><td>${grade || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Email:</td><td><a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email || 'N/A'}</a></td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Phone:</td><td>${phone || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Course:</td><td>${courseName || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Level:</td><td>${level || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Submitted:</td><td>${new Date(submittedAt || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td></tr>
            </table>

            <div class="section-title">Demo Results Summary</div>
            ${demoResultsHtml}
            
            <div class="tip-box">
                <strong>Next Steps:</strong><br/>
                1. Contact the user within 24 hours<br/>
                2. Provide personalized feedback on their performance<br/>
                3. Offer full course enrollment based on their results
            </div>
            
            <a class="cta" href="mailto:${email}?subject=Your AIPrep365 Demo Results & Next Steps">Contact User Now</a>
        </div>
        <div class="footer">${appName} · New lead notification sent automatically</div>
    </div></div></body></html>`;
}

export function buildContactSubmissionEmail({ name, email, mobile, subject, type, message, appName, additionalDetailsHtml }) {
    return `
    <!DOCTYPE html><html><head><meta charset="utf-8">${BASE_STYLES}</head><body>
    <div class="wrapper"><div class="card">
        <div class="header">
            <h1>📥 New Contact Submission</h1>
            <p>${appName} • ${type || 'Support Request'}</p>
        </div>
        <div class="body">
            <p style="font-size: 14px; color: #718096; margin-bottom: 20px;">You have received a new message from the contact form:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr><td style="padding: 8px 0; font-weight: 700; width: 120px;">Name:</td><td>${name || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Email:</td><td><a href="mailto:${email}" style="color: #667eea; text-decoration: none;">${email || 'N/A'}</a></td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Phone:</td><td>${mobile || 'N/A'}</td></tr>
                <tr><td style="padding: 8px 0; font-weight: 700;">Subject:</td><td>${subject || 'N/A'}</td></tr>
            </table>

            <div class="section-title">Message:</div>
            <div style="background: #f7f9fc; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #2d3748; white-space: pre-wrap; border-left: 4px solid #667eea;">${message || '(No message content)'}</div>

            ${additionalDetailsHtml || ''}
            
            <a class="cta" href="mailto:${email}?subject=Re: ${subject || 'Your Support Request'}">Reply to User →</a>
        </div>
        <div class="footer">${appName} • Sent automatically from the website contact system.</div>
    </div></div></body></html>`;
}
