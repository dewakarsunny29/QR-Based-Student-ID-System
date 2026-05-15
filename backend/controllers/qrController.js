const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const QRSession = require('../models/QRSession');
const Attendance = require('../models/Attendance');

// Period timing configuration
// Schedule as per requirements:
// Period 1: 8:15 – 9:10 (55 min)
// Period 2: 9:10 – 10:05 (55 min)
// Morning Break: 10:05 – 10:20 (Attendance Disabled)
// Period 3: 10:20 – 11:15 (55 min)
// Period 4: 11:15 – 12:10 (55 min)
// Period 5: 12:10 – 12:40 (30 min)
// Lunch Break: 12:40 – 1:40 (Attendance Disabled)
// Period 6: 1:40 – 2:35 (55 min)
// Period 7: 2:35 – 3:30 (55 min)
// Period 8: 3:30 – 4:25 (55 min)

const PERIOD_TIMINGS = {
  1: { start: '08:15', end: '09:10' },
  2: { start: '09:10', end: '10:05' },
  3: { start: '10:20', end: '11:15' },
  4: { start: '11:15', end: '12:10' },
  5: { start: '12:10', end: '12:40' },  // 30 minutes
  6: { start: '13:40', end: '14:35' },
  7: { start: '14:35', end: '15:30' },
  8: { start: '15:30', end: '16:25' }
};

// @desc    Generate QR code for a period
// @route   POST /api/qr/generate
// @access  Private/Admin
const generateQR = async (req, res) => {
  try {
    const { period, date } = req.body;
    const adminId = req.user._id;

    // Validate period
    if (!period || period < 1 || period > 8) {
      return res.status(400).json({ message: 'Invalid period number (1-8)' });
    }

    // Use today's date if not provided
    const sessionDate = date ? new Date(date) : new Date();
    sessionDate.setHours(0, 0, 0, 0);

    // Check if QR already generated for this period and date
    const existingSession = await QRSession.findOne({
      period,
      date: sessionDate,
      isActive: true
    });

    if (existingSession) {
      // Return existing QR code
      const qrDataUrl = await QRCode.toDataURL(JSON.stringify({
        sessionId: existingSession.sessionId,
        period: existingSession.period
      }));

      return res.json({
        message: 'QR code already exists for this period',
        qrCode: qrDataUrl,
        session: existingSession,
        periodTiming: PERIOD_TIMINGS[period]
      });
    }

    // Generate unique session ID
    const sessionId = uuidv4();

    // Calculate expiration (end of period + 10 minutes)
    const periodTiming = PERIOD_TIMINGS[period];
    const [endHour, endMin] = periodTiming.end.split(':').map(Number);
    const expiresAt = new Date(sessionDate);
    expiresAt.setHours(endHour, endMin + 10, 0, 0);

    // Create QR session
    const qrSession = await QRSession.create({
      sessionId,
      period,
      date: sessionDate,
      startTime: periodTiming.start,
      endTime: periodTiming.end,
      isActive: true,
      generatedBy: adminId,
      expiresAt
    });

    // Generate QR code
    const qrData = JSON.stringify({
      sessionId: qrSession.sessionId,
      period: qrSession.period
    });

    const qrDataUrl = await QRCode.toDataURL(qrData);

    res.status(201).json({
      message: `QR code generated for ${period}${getOrdinalSuffix(period)} Period`,
      qrCode: qrDataUrl,
      session: qrSession,
      periodTiming: PERIOD_TIMINGS[period]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all QR sessions for today
// @route   GET /api/qr/sessions
// @access  Private/Admin
const getQRSessions = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sessions = await QRSession.find({
      date: { $gte: today, $lt: tomorrow }
    })
      .populate('generatedBy', 'name email')
      .sort({ period: 1 });

    // Get attendance count for each session
    const sessionsWithCount = await Promise.all(
      sessions.map(async (session) => {
        const attendanceCount = await Attendance.countDocuments({
          qrSession: session._id,
          period: session.period
        });
        return {
          ...session.toObject(),
          attendanceCount
        };
      })
    );

    res.json(sessionsWithCount);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Deactivate QR session
// @route   PUT /api/qr/sessions/:id/deactivate
// @access  Private/Admin
const deactivateSession = async (req, res) => {
  try {
    const session = await QRSession.findById(req.params.id);

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    session.isActive = false;
    await session.save();

    res.json({ message: 'QR session deactivated', session });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get period timings
// @route   GET /api/qr/periods
// @access  Public
const getPeriodTimings = async (req, res) => {
  try {
    res.json(PERIOD_TIMINGS);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Validate QR data (for testing/debugging)
// @route   POST /api/qr/validate
// @access  Private
const validateQR = async (req, res) => {
  try {
    const { qrData } = req.body;

    let qrDataObj;
    try {
      qrDataObj = JSON.parse(qrData);
    } catch (e) {
      return res.status(400).json({ valid: false, message: 'Invalid QR data format' });
    }

    const { sessionId, period } = qrDataObj;

    const session = await QRSession.findOne({ sessionId });

    if (!session) {
      return res.status(400).json({ valid: false, message: 'Invalid QR session' });
    }

    if (!session.isActive) {
      return res.status(400).json({ valid: false, message: 'QR session is inactive' });
    }

    if (new Date() > session.expiresAt) {
      return res.status(400).json({ valid: false, message: 'QR session expired' });
    }

    res.json({
      valid: true,
      session: {
        period: session.period,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime
      },
      periodTiming: PERIOD_TIMINGS[period]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Helper function
function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

module.exports = {
  generateQR,
  getQRSessions,
  deactivateSession,
  getPeriodTimings,
  validateQR,
  PERIOD_TIMINGS
};
