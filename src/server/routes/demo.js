import express from 'express';
import supabase from '../../supabase/supabase.js';
import { sendEmail, buildDemoScoreEmail } from '../utils/notificationEngine.js';

const router = express.Router();

// 1. Submit Demo Lead & Send Score
router.post('/submit-lead', async (req, res) => {
    const { courseId, fullName, grade, email, phone, level, scoreDetails } = req.body;

    console.log(`📩 [DEMO] Lead Submission: ${fullName} (${email}) for Course ${courseId}, Level: ${level}`);

    if (!courseId || !email || !fullName) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    try {
        // 1. Save Lead to database
        const { error: dbError } = await supabase
            .from('demo_leads')
            .insert({
                course_id: parseInt(courseId),
                full_name: fullName,
                grade: String(grade),
                email,
                phone,
                level_completed: level,
                score_details: scoreDetails || {}
            });

        if (dbError) {
            console.error('❌ [DEMO] Database Error:', dbError);
            throw dbError;
        }

        // 2. Fetch Course Details
        const { data: course } = await supabase
            .from('courses')
            .select('name')
            .eq('id', courseId)
            .single();

        // 3. Send Email
        const html = buildDemoScoreEmail({
            studentName: fullName,
            courseName: course?.name || 'Demo Course',
            level,
            scoreDetails: scoreDetails || {}
        });

        const isFinal = level?.toLowerCase() === 'hard';
        const emailResult = await sendEmail({
            to: email,
            subject: isFinal 
                ? `Final Predicted SAT Score: ${course?.name || 'Test'}` 
                : `Demo Result: ${course?.name || 'Test'} - ${level} Level`,
            html
        });

        if (!emailResult.ok) {
            console.warn('⚠️ [DEMO] Email sending failed:', emailResult.error);
        }

        res.json({ success: true, message: 'Lead saved and score sent via email' });
    } catch (error) {
        console.error('❌ [DEMO] Submission processing failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
