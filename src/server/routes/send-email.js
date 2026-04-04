/**
 * POST /api/send-email
 * Sends a transactional email via Nodemailer SMTP.
 * All SMTP credentials are read exclusively from environment variables.
 */

import { Router } from 'express';
import nodemailer from 'nodemailer';

const router = Router();

// ─── Singleton transporter (created once, reused) ────────────────────────────
let _transporter = null;

function getTransporter() {
    if (_transporter) return _transporter;

    const host   = process.env.EMAIL_HOST;
    const port   = parseInt(process.env.EMAIL_PORT || '587', 10);
    const secure = process.env.EMAIL_SECURE === 'true'; // true = 465 SSL, false = 587 STARTTLS
    const user   = process.env.EMAIL_USER;
    const pass   = process.env.EMAIL_PASS;

    if (!host || !user || !pass) {
        throw new Error('SMTP config missing: EMAIL_HOST, EMAIL_USER, EMAIL_PASS are required env vars.');
    }

    _transporter = nodemailer.createTransport({
        host,
        port,
        secure,          // false for 587 STARTTLS, true for 465 SSL
        auth: { user, pass },
        tls: {
            rejectUnauthorized: false  // required for many cPanel/shared hosting mail servers
        },
        connectionTimeout: 20000,
        greetingTimeout:   15000,
        socketTimeout:     25000,
    });

    console.log(`📡 [send-email] SMTP transporter ready — ${host}:${port} (${secure ? 'SSL' : 'STARTTLS'})`);
    return _transporter;
}

// ─── POST /api/send-email ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { to, subject, html, body, text } = req.body;

        // ── Validation ──────────────────────────────────────────────────────
        const errors = [];
        if (!to)              errors.push('"to" is required');
        if (!subject)         errors.push('"subject" is required');
        if (!html && !body && !text) errors.push('One of "html", "body", or "text" is required');

        if (errors.length) {
            return res.status(400).json({ ok: false, error: 'Validation failed', details: errors });
        }

        // Basic email format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const toList = (Array.isArray(to) ? to : String(to).split(',').map(s => s.trim())).filter(Boolean);
        const invalid = toList.filter(e => !emailRegex.test(e));
        if (invalid.length) {
            return res.status(400).json({ ok: false, error: 'Invalid email address(es)', invalid });
        }

        // ── Build mail options ───────────────────────────────────────────────
        const from       = process.env.EMAIL_FROM || process.env.EMAIL_USER;
        const htmlBody   = html || body; // accept either field name
        const textBody   = text || '';

        const mailOptions = {
            from,
            to: toList.join(', '),
            subject: String(subject).trim(),
            ...(htmlBody ? { html: htmlBody } : {}),
            ...(textBody ? { text: textBody } : {}),
        };

        // ── Send ─────────────────────────────────────────────────────────────
        const transporter = getTransporter();
        const info = await transporter.sendMail(mailOptions);

        console.log(`✅ [send-email] Delivered to ${toList.join(', ')} | MessageId: ${info.messageId}`);

        return res.status(200).json({
            ok: true,
            message: 'Email sent successfully',
            messageId: info.messageId,
            to: toList,
        });

    } catch (err) {
        console.error('❌ [send-email] Error:', err.message);
        return res.status(500).json({
            ok: false,
            error: 'Failed to send email',
            detail: err.message,
        });
    }
});

export default router;
