const axios = require('axios');

// SMS Configuration
// You can use Fast2SMS, Twilio, MSG91, or any SMS service
// For demo purposes, we'll implement Fast2SMS (free tier available)

const SMS_CONFIG = {
  // Fast2SMS Configuration (free for development)
  // Sign up at https://www.fast2sms.com/
  FAST2SMS_API_KEY: process.env.FAST2SMS_API_KEY || '',
  
  // Alternative: Twilio Configuration
  // TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  // TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  // TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  
  // Sender ID (for Fast2SMS)
  SENDER_ID: 'FSTSMS',
  
// OTP expiry time in seconds
  OTP_EXPIRY_SECONDS: 30
};

// Format mobile number to include country code
const formatMobileNumber = (mobileNumber) => {
  // Remove any spaces or special characters
  let cleaned = mobileNumber.replace(/[^0-9]/g, '');
  
  // Add country code +91 for India if not present
  if (!cleaned.startsWith('91') && cleaned.length === 10) {
    cleaned = '91' + cleaned;
  }
  
  // Add + prefix for some APIs
  return '+' + cleaned;
};

// Send SMS using Fast2SMS
const sendSMSViaFast2SMS = async (mobileNumber, message) => {
  try {
    const formattedMobile = formatMobileNumber(mobileNumber);
    
    const payload = {
      sender_id: SMS_CONFIG.SENDER_ID,
      message: message,
      language: 'english',
      route: 'p',
      numbers: formattedMobile
    };

    const headers = {
      'authorization': SMS_CONFIG.FAST2SMS_API_KEY,
      'Content-Type': 'application/json'
    };

    console.log(`[SMS] Sending SMS to ${formattedMobile}: ${message}`);

    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      payload,
      { headers }
    );

    console.log('[SMS] Fast2SMS Response:', response.data);
    
    return {
      success: response.data.return === true,
      message: response.data.message || 'SMS sent successfully',
      details: response.data
    };
  } catch (error) {
    console.error('[SMS] Fast2SMS Error:', error.response?.data || error.message);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to send SMS',
      error: error.message
    };
  }
};

// Send SMS using Twilio (alternative)
const sendSMSViaTwilio = async (mobileNumber, message) => {
  try {
    const twilio = require('twilio');
    
    const client = twilio(
      SMS_CONFIG.TWILIO_ACCOUNT_SID,
      SMS_CONFIG.TWILIO_AUTH_TOKEN
    );

    const formattedMobile = formatMobileNumber(mobileNumber);

    const result = await client.messages.create({
      body: message,
      from: SMS_CONFIG.TWILIO_PHONE_NUMBER,
      to: formattedMobile
    });

    console.log('[SMS] Twilio Response:', result.sid);
    
    return {
      success: true,
      message: 'SMS sent successfully',
      details: { sid: result.sid }
    };
  } catch (error) {
    console.error('[SMS] Twilio Error:', error.message);
    return {
      success: false,
      message: error.message,
      error: error.message
    };
  }
};

// Main send SMS function
const sendSMS = async (mobileNumber, message) => {
  // If no API key configured, use simulation
  if (!SMS_CONFIG.FAST2SMS_API_KEY) {
    console.log(`[SMS SIMULATION] Would send to ${mobileNumber}: ${message}`);
    return {
      success: true,
      message: 'SMS sent successfully (simulated)',
      simulated: true
    };
  }

  // Use Fast2SMS
  return await sendSMSViaFast2SMS(mobileNumber, message);
};

// Send OTP via SMS
const sendOTP = async (mobileNumber, otp) => {
  const message = `Your password reset OTP is ${otp}. It is valid for 5 minutes.`;
  return await sendSMS(mobileNumber, message);
};

module.exports = {
  sendSMS,
  sendOTP,
  formatMobileNumber,
  SMS_CONFIG
};

