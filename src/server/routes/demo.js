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
        
        if (hasTwilioConfig) {
            try {
                console.log(`📱 [OTP] Sending SMS to ${phone}`);
                const smsResult = await sendSMS({
                    to: phone,
                    message: `Your AIPrep365 verification code is: ${otp}. It will expire in 5 minutes.`
                });

                if (!smsResult.ok) {
                    console.error('❌ [OTP] SMS sending failed:', smsResult.error);
                    // Don't return error, just log it and continue with OTP generation
                    console.log(`📋 [OTP] OTP generated but SMS failed. OTP for testing: ${otp}`);
                } else {
                    console.log(`✅ [OTP] SMS sent successfully to ${phone}`);
                }
            } catch (smsError) {
                console.error('❌ [OTP] SMS sending error:', smsError);
                console.log(`📋 [OTP] OTP generated but SMS failed. OTP for testing: ${otp}`);
            }
        } else {
            console.log(`⚠️ [OTP] Twilio not configured. OTP for testing: ${otp}`);
            console.log(`📋 [OTP] To enable SMS, set TWILIO_FROM_NUMBER environment variable`);
        }

        res.json({ 
            success: true, 
            message: hasTwilioConfig ? 'OTP sent successfully' : 'OTP generated (SMS not configured)',
            debugMode: !hasTwilioConfig,
            otpForTesting: hasTwilioConfig ? undefined : otp // Only include OTP in debug mode
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

// 1. Submit Demo Lead & Track Level Progress
router.post('/submit-lead', async (req, res) => {
    const { courseId, fullName, grade, email, phone, level, scoreDetails } = req.body;

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
        const newScoreDetails = scoreDetails || {};
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
        console.log(`✅ [DEMO] Course found: ${course?.name || 'Unknown'}`);

        // 3. Send Emails for completed tests (Hard level or full length test)
        const cleanLevel = level?.toLowerCase()?.trim();
        console.log(`🔍 [DEMO] Step 4: Email trigger check - Level: "${level}", Cleaned: "${cleanLevel}"`);
        console.log(`🔍 [DEMO] Condition check: isHard=${cleanLevel === 'hard'}, isFinalTest=${cleanLevel === 'full length test'}`);
        
        if (cleanLevel === 'hard' || cleanLevel === 'full length test') {
            console.log('📧 [DEMO] Preparing to send emails...');
            
            const adminEmail = process.env.ADMIN_EMAIL || 'ssky57771@gmail.com';
            const submittedAt = new Date().toISOString();
            
            // Debug email configuration
            console.log('🔧 [DEMO] Email Configuration Debug:');
            console.log(`   BREVO_API_KEY: ${process.env.BREVO_API_KEY ? 'SET' : 'MISSING'}`);
            console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'DEFAULT'}`);
            console.log(`   ADMIN_EMAIL: ${adminEmail}`);
            console.log(`   STUDENT_EMAIL: ${email}`);
            
            const emailScoreDetails = newScoreDetails;

            try {
                // Send admin notification email
                console.log('📨 [DEMO] Building admin email...');
                const adminHtml = buildDemoAdminEmail({
                    fullName,
                    grade,
                    email,
                    phone,
                    courseName: course?.name || 'Demo Course',
                    level,
                    scoreDetails: emailScoreDetails,
                    submittedAt,
                    courseId
                });

                console.log('📤 [DEMO] Sending admin email...');
                const adminEmailResult = await sendEmail({
                    to: adminEmail,
                    subject: `NEW DEMO LEAD: ${fullName} - ${course?.name || 'Demo Course'}`,
                    html: adminHtml
                });

                if (!adminEmailResult.ok) {
                    console.error('❌ [DEMO] Admin email sending failed:', adminEmailResult.error);
                    console.error('❌ [DEMO] Admin email error details:', {
                        recipient: adminEmail,
                        subject: `NEW DEMO LEAD: ${fullName} - ${course?.name || 'Demo Course'}`,
                        error: adminEmailResult.error
                    });
                } else {
                    console.log(`✅ [DEMO] Admin email sent successfully to ${adminEmail}`);
                    console.log(`   Message ID: ${adminEmailResult.id}`);
                }

                // Send user email
                console.log('📨 [DEMO] Building student email...');
                const userHtml = buildDemoScoreEmail({
                    studentName: fullName,
                    courseName: course?.name || 'Demo Course',
                    level: level || 'hard',
                    scoreDetails: emailScoreDetails,
                    courseId
                });

                const isAdaptiveSAT_Email = level?.toLowerCase() === 'full length test' || (course?.name?.toLowerCase()?.includes('adaptive') && course?.name?.toLowerCase()?.includes('sat'));
                
                console.log('📤 [DEMO] Sending student email...');
                const userEmailResult = await sendEmail({
                    to: email,
                    subject: isAdaptiveSAT_Email ? `Your Full SAT Score Report: ${course?.name || 'FULL LENGTH TEST'}` : `Your Final Predicted Score: ${course?.name || 'Test'}`,
                    html: userHtml
                });

                if (!userEmailResult.ok) {
                    console.error('❌ [DEMO] User email sending failed:', userEmailResult.error);
                    console.error('❌ [DEMO] User email error details:', {
                        recipient: email,
                        subject: `Your Final Predicted Score: ${course?.name || 'Test'}`,
                        error: userEmailResult.error
                    });
                } else {
                    console.log(`✅ [DEMO] User email sent successfully to ${email}`);
                    console.log(`   Message ID: ${userEmailResult.id}`);
                }

                // Summary of email results
                const emailSummary = {
                    adminEmail: { sent: adminEmailResult.ok, error: adminEmailResult.error },
                    userEmail: { sent: userEmailResult.ok, error: userEmailResult.error },
                    bothSent: adminEmailResult.ok && userEmailResult.ok
                };
                
                console.log('📊 [DEMO] Email sending summary:', emailSummary);

            } catch (emailError) {
                console.error('❌ [DEMO] Critical error in email sending process:', emailError);
                console.error('❌ [DEMO] Email error stack:', emailError.stack);
            }
        }

        const emailsSent = level?.toLowerCase() === 'hard' || level?.toLowerCase() === 'full length test';
        
        // Prepare detailed success message if emails were triggered
        let finalMessage = 'Progress saved';
        if (emailsSent) {
            const adminOk = typeof adminEmailResult !== 'undefined' ? adminEmailResult.ok : true;
            const userOk = typeof userEmailResult !== 'undefined' ? userEmailResult.ok : true;
            
            if (adminOk && userOk) {
                finalMessage = 'Emails sent to User and Admin successfully';
            } else if (adminOk || userOk) {
                finalMessage = `Partial success: ${adminOk ? 'Admin' : 'User'} email sent, but ${!adminOk ? 'Admin' : 'User'} email failed. Check logs.`;
            } else {
                finalMessage = 'Lead saved, but both emails failed to send. Check your Brevo configuration.';
            }
        }

        res.json({ 
            success: true, 
            message: finalMessage,
            finalEmailSent: emailsSent,
            emailStatus: emailsSent ? {
                admin: typeof adminEmailResult !== 'undefined' ? adminEmailResult.ok : null,
                user: typeof userEmailResult !== 'undefined' ? userEmailResult.ok : null,
                error: (typeof adminEmailResult !== 'undefined' && !adminEmailResult.ok) ? adminEmailResult.error : 
                       (typeof userEmailResult !== 'undefined' && !userEmailResult.ok) ? userEmailResult.error : null
            } : null
        });
    } catch (error) {
        console.error('❌ [DEMO] Submission processing failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export { router as demoRouter };
