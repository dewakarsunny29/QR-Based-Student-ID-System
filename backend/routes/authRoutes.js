const express = require('express');
const router = express.Router();
const {
  registerStudent,
  loginUser,
  adminLogin,
  verifyAdmin,
  getMe,
  getAllStudents,
  deleteStudent,
  getStudentById,
  updateSystemSettings,
  getSystemSettings,
  forgotPassword,
  verifyOTP,
  resetPassword
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middleware/auth');

// Public routes
router.post('/register', registerStudent);
router.post('/login', loginUser);
router.post('/admin/login', adminLogin);
router.post('/admin/verify', protect, verifyAdmin);

// Password reset routes (public)
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOTP);
router.post('/reset-password', resetPassword);

// System settings (public - for checking if student registration is enabled)
router.get('/settings', getSystemSettings);
router.put('/settings', protect, adminOnly, updateSystemSettings);

// Protected routes
router.get('/me', protect, getMe);

// Admin routes
router.get('/students', protect, adminOnly, getAllStudents);
router.get('/students/:id', protect, adminOnly, getStudentById);
router.delete('/students/:id', protect, adminOnly, deleteStudent);

module.exports = router;
