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
        const { name, email, mobile, subject, message, type, ...extraFields } = req.body;

        console.log(`📩 [Contact Route] Received message from ${name || 'N/A'} (${email || 'N/A'}) - ${subject || 'No Subject'}`);

        // 1. Get Admin Email from settings or env
        const settings = await getAppSettings();
        
        // Use ADMIN_EMAIL if set, otherwise fallback to EMAIL_USER (the sender's own address as admin)
        const adminEmail = process.env.ADMIN_EMAIL || settings?.support_email || process.env.EMAIL_USER || 'support@aiprep365.com';
        const appName = settings?.app_name || 'AIPrep365';

        // 2. Prepare Additional Details if any exist
        let additionalDetailsText = "";
        let additionalDetailsHtml = "";
        
        const extraEntries = Object.entries(extraFields);
        if (extraEntries.length > 0) {
            additionalDetailsText = "\nAdditional Details:\n" + extraEntries.map(([key, val]) => `${key}: ${val}`).join('\n');
            additionalDetailsHtml = `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ddd;">
                    <p style="font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase;">Additional Metadata:</p>
                    <table style="width: 100%; font-size: 13px; color: #444;">
                        ${extraEntries.map(([key, val]) => `<tr><td style="width: 120px; font-weight: 600;">${key}:</td><td>${val}</td></tr>`).join('')}
                    </table>
                </div>
            `;
        }

        // 3. Prepare Email Content
        const mailOptions = {
            from: `"${appName} Support" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            replyTo: email || process.env.EMAIL_USER,
            subject: `[${type || 'Support'}] ${subject || 'New Contact Message'}`,
            text: `
New message from ${appName} Contact Form:

Full Name: ${name || 'N/A'}
Email: ${email || 'N/A'}
Mobile: ${mobile || 'N/A'}
Subject: ${subject || 'N/A'}
Type/Reason: ${type || 'Support Request'}

Message:
${message || '(No message content)'}
${additionalDetailsText}

---
Sent automatically by ${appName} Notification System
`,
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e1e1e1; border-radius: 16px; background-color: #fff; color: #333;">
          <div style="text-align: center; margin-bottom: 30px;">
             <h1 style="color: #000; margin: 0; font-size: 24px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${appName}</h1>
             <p style="color: #666; font-size: 14px; margin-top: 5px;">New Contact Submission</p>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 12px; margin-bottom: 25px;">
             <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding-bottom: 10px; font-size: 13px; color: #888; text-transform: uppercase; font-weight: bold; width: 40%;">Sender Name</td>
                    <td style="padding-bottom: 10px; font-size: 15px; font-weight: 600;">${name || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding-bottom: 10px; font-size: 13px; color: #888; text-transform: uppercase; font-weight: bold;">Email Address</td>
                    <td style="padding-bottom: 10px; font-size: 15px; font-weight: 600;"><a href="mailto:${email}" style="color: #F98B00; text-decoration: none;">${email || 'N/A'}</a></td>
                </tr>
                <tr>
                    <td style="padding-bottom: 10px; font-size: 13px; color: #888; text-transform: uppercase; font-weight: bold;">Phone/Mobile</td>
                    <td style="padding-bottom: 10px; font-size: 15px; font-weight: 600;">${mobile || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding-bottom: 0; font-size: 13px; color: #888; text-transform: uppercase; font-weight: bold;">Type</td>
                    <td style="padding-bottom: 0; font-size: 15px;"><span style="background-color: #000; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${type || 'Support Request'}</span></td>
                </tr>
             </table>
          </div>

          <div style="margin-bottom: 25px;">
             <p style="font-size: 13px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 10px;">Message Content:</p>
             <div style="padding: 15px; border-left: 4px solid #F98B00; background-color: #fdfdfd; font-size: 15px; line-height: 1.6; color: #333; white-space: pre-wrap;">${message || '(No message content)'}</div>
          </div>

          ${additionalDetailsHtml}

          <div style="margin-top: 40px; padding-top: 20px; border-t: 1px solid #eee; text-align: center; font-size: 12px; color: #aaa;">
            <p>This message was sent via the contact form on <a href="https://aiprep365.com" style="color: #aaa;">aiprep365.com</a></p>
            <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          </div>
        </div>
      `
        };

        // 4. Send Email
        const transporter = createTransporter();
        if (transporter) {
            await transporter.sendMail(mailOptions);
            console.log('✅ Email successfully sent to admin:', adminEmail);
        } else {
            console.warn('❌ Could not send email: Transporter not configured. Details below:');
            console.log('Details:', mailOptions);
        }

        res.json({ success: true, message: 'Message received successfully' });
    } catch (error) {
        console.error('❌ Contact Route Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
