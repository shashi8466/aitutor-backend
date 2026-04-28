
import express from 'express';
import { getUserFromRequest } from '../utils/authHelper.js';
import supabaseAdmin from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * GET /api/auth-debug/verify-token
 * Verify a token manually
 */
router.get('/verify-token', async (req, res) => {
    const user = await getUserFromRequest(req);
    
    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'Verification failed',
            headers: {
                authorization: req.headers.authorization ? 'Present (len: ' + req.headers.authorization.length + ')' : 'Missing'
            }
        });
    }

    // Check profile
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    res.json({
        success: true,
        user: {
            id: user.id,
            email: user.email,
            role: user.role
        },
        profile: profile || 'No profile found in DB',
        headers: req.headers
    });
});

export default router;
