import NotificationScheduler from '../services/NotificationScheduler.js';

class NotificationMiddleware {
  constructor() {
    this.scheduler = new NotificationScheduler();
  }

  /**
   * Middleware to trigger test completion notification after test submission
   */
  async triggerTestCompletionNotification(req, res, next) {
    const originalSend = res.send;
    
    res.send = async function(data) {
      // Check if this is a successful test submission
      if (res.statusCode === 200 || res.statusCode === 201) {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Look for submission ID or user ID in the response
          const submissionId = responseData.submissionId || responseData.id || responseData._id;
          const studentId = responseData.user_id || responseData.studentId || req.user?.id;
          
          if (submissionId && studentId) {
            // Trigger notification asynchronously (don't block the response)
            setTimeout(async () => {
              try {
                await this.scheduler.triggerTestCompletionNotification(submissionId, studentId);
              } catch (error) {
                console.error('Error triggering test completion notification:', error);
              }
            }, 1000);
          }
        } catch (error) {
          console.error('Error parsing submission response for notification:', error);
        }
      }
      
      // Call original send
      originalSend.call(this, data);
    };
    
    next();
  }

  /**
   * Middleware to trigger notification when progress is updated
   */
  async triggerProgressNotification(req, res, next) {
    const originalSend = res.send;
    
    res.send = async function(data) {
      // Check if this is a successful progress update
      if (res.statusCode === 200 || res.statusCode === 201) {
        try {
          const responseData = typeof data === 'string' ? JSON.parse(data) : data;
          
          // Check if this represents a significant achievement
          if (responseData.passed || responseData.score >= 80) {
            const studentId = responseData.user_id || responseData.studentId || req.user?.id;
            
            if (studentId) {
              // Could trigger achievement notifications here
              console.log(`Progress milestone achieved for student ${studentId}`);
            }
          }
        } catch (error) {
          console.error('Error parsing progress response for notification:', error);
        }
      }
      
      // Call original send
      originalSend.call(this, data);
    };
    
    next();
  }

  /**
   * Initialize the notification scheduler
   */
  initializeScheduler() {
    this.scheduler.start();
    console.log('Notification scheduler initialized');
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
