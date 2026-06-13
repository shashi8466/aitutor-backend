import cron from 'node-cron';
import axios from 'axios';
import supabase from '../../supabase/supabaseAdmin.js';
import { enqueueNotification } from '../utils/notificationOutbox.js';

// ─── Process-level singleton guard ───────────────────────────────────────────
// This lives on `process` (not the class instance) so it survives HMR module
// re-imports in development. Without this, every hot-reload creates a new
// cron task, resulting in 2, 3, 4... simultaneous outbox ticks per minute.
if (!process._notifSchedulerLocks) {
  process._notifSchedulerLocks = {
    started: false,
    processingSubmissions: new Set()
  };
}

class NotificationScheduler {
  constructor() {
    this.tasks = [];
  }

  get isRunning() {
    return process._notifSchedulerLocks.started;
  }

  get _processingSubmissions() {
    return process._notifSchedulerLocks.processingSubmissions;
  }

  /**
   * Start all scheduled jobs — safe to call multiple times.
   */
  start() {
    if (process._notifSchedulerLocks.started) {
      console.log(`🔔 [Scheduler] [PID: ${process.pid}] Already running — skipping duplicate start.`);
      return;
    }

    // Stop any leftover cron tasks from a previous module load
    try {
      const tasks = cron.getTasks();
      const taskCount = tasks instanceof Map ? tasks.size : (tasks?.length || 0);
      if (taskCount > 0) {
        console.log(`🛑 [Scheduler] Cleaning up ${taskCount} stale cron tasks...`);
        (tasks instanceof Map ? tasks.values() : tasks).forEach(t => t.stop());
      }
    } catch (err) {
      console.warn('⚠️ [Scheduler] Cleanup error:', err.message);
    }

    process._notifSchedulerLocks.started = true;
    console.log(`🚀 [Scheduler] [PID: ${process.pid}] Starting notification scheduler (single instance)...`);




    // ── Outbox processor ─────────────────────────────────────────────────────
    // IMPORTANT: Only run in production OR when explicitly enabled in dev.
    // Both local dev AND Render point to the same Supabase DB. Running crons
    // on both causes two servers to process the same pending row → two emails.
    const isProduction = process.env.NODE_ENV === 'production';
    const localOutboxEnabled = process.env.ENABLE_LOCAL_OUTBOX === 'true';

    if (isProduction || localOutboxEnabled) {
      // On startup, delete all stale pending rows so restarts don't re-process.
      setImmediate(async () => {
        try {
          const { data: wiped, error } = await supabase
            .from('notification_outbox')
            .delete()
            .eq('event_type', 'TEST_COMPLETED')
            .in('status', ['pending', 'processing'])
            .select('id');
          console.log(`🧹 [Scheduler] Startup wipe: ${wiped?.length || 0} stale rows removed.`);
          if (error) console.warn('⚠️ [Scheduler] Wipe error:', error.message);
        } catch (e) { console.warn('⚠️ [Scheduler] Startup wipe failed:', e.message); }
      });

      let outboxRunning = false;
      const outboxTask = cron.schedule('* * * * *', async () => {
        if (outboxRunning) return; // Prevent overlap
        outboxRunning = true;
        try {
          console.log(`🔄 [Cron] [PID: ${process.pid}] Processing notification outbox...`);
          const { processOutboxOnce } = await import('../utils/notificationOutbox.js');
          const result = await processOutboxOnce({ limit: 20 });
          if (result.processed > 0) {
            console.log(`✅ [Cron] Processed ${result.processed} notifications`);
          }
        } catch (e) {
          console.error(`❌ [Cron] Outbox error:`, e.message);
        } finally {
          outboxRunning = false;
        }
      });
      this.tasks.push(outboxTask);
      console.log(`📦 [Scheduler] Outbox cron ACTIVE (${isProduction ? 'production' : 'local-dev-explicit'})`);
    } else {
      console.log(`⏭️ [Scheduler] Outbox cron DISABLED in dev (set ENABLE_LOCAL_OUTBOX=true to enable locally).`);
    }

    // Weekly progress report — every Saturday at 7 PM IST
    const weeklyTask = cron.schedule('0 19 * * 6', async () => {
      console.log('📬 [Cron] Weekly progress report job triggered');
      try {
        const port = process.env.PORT || 3001;
        const url = `http://127.0.0.1:${port}/api/notifications/run-weekly`;
        const response = await axios.post(url, {}, {
          headers: { 'x-cron-secret': process.env.CRON_SECRET || '' },
          timeout: 600000
        });
        console.log('✅ [Cron] Weekly report response:', response.data);
      } catch (error) {
        console.error('❌ [Cron] Weekly report error:', error.message);
      }
    }, { timezone: 'Asia/Kolkata' });
    this.tasks.push(weeklyTask);

    // Due date reminders — every two days at 9 AM
    const remindersTask = cron.schedule('0 9 */2 * *', async () => {
      console.log('📬 [Cron] Due date reminder job triggered');
      try {
        const port = process.env.PORT || 3001;
        const url = `http://127.0.0.1:${port}/api/notifications/run-due-reminders`;
        const response = await axios.post(url, {}, {
          headers: { 'x-cron-secret': process.env.CRON_SECRET || '' }
        });
        console.log('✅ [Cron] Due reminders response:', response.data);
      } catch (e) {
        console.error('❌ [Cron] Due reminders error:', e.message);
      }
    }, { timezone: 'America/New_York' });
    this.tasks.push(remindersTask);

    console.log('✅ [Scheduler] Notification scheduler started successfully (1 outbox task registered).');
  }

  /**
   * Trigger test completion notification (called when a test is submitted).
   * Fully idempotent — safe to call multiple times for the same submissionId.
   */
  async triggerTestCompletionNotification(submissionId, studentId, modularScores = null) {
    // ── Layer 1: In-memory concurrent-call guard ──────────────────────────────
    // Blocks a second call that arrives within the same Node.js event-loop turn
    // (e.g. double-click reaching the API before React disables the button).
    const lockKey = `submission:${submissionId}`;
    if (this._processingSubmissions.has(lockKey)) {
      console.log(`⚠️ [Notification] Concurrent duplicate suppressed for submission ${submissionId}`);
      return;
    }
    this._processingSubmissions.add(lockKey);

    try {
      console.log(`📬 [Notification] Triggering test completion notification for submission ${submissionId}`);

      // ── Layer 2: DB pre-check ─────────────────────────────────────────────
      // Check both numeric and string form of submissionId to handle type
      // mismatches between JS number and JSONB string storage.
      const numericId = Number(submissionId);
      const stringId = String(submissionId);

      const { data: existingOutbox } = await supabase
        .from('notification_outbox')
        .select('id, status')
        .eq('event_type', 'TEST_COMPLETED')
        .or(`payload->>submissionId.eq.${stringId},payload->>submissionId.eq.${numericId}`)
        .in('status', ['pending', 'processing', 'sent'])
        .limit(1);

      if (existingOutbox && existingOutbox.length > 0) {
        console.log(`✅ [Notification] Submission ${submissionId} already has a ${existingOutbox[0].status} notification — skipping.`);
        return;
      }

      const { data: submission, error: subError } = await supabase
        .from('test_submissions')
        .select('id, user_id, course_id, level, raw_score, total_questions, raw_score_percentage, scaled_score, test_date, metadata')
        .eq('id', submissionId)
        .single();

      if (subError || !submission) {
        console.error('❌ [Notification] Failed to fetch submission:', subError?.message || 'Not found');
        return;
      }

      const [{ data: studentProfile }, { data: course }] = await Promise.all([
        supabase.from('profiles').select('id, name, email').eq('id', submission.user_id || studentId).maybeSingle(),
        supabase.from('courses').select('id, name').eq('id', submission.course_id).maybeSingle()
      ]);

      const normalizedStudentEmail = studentProfile?.email
        ? studentProfile.email.trim().toLowerCase()
        : null;

      const { data: allParents } = await supabase
        .from('profiles')
        .select('id, name, email, linked_students')
        .eq('role', 'parent');

      const parents = (allParents || []).filter(p => {
        const linked = p.linked_students;
        if (!Array.isArray(linked)) return false;
        return linked.some(id => id && String(id).trim() === String(studentId).trim());
      });

      // Consolidate recipients by unique email (prevents student == parent duplicates)
      const emailToProfileMap = new Map();
      if (normalizedStudentEmail) {
        emailToProfileMap.set(normalizedStudentEmail, {
          id: studentId,
          type: 'student',
          name: studentProfile?.name || 'Student'
        });
      }
      for (const parent of parents) {
        const normalizedParentEmail = parent.email ? parent.email.trim().toLowerCase() : null;
        if (normalizedParentEmail) {
          emailToProfileMap.set(normalizedParentEmail, {
            id: parent.id,
            type: 'parent',
            name: parent.name || 'Parent'
          });
        }
      }

      // ── Layer 3: Enqueue exactly ONE row per unique email ─────────────────
      // enqueueNotification itself also does a DB dedup check internally.
      let enqueuedCount = 0;
      for (const [email, recipient] of emailToProfileMap.entries()) {
        await enqueueNotification({
          eventType: 'TEST_COMPLETED',
          recipientProfileId: recipient.id,
          recipientType: recipient.type,
          payload: {
            submissionId: numericId, // Store consistently as number
            studentId,
            recipientEmail: email,
            studentName: studentProfile?.name || 'Student',
            courseId: submission.course_id,
            courseName: course?.name || 'Course',
            level: modularScores ? 'Comprehensive' : submission.level,
            rawScore: submission.raw_score,
            totalQuestions: submission.total_questions,
            rawPercentage: submission.raw_score_percentage,
            scaledScore: submission.scaled_score,
            testDate: submission.test_date,
            metadata: submission.metadata,
            modularScores
          },
          scheduledFor: new Date().toISOString()
        });
        enqueuedCount++;
      }

      console.log(`✅ [Notification] Enqueued ${enqueuedCount} notifications for submission ${submissionId}.`);

      // In-app notifications
      const inAppNotifications = [{
        user_id: studentId,
        title: `Test Graded: ${course?.name || 'Course'}`,
        message: `You scored ${Math.round(submission.raw_score_percentage)}% in your ${submission.level || 'Practice'} level test.`,
        type: 'test_completion',
        data: { submissionId: numericId, courseId: submission.course_id, level: submission.level }
      }];
      parents.forEach(parent => {
        inAppNotifications.push({
          user_id: parent.id,
          title: `Child Activity: ${studentProfile?.name || 'Student'}`,
          message: `${studentProfile?.name} completed a ${course?.name || 'Course'} test with ${Math.round(submission.raw_score_percentage)}%.`,
          type: 'test_completion',
          data: { submissionId: numericId, studentId, studentName: studentProfile?.name }
        });
      });

      if (inAppNotifications.length > 0) {
        await supabase.from('notifications').insert(inAppNotifications);
      }

      return { success: true, emailsEnqueued: enqueuedCount };
    } catch (error) {
      console.error('❌ [Notification] Error in triggerTestCompletionNotification:', error);
    } finally {
      this._processingSubmissions.delete(lockKey);
    }
  }

  stop() {
    this.tasks.forEach(t => t.stop());
    this.tasks = [];
    process._notifSchedulerLocks.started = false;
    console.log('🛑 [Scheduler] Stopped.');
  }

  getStatus() {
    return {
      isRunning: process._notifSchedulerLocks.started,
      scheduledTasks: cron.getTasks() instanceof Map
        ? cron.getTasks().size
        : (cron.getTasks()?.length || 0)
    };
  }
}

export default NotificationScheduler;
