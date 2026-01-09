import express from 'express';
import nodemailer from 'nodemailer';
import { getAppSettings } from '../utils/settingsHelper.js';

const router = express.Router();

// Helper to create mail transporter
const createTransporter = () => {
    // These should be set in Render Environment Variables
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = process.env.EMAIL_PORT || 465;

    if (!user || !pass) {
        console.warn('⚠️ SMTP credentials missing. Email will not be sent.');
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: true, // true for 465, false for other ports
        auth: { user, pass }
    });
};

router.post('/', async (req, res) => {
    try {
        const { name, email, mobile, subject, message, type } = req.body;

        console.log(`📩 [Contact Route] Received message from ${name} (${email}) - ${subject}`);

        // 1. Get Admin Email from settings or env
        const settings = await getAppSettings();
        const adminEmail = process.env.ADMIN_EMAIL || 'support@eduplatform.com';
        const appName = settings?.app_name || 'AI Tutor Platform';

        // 2. Prepare Email Content
        const mailOptions = {
            from: `"${appName} Support" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            replyTo: email,
            subject: `[${type || 'Support'}] ${subject || 'New Contact Message'}`,
            text: `
        New message from ${appName} Contact Form:
        
        Name: ${name || 'N/A'}
        Email: ${email || 'N/A'}
        Mobile: ${mobile || 'N/A'}
        Subject: ${subject || 'N/A'}
        
        Message:
        ${message}
      `,
            html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333;">New Support Message</h2>
          <p><strong>From:</strong> ${name} (${email})</p>
          <p><strong>Mobile:</strong> ${mobile || 'N/A'}</p>
          <p><strong>Type:</strong> ${type || 'Support Request'}</p>
          <p><strong>Subject:</strong> ${subject || 'N/A'}</p>
          <hr />
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
      `
        };

        // 3. Send Email
        const transporter = createTransporter();
        if (transporter) {
            await transporter.sendMail(mailOptions);
            console.log('✅ Email sent to admin');
        } else {
            console.warn('❌ Could not send email: Transporter not configured');
        }

        res.json({ success: true, message: 'Message received successfully' });
    } catch (error) {
        console.error('❌ Contact Route Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
