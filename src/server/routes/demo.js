import express from 'express';
import supabase from '../../supabase/supabase.js';
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

        console.log(`🔑 [OTP] Sending OTP ${otp} to ${phone}`);
        
        const smsResult = await sendSMS({
            to: phone,
            message: `Your AIPrep365 verification code is: ${otp}. It will expire in 5 minutes.`
        });

        if (!smsResult.ok) {
            console.error('❌ [OTP] SMS sending failed:', smsResult.error);
            return res.status(500).json({ success: false, error: 'Failed to send OTP. Please check your phone number.' });
        }

        res.json({ success: true, message: 'OTP sent successfully' });
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
        const { data: existingLead } = await supabase
            .from('demo_leads')
            .select('*')
            .eq('email', email)
            .eq('course_id', parseInt(courseId))
            .single();

        let leadRecord;
        const newScoreDetails = scoreDetails || {};
        const allLevels = newScoreDetails.allLevels || {};

        const isFinal = level?.toLowerCase() === 'hard';
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
            const { error: updateError } = await supabase
                .from('demo_leads')
                .update(updateData)
                .eq('id', existingLead.id);

            if (updateError) {
                console.error('❌ [DEMO] Update Error:', updateError);
                throw updateError;
            }

            leadRecord = { ...existingLead, ...updateData };
        } else {
            const insertData = {
                course_id: parseInt(courseId),
                email,
                ...updateData
            };
            const { error: insertError } = await supabase
                .from('demo_leads')
                .insert(insertData)
                .select();

            if (insertError) {
                console.error('❌ [DEMO] Insert Error:', insertError);
                throw insertError;
            }

            leadRecord = insertData;
        }

        // 2. Fetch Course Details
        const { data: course } = await supabase
            .from('courses')
            .select('name')
            .eq('id', courseId)
            .single();

        // 3. Send Emails ONLY after Hard level completion
        if (level?.toLowerCase() === 'hard') {
            const adminEmail = process.env.ADMIN_EMAIL || 'ssky57771@gmail.com';
            const submittedAt = new Date().toISOString();
            
            const emailScoreDetails = newScoreDetails;

            // Send admin notification email
            const adminHtml = buildDemoAdminEmail({
                fullName,
                grade,
                email,
                phone,
                courseName: course?.name || 'Demo Course',
                level,
                scoreDetails: emailScoreDetails,
                submittedAt
            });

            const adminEmailResult = await sendEmail({
                to: adminEmail,
                subject: `NEW DEMO LEAD: ${fullName} - ${course?.name || 'Demo Course'}`,
                html: adminHtml
            });

            if (!adminEmailResult.ok) {
                console.warn('   [DEMO] Admin email sending failed:', adminEmailResult.error);
            } else {
                console.log(`   [DEMO] Admin email sent successfully to ${adminEmail}`);
            }

            // Send user email
            const userHtml = buildDemoScoreEmail({
                studentName: fullName,
                courseName: course?.name || 'Demo Course',
                level: 'hard',
                scoreDetails: emailScoreDetails
            });

            const userEmailResult = await sendEmail({
                to: email,
                subject: `Your Final Predicted Score: ${course?.name || 'Test'}`,
                html: userHtml
            });

            if (!userEmailResult.ok) {
                console.warn('   [DEMO] User email sending failed:', userEmailResult.error);
            } else {
                console.log(`   [DEMO] User email sent successfully to ${email}`);
            }
        }

        res.json({ 
            success: true, 
            message: level?.toLowerCase() === 'hard' ? 'Emails sent to User and Admin successfully' : 'Progress saved',
            finalEmailSent: level?.toLowerCase() === 'hard'
        });
    } catch (error) {
        console.error('❌ [DEMO] Submission processing failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export { router as demoRouter };
