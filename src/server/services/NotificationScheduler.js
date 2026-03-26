import cron from 'node-cron';
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

    // Weekly progress report - Every Sunday at 9 AM
    cron.schedule('0 9 * * 0', async () => {
      console.log('Weekly progress report job triggered');
      try {
        const port = process.env.PORT || 3001;
        await fetch(`http://localhost:${port}/api/notifications/run-weekly`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' }
        });
      } catch (e) {
        console.error('Error running weekly report from cron:', e.message);
      }
    }, {
      timezone: 'America/New_York'
    });

    // Test due date reminders - Every day at 8 AM and 6 PM
    cron.schedule('0 8 * * *', async () => {
      console.log('Morning due date reminder job triggered');
      try {
        const port = process.env.PORT || 3001;
        await fetch(`http://localhost:${port}/api/notifications/run-due-reminders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' }
        });
      } catch (e) {
        console.error('Error running morning reminders from cron:', e.message);
      }
    }, {
      timezone: 'America/New_York'
    });

    cron.schedule('0 18 * * *', async () => {
      console.log('Evening due date reminder job triggered');
      try {
        const port = process.env.PORT || 3001;
        await fetch(`http://localhost:${port}/api/notifications/run-due-reminders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': process.env.CRON_SECRET || '' }
        });
      } catch (e) {
        console.error('Error running evening reminders from cron:', e.message);
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
  async triggerTestCompletionNotification(submissionId, studentId) {
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

      // Collect all parents
      const { data: allParents, error: parentError } = await supabase
        .from('profiles')
        .select('id, name, email, linked_students')
        .eq('role', 'parent');

      const parents = (allParents || []).filter(p => {
        const linked = p.linked_students || [];
        return Array.isArray(linked) && linked.some(id => String(id).trim() === String(studentId).trim());
      });

      const parentEmails = parents.map(p => p.email).filter(Boolean);
      
      // 3. Enqueue External Notifications (Separate for Student vs Parents for Deep Linking)
      
      // Enqueue for Student
      if (studentEmail) {
        // External notification (Outbox) - survivable deep link
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
            level: submission.level,
            rawScore: submission.raw_score,
            totalQuestions: submission.total_questions,
            rawPercentage: submission.raw_score_percentage,
            scaledScore: submission.scaled_score,
            testDate: submission.test_date
          },
          scheduledFor: new Date().toISOString()
        });

        // In-App Notification (Dashboard)
        await supabase
          .from('notifications')
          .insert({
            user_id: studentId,
            title: `Test Graded: ${course?.name || 'Course'}`,
            message: `You scored ${Math.round(submission.raw_score_percentage)}% in your ${submission.level || ''} level test.`,
            type: 'test_completion',
            data: { submissionId, courseId: submission.course_id, level: submission.level }
          });
      }

      // Enqueue for each Parent separately
      for (const parent of parents) {
        if (parent.email) {
          // External notification (Outbox)
          await enqueueNotification({
            eventType: 'TEST_COMPLETED',
            recipientProfileId: parent.id,
            recipientType: 'parent',
            payload: {
              submissionId,
              studentId, // Needed for parent deep link
              studentName: studentProfile?.name || 'Student',
              courseId: submission.course_id,
              courseName: course?.name || 'Course',
              level: submission.level,
              rawScore: submission.raw_score,
              totalQuestions: submission.total_questions,
              rawPercentage: submission.raw_score_percentage,
              scaledScore: submission.scaled_score,
              testDate: submission.test_date
            },
            scheduledFor: new Date().toISOString()
          });

          // In-App Notification (Parent Dashboard)
          await supabase
            .from('notifications')
            .insert({
              user_id: parent.id,
              title: `Child Activity: ${studentProfile?.name || 'Student'}`,
              message: `${studentProfile?.name} completed a ${course?.name || 'Course'} test with ${Math.round(submission.raw_score_percentage)}%.`,
              type: 'test_completion',
              data: { 
                submissionId, 
                studentId, 
                courseId: submission.course_id, 
                level: submission.level,
                studentName: studentProfile?.name
              }
            });
        }
      }

      console.log(`✅ [Notification] Enqueued separate notifications for student and ${parents.length} parents`);

      // 4. Create In-App Notifications
      const inAppNotifications = [];
      
      // For Student
      inAppNotifications.push({
        user_id: studentId,
        title: 'Test Completed!',
        message: `You completed ${course?.name || 'Test'} (${submission.level || 'Practice'}). Score: ${Math.round(submission.raw_score_percentage || 0)}%`,
        type: 'test_completion',
        data: { 
            submissionId, 
            courseId: submission.course_id, 
            level: submission.level,
            score: Math.round(submission.raw_score_percentage || 0),
            scaledScore: submission.scaled_score,
            testName: course?.name || 'Test'
        }
      });

      // For Parents
      parents.forEach(parent => {
        inAppNotifications.push({
          user_id: parent.id,
          title: 'Child Test Completed',
          message: `${studentProfile?.name || 'Your child'} completed ${course?.name || 'Test'} (${submission.level || 'Practice'}). Score: ${Math.round(submission.raw_score_percentage || 0)}%`,
          type: 'test_completion',
          data: { 
              submissionId, 
              studentId,
              studentName: studentProfile?.name,
              courseId: submission.course_id, 
              level: submission.level,
              score: Math.round(submission.raw_score_percentage || 0),
              scaledScore: submission.scaled_score,
              testName: course?.name || 'Test'
          }
        });
      });

      if (inAppNotifications.length > 0) {
        // Use supabaseAdmin to bypass RLS for direct insertion
        await supabaseAdmin.from('notifications').insert(inAppNotifications);
        console.log(`✅ [Notification] In-app notifications created in table for ${inAppNotifications.length} users`);
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
      console.log(`Manual weekly report triggered for student ${studentId}`);
      return { success: true, message: 'Manual weekly report triggered' };
    } catch (error) {
      console.error('Error sending manual weekly report:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a test due date reminder
   */
  async sendManualDueDateReminder(studentId, testName, dueDate, parentId = null) {
    try {
      console.log(`Manual due date reminder triggered for student ${studentId}`);
      return { success: true, message: 'Manual due date reminder triggered' };
    } catch (error) {
      console.error('Error sending manual due date reminder:', error);
      throw error;
    }
  }
}

export default NotificationScheduler;
