const jwt = require('jsonwebtoken');
const User = require('../models/User');
const QRCode = require('qrcode');
const { sendOTPEmail, EMAIL_CONFIG } = require('../services/emailService');

// In-memory system settings (in production, use database)
let systemSettings = {
  studentRegistrationEnabled: true,
  studentLoginEnabled: false,
  adminVerificationEnabled: false,
  adminVerificationCode: 'ADMIN2024',
  systemActivated: false
};

// OTP configuration
const OTP_EXPIRY_MINUTES = 5;
const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;

// In-memory OTP storage for password reset (in production, use Redis)
const otpStorage = {};

// Rate limiting for password reset attempts
const resetAttempts = {};
const MAX_RESET_ATTEMPTS = 3;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'qr-attendance-secret-key', {
    expiresIn: '30d'
  });
};

// Helper: get attempt key
const getAttemptKey = (identifier) => `reset:${identifier}`;

// Helper: check and record reset attempts
const checkResetAttempts = (identifier) => {
  const key = getAttemptKey(identifier);
  const now = Date.now();
  const record = resetAttempts[key];

  if (!record) {
    resetAttempts[key] = { count: 1, firstAttempt: now };
    return { allowed: true, remaining: MAX_RESET_ATTEMPTS - 1 };
  }

  if (now - record.firstAttempt > ATTEMPT_WINDOW_MS) {
    // Window expired, reset counter
    resetAttempts[key] = { count: 1, firstAttempt: now };
    return { allowed: true, remaining: MAX_RESET_ATTEMPTS - 1 };
  }

  if (record.count >= MAX_RESET_ATTEMPTS) {
    const retryAfter = Math.ceil((record.firstAttempt + ATTEMPT_WINDOW_MS - now) / 60000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  record.count += 1;
  return { allowed: true, remaining: MAX_RESET_ATTEMPTS - record.count };
};

// Helper: clear reset attempts
const clearResetAttempts = (identifier) => {
  const key = getAttemptKey(identifier);
  delete resetAttempts[key];
};

// @desc    Register a new student
// @route   POST /api/auth/register
// @access  Public (but only if enabled)
const registerStudent = async (req, res) => {
  try {
    if (!systemSettings.studentRegistrationEnabled) {
      return res.status(403).json({ message: 'Student registration is currently disabled. Please contact administrator.' });
    }

    const { name, email, password, rollNumber, department, year, mobileNumber, aadhaarNumber } = req.body;

    if (!aadhaarNumber || !/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ message: 'A valid 12-digit Aadhaar number is required for registration' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    if (rollNumber) {
      const rollExists = await User.findOne({ rollNumber, role: 'student' });
      if (rollExists) {
        return res.status(400).json({ message: 'Roll number already registered' });
      }
    }

    const studentId = await User.generateStudentId();
    const qrData = JSON.stringify({ studentId });
    const qrCode = await QRCode.toDataURL(qrData, { width: 200, margin: 2 });

    const user = await User.create({
      name, email, password, rollNumber, department, year, mobileNumber, aadhaarNumber,
      studentId, qrCode, role: 'student'
    });

    if (user) {
      res.status(201).json({
        _id: user._id, name: user.name, email: user.email, role: user.role,
        studentId: user.studentId, qrCode: user.qrCode, rollNumber: user.rollNumber,
        department: user.department, year: user.year, token: generateToken(user._id)
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Authenticate user (login)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    if (!systemSettings.studentLoginEnabled) {
      return res.status(403).json({ message: 'Student login is currently disabled. Please contact administrator.' });
    }

    const { email, password, rollNumber } = req.body;
    let user;

    if (email) {
      user = await User.findOne({ email });
      if (!user && !email.includes('@')) {
        user = await User.findOne({ rollNumber: email, role: 'student' });
      }
    } else if (rollNumber) {
      user = await User.findOne({ rollNumber, role: 'student' });
    }

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials. Please check your email/roll number and password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials. Please check your email/roll number and password.' });
    }

    res.json({
      _id: user._id, name: user.name, email: user.email, role: user.role,
      studentId: user.studentId, qrCode: user.qrCode, rollNumber: user.rollNumber,
      department: user.department, year: user.year, token: generateToken(user._id)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Admin login
// @route   POST /api/auth/admin/login
// @access  Public
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email, role: 'admin' });

    if (!user) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    systemSettings.systemActivated = true;
    systemSettings.studentLoginEnabled = true;

    res.json({
      _id: user._id, name: user.name, email: user.email, role: user.role,
      token: generateToken(user._id)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify admin (second-level authentication)
// @route   POST /api/auth/admin/verify
// @access  Private (Admin only)
const verifyAdmin = async (req, res) => {
  try {
    const { secretKey } = req.body;

    if (!systemSettings.adminVerificationEnabled) {
      return res.json({ success: true, message: 'Verification disabled' });
    }

    if (secretKey === systemSettings.adminVerificationCode) {
      systemSettings.systemActivated = true;
      systemSettings.studentLoginEnabled = true;
      return res.json({ success: true, message: 'Admin verified successfully', activated: true });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid verification code' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get system settings
// @route   GET /api/auth/settings
// @access  Public
const getSystemSettings = async (req, res) => {
  try {
    res.json({
      studentRegistrationEnabled: systemSettings.studentRegistrationEnabled,
      studentLoginEnabled: systemSettings.studentLoginEnabled,
      adminVerificationEnabled: systemSettings.adminVerificationEnabled,
      systemActivated: systemSettings.systemActivated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Update system settings
// @route   PUT /api/auth/settings
// @access  Private (Admin only)
const updateSystemSettings = async (req, res) => {
  try {
    const { studentRegistrationEnabled, studentLoginEnabled, adminVerificationCode, systemActivated } = req.body;

    if (studentRegistrationEnabled !== undefined) systemSettings.studentRegistrationEnabled = studentRegistrationEnabled;
    if (studentLoginEnabled !== undefined) systemSettings.studentLoginEnabled = studentLoginEnabled;
    if (adminVerificationCode) systemSettings.adminVerificationCode = adminVerificationCode;
    if (systemActivated !== undefined) {
      systemSettings.systemActivated = !!systemActivated;
      if (systemSettings.systemActivated) systemSettings.studentLoginEnabled = true;
    }

    res.json({
      message: 'Settings updated successfully',
      settings: {
        studentRegistrationEnabled: systemSettings.studentRegistrationEnabled,
        studentLoginEnabled: systemSettings.studentLoginEnabled,
        adminVerificationEnabled: systemSettings.adminVerificationEnabled
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Forgot Password - Verify Aadhaar and return reset token directly
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const { identifier, aadhaarNumber } = req.body;

    if (!identifier || !aadhaarNumber) {
      return res.status(400).json({ message: 'Username/Student ID and Aadhaar number are required' });
    }

    if (!/^\d{12}$/.test(aadhaarNumber)) {
      return res.status(400).json({ message: 'Aadhaar number must be exactly 12 digits' });
    }

    // Rate limiting check
    const attemptCheck = checkResetAttempts(identifier);
    if (!attemptCheck.allowed) {
      return res.status(429).json({
        message: `Too many failed attempts. Please try again after ${attemptCheck.retryAfter} minutes.`
      });
    }

    // Find user by studentId, email, or rollNumber
    let user = await User.findOne({ studentId: identifier, role: 'student' });
    if (!user) {
      user = await User.findOne({ email: identifier, role: 'student' });
    }
    if (!user && !identifier.includes('@')) {
      user = await User.findOne({ rollNumber: identifier, role: 'student' });
    }

    if (!user || !user.aadhaarNumber) {
      // Generic error to prevent user enumeration
      return res.status(400).json({ message: 'Invalid credentials. No matching student found.' });
    }

    // Verify Aadhaar matches (hashed)
    const isAadhaarValid = await user.compareAadhaar(aadhaarNumber);
    if (!isAadhaarValid) {
      return res.status(400).json({
        message: 'Invalid credentials. Aadhaar number does not match registered details.',
        remainingAttempts: attemptCheck.remaining
      });
    }

    // Aadhaar verified — generate reset token directly (no OTP)
    clearResetAttempts(identifier);

    const resetToken = jwt.sign(
      { userId: user._id, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'qr-attendance-secret-key',
      { expiresIn: '15m' }
    );

    res.status(200).json({
      message: 'Identity verified successfully. You can now reset your password.',
      resetToken
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify OTP (kept for backward compatibility)
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOTP = async (req, res) => {
  try {
    const { mobileNumber, otp } = req.body;

    if (!mobileNumber || !otp) {
      return res.status(400).json({ message: 'Mobile number and OTP are required' });
    }

    const storedData = otpStorage[mobileNumber];

    if (!storedData) {
      return res.status(400).json({ message: 'OTP expired or not requested. Please request a new OTP.' });
    }

    if (new Date() > storedData.expiresAt) {
      delete otpStorage[mobileNumber];
      return res.status(400).json({ message: 'OTP has expired. Please request a new OTP.' });
    }

    if (storedData.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { mobileNumber, userId: storedData.userId, purpose: 'password-reset' },
      process.env.JWT_SECRET || 'qr-attendance-secret-key',
      { expiresIn: '15m' }
    );

    delete otpStorage[mobileNumber];

    res.status(200).json({ message: 'OTP verified successfully', resetToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    // Password strength validation
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Optional: enforce complexity (at least one number and one letter)
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ message: 'Password must contain at least one letter and one number' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'qr-attendance-secret-key');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired reset token' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(401).json({ message: 'Invalid token purpose' });
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ message: 'Password reset successful. You can now login with your new password.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all students (Admin)
// @route   GET /api/auth/students
// @access  Private/Admin
const getAllStudents = async (req, res) => {
  try {
    const { department, year } = req.query;
    const query = { role: 'student' };

    if (department) query.department = department;
    if (year) query.year = year;

    const students = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete student (Admin)
// @route   DELETE /api/auth/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (user.role !== 'student') {
      return res.status(400).json({ message: 'Cannot delete non-student users' });
    }

    await user.deleteOne();
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get student by ID (Admin)
// @route   GET /api/auth/students/:id
// @access  Private/Admin
const getStudentById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  registerStudent,
  loginUser,
  adminLogin,
  verifyAdmin,
  getSystemSettings,
  updateSystemSettings,
  forgotPassword,
  verifyOTP,
  resetPassword,
  getMe,
  getAllStudents,
  deleteStudent,
  getStudentById
};

