// ============================================
// WELCOME EMAIL QUEUE PROCESSOR
// Polls database and sends emails via Brevo
// ============================================

import { createClient } from '@supabase/supabase-js';
import BrevoEmailService from './BrevoEmailService.js';

class WelcomeEmailProcessor {
  constructor() {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('⚠️ WelcomeEmailProcessor Error: Missing Supabase credentials.');
      // Don't throw, let start() handle the check if we want to be graceful
    }

    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      console.warn('⚠️ WelcomeEmailProcessor: Missing Supabase credentials. Background processing disabled.');
      this.supabase = null;
    }
    this.emailService = new BrevoEmailService();
    this.isRunning = false;
    this.processQueueInFlight = false;
    this.pollInterval = null;
  }

  /**
   * Start polling the queue
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ Welcome email processor already running');
      return;
    }

    console.log('📧 Starting welcome email queue processor...');
    this.isRunning = true;

    // Process immediately, then every 10 seconds
    void this.processQueue();
    this.pollInterval = setInterval(() => {
      void this.processQueue();
    }, 10000); // 10 seconds
  }

  /**
   * Stop polling
   */
  stop() {
    if (!this.isRunning) return;

    console.log('Stopping welcome email processor...');
    this.isRunning = false;
    
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Process pending emails in queue
   */
  async processQueue() {
    if (this.processQueueInFlight) return;
    this.processQueueInFlight = true;

    try {
      // Check if Supabase client is initialized
      if (!this.supabase) {
        // Only log warning once to avoid log spam, or skip logging if previously warned in constructor
        return;
      }

      const limit = 10;
      const nowIso = new Date().toISOString();

      // Reclaim stuck rows (if a worker crashed after claiming).
      const reclaimMinutes = Number(process.env.WELCOME_EMAIL_RECLAIM_MINUTES || 30);
      const reclaimBeforeIso = new Date(Date.now() - reclaimMinutes * 60_000).toISOString();

      // 1) Pending items
      const { data: pendingEmails, error: pendingFetchError } = await this.supabase
        .from('welcome_email_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (pendingFetchError) {
        console.error('❌ Error fetching pending welcome emails:', pendingFetchError.message);
        return;
      }

      let candidates = pendingEmails || [];

      // 2) Stale processing items (optional; depends on schema upgrade)
      const remaining = Math.max(0, limit - candidates.length);
      if (remaining > 0) {
        const { data: staleProcessing, error: staleFetchError } = await this.supabase
          .from('welcome_email_queue')
          .select('*')
          .eq('status', 'processing')
          .lte('processing_at', reclaimBeforeIso)
          .order('processing_at', { ascending: true })
          .limit(remaining);

        if (!staleFetchError) {
          candidates = candidates.concat(staleProcessing || []);
        } else {
          // If queue schema isn't upgraded yet, don't fail the whole worker.
          console.warn('⚠️ Skipping stale processing reclaim:', staleFetchError.message);
        }
      }

      if (!candidates || candidates.length === 0) return;

      console.log(`📧 Processing ${candidates.length} welcome email(s)...`);

      // Process each email (claim before sending to avoid duplicates)
      for (const item of candidates) {
        const claimed = await this.claimQueueItem(item, nowIso);
        // If claiming failed due to schema mismatch (no `processing` support),
        // fall back to sending anyway (best-effort, less strict de-dupe).
        await this.sendWelcomeEmail(item, { claimed });
      }

    } catch (error) {
      console.error('❌ Welcome email queue processing error:', error.message);
      console.error('   Stack:', error.stack);
    } finally {
      this.processQueueInFlight = false;
    }
  }

  /**
   * Atomically claim a row for processing.
   * Prevents duplicate emails when multiple server instances run in parallel.
   */
  async claimQueueItem(queueItem, nowIso) {
    try {
      const { data, error } = await this.supabase
        .from('welcome_email_queue')
        .update({
          status: 'processing',
          processing_at: nowIso,
          processed_at: null,
          error_message: null
        })
        .match({ id: queueItem.id, status: queueItem.status })
        .select('id');

      if (error) {
        console.error(`   ❌ Failed to claim item ${queueItem.id}:`, error.message);
        return false;
      }
      return (data?.length || 0) > 0;
    } catch (err) {
      console.warn('⚠️ Failed to claim welcome email queue item:', err?.message || String(err));
      return false;
    }
  }

  /**
   * Send welcome email to single recipient
   */
  async sendWelcomeEmail(queueItem, { claimed = false } = {}) {
    try {
      console.log(`   → Sending to: ${queueItem.email} (${queueItem.name})`);

      // Send via Brevo
      const result = await this.emailService.sendWelcomeEmail(
        queueItem.email,
        queueItem.name
      );

      if (result.success) {
        // Mark as sent
        await this.updateQueueStatus(queueItem.id, 'sent', null, result.messageId, {
          expectedStatus: claimed ? 'processing' : 'pending'
        });
        console.log(`   ✅ Sent to ${queueItem.email}`);
      } else {
        // Mark as failed
        await this.updateQueueStatus(queueItem.id, 'failed', result.error, null, {
          expectedStatus: claimed ? 'processing' : 'pending'
        });
        console.error(`   ❌ Failed for ${queueItem.email}: ${result.error}`);
      }
    } catch (error) {
      console.error(`   ❌ Error sending to ${queueItem.email}:`, error.message);
      await this.updateQueueStatus(queueItem.id, 'failed', error.message, null, {
        expectedStatus: claimed ? 'processing' : 'pending'
      });
    }
  }

  /**
   * Update queue item status
   */
  async updateQueueStatus(id, status, errorMessage, messageId, { expectedStatus = null } = {}) {
    try {
      const nowIso = new Date().toISOString();
      const updateData = {
        status,
        processed_at: nowIso,
        processing_at: null,
        ...(errorMessage && { error_message: errorMessage }),
        ...(!errorMessage && { error_message: null }),
        ...(messageId && { payload: { messageId } })
      };

      let query = this.supabase
        .from('welcome_email_queue')
        .update(updateData)
        .eq('id', id);

      if (expectedStatus) {
        query = query.eq('status', expectedStatus);
      }

      const { error } = await query;
      
      if (error) {
        console.error(`❌ Error updating queue status for ID ${id} to ${status}:`, error.message);
        console.error('   Update data:', JSON.stringify(updateData));
      }
    } catch (error) {
      console.error(`❌ Exception updating queue status for ID ${id}:`, error.message);
    }
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    try {
      const { data: stats } = await this.supabase.rpc('welcome_email_stats');
      
      if (stats) return stats;

      // Fallback: manual count
      const [pending, sent, failed] = await Promise.all([
        this.supabase.from('welcome_email_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        this.supabase.from('welcome_email_queue').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
        this.supabase.from('welcome_email_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed')
      ]);

      return {
        pending: pending.count || 0,
        sent: sent.count || 0,
        failed: failed.count || 0,
        total: (pending.count || 0) + (sent.count || 0) + (failed.count || 0)
      };
    } catch (error) {
      console.error('Error getting stats:', error.message);
      return { pending: 0, sent: 0, failed: 0, total: 0 };
    }
  }
}

export default WelcomeEmailProcessor;
