import cron from 'node-cron';
import axios from 'axios';
import supabase from '../../supabase/supabaseAdmin.js';
import { enqueueNotification } from '../utils/notificationOutbox.js';

class NotificationScheduler {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      console.log('Notification scheduler already running');
      return;
    }

    console.log('Starting notification scheduler...');

    // Outbox processor - Every minute
    // Allowed locally if ENABLE_LOCAL_OUTBOX is true OR in any non-production environment
    const shouldRunOutbox = 
        process.env.NODE_ENV === 'production' || 
        process.env.ENABLE_LOCAL_OUTBOX === 'true' ||
        process.env.NODE_ENV !== 'production';

    if (shouldRunOutbox) {
        cron.schedule('* * * * *', async () => {
        try {
            console.log('🔄 [Cron] Processing notification outbox...');
            const { processOutboxOnce } = await import('../utils/notificationOutbox.js');
            const result = await processOutboxOnce({ limit: 20 });
            if (result.processed > 0) {
            console.log(`✅ [Cron] Processed ${result.processed} notifications`);
            }
        } catch (e) {
            console.error('❌ [Cron] Error processing outbox:', e.message);
        }
        });
    } else {
        console.log('ℹ️ [Cron] Outbox processor disabled locally (NODE_ENV != production)');
    }

    // Weekly progress report - Every Saturday at 7 PM IST
    cron.schedule('0 19 * * 6', async () => {
      console.log('📬 [Cron] Weekly progress report job triggered');
      try {
        const port = process.env.PORT || 3001;
        const secret = process.env.CRON_SECRET || '';
        const url = `http://127.0.0.1:${port}/api/notifications/run-weekly`;
        
        console.log(`📡 [Cron] Calling weekly report endpoint: ${url}`);
        const response = await axios.post(url, {}, {
          headers: { 'x-cron-secret': secret },
          timeout: 600000 // 10 minutes for large report processing
        });
        
        console.log('✅ [Cron] Weekly report response:', response.data);
      } catch (e) {
        console.error('❌ [Cron] Error running weekly report:', e.message);
        if (e.response) {
          console.error('❌ [Cron] Status:', e.response.status, 'Data:', e.response.data);
        }
      }
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Test due date reminders - Every two days at 9 AM
    cron.schedule('0 9 */2 * *', async () => {
      console.log('📬 [Cron] Due date reminder job triggered');
      try {
        const port = process.env.PORT || 3001;
        const secret = process.env.CRON_SECRET || '';
        const url = `http://127.0.0.1:${port}/api/notifications/run-due-reminders`;

        console.log(`📡 [Cron] Calling due reminders endpoint: ${url}`);
        const response = await axios.post(url, {}, {
          headers: { 'x-cron-secret': secret }
        });
        
        console.log('✅ [Cron] Due reminders response:', response.data);
      } catch (e) {
        console.error('❌ [Cron] Error running reminders from cron:', e.message);
        if (e.response) {
          console.error('❌ [Cron] Status:', e.response.status, 'Data:', e.response.data);
        }
      }
    }, {
      timezone: 'America/New_York'
    });

    this.isRunning = true;
    console.log('Notification scheduler started successfully');
  }

  /**
   * Trigger test completion notification (called when a test is submitted)
   */
  async triggerTestCompletionNotification(submissionId, studentId, modularScores = null) {
    try {
      console.log(`📬 [Notification] Triggering test completion notification for submission ${submissionId}`);
      
      // Fetch submission (avoid implicit joins; they can break depending on FK naming)
      const { data: submission, error: subError } = await supabase
        .from('test_submissions')
        .select('id, user_id, course_id, level, raw_score, total_questions, raw_score_percentage, scaled_score, test_date')
        .eq('id', submissionId)
        .single();

      if (subError || !submission) {
        console.error('❌ [Notification] Failed to fetch submission:', subError?.message || 'Not found');
        return;
      }

      // Resolve student + course info (robust across schema variations)
      const [{ data: studentProfile }, { data: course }] = await Promise.all([
        supabase.from('profiles').select('id, name, email').eq('id', submission.user_id || studentId).maybeSingle(),
        supabase.from('courses').select('id, name').eq('id', submission.course_id).maybeSingle()
      ]);

      const studentEmail = studentProfile?.email;
      if (!studentEmail) {
        console.warn(`⚠️ [Notification] Student ${submission.user_id || studentId} has no email – delivery will skip student.`);
      }

      if (!studentId) {
        console.error('❌ [Notification] Missing studentId – cannot proceed.');
        return;
      }

      // Collect all parents & filter safely
      const { data: allParents } = await supabase
        .from('profiles')
        .select('id, name, email, linked_students')
        .eq('role', 'parent');

      const parents = (allParents || [])
        .filter(p => {
          const linked = p.linked_students;
          if (!linked || !Array.isArray(linked)) return false;
          return linked.some(id => id && String(id).trim() === String(studentId).trim());
        });
      
      // 3. Enqueue External Notifications (Separate for Student vs Parents for Deep Linking)
      
      // Enqueue for Student
      if (studentEmail) {
        await enqueueNotification({
          eventType: 'TEST_COMPLETED',
          recipientProfileId: studentId,
          recipientType: 'student',
          payload: {
            submissionId,
            studentId,
            studentName: studentProfile?.name || 'Student',
            courseId: submission.course_id,
            courseName: course?.name || 'Course',
            level: modularScores ? 'Comprehensive' : submission.level,
            rawScore: submission.raw_score,
            totalQuestions: submission.total_questions,
            rawPercentage: submission.raw_score_percentage,
            scaledScore: submission.scaled_score,
            testDate: submission.test_date,
            modularScores
          },
          scheduledFor: new Date().toISOString()
        });
      }

      // Enqueue for each Parent separately
      for (const parent of parents) {
        if (parent.email) {
          await enqueueNotification({
            eventType: 'TEST_COMPLETED',
            recipientProfileId: parent.id,
            recipientType: 'parent',
            payload: {
              submissionId,
              studentId, 
              studentName: studentProfile?.name || 'Student',
              courseId: submission.course_id,
              courseName: course?.name || 'Course',
              level: modularScores ? 'Comprehensive' : submission.level,
              rawScore: submission.raw_score,
              totalQuestions: submission.total_questions,
              rawPercentage: submission.raw_score_percentage,
              scaledScore: submission.scaled_score,
              testDate: submission.test_date,
              modularScores
            },
            scheduledFor: new Date().toISOString()
          });
        }
      }

      console.log(`✅ [Notification] Enqueued separate notifications for student and ${parents.length} parents`);

      // 4. Create In-App Notifications (Bulk insertion for efficiency)
      const inAppNotifications = [];
      
      // For Student
      inAppNotifications.push({
        user_id: studentId,
        title: `Test Graded: ${course?.name || 'Course'}`,
        message: `You scored ${Math.round(submission.raw_score_percentage)}% in your ${submission.level || 'Practice'} level test.`,
        type: 'test_completion',
        data: { 
            submissionId, 
            courseId: submission.course_id, 
            level: submission.level,
            scaledScore: submission.scaled_score
        }
      });

      // For Parents
      parents.forEach(parent => {
        inAppNotifications.push({
          user_id: parent.id,
          title: `Child Activity: ${studentProfile?.name || 'Student'}`,
          message: `${studentProfile?.name} completed a ${course?.name || 'Course'} test with ${Math.round(submission.raw_score_percentage)}%.`,
          type: 'test_completion',
          data: { 
              submissionId, 
              studentId,
              studentName: studentProfile?.name,
              courseId: submission.course_id, 
              level: submission.level,
              scaledScore: submission.scaled_score
          }
        });
      });

      if (inAppNotifications.length > 0) {
        await supabase.from('notifications').insert(inAppNotifications);
        console.log(`✅ [Notification] In-app notifications created for ${inAppNotifications.length} users`);
      }
    } catch (error) {
      console.error('❌ [Notification] Error triggering test completion notification:', error);
    }
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (!this.isRunning) {
      console.log('Notification scheduler not running');
      return;
    }

    cron.getTasks().forEach(task => task.stop());
    this.isRunning = false;
    console.log('Notification scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: cron.getTasks().length
    };
  }

  /**
   * Manually trigger a weekly progress report for a specific student
   */
  async sendManualWeeklyReport(studentId, parentId = null) {
    try {
      console.log(`📬 [ManualReport] Triggering weekly report for student ${studentId}`);

      // 1. Fetch student profile
      const { data: student, error: studentError } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', studentId)
        .single();

      if (studentError || !student) {
        throw new Error(`Student not found: ${studentError?.message || 'unknown'}`);
      }

      // 2. Fetch submissions for the last 7 days
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const { data: submissions, error: subError } = await supabase
        .from('test_submissions')
        .select('*, courses:courses(id, name)')
        .eq('user_id', studentId)
        .gte('test_date', oneWeekAgo.toISOString())
        .order('test_date', { ascending: false });

      if (subError) throw subError;

      // 3. Find linked parents
      const { data: allParents } = await supabase
        .from('profiles')
        .select('id, name, email, linked_students')
        .eq('role', 'parent');

      const parents = (allParents || []).filter(p => {
        const linked = p.linked_students || [];
        return Array.isArray(linked) && linked.some(id => String(id) === String(studentId));
      });

      // 4. Calculate Stats
      const totalTests = submissions?.length || 0;
      const avgScore = totalTests > 0 
        ? Math.round(submissions.reduce((acc, s) => acc + (s.raw_score_percentage || 0), 0) / totalTests) 
        : 0;
      const bestScore = totalTests > 0 
        ? Math.round(Math.max(...submissions.map(s => s.raw_score_percentage || 0))) 
        : 0;

      const payload = {
        studentId,
        studentName: student.name,
        submissions: submissions || [],
        totalTests,
        avgScore,
        bestScore,
        weekStart: oneWeekAgo.toISOString(),
        weekEnd: new Date().toISOString()
      };

      // 5. Enqueue for Student
      if (student.email) {
        await enqueueNotification({
          eventType: 'WEEKLY_REPORT',
          recipientProfileId: student.id,
          recipientType: 'student',
          payload,
        });
      }

      // 6. Enqueue for Parents
      for (const parent of parents) {
        if (parent.email) {
          await enqueueNotification({
            eventType: 'WEEKLY_REPORT',
            recipientProfileId: parent.id,
            recipientType: 'parent',
            payload,
          });
        }
      }

      console.log(`✅ [ManualReport] Weekly report enqueued for student and ${parents.length} parents.`);
      return { success: true, count: 1 + parents.length };
    } catch (error) {
      console.error('❌ [ManualReport] Error sending manual weekly report:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a test due date reminder
   */
  async sendManualDueDateReminder(studentId, testName, dueDate, parentId = null) {
    try {
      console.log(`📬 [ManualDue] Triggering due date reminder for student ${studentId}`);

      const { data: student } = await supabase.from('profiles').select('id, name, email').eq('id', studentId).single();
      if (!student) throw new Error('Student not found');

      const payload = {
        studentId,
        studentName: student.name,
        dueItems: [
          {
            course_name: testName || 'Assigned Test',
            due_date: dueDate || new Date(Date.now() + 86400000 * 2).toISOString(), // fallback 2 days
            level: 'Practice'
          }
        ]
      };

      // Enqueue Student
      if (student.email) {
        await enqueueNotification({
          eventType: 'DUE_DATE_REMINDER',
          recipientProfileId: student.id,
          recipientType: 'student',
          payload
        });
      }

      // Enqueue Parents
      const { data: allParents } = await supabase.from('profiles').select('id, name, email, linked_students').eq('role', 'parent');
      const parents = (allParents || []).filter(p => (p.linked_students || []).some(id => String(id) === String(studentId)));

      for (const parent of parents) {
        if (parent.email) {
          await enqueueNotification({
            eventType: 'DUE_DATE_REMINDER',
            recipientProfileId: parent.id,
            recipientType: 'parent',
            payload
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error('❌ [ManualDue] Error sending manual due reminder:', error);
      throw error;
    }
  }
}

export default NotificationScheduler;
