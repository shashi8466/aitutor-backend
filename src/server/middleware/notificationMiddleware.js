import NotificationScheduler from '../services/NotificationScheduler.js';

class NotificationMiddleware {
  constructor() {
    this.scheduler = new NotificationScheduler();
  }

  /**
   * Middleware to trigger test completion notification after test submission
   * DEPRECATED: Now handled explicitly in grading route for reliability.
   */
  async triggerTestCompletionNotification(req, res, next) {
    // Logic moved to grading.js to avoid scoping and interception issues.
    next();
  }

  /**
   * Middleware to trigger notification when progress is updated
   */
  async triggerProgressNotification(req, res, next) {
    next();
  }

  /**
   * Initialize the notification scheduler
   */
  initializeScheduler() {
    this.scheduler.start();
    console.log('🔔 Notification scheduler initialized');
  }

  /**
   * Stop the notification scheduler
   */
  stopScheduler() {
    this.scheduler.stop();
  }
}

// Create a singleton instance
const notificationMiddleware = new NotificationMiddleware();

export default notificationMiddleware;
