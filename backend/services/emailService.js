const nodemailer = require('nodemailer');

// Email Configuration using Gmail SMTP
const EMAIL_CONFIG = {
  // Gmail SMTP settings
  // For Gmail, you need to use App Password if 2FA is enabled
  // Get App Password: https://myaccount.google.com/apppasswords
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 465,
  SMTP_USER: process.env.EMAIL_USER || 'your-email@gmail.com',
  SMTP_PASS: process.env.EMAIL_PASS || 'your-app-password',
  FROM_EMAIL: process.env.EMAIL_USER || 'your-email@gmail.com',
  FROM_NAME: 'QR Attendance System',
  
  // OTP expiry time in minutes
  OTP_EXPIRY_MINUTES: 5
};

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: EMAIL_CONFIG.SMTP_HOST,
    port: EMAIL_CONFIG.SMTP_PORT,
    secure: true, // use SSL
    auth: {
      user: EMAIL_CONFIG.SMTP_USER,
      pass: EMAIL_CONFIG.SMTP_PASS
    }
  });
};

// Send email
const sendEmail = async (to, subject, html) => {
  // If no email configured, use simulation
  if (!EMAIL_CONFIG.SMTP_PASS || EMAIL_CONFIG.SMTP_PASS === 'your-app-password') {
    console.log(`[EMAIL SIMULATION] Would send to ${to}`);
    console.log(`[EMAIL SIMULATION] Subject: ${subject}`);
    console.log(`[EMAIL SIMULATION] Body: ${html.replace(/<[^>]*>/g, '')}`);
    return {
      success: true,
      message: 'Email sent successfully (simulated)',
      simulated: true
    };
  }

  try {
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: `"${EMAIL_CONFIG.FROM_NAME}" <${EMAIL_CONFIG.FROM_EMAIL}>`,
      to: to,
      subject: subject,
      html: html
    });

    console.log('[EMAIL] Sent:', info.messageId);
    return {
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId
    };
  } catch (error) {
    console.error('[EMAIL] Error:', error.message);
    return {
      success: false,
      message: error.message,
      error: error.message
    };
  }
};

// Send OTP via email
const sendOTPEmail = async (email, otp, userName = 'Student') => {
  const subject = 'Password Reset OTP';
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(to right, #059669, #0d9488); padding: 20px; border-radius: 10px;">
        <h2 style="color: white; margin: 0;">Password Reset OTP</h2>
      </div>
      
      <div style="padding: 20px; background: #f9fafb; border-radius: 10px; margin-top: 10px;">
        <p>Hello ${userName},</p>
        
        <p>Your OTP for resetting the password is: <strong style="font-size: 24px; letter-spacing: 5px;">${otp}</strong></p>
        
        <p>This OTP is valid for 5 minutes.</p>
        
        <p style="color: #dc2626; font-weight: bold;">Do not share this OTP with anyone.</p>
        
        <p>If you did not request a password reset, please ignore this email.</p>
      </div>
      
      <div style="padding: 20px; text-align: center; color: #6b7280; font-size: 12px;">
        <p>© 2024 QR Attendance System. All rights reserved.</p>
      </div>
    </div>
  `;

  return await sendEmail(email, subject, html);
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  EMAIL_CONFIG
};

