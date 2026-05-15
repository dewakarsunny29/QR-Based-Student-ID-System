const express = require('express');
const router = express.Router();
const {
  generateQR,
  getQRSessions,
  deactivateSession,
  getPeriodTimings,
  validateQR
} = require('../controllers/qrController');
const { protect, adminOnly } = require('../middleware/auth');

// Public routes
router.get('/periods', getPeriodTimings);

// Protected routes (Admin only)
router.post('/generate', protect, adminOnly, generateQR);
router.get('/sessions', protect, adminOnly, getQRSessions);
router.put('/sessions/:id/deactivate', protect, adminOnly, deactivateSession);

// Protected routes (for validation)
router.post('/validate', protect, validateQR);

module.exports = router;
