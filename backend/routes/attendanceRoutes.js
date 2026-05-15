const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getStudentAttendance,
  getAllAttendance,
  getStudentAttendanceById,
  getCurrentSessionInfo
} = require('../controllers/attendanceController');
const { protect, adminOnly, studentOnly } = require('../middleware/auth');

// Public route - get current session info
router.get('/current-session', getCurrentSessionInfo);

// Student routes
router.post('/scan', protect, studentOnly, markAttendance);
router.get('/student', protect, studentOnly, getStudentAttendance);

// Admin routes
router.get('/', protect, adminOnly, getAllAttendance);
router.get('/student/:id', protect, adminOnly, getStudentAttendanceById);

module.exports = router;
