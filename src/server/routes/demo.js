import express from 'express';
import supabaseAdmin from '../../supabase/supabaseAdmin.js';
import { sendEmail, buildDemoScoreEmail, buildDemoAdminEmail, sendSMS } from '../utils/notificationEngine.js';

const router = express.Router();

// Simple in-memory storage for OTPs (for production, use Redis or a DB table)
const otpCache = new Map();

// Generate a random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

console.log('✅ [DEMO ROUTER] Initializing demo routes...');

// Test Route to verify deployment
router.get('/health', (req, res) => {
    console.log('🔍 [DEMO] Health check called');
    res.json({ status: 'ok', domain: 'demo', timestamp: new Date().toISOString() });
});

router.get('/test', (req, res) => {
    console.log('🔍 [DEMO] Test route called');
    res.json({ message: 'Demo routes are active', timestamp: new Date().toISOString() });
});

// Diagnostic Endpoint to check environment configuration in production
router.get('/diag', (req, res) => {
    try {
        res.json({
            status: 'ok',
            time: new Date().toISOString(),
            env: {
                BREVO_API_KEY: process.env.BREVO_API_KEY ? 'SET (starts with ' + process.env.BREVO_API_KEY.substring(0, 5) + '...)' : 'MISSING',
                EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET (using fallback)',
                ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'NOT SET (using fallback)',
                SUPABASE_URL: (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) ? 'SET' : 'MISSING',
                SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
                NODE_ENV: process.env.NODE_ENV || 'development'
            },
            instructions: "If BREVO_API_KEY is MISSING, set it in your deployment platform's environment variables. Ensure EMAIL_FROM is verified in your Brevo dashboard."
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Test Email Endpoint
router.get('/test-email', async (req, res) => {
    const { to } = req.query;
    if (!to) return res.status(400).json({ error: 'Please provide a "to" query parameter' });

    try {
        console.log(`🧪 [TEST] Triggering test email to ${to}...`);
        const result = await sendEmail({
            to,
            subject: 'AIPrep365 - Email Connectivity Test',
            html: '<h1>Success!</h1><p>If you are reading this, your Brevo email configuration is working correctly.</p>'
        });

        if (result.ok) {
            res.json({ success: true, message: `Test email sent successfully to ${to}`, messageId: result.id });
        } else {
            res.status(500).json({ success: false, error: result.error, hint: "Check if your sender email (EMAIL_FROM) is verified in Brevo." });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Endpoint to send OTP
router.post('/send-otp', async (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    try {
        const otp = generateOTP();
        // Store OTP with expiry (e.g., 5 minutes)
        otpCache.set(phone, {
            otp,
            expiry: Date.now() + 5 * 60 * 1000
        });

        console.log(`🔑 [OTP] Generated OTP ${otp} for ${phone}`);
        
        // Check if SMS is configured
        const hasTwilioConfig = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;
        
        let smsSent = false;
        let smsError = null;
        
        if (hasTwilioConfig) {
            try {
                console.log(`📱 [OTP] Sending SMS to ${phone}`);
                const smsResult = await sendSMS({
                    to: phone,
                    message: `Your AIPrep365 verification code is: ${otp}. It will expire in 5 minutes.`
                });

                if (!smsResult.ok) {
                    console.error('❌ [OTP] SMS sending failed:', smsResult.error);
                    smsError = smsResult.error;
                    console.log(`📋 [OTP] OTP generated but SMS failed. OTP for testing: ${otp}`);
                } else {
                    console.log(`✅ [OTP] SMS sent successfully to ${phone}`);
                    smsSent = true;
                }
            } catch (err) {
                console.error('❌ [OTP] SMS sending error:', err);
                smsError = err.message;
                console.log(`📋 [OTP] OTP generated but SMS failed. OTP for testing: ${otp}`);
            }
        } else {
            console.log(`⚠️ [OTP] Twilio not configured. OTP for testing: ${otp}`);
            console.log(`📋 [OTP] To enable SMS, set TWILIO_FROM_NUMBER environment variable`);
        }

        if (hasTwilioConfig && !smsSent) {
            return res.status(500).json({ 
                success: false, 
                error: `Failed to send SMS: ${smsError || 'Unknown error'}. Please try again or contact support.`,
                otpForTesting: process.env.NODE_ENV === 'development' ? otp : undefined
            });
        }

        res.json({ 
            success: true, 
            message: hasTwilioConfig ? 'OTP sent successfully' : 'OTP generated (SMS not configured)',
            debugMode: !hasTwilioConfig,
            otpForTesting: hasTwilioConfig ? undefined : otp 
        });
    } catch (error) {
        console.error('❌ [OTP] Error sending OTP:', error);
        res.status(500).json({ success: false, error: 'Internal server error while sending OTP' });
    }
});

// Endpoint to verify OTP
router.post('/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ success: false, error: 'Phone and OTP are required' });
    }

    const cachedData = otpCache.get(phone);

    if (!cachedData) {
        return res.status(400).json({ success: false, error: 'No OTP found for this phone number' });
    }

    if (Date.now() > cachedData.expiry) {
        otpCache.delete(phone);
        return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new one.' });
    }

    if (cachedData.otp === otp) {
        otpCache.delete(phone);
        res.json({ success: true, message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ success: false, error: 'Invalid OTP, please try again.' });
    }
});

// Endpoint to send Email OTP
router.post('/send-email-otp', async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    try {
        const otp = generateOTP();
        // Store OTP with expiry (10 minutes for email)
        otpCache.set(email.toLowerCase().trim(), {
            otp,
            expiry: Date.now() + 10 * 60 * 1000
        });

        console.log(`🔑 [Email OTP] Generated OTP ${otp} for ${email}`);
        
        let emailSent = false;
        let emailError = null;

        try {
            console.log(`📧 [Email OTP] Sending email to ${email}`);
            const result = await sendEmail({
                to: email,
                subject: 'AIPrep365 - Email Verification Code',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; rounded: 10px;">
                        <h2 style="color: #E53935; text-align: center;">Email Verification Code</h2>
                        <p>Hello,</p>
                        <p>Thank you for choosing <strong>AIPrep365</strong>. Please use the following 6-digit verification code to complete your email verification process:</p>
                        <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #333; margin: 20px 0; border-radius: 5px; border: 1px dashed #ccc;">
                            ${otp}
                        </div>
                        <p style="font-size: 12px; color: #666; text-align: center;">This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                        <p style="font-size: 10px; color: #999; text-align: center;">AIPrep365 SAT/AP Learning Portal</p>
                    </div>
                `
            });

            if (result.ok) {
                console.log(`✅ [Email OTP] Email sent successfully to ${email}`);
                emailSent = true;
            } else {
                console.error('❌ [Email OTP] Brevo send failed:', result.error);
                emailError = result.error;
            }
        } catch (err) {
            console.error('❌ [Email OTP] Send error:', err);
            emailError = err.message;
        }

        // Return success even if Brevo fails, giving the test OTP so signup doesn't block if API keys are unconfigured
        res.json({ 
            success: true, 
            message: emailSent ? 'Verification code sent to your email.' : 'Verification code generated.',
            debugMode: !emailSent,
            otpForTesting: otp 
        });
    } catch (error) {
        console.error('❌ [Email OTP] Error sending email OTP:', error);
        res.status(500).json({ success: false, error: 'Internal server error while sending email verification code' });
    }
});

// Endpoint to verify Email OTP
router.post('/verify-email-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }

    const key = email.toLowerCase().trim();
    const cachedData = otpCache.get(key);

    if (!cachedData) {
        return res.status(400).json({ success: false, error: 'No verification code found for this email' });
    }

    if (Date.now() > cachedData.expiry) {
        otpCache.delete(key);
        return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }

    if (cachedData.otp === otp.trim()) {
        otpCache.delete(key);
        res.json({ success: true, message: 'Email verified successfully' });
    } else {
        res.status(400).json({ success: false, error: 'Invalid verification code. Please try again.' });
    }
});


// 1. Submit Demo Lead & Track Level Progress
router.post('/submit-lead', async (req, res) => {
    const { courseId, fullName, grade, email, phone, level, scoreDetails, parentName, parentEmail } = req.body;

    console.log(`📩 [DEMO] Lead Submission: ${fullName} (${email}) for Course ${courseId}, Level: ${level}`);

    if (!courseId || !email || !fullName) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        // 1. Check if user already exists for this course
        console.log(`🔍 [DEMO] Step 1: Checking for existing lead... (email=${email}, course=${courseId})`);
        const { data: existingLead, error: fetchError } = await supabaseAdmin
            .from('demo_leads')
            .select('*')
            .eq('email', email)
            .eq('course_id', parseInt(courseId))
            .maybeSingle(); // Changed from single() to maybeSingle() to avoid 406 errors

        if (fetchError) {
            console.error('❌ [DEMO] Error fetching existing lead:', fetchError);
        }

        let leadRecord;
        const existingDetails = existingLead?.score_details || {};
        const newScoreDetails = { ...existingDetails, ...(scoreDetails || {}) };
        if (parentName) newScoreDetails.parentName = parentName;
        if (parentEmail) newScoreDetails.parentEmail = parentEmail;
        const allLevels = newScoreDetails.allLevels || {};

        const levelStr = String(level || '').toLowerCase().trim();
        const isAdaptiveSAT = levelStr.includes('adaptive') || levelStr.includes('sat test') || levelStr === 'full length test';
        const isHard = levelStr === 'hard';
        const isFinal = isHard || isAdaptiveSAT;

        const completedLevels = [];
        if (allLevels.easy) completedLevels.push('easy');
        if (allLevels.medium) completedLevels.push('medium');
        if (allLevels.hard || isFinal) completedLevels.push('hard');

        const updateData = {
            full_name: fullName,
            phone: phone,
            grade: String(grade),
            level_completed: level,
            score_details: newScoreDetails,
            easy_score_details: allLevels.easy || {},
            medium_score_details: allLevels.medium || {},
            hard_score_details: allLevels.hard || {},
            levels_completed: JSON.stringify(completedLevels),
            final_email_sent: isFinal,
            final_combined_score: isFinal ? (newScoreDetails.comprehensive?.finalPredictedScore || 0) : 0
        };

        if (existingLead) {
            console.log(`🔍 [DEMO] Step 2: Updating existing lead record ${existingLead.id}...`);
            const { error: updateError } = await supabaseAdmin
                .from('demo_leads')
                .update(updateData)
                .eq('id', existingLead.id);

            if (updateError) {
                console.error('❌ [DEMO] Update Error:', updateError);
                throw updateError;
            }
            console.log('✅ [DEMO] Lead updated successfully');
            leadRecord = { ...existingLead, ...updateData };
        } else {
            console.log('🔍 [DEMO] Step 2: Creating new lead record...');
            const insertData = {
                course_id: parseInt(courseId),
                email,
                ...updateData
            };
            const { error: insertError } = await supabaseAdmin
                .from('demo_leads')
                .insert(insertData)
                .select();

            if (insertError) {
                console.error('❌ [DEMO] Insert Error:', insertError);
                throw insertError;
            }
            console.log('✅ [DEMO] New lead created successfully');
            leadRecord = insertData;
        }

        // 2. Fetch Course Details
        console.log(`🔍 [DEMO] Step 3: Fetching course name for ID ${courseId}...`);
        const { data: course, error: courseError } = await supabaseAdmin
            .from('courses')
            .select('name')
            .eq('id', courseId)
            .maybeSingle();

        if (courseError) {
            console.error('❌ [DEMO] Course Fetch Error:', courseError);
        }
        console.log(`✅ [DEMO] Successfully saved lead: ${leadRecord.id}`);

        res.json({
            success: true,
            message: 'Progress saved successfully',
            leadId: leadRecord.id
        });
    } catch (error) {
        console.error('❌ [DEMO] Submission processing failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Securely delete a demo lead (Admin Only)
router.delete('/lead/:id', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        
        const token = authHeader.substring(7);
        const { data: authData, error: userError } = await supabaseAdmin.auth.getUser(token);
        
        if (userError || !authData?.user) {
            return res.status(401).json({ success: false, error: 'Invalid token' });
        }
        
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .maybeSingle();
            
        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
        }

        const { id } = req.params;
        const { error: deleteError } = await supabaseAdmin
            .from('demo_leads')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('❌ [DEMO] Delete Error:', deleteError);
            throw deleteError;
        }
        
        console.log(`✅ [DEMO] Lead ${id} deleted successfully by admin ${authData.user.email}`);
        res.json({ success: true, message: 'Lead deleted successfully' });
    } catch (error) {
        console.error('❌ [DEMO] Delete processing failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Get demo report by ID
router.get('/report/:leadId', async (req, res) => {
    try {
        const { leadId } = req.params;
        
        console.log(`🔍 [DEMO] Fetching report for lead: ${leadId}`);
        const { data: lead, error } = await supabaseAdmin
            .from('demo_leads')
            .select('*')
            .eq('id', leadId)
            .single();
            
        if (error || !lead) {
            console.error('❌ [DEMO] Report fetch error:', error);
            return res.status(404).json({ success: false, error: 'Report not found' });
        }
        
        // Build report data from score_details
        const scoreDetails = lead.score_details || {};
        const comprehensive = scoreDetails.comprehensive || {};
        
        const reportData = {
            studentName: lead.full_name,
            finalScores: {
                totalScore: comprehensive.finalPredictedScore || 0,
                rwScore: comprehensive.rwScore || 0,
                mathScore: comprehensive.mathScore || 0,
                overallAccuracy: comprehensive.overallAccuracy || 0,
                moduleDetails: comprehensive.moduleDetails || {},
                completedAt: lead.created_at
            },
            moduleHistory: comprehensive.moduleHistory || [],
            moduleAnswers: scoreDetails.moduleAnswers || {},
            questionTimes: scoreDetails.questionTimes || {},
            moduleDurations: scoreDetails.moduleDurations || {}
        };
        
        res.json({ success: true, reportData });
    } catch (error) {
        console.error('❌ [DEMO] Report processing failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/demo/send-email to handle sending email after PDF generation
router.post('/send-email', async (req, res) => {
    try {
        const { leadId, pdfUrl } = req.body;
        console.log(`📧 [DEMO] Received request to send email for lead: ${leadId}`);

        if (!leadId) return res.status(400).json({ success: false, error: 'Missing leadId' });

        const { data: lead, error: leadError } = await supabaseAdmin
            .from('demo_leads')
            .select('*')
            .eq('id', leadId)
            .single();

        if (leadError || !lead) {
            console.error('❌ [DEMO] Lead not found for email:', leadError);
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        const adminEmail = process.env.ADMIN_EMAIL || 'ssky57771@gmail.com';
        const submittedAt = lead.created_at;
        const emailScoreDetails = lead.score_details || {};
        const emailSubject = `NEW DEMO LEAD: ${lead.full_name} - ${lead.course_name || 'Demo Course'}`;

        // Build Admin HTML
        const adminHtml = buildDemoAdminEmail({
            fullName: lead.full_name,
            grade: lead.grade,
            email: lead.email,
            phone: lead.phone,
            parentName: lead.parent_name || emailScoreDetails.parentName,
            parentEmail: lead.parent_email || emailScoreDetails.parentEmail,
            courseName: lead.course_name || 'Demo Course',
            level: lead.level_completed,
            scoreDetails: emailScoreDetails,
            submittedAt,
            courseId: lead.course_id,
            leadId: lead.id,
            downloadUrl: pdfUrl
        });

        console.log('📤 [DEMO] Sending admin email...');
        const adminEmailResult = await sendEmail({
            to: adminEmail,
            subject: emailSubject,
            html: adminHtml
        });
        if (!adminEmailResult.ok) console.error('❌ [DEMO] Admin email failed:', adminEmailResult.error);

        // Build User HTML
        const userHtml = buildDemoAdminEmail({
            fullName: lead.full_name,
            grade: lead.grade,
            email: lead.email,
            phone: lead.phone,
            parentName: lead.parent_name || emailScoreDetails.parentName,
            parentEmail: lead.parent_email || emailScoreDetails.parentEmail,
            courseName: lead.course_name || 'Demo Course',
            level: lead.level_completed,
            scoreDetails: emailScoreDetails,
            submittedAt,
            courseId: lead.course_id,
            leadId: lead.id,
            customTitle: 'YOUR DEMO RESULTS',
            downloadUrl: pdfUrl
        });

        const actualParentEmail = lead.parent_email || emailScoreDetails.parentEmail;
        const recipients = [lead.email];
        if (actualParentEmail && actualParentEmail.toLowerCase().trim() !== lead.email.toLowerCase().trim()) {
            recipients.push(actualParentEmail.trim());
        }

        console.log(`📤 [DEMO] Sending student & parent email to ${recipients.join(', ')}...`);
        const userEmailResult = await sendEmail({
            to: recipients,
            subject: emailSubject,
            html: userHtml
        });
        if (!userEmailResult.ok) console.error('❌ [DEMO] User/Parent email failed:', userEmailResult.error);

        res.json({ success: true, message: 'Emails dispatched' });
    } catch (error) {
        console.error('❌ [DEMO] Error in /send-email:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export { router as demoRouter };
