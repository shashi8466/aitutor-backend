import NotificationService from '../services/NotificationService.js';
import NotificationTemplates from '../services/NotificationTemplates.js';
import Progress from '../models/Progress.js';
import Submission from '../models/Submission.js';
import Enrollment from '../models/Enrollment.js';

class NotificationController {
  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Send test completion notification
   */
  async sendTestCompletionNotification(req, res) {
    try {
      const { submissionId, studentId, parentId } = req.body;

      // Get submission details
      const submission = await Submission.findById(submissionId)
        .populate('course_id', 'name tutor_type')
        .populate('user_id', 'name email phone');

      if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
      }

      const student = submission.user_id;
      const score = Math.round(submission.raw_score_percentage || 0);
      const totalScore = 100;
      const percentage = score;
      const testName = submission.course_id.name;

      // Get parent details if parentId is provided
      let parent = null;
      if (parentId) {
        parent = await User.findById(parentId);
      }

      // Prepare recipients
      const recipients = {
        email: [student.email],
        phone: student.phone ? [student.phone] : [],
        whatsapp: student.phone ? [student.phone] : []
      };

      // Add parent to recipients if available
      if (parent) {
        recipients.email.push(parent.email);
        if (parent.phone) {
          recipients.phone.push(parent.phone);
          recipients.whatsapp.push(parent.phone);
        }
      }

      // Get notification templates
      const studentTemplate = NotificationTemplates.getTestCompletionTemplate(
        student.name, testName, score, totalScore, percentage
      );

      const parentTemplate = parent ? NotificationTemplates.getTestCompletionTemplate(
        student.name, testName, score, totalScore, percentage, parent.name
      ) : null;

      // Send notifications
      const results = await this.notificationService.sendNotification(recipients, {
        email: true,
        sms: true,
        whatsapp: true,
        subject: studentTemplate.emailSubject,
        message: studentTemplate.smsMessage,
        htmlContent: studentTemplate.emailHtml
      });

      // Log notification for tracking
      await this.logNotification({
        type: 'test_completion',
        studentId: student._id,
        parentId: parentId,
        submissionId: submissionId,
        recipients: recipients,
        results: results,
        sentAt: new Date()
      });

      res.json({
        success: true,
        message: 'Test completion notifications sent successfully',
        results
      });

    } catch (error) {
      console.error('Error sending test completion notification:', error);
      res.status(500).json({ error: 'Failed to send notifications' });
    }
  }

  /**
   * Send weekly progress report
   */
  async sendWeeklyProgressReport(req, res) {
    try {
      const { studentId, parentId } = req.body;

      // Get student details
      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get parent details if parentId is provided
      let parent = null;
      if (parentId) {
        parent = await User.findById(parentId);
      }

      // Calculate progress data for the past week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Get submissions from the past week
      const weeklySubmissions = await Submission.find({
        user_id: studentId,
        created_at: { $gte: oneWeekAgo }
      }).populate('course_id', 'name tutor_type');

      // Get progress updates from the past week
      const weeklyProgress = await Progress.find({
        user_id: studentId,
        updated_at: { $gte: oneWeekAgo }
      }).populate('course_id', 'name');

      // Calculate statistics
      const testsAttempted = weeklySubmissions.length;
      const averageScore = testsAttempted > 0 
        ? Math.round(weeklySubmissions.reduce((sum, sub) => sum + (sub.raw_score_percentage || 0), 0) / testsAttempted)
        : 0;

      const lessonsCompleted = weeklyProgress.filter(p => p.passed).length;
      const studyHours = Math.min(25, lessonsCompleted * 0.5); // Estimate

      // Get current scores
      const currentSubmissions = await Submission.find({ user_id: studentId })
        .populate('course_id', 'name tutor_type');

      let currentMathScore = 0;
      let currentRWScore = 0;

      currentSubmissions.forEach(sub => {
        const score = Math.round(sub.raw_score_percentage || 0);
        const scaledScore = 200 + (score / 100) * 600;
        
        if (sub.course_id.tutor_type === 'math') {
          currentMathScore = Math.max(currentMathScore, Math.round(scaledScore));
        } else {
          currentRWScore = Math.max(currentRWScore, Math.round(scaledScore));
        }
      });

      const currentTotalScore = currentMathScore + currentRWScore;

      // Get course progress
      const enrollments = await Enrollment.find({ student_id: studentId })
        .populate('course_id', 'name');

      const courseProgress = enrollments.map(enrollment => ({
        name: enrollment.course_id.name,
        score: Math.random() * 800, // This should come from actual course data
        progress: Math.min(100, Math.random() * 100) // This should come from actual progress data
      }));

      // Generate achievements and recommendations
      const achievements = [];
      const recommendations = [];

      if (testsAttempted >= 3) achievements.push(`Completed ${testsAttempted} tests this week!`);
      if (averageScore >= 80) achievements.push(`Maintained ${averageScore}% average score!`);
      if (lessonsCompleted >= 5) achievements.push(`Completed ${lessonsCompleted} lessons!`);

      if (averageScore < 70) recommendations.push('Focus on reviewing fundamentals where scores are lower');
      if (testsAttempted < 2) recommendations.push('Try to complete at least 2-3 tests per week for consistent practice');
      if (currentTotalScore < 1000) recommendations.push('Consider spending more time on practice exercises');

      const progressData = {
        testsAttempted,
        averageScore,
        lessonsCompleted,
        studyHours,
        currentMathScore,
        currentRWScore,
        currentTotalScore,
        courseProgress,
        achievements,
        recommendations
      };

      // Prepare recipients
      const recipients = {
        email: [student.email],
        phone: student.phone ? [student.phone] : [],
        whatsapp: student.phone ? [student.phone] : []
      };

      if (parent) {
        recipients.email.push(parent.email);
        if (parent.phone) {
          recipients.phone.push(parent.phone);
          recipients.whatsapp.push(parent.phone);
        }
      }

      // Get notification templates
      const studentTemplate = NotificationTemplates.getWeeklyProgressTemplate(
        student.name, progressData
      );

      const parentTemplate = parent ? NotificationTemplates.getWeeklyProgressTemplate(
        student.name, progressData, parent.name
      ) : null;

      // Send notifications
      const results = await this.notificationService.sendNotification(recipients, {
        email: true,
        sms: true,
        whatsapp: true,
        subject: studentTemplate.emailSubject,
        message: studentTemplate.smsMessage,
        htmlContent: studentTemplate.emailHtml
      });

      // Log notification
      await this.logNotification({
        type: 'weekly_progress',
        studentId: studentId,
        parentId: parentId,
        recipients: recipients,
        results: results,
        progressData: progressData,
        sentAt: new Date()
      });

      res.json({
        success: true,
        message: 'Weekly progress report sent successfully',
        results,
        progressData
      });

    } catch (error) {
      console.error('Error sending weekly progress report:', error);
      res.status(500).json({ error: 'Failed to send progress report' });
    }
  }

  /**
   * Send test due date reminder
   */
  async sendTestDueDateReminder(req, res) {
    try {
      const { studentId, parentId, testName, dueDate, priority = 'medium', customEmail } = req.body;

      console.log(`📅 [DueDate] Sending due date reminder for test: ${testName}`);

      // Get student details
      const student = await User.findById(studentId);
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Get parent details if parentId is provided
      let parent = null;
      if (parentId) {
        parent = await User.findById(parentId);
      }

      // Prepare due date data
      const dueDateData = {
        testName,
        dueDate: new Date(dueDate),
        priority,
        daysUntilDue: Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24)),
        studentName: student.name,
        parentName: parent ? parent.name : null
      };

      // Send email notification
      const targetEmail = customEmail || (parent ? parent.email : student.email);
      const targetName = parent ? parent.name : student.name;
      
      const emailResult = await notificationService.sendDueDateReminder(
        targetEmail,
        targetName,
        dueDateData
      );

      // Send SMS if enabled
      if (parent && parent.phone_number) {
        try {
          await notificationService.sendSMS(
            parent.phone_number,
            `Reminder: ${student.name} has test "${testName}" due on ${new Date(dueDate).toLocaleDateString()}`
          );
        } catch (smsError) {
          console.warn('SMS notification failed:', smsError.message);
        }
      }

      res.json({
        success: true,
        message: 'Due date reminder sent successfully',
        dueDateInfo: dueDateData,
        emailResult
      });

    } catch (error) {
      console.error('Error sending due date reminder:', error);
      res.status(500).json({ error: 'Failed to send due date reminder' });
    }
  }
  async getNotificationHistory(req, res) {
    try {
      const { studentId, parentId, type, limit = 20 } = req.query;

      const query = {};
      if (studentId) query.studentId = studentId;
      if (parentId) query.parentId = parentId;
      if (type) query.type = type;

      const notifications = await NotificationLog.find(query)
        .sort({ sentAt: -1 })
        .limit(parseInt(limit))
        .populate('studentId', 'name email')
        .populate('parentId', 'name email');

      res.json({
        success: true,
        notifications
      });

    } catch (error) {
      console.error('Error fetching notification history:', error);
      res.status(500).json({ error: 'Failed to fetch notification history' });
    }
  }

  /**
   * Log notification for tracking
   */
  async logNotification(notificationData) {
    try {
      const NotificationLog = require('../models/NotificationLog');
      const log = new NotificationLog(notificationData);
      await log.save();
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }
}

export default NotificationController;
