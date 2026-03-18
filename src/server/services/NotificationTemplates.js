class NotificationTemplates {
  /**
   * Test Completion Notification Templates
   */
  static getTestCompletionTemplate(studentName, testName, score, totalScore, percentage, parentName = null) {
    const isForParent = parentName !== null;
    
    const emailSubject = isForParent 
      ? `📊 Test Completion Report: ${studentName}'s ${testName} Results`
      : `🎯 Your ${testName} Test Results Are Ready!`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Completion Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .score-box { background-color: #f8f9fa; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; }
          .score-large { font-size: 36px; font-weight: bold; color: #28a745; }
          .percentage { font-size: 24px; color: #6c757d; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Test Completion Report</h1>
            <p>${isForParent ? `Your child ${studentName}` : `You ${studentName}`} has completed the ${testName}!</p>
          </div>
          
          <div class="content">
            <h2>Test Results Summary</h2>
            <div class="score-box">
              <div class="score-large">${score}/${totalScore}</div>
              <div class="percentage">${percentage}%</div>
              <p><strong>Performance Level:</strong> ${this.getPerformanceLevel(percentage)}</p>
            </div>
            
            <h3>What This Score Means:</h3>
            <p>${this.getScoreInterpretation(percentage)}</p>
            
            <h3>Next Steps:</h3>
            <ul>
              <li>Review the detailed test report on the dashboard</li>
              <li>Focus on areas where improvement is needed</li>
              <li>Schedule a follow-up test to track progress</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/student/test-review" class="btn">View Full Report</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated message from the SAT Prep Learning Platform</p>
            <p>For questions, please contact our support team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const smsMessage = isForParent
      ? `Hi ${parentName}! ${studentName} completed ${testName}. Score: ${score}/${totalScore} (${percentage}%). View full report: ${process.env.FRONTEND_URL}/parent/dashboard`
      : `Hi ${studentName}! Great job completing ${testName}. Your score: ${score}/${totalScore} (${percentage}%). View detailed report: ${process.env.FRONTEND_URL}/student/test-review`;

    const whatsappMessage = smsMessage; // Similar content for WhatsApp

    return {
      emailSubject,
      emailHtml,
      smsMessage,
      whatsappMessage
    };
  }

  /**
   * Weekly Progress Report Template
   */
  static getWeeklyProgressTemplate(studentName, progressData, parentName = null) {
    const isForParent = parentName !== null;
    
    const emailSubject = isForParent
      ? `📈 Weekly Progress Report: ${studentName}'s SAT Prep Journey`
      : `📊 Your Weekly SAT Prep Progress Report`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly Progress Report</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 700px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
          .stat-card { background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
          .stat-number { font-size: 32px; font-weight: bold; color: #007bff; }
          .progress-bar { width: 100%; height: 20px; background-color: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
          .progress-fill { height: 100%; background: linear-gradient(90deg, #007bff, #28a745); transition: width 0.3s ease; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📈 Weekly Progress Report</h1>
            <p>${isForParent ? `${studentName}'s` : `Your`} SAT Prep Journey This Week</p>
            <p>Week of ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="content">
            <h2>📊 Performance Overview</h2>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-number">${progressData.testsAttempted || 0}</div>
                <div>Tests Attempted</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${progressData.averageScore || 0}%</div>
                <div>Average Score</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${progressData.lessonsCompleted || 0}</div>
                <div>Lessons Completed</div>
              </div>
              <div class="stat-card">
                <div class="stat-number">${progressData.studyHours || 0}</div>
                <div>Study Hours</div>
              </div>
            </div>

            <h3>🎯 Current Scores</h3>
            <div style="margin: 20px 0;">
              <p><strong>Math:</strong> ${progressData.currentMathScore || 0}/800</p>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, (progressData.currentMathScore || 0) / 800 * 100)}%"></div>
              </div>
              
              <p><strong>Reading & Writing:</strong> ${progressData.currentRWScore || 0}/800</p>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, (progressData.currentRWScore || 0) / 800 * 100)}%"></div>
              </div>
              
              <p><strong>Total:</strong> ${progressData.currentTotalScore || 0}/1600</p>
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(100, (progressData.currentTotalScore || 0) / 1600 * 100)}%"></div>
              </div>
            </div>

            <h3>📚 Course Progress</h3>
            ${progressData.courseProgress ? progressData.courseProgress.map(course => `
              <div style="margin: 15px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
                <h4>${course.name}</h4>
                <p>Score: ${course.score}/800 | Progress: ${course.progress}%</p>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${course.progress}%"></div>
                </div>
              </div>
            `).join('') : '<p>No course progress data available this week.</p>'}

            <h3>🏆 Achievements</h3>
            <ul>
              ${progressData.achievements ? progressData.achievements.map(achievement => 
                `<li>${achievement}</li>`
              ).join('') : '<li>Keep working towards your goals!</li>'}
            </ul>

            <h3>📋 Recommendations</h3>
            <ul>
              ${progressData.recommendations ? progressData.recommendations.map(rec => 
                `<li>${rec}</li>`
              ).join('') : '<li>Continue with your current study plan and maintain consistency.</li>'}
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${isForParent ? process.env.FRONTEND_URL + '/parent/dashboard' : process.env.FRONTEND_URL + '/student/dashboard'}" class="btn">View Detailed Dashboard</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is your weekly progress report from the SAT Prep Learning Platform</p>
            <p>Keep up the great work! 🌟</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const smsMessage = isForParent
      ? `Weekly update: ${studentName} attempted ${progressData.testsAttempted || 0} tests, avg score ${progressData.averageScore || 0}%. Current total: ${progressData.currentTotalScore || 0}/1600. Full report: ${process.env.FRONTEND_URL}/parent/dashboard`
      : `Your weekly progress: ${progressData.testsAttempted || 0} tests, avg ${progressData.averageScore || 0}%. Current score: ${progressData.currentTotalScore || 0}/1600. Details: ${process.env.FRONTEND_URL}/student/dashboard`;

    return {
      emailSubject,
      emailHtml,
      smsMessage,
      whatsappMessage: smsMessage
    };
  }

  /**
   * Test Due Date Reminder Template
   */
  static getTestDueDateTemplate(studentName, testName, dueDate, parentName = null) {
    const isForParent = parentName !== null;
    const daysUntilDue = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    const urgencyLevel = daysUntilDue <= 1 ? 'high' : daysUntilDue <= 3 ? 'medium' : 'low';
    
    const emailSubject = isForParent
      ? `⏰ Reminder: ${studentName}'s ${testName} Due Soon!`
      : `⏰ Reminder: ${testName} Due in ${daysUntilDue} Days`;

    const urgencyColors = {
      high: '#dc3545',
      medium: '#ffc107', 
      low: '#28a745'
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Test Due Date Reminder</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, ${urgencyColors[urgencyLevel]} 0%, #6c757d 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .due-date-box { background-color: #f8f9fa; border-left: 4px solid ${urgencyColors[urgencyLevel]}; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center; }
          .days-remaining { font-size: 48px; font-weight: bold; color: ${urgencyColors[urgencyLevel]}; }
          .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; }
          .btn { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ Test Due Date Reminder</h1>
            <p>${isForParent ? `${studentName} has` : `You have`} a test coming up!</p>
          </div>
          
          <div class="content">
            <h2>📚 ${testName}</h2>
            <div class="due-date-box">
              <div class="days-remaining">${daysUntilDue}</div>
              <div>Days Remaining</div>
              <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
            </div>
            
            <h3>Why This Test Matters:</h3>
            <ul>
              <li>Track your progress and identify areas for improvement</li>
              <li>Build test-taking confidence and time management skills</li>
              <li>Stay on track with your SAT preparation goals</li>
            </ul>
            
            <h3>Preparation Tips:</h3>
            <ul>
              <li>Review previous test results and focus on weak areas</li>
              <li>Practice with timed conditions to simulate the real test</li>
              <li>Get a good night's sleep before test day</li>
              <li>Ensure you have a quiet, distraction-free environment</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${isForParent ? process.env.FRONTEND_URL + '/parent/dashboard' : process.env.FRONTEND_URL + '/student/dashboard'}" class="btn">Go to Dashboard</a>
            </div>
          </div>
          
          <div class="footer">
            <p>This is an automated reminder from the SAT Prep Learning Platform</p>
            <p>Good luck with your test! 🍀</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const urgencyText = daysUntilDue === 1 ? 'tomorrow' : daysUntilDue <= 3 ? 'soon' : `in ${daysUntilDue} days`;
    const smsMessage = isForParent
      ? `Reminder: ${studentName}'s ${testName} is due ${urgencyText} (${new Date(dueDate).toLocaleDateString()}). Ensure they complete it on time! Dashboard: ${process.env.FRONTEND_URL}/parent/dashboard`
      : `Reminder: Your ${testName} is due ${urgencyText} (${new Date(dueDate).toLocaleDateString()}). Don't miss it! Dashboard: ${process.env.FRONTEND_URL}/student/dashboard`;

    return {
      emailSubject,
      emailHtml,
      smsMessage,
      whatsappMessage: smsMessage
    };
  }

  /**
   * Helper methods
   */
  static getPerformanceLevel(percentage) {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 80) return 'Very Good';
    if (percentage >= 70) return 'Good';
    if (percentage >= 60) return 'Satisfactory';
    return 'Needs Improvement';
  }

  static getScoreInterpretation(percentage) {
    if (percentage >= 90) return 'Outstanding performance! You\'re mastering the material and ready for advanced challenges.';
    if (percentage >= 80) return 'Great job! You have a strong understanding of the concepts with room for fine-tuning.';
    if (percentage >= 70) return 'Good work! You\'re grasping the main concepts well. Focus on the weaker areas for improvement.';
    if (percentage >= 60) return 'You\'re making progress! Consistent practice will help you reach higher scores.';
    return 'Keep practicing! Review the fundamentals and don\'t hesitate to seek help with challenging topics.';
  }
}

module.exports = NotificationTemplates;
