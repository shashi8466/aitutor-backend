// ============================================
// BREVO EMAIL SERVICE
// Clean, fast email delivery for Supabase
// ============================================

import axios from 'axios';

class BrevoEmailService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.apiUrl = 'https://api.brevo.com/v3';
    
    if (!this.apiKey) {
      console.warn('⚠️ BREVO_API_KEY not configured - emails will be logged only');
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userEmail, userName) {
    try {
      const emailData = {
        sender: {
          name: 'AIPrep365 Team',
          email: process.env.EMAIL_FROM || 'ssky57771@gmail.com'
        },
        to: [
          {
            email: userEmail,
            name: userName
          }
        ],
        subject: 'Welcome to AIPrep365 🎉',
        htmlContent: this.getWelcomeTemplate(userName),
        headers: {
          'X-Mailin-custom': 'custom_header_value'
        }
      };

      // If API key exists, send via Brevo
      if (this.apiKey) {
        const response = await axios.post(
          `${this.apiUrl}/smtp/email`,
          emailData,
          {
            headers: {
              'api-key': this.apiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 10000 // 10 seconds timeout
          }
        );

        console.log('✅ Welcome email sent via Brevo:', response.data);
        return { 
          success: true, 
          messageId: response.data.messageId,
          provider: 'brevo'
        };
      } else {
        // Fallback: log email content
        console.log('📧 WELCOME EMAIL (logged only):');
        console.log('To:', userEmail);
        console.log('Subject:', emailData.subject);
        console.log('Content:', emailData.htmlContent);
        return { 
          success: true, 
          messageId: 'logged-only',
          provider: 'console'
        };
      }
    } catch (error) {
      console.error('❌ Brevo email error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message,
        provider: 'brevo'
      };
    }
  }

  /**
   * Welcome email template
   */
  getWelcomeTemplate(userName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 48px;
      margin-bottom: 10px;
    }
    h1 {
      color: #2563eb;
      margin: 0;
    }
    .content {
      margin-bottom: 30px;
    }
    .button {
      display: inline-block;
      background: #2563eb;
      color: white;
      padding: 12px 30px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      margin: 20px 0;
    }
    .features {
      background: #f0f9ff;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .feature-item {
      margin: 10px 0;
      padding-left: 10px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🎓</div>
      <h1>Welcome to AIPrep365!</h1>
    </div>

    <div class="content">
      <p>Hi <strong>${userName || 'there'}</strong>,</p>
      
      <p>Welcome to <strong>AIPrep365! 🎉</strong></p>
      <p>You have successfully registered on our platform.</p>
      <p>Start learning, practice regularly, and improve your skills step by step. 🚀</p>


      <center>
        <a href="${process.env.APP_URL || 'https://aitutor-4431c.web.app/'}" class="button">
          Start Learning Now 🚀
        </a>
      </center>
    </div>

    <div class="footer">
      <p>Thanks & Regards,</p>
      <p><strong>AIPrep365 Team</strong></p>
      <p style="font-size: 12px; margin-top: 20px;">
        © ${new Date().getFullYear()} AIPrep365. All rights reserved.<br>
        You received this email because you created an account on AIPrep365.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Send test completion notification
   */
  async sendTestCompletionEmail(userEmail, userName, courseName, score, percentage) {
    const percentageInt = Math.round(percentage || 0);
    const badge = percentageInt >= 70 ? '🏆' : percentageInt >= 40 ? '✅' : '📚';
    const grade = percentageInt >= 70 ? 'Excellent' : percentageInt >= 40 ? 'Good' : 'Needs Improvement';

    try {
      const emailData = {
        sender: {
          name: 'AIPrep365 Team',
          email: process.env.EMAIL_FROM || 'noreply@aitutor.com'
        },
        to: [{ email: userEmail, name: userName }],
        subject: `${badge} Test Completed: ${courseName} - Score: ${percentageInt}%`,
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    .card { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .score { font-size: 48px; font-weight: bold; color: ${percentageInt >= 70 ? '#10b981' : percentageInt >= 40 ? '#f59e0b' : '#ef4444'}; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${badge} Test Results</h1>
    <p>Hi <strong>${userName}</strong>,</p>
    <p>Great job completing <strong>${courseName}</strong>!</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <div class="score">${percentageInt}%</div>
      <p>Grade: <strong>${grade}</strong></p>
      <p>Scaled Score: <strong>${score || 'N/A'}</strong></p>
    </div>

    <a href="${process.env.APP_URL}/student/dashboard" class="button">View Detailed Report →</a>
    
    <p style="margin-top: 30px;">Keep practicing to improve your score! 💪</p>
  </div>
</body>
</html>
        `
      };

      if (this.apiKey) {
        const response = await axios.post(`${this.apiUrl}/smtp/email`, emailData, {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ Test completion email sent:', response.data);
        return { success: true, messageId: response.data.messageId };
      } else {
        console.log('📧 TEST COMPLETION EMAIL:', emailData.subject);
        return { success: true, messageId: 'logged' };
      }
    } catch (error) {
      console.error('❌ Test completion email error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send weekly progress report
   */
  async sendWeeklyProgressEmail(userEmail, userName, progressData) {
    try {
      const emailData = {
        sender: {
          name: 'AIPrep365 Team',
          email: process.env.EMAIL_FROM
        },
        to: [{ email: userEmail, name: userName }],
        subject: `📊 Weekly Progress Report - ${userName}`,
        htmlContent: this.getWeeklyReportTemplate(userName, progressData)
      };

      if (this.apiKey) {
        const response = await axios.post(`${this.apiUrl}/smtp/email`, emailData, {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        });
        console.log('✅ Weekly report sent:', response.data);
        return { success: true, messageId: response.data.messageId };
      } else {
        console.log('📧 WEEKLY REPORT:', emailData.subject);
        return { success: true, messageId: 'logged' };
      }
    } catch (error) {
      console.error('❌ Weekly report error:', error.message);
      return { success: false, error: error.message };
    }
  }

  getWeeklyReportTemplate(userName, data) {
    const rows = (data.submissions || []).map(sub => {
      const pct = Math.round(sub.raw_score_percentage || 0);
      return `<tr><td>${sub.courses?.name || 'Test'}</td><td>${pct}%</td></tr>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; }
    .card { background: white; border-radius: 12px; padding: 30px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    .stat { display: inline-block; margin: 10px; padding: 15px; background: #f0f9ff; border-radius: 8px; min-width: 100px; text-align: center; }
    .stat-val { font-size: 24px; font-weight: bold; color: #2563eb; }
  </style>
</head>
<body>
  <div class="card">
    <h1>📊 Weekly Progress Report</h1>
    <p>Hi <strong>${userName}</strong>,</p>
    <p>Here's your performance summary for this week:</p>

    <div>
      <div class="stat"><div class="stat-val">${data.testsAttempted || 0}</div><div>Tests Taken</div></div>
      <div class="stat"><div class="stat-val">${data.averageScore || 0}%</div><div>Avg Score</div></div>
      <div class="stat"><div class="stat-val">${data.bestScore || 0}%</div><div>Best Score</div></div>
    </div>

    ${rows ? `<table><thead><tr><th>Test</th><th>Score</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No tests taken this week.</p>'}

    <p style="margin-top: 30px;">Keep up the great work! 🚀</p>
  </div>
</body>
</html>
    `;
  }
  /**
   * Send Feedback Notification to Admin
   */
  async sendFeedbackNotification(adminEmail, feedbackData) {
    try {
      const { 
        studentName, 
        studentEmail, 
        courseName, 
        testType, 
        rating, 
        difficultyLevel, 
        qualityRating, 
        message, 
        anonymous,
        attemptDate
      } = feedbackData;

      const displayStudentName = anonymous ? 'Anonymous Student' : studentName;
      const displayStudentEmail = anonymous ? 'Hidden' : studentEmail;

      const emailData = {
        sender: {
          name: 'AIPrep365 Notification',
          email: process.env.EMAIL_FROM || 'noreply@aitutor.com'
        },
        to: [{ email: adminEmail, name: 'Admin' }],
        subject: `💬 New Feedback: ${displayStudentName} - ${courseName}`,
        htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px; }
    .header { background: #E53935; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
    .content { padding: 20px; }
    .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
    .label { font-weight: bold; color: #666; }
    .value { font-weight: bold; color: #333; }
    .message-box { background: #f9f9f9; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #E53935; }
    .stars { color: #f59e0b; font-size: 18px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin:0">New Student Feedback 💬</h2>
    </div>
    <div class="content">
      <div class="stat-row">
        <span class="label">Student:</span>
        <span class="value">${displayStudentName}</span>
      </div>
      <div class="stat-row">
        <span class="label">Email:</span>
        <span class="value">${displayStudentEmail}</span>
      </div>
      <div class="stat-row">
        <span class="label">Activity:</span>
        <span class="value">${courseName} (${testType})</span>
      </div>
      <div class="stat-row">
        <span class="label">Attempt Date:</span>
        <span class="value">${attemptDate ? new Date(attemptDate).toLocaleDateString() : 'N/A'}</span>
      </div>
      <div class="stat-row">
        <span class="label">Learning Exp:</span>
        <span class="stars">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</span>
      </div>
      <div class="stat-row">
        <span class="label">Question Quality:</span>
        <span class="stars">${'★'.repeat(qualityRating)}${'☆'.repeat(5-qualityRating)}</span>
      </div>
      <div class="stat-row">
        <span class="label">Difficulty:</span>
        <span class="value" style="color: #E53935">${difficultyLevel}</span>
      </div>
      
      <div class="message-box">
        <p style="margin:0; font-weight: bold; color: #666; font-size: 12px; margin-bottom: 5px;">MESSAGE:</p>
        <p style="margin:0; font-style: italic;">"${message || 'No additional comments.'}"</p>
      </div>
    </div>
    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
      Generated by AIPrep365 Feedback System
    </div>
  </div>
</body>
</html>
        `
      };

      if (this.apiKey) {
        await axios.post(`${this.apiUrl}/smtp/email`, emailData, {
          headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' }
        });
        console.log('✅ Feedback notification sent to admin');
      }
      return { success: true };
    } catch (error) {
      console.error('❌ Feedback email error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

export default BrevoEmailService;
