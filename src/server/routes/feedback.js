import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';
import BrevoEmailService from '../services/BrevoEmailService.js';

const router = express.Router();
const emailService = new BrevoEmailService();

// POST /api/feedback/submit
router.post('/submit', async (req, res) => {
    try {
        const { 
            student_id, 
            course_id, 
            test_id, 
            test_type, 
            rating, 
            difficulty_level, 
            quality_rating, 
            message, 
            anonymous 
        } = req.body;
        
        // Security check: ensure student is submitting for themselves (unless admin)
        if (req.user.id !== student_id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to submit feedback for another user.' });
        }

        // 1. Store in Database
        const { data: feedbackData, error: insertError } = await supabase
            .from('feedback')
            .insert({
                student_id,
                course_id,
                test_id,
                test_type,
                rating,
                difficulty_level,
                quality_rating,
                message,
                anonymous
            })
            .select(`
                *,
                profiles:student_id (name, email),
                courses:course_id (name)
            `)
            .single();

        if (insertError) throw insertError;

        // 2. Trigger Email Notification to Admin
        const adminEmail = process.env.ADMIN_EMAIL || 'ssky57771@gmail.com';
        
        // Fetch or use data from joined select
        const studentName = feedbackData.profiles?.name || 'Unknown Student';
        const studentEmail = feedbackData.profiles?.email || 'N/A';
        const courseName = feedbackData.courses?.name || 'General Course';
        
        // Asynchronously send email so it doesn't block the response
        emailService.sendFeedbackNotification(adminEmail, {
            studentName,
            studentEmail,
            courseName,
            testType: test_type || 'General',
            rating,
            difficultyLevel: difficulty_level,
            qualityRating: quality_rating,
            message,
            anonymous,
            attemptDate: feedbackData.created_at
        }).catch(err => console.error('📧 [FeedbackEmail] Background error:', err));

        res.json({ success: true, data: feedbackData });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ 
            error: 'Failed to submit feedback', 
            details: error.message || 'Unknown server error' 
        });
    }
});

// GET /api/feedback/all (Admin Only)
router.get('/all', async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('feedback')
            .select(`
                *,
                profiles:student_id (name, email),
                courses:course_id (name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({ error: 'Failed to fetch feedback' });
    }
});

export default router;
