import express from 'express';
// Corrected relative path to match project structure
import supabaseAdmin from '../../supabase/supabaseAdmin.js';
import { enqueueNotification } from '../utils/notificationOutbox.js';
import { getAppSettings } from '../utils/settingsHelper.js';

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        const { name, fullName, email, mobile, subject, message, type, ...extraFields } = req.body;

        const senderName = fullName || name || 'N/A';
        const senderEmail = email || 'N/A';
        const contactType = type || 'Support';

        console.log(`📩 [Contact Route] Received ${contactType} message from ${senderName} (${senderEmail})`);

        // respond immediately to avoid timeout
        res.json({ success: true, message: 'Message received and processing in background' });

        // run logic in background (no await)
        _runContactBackgroundTasks({ 
            senderName, 
            senderEmail, 
            mobile, 
            subject, 
            message, 
            contactType, 
            extraFields,
            ip: req.ip || req.headers['x-forwarded-for']
        }).catch(err => {
            console.error('💥 [Contact Background] Error:', err.message);
        });

    } catch (error) {
        console.error('❌ Contact Route Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

async function _runContactBackgroundTasks(data) {
    const { senderName, senderEmail, mobile, subject, message, contactType, extraFields, ip } = data;
    
    // 1. Get Settings for app name & admin email
    const settings = await getAppSettings().catch(() => ({}));
    const adminEmail = process.env.ADMIN_EMAIL || settings?.support_email || process.env.EMAIL_USER || 'support@aiprep365.com';
    const appName = settings?.app_name || 'AIPrep365';

    // 2. Prepare Additional Details if any exist
    let additionalDetailsHtml = "";
    const extraEntries = Object.entries(extraFields || {});
    if (extraEntries.length > 0) {
        additionalDetailsHtml = `
            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ddd;">
                <p style="font-weight: bold; color: #666; font-size: 12px; text-transform: uppercase;">Submission Metadata:</p>
                <table style="width: 100%; font-size: 13px; color: #444;">
                    ${extraEntries.map(([key, val]) => `<tr><td style="width: 120px; font-weight: 600; padding: 4px 0;">${key}:</td><td>${val}</td></tr>`).join('')}
                </table>
            </div>
        `;
    }

    // 3. Store Submission in Supabase
    const { data: dbData, error: dbError } = await supabaseAdmin
        .from('contact_messages')
        .insert({
            full_name: senderName,
            email: senderEmail,
            mobile,
            message,
            metadata: {
                ...extraFields,
                ip,
                timestamp: new Date().toISOString()
            }
        })
        .select('id')
        .single();

    if (dbError) {
        console.warn('⚠️ [Contact Background] Failed to store in DB:', dbError.message);
    } else {
        console.log('✅ [Contact Background] Submission stored in database (ID: ' + dbData?.id + ')');
    }

    // 4. Enqueue Notification for Admin
    try {
        await enqueueNotification({
            eventType: 'CONTACT_SUBMISSION',
            recipientProfileId: null, // Admin alert
            recipientType: 'admin',
            channels: ['email'],
            payload: {
                recipientEmails: [adminEmail],
                name: senderName,
                email: senderEmail,
                mobile,
                subject: subject || `${contactType} Submission`,
                type: contactType,
                message,
                additionalDetailsHtml
            }
        });
        console.log('✅ [Contact Background] Admin notification enqueued for delivery to:', adminEmail);
    } catch (notifError) {
        console.error('❌ [Contact Background] Failed to enqueue notification:', notifError.message);
    }
}

export default router;
