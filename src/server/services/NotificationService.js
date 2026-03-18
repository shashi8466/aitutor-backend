import nodemailer from 'nodemailer';
import twilio from 'twilio';
import axios from 'axios';

class NotificationService {
  constructor() {
    // Email configuration (using Gmail as example)
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    // SMS configuration (Twilio)
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // WhatsApp configuration (Twilio WhatsApp API)
    this.whatsappFrom = process.env.WHATSAPP_FROM_NUMBER;
  }

  /**
   * Send email notification
   */
  async sendEmail(to, subject, htmlContent, attachments = []) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html: htmlContent,
        attachments
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(to, message) {
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_FROM_NUMBER,
        to: Array.isArray(to) ? to.join(',') : to
      });

      console.log('SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('SMS sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(to, message) {
    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: `whatsapp:${this.whatsappFrom}`,
        to: `whatsapp:${Array.isArray(to) ? to.join(',') : to}`
      });

      console.log('WhatsApp message sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('WhatsApp sending failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification through multiple channels
   */
  async sendNotification(recipients, notificationData) {
    const results = {
      email: null,
      sms: null,
      whatsapp: null
    };

    const { email, sms, whatsapp, subject, message, htmlContent } = notificationData;

    // Send email
    if (email && recipients.email && (Array.isArray(recipients.email) ? recipients.email.length > 0 : !!recipients.email)) {
      results.email = await this.sendEmail(recipients.email, subject, htmlContent);
    }

    // Send SMS
    if (sms && recipients.phone && (Array.isArray(recipients.phone) ? recipients.phone.length > 0 : !!recipients.phone)) {
      results.sms = await this.sendSMS(recipients.phone, message);
    }

    // Send WhatsApp
    if (whatsapp && recipients.whatsapp && (Array.isArray(recipients.whatsapp) ? recipients.whatsapp.length > 0 : !!recipients.whatsapp)) {
      results.whatsapp = await this.sendWhatsApp(recipients.whatsapp, message);
    }

    return results;
  }
}

export default NotificationService;
