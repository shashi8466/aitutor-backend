/**
 * Admin Routes for Group Management
 * Endpoints for admin to manage all groups and tutor assignments
 */

import express from 'express';
import supabase from '../../supabase/supabaseAdmin.js';

const router = express.Router();

/**
 * GET /api/admin/tutors
 * Get all available tutors
 */
router.get('/tutors', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Verify admin role
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (!profile || profile.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

        const { data: tutors, error } = await supabase
            .from('profiles')
            .select('id, name, email, role')
            .eq('role', 'tutor')
            .order('name');

        if (error) throw error;
        res.json({ tutors: tutors || [] });
    } catch (error) {
        console.error('get tutors error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/groups
 * Get all groups across all tutors
 */
router.get('/groups', async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get all groups with tutor and course info
        const { data: groups, error } = await supabase
            .from('student_groups')
            .select(`
                *,
                course:courses(id, name),
                creator:profiles!created_by(id, name, email),
                member_count:group_members(count)
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all groups:', error);
            return res.status(500).json({ error: 'Failed to fetch groups' });
        }

        // Format groups
        const formattedGroups = (groups || []).map(g => {
            let count = 0;
            if (Array.isArray(g.member_count)) {
                count = g.member_count[0]?.count || 0;
            } else if (typeof g.member_count === 'object' && g.member_count !== null) {
                count = g.member_count.count || 0;
            } else if (typeof g.member_count === 'number') {
                count = g.member_count;
            }

            return {
                ...g,
                member_count: Number(count),
                tutor_name: g.creator?.name || 'Unknown',
                tutor_email: g.creator?.email
            };
        });

        res.json({ groups: formattedGroups });

    } catch (error) {
        console.error('Get all groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/tutors/:tutorId/groups
 * Get all groups for a specific tutor
 */
router.get('/tutors/:tutorId/groups', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { tutorId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { data: groups, error } = await supabase
            .from('student_groups')
            .select(`
                *,
                course:courses(id, name),
                member_count:group_members(count)
            `)
            .eq('created_by', tutorId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching tutor groups:', error);
            return res.status(500).json({ error: 'Failed to fetch groups' });
        }

        const formattedGroups = (groups || []).map(g => ({
            ...g,
            member_count: g.member_count?.[0]?.count || 0
        }));

        res.json({ groups: formattedGroups });

    } catch (error) {
        console.error('Get tutor groups error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/groups/:groupId/assign-tutor
 * Reassign a group to a different tutor
 */
router.post('/groups/:groupId/assign-tutor', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { tutorId } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Verify new tutor exists and is a tutor
        const { data: tutor } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', tutorId)
            .single();

        if (!tutor || tutor.role !== 'tutor') {
            return res.status(400).json({ error: 'Invalid tutor ID' });
        }

        // Update group
        const { error } = await supabase
            .from('student_groups')
            .update({ created_by: tutorId, updated_at: new Date().toISOString() })
            .eq('id', groupId);

        if (error) {
            console.error('Error reassigning group:', error);
            return res.status(500).json({ error: 'Failed to reassign group' });
        }

        res.json({ success: true, message: 'Group reassigned successfully' });

    } catch (error) {
        console.error('Reassign group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/admin/groups/:groupId/assign-students
 * Bulk assign students to a group
 */
router.post('/groups/:groupId/assign-students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { studentIds } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ error: 'Student IDs array required' });
        }

        const membersToInsert = studentIds.map(sid => ({
            group_id: groupId,
            student_id: sid
        }));

        const { error } = await supabase
            .from('group_members')
            .upsert(membersToInsert, { onConflict: 'group_id, student_id' });

        if (error) {
            console.error('Error assigning students:', error);
            return res.status(500).json({ error: 'Failed to assign students' });
        }

        res.json({ success: true, message: `${studentIds.length} students assigned` });

    } catch (error) {
        console.error('Bulk assign students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/groups/:groupId/members
 * Get group members with performance (Admin version)
 */
router.get('/groups/:groupId/members', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        // Verify admin
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (!profile || profile.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

        const { data: group } = await supabase.from('student_groups').select('course_id').eq('id', groupId).single();
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const { data: members, error: membersError } = await supabase
            .from('group_members')
            .select(`
                student_id,
                created_at,
                student:profiles(
                    id, name, email,
                    student_progress(count)
                )
            `)
            .eq('group_id', groupId);

        if (membersError) throw membersError;

        const memberIds = members.map(m => m.student_id);
        if (memberIds.length === 0) return res.json({ members: [] });

        const { data: submissions } = await supabase
            .from('test_submissions')
            .select('user_id, raw_score_percentage, scaled_score, created_at')
            .eq('course_id', group.course_id)
            .in('user_id', memberIds)
            .order('created_at', { ascending: false });

        const membersWithPerformance = members.map(member => {
            const stuSubs = submissions?.filter(s => s.user_id === member.student_id) || [];
            const avg = stuSubs.length > 0 ? stuSubs.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / stuSubs.length : 0;
            const latest = stuSubs[0];

            return {
                id: member.student_id,
                name: member.student?.name,
                email: member.student?.email,
                joined_at: member.created_at,
                total_tests: stuSubs.length,
                average_score: Math.round(avg * 10) / 10,
                latest_score: latest?.raw_score_percentage || 0,
                latest_scaled_score: latest?.scaled_score || 0,
                last_test_date: latest?.created_at || null,
                progress_count: member.student?.student_progress?.[0]?.count || 0
            };
        });

        res.json({ members: membersWithPerformance });
    } catch (error) {
        console.error('Admin get group members error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/groups/:groupId/analytics
 * Get group analytics (Admin version)
 */
router.get('/groups/:groupId/analytics', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;
        const { startDate, endDate } = req.query;

        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (!profile || profile.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });

        const { data: group } = await supabase.from('student_groups').select('course_id, name').eq('id', groupId).single();
        if (!group) return res.status(404).json({ error: 'Group not found' });

        const { data: membersRes } = await supabase.from('group_members').select('student_id').eq('group_id', groupId);
        const memberIds = membersRes?.map(m => m.student_id) || [];

        if (memberIds.length === 0) {
            return res.json({
                group_name: group.name,
                total_students: 0,
                average_score: 0,
                total_tests: 0,
                top_performers: [],
                low_performers: [],
                subject_performance: {},
                progress_trend: []
            });
        }

        // Submissions query
        let q = supabase.from('test_submissions').select('*').eq('course_id', group.course_id).in('user_id', memberIds);
        if (startDate) q = q.gte('created_at', startDate);
        if (endDate) q = q.lte('created_at', endDate);
        const { data: submissions } = await q.order('created_at', { ascending: false });

        const totalTests = submissions?.length || 0;
        const avgScore = totalTests > 0 ? submissions.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / totalTests : 0;

        // Performers
        const studentStats = {};
        memberIds.forEach(id => {
            const stuSubs = submissions?.filter(s => s.user_id === id) || [];
            if (stuSubs.length > 0) {
                studentStats[id] = {
                    avg: stuSubs.reduce((sum, s) => sum + (s.raw_score_percentage || 0), 0) / stuSubs.length,
                    count: stuSubs.length
                };
            }
        });

        const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', memberIds);
        const profMap = {};
        profiles?.forEach(p => profMap[p.id] = p);

        const ranked = Object.entries(studentStats).map(([id, d]) => ({
            id,
            name: profMap[id]?.name || 'Unknown',
            email: profMap[id]?.email,
            average_score: Math.round(d.avg * 10) / 10,
            total_tests: d.count
        })).sort((a, b) => b.average_score - a.average_score);

        // Subject performance
        const subjects = {
            math: { total: 0, correct: 0, count: 0 },
            reading: { total: 0, correct: 0, count: 0 },
            writing: { total: 0, correct: 0, count: 0 }
        };

        submissions?.forEach(s => {
            if (s.math_total_questions > 0) {
                subjects.math.total += s.math_total_questions;
                subjects.math.correct += s.math_raw_score || 0;
                subjects.math.count++;
            }
            if (s.reading_total_questions > 0) {
                subjects.reading.total += s.reading_total_questions;
                subjects.reading.correct += s.reading_raw_score || 0;
                subjects.reading.count++;
            }
            if (s.writing_total_questions > 0) {
                subjects.writing.total += s.writing_total_questions;
                subjects.writing.correct += s.writing_raw_score || 0;
                subjects.writing.count++;
            }
        });

        const subjectScores = {};
        Object.entries(subjects).forEach(([sub, data]) => {
            if (data.count > 0) {
                subjectScores[sub] = {
                    average_percentage: Math.round((data.correct / data.total) * 100),
                    total_questions: data.total,
                    correct_answers: data.correct
                };
            }
        });

        res.json({
            group_name: group.name,
            course_id: group.course_id,
            total_students: memberIds.length,
            average_score: Math.round(avgScore),
            total_tests: totalTests,
            top_performers: ranked.slice(0, 5),
            low_performers: ranked.slice(-5).reverse(),
            subject_performance: subjectScores,
            progress_trend: []
        });
    } catch (error) {
        console.error('Admin analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/admin/unassigned-students
 * Get students not assigned to any group for a specific course
 */
router.get('/unassigned-students', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId } = req.query;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!courseId) {
            return res.status(400).json({ error: 'Course ID required' });
        }

        // Use a more robust query: Find all students enrolled in this course
        // then filter out those who are already in ANY group for this course

        // 1. Get IDs of all students already in groups for this course
        const { data: groupIds } = await supabase
            .from('student_groups')
            .select('id')
            .eq('course_id', courseId);

        const ids = groupIds?.map(g => g.id) || [];
        let assignedStudentIds = [];
        if (ids.length > 0) {
            const { data: members } = await supabase
                .from('group_members')
                .select('student_id')
                .in('group_id', ids);
            assignedStudentIds = members?.map(m => m.student_id) || [];
        }

        // 2. Get profiles of students enrolled in this course who aren't in those groups
        const { data: students, error: sError } = await supabase
            .from('profiles')
            .select(`
                id, name, email,
                enrollments!inner(course_id)
            `)
            .eq('role', 'student')
            .eq('enrollments.course_id', courseId);

        if (sError) throw sError;

        const unassignedStudents = (students || [])
            .filter(s => !assignedStudentIds.includes(s.id))
            .map(s => ({
                id: s.id,
                name: s.name,
                email: s.email
            }));

        res.json({ students: unassignedStudents });

    } catch (error) {
        console.error('Get unassigned students error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/admin/groups/:groupId
 * Admin delete any group
 */
router.delete('/groups/:groupId', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { groupId } = req.params;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Verify admin role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

        if (!profile || profile.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { error } = await supabase
            .from('student_groups')
            .delete()
            .eq('id', groupId);

        if (error) {
            console.error('Error deleting group:', error);
            return res.status(500).json({ error: 'Failed to delete group' });
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Admin delete group error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
