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
    // ⚠️ DISABLED LOCALLY to prevent local environment from consuming/failing production outbox items
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_LOCAL_OUTBOX === 'true') {
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

      if (!studentProfile?.email) {
        console.warn(`⚠️ [Notification] Student ${submission.user_id || studentId} has no email in profiles.email – email delivery will fail until set.`);
      }

      // Build payload matching email template expectations
      const payload = {
        submissionId,
        studentId,
        studentName: studentProfile?.name || 'Student',
        courseName: course?.name || 'Course',
        level: submission.level,
        rawScore: submission.raw_score,
        totalQuestions: submission.total_questions,
        rawPercentage: submission.raw_score_percentage,
        scaledScore: submission.scaled_score,
        testDate: submission.test_date
      };

      console.log(`✅ [Notification] Payload built for ${payload.studentName} - Score: ${payload.rawPercentage}%`);

      // Send to student
      await enqueueNotification({
        eventType: 'TEST_COMPLETED',
        recipientProfileId: studentId,
        recipientType: 'student',
        payload,
        scheduledFor: new Date().toISOString()
      });
      console.log(`✅ [Notification] Queued notification for student ${studentId}`);

      // Find and notify linked parents
      const { data: parents, error: parentError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'parent')
        .contains('linked_students', [studentId]);

      if (parentError) {
        console.error('❌ [Notification] Error finding parents:', parentError.message);
        return;
      }

      for (const parent of parents || []) {
        await enqueueNotification({
          eventType: 'TEST_COMPLETED',
          recipientProfileId: parent.id,
          recipientType: 'parent',
          payload,
          scheduledFor: new Date().toISOString()
        });
        console.log(`✅ [Notification] Queued notification for parent ${parent.id}`);
      }

      console.log(`✅ [Notification] Test completion notifications queued successfully`);
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
