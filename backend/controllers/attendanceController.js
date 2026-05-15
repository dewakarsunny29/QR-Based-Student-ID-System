const Attendance = require('../models/Attendance');
const User = require('../models/User');
const QRSession = require('../models/QRSession');

// Period timing configuration (55 Minutes Each + Break After 2 Periods)
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

// Schedule array for current period detection
const SCHEDULE = [
  { name: 'Period 1', period: 1, start: 8 * 60 + 15, end: 9 * 60 + 10 },     // 8:15 - 9:10
  { name: 'Period 2', period: 2, start: 9 * 60 + 10, end: 10 * 60 + 5 },    // 9:10 - 10:05
  { name: 'Break', period: null, start: 10 * 60 + 5, end: 10 * 60 + 20 },   // 10:05 - 10:20
  { name: 'Period 3', period: 3, start: 10 * 60 + 20, end: 11 * 60 + 15 },  // 10:20 - 11:15
  { name: 'Period 4', period: 4, start: 11 * 60 + 15, end: 12 * 60 + 10 },  // 11:15 - 12:10
  { name: 'Period 5', period: 5, start: 12 * 60 + 10, end: 12 * 60 + 40 },  // 12:10 - 12:40 (30 min)
  { name: 'Lunch', period: null, start: 12 * 60 + 40, end: 13 * 60 + 40 },  // 12:40 - 13:40
  { name: 'Period 6', period: 6, start: 13 * 60 + 40, end: 14 * 60 + 35 },  // 13:40 - 14:35
  { name: 'Period 7', period: 7, start: 14 * 60 + 35, end: 15 * 60 + 30 },  // 14:35 - 15:30
  { name: 'Period 8', period: 8, start: 15 * 60 + 30, end: 16 * 60 + 25 }   // 15:30 - 16:25
];

// Get current session based on time
const getCurrentSession = () => {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes();

  for (let s of SCHEDULE) {
    if (totalMinutes >= s.start && totalMinutes < s.end) {
      return s;
    }
  }

  return { name: 'Outside College Hours', period: null };
};

// Check if attendance is allowed now
const isAttendanceAllowed = () => {
  const session = getCurrentSession();
  return session.name !== 'Break' && 
         session.name !== 'Lunch' && 
         session.name !== 'Outside College Hours' &&
         session.period !== null;
};

// Get current period number
const getCurrentPeriod = () => {
  const session = getCurrentSession();
  return session.period;
};

// @desc    Get current session info
// @route   GET /api/attendance/current-session
// @access  Public
const getCurrentSessionInfo = async (req, res) => {
  const session = getCurrentSession();
  const allowed = isAttendanceAllowed();
  const currentPeriod = getCurrentPeriod();
  
  res.json({
    currentSession: session.name,
    currentPeriod: currentPeriod,
    isAllowed: allowed,
    message: allowed 
      ? `Current: ${session.name}` 
      : `Attendance not allowed during ${session.name || 'off-hours'}`
  });
};

// @desc    Mark attendance by scanning QR
// @route   POST /api/attendance/scan
// @access  Private/Student
const markAttendance = async (req, res) => {
  try {
    const { qrData, period } = req.body;
    const studentId = req.user._id;

    // Check if attendance is allowed now (block during break/lunch)
    if (!isAttendanceAllowed()) {
      const session = getCurrentSession();
      let message = '';
      if (session.name === 'Break') {
        message = '☕ Morning Break - Attendance Disabled';
      } else if (session.name === 'Lunch') {
        message = '🍽 Lunch Break - Attendance Disabled';
      } else {
        message = '⏰ Outside College Hours - Attendance Disabled';
      }
      return res.status(400).json({ message });
    }

    // Parse QR data
    let qrDataObj;
    try {
      qrDataObj = JSON.parse(qrData);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid QR code format' });
    }

    // Student scans their personal QR code (contains only studentId)
    if (qrDataObj.studentId && !qrDataObj.sessionId) {
      // Verify the logged-in student matches the QR
      const currentUser = await User.findById(studentId);
      if (!currentUser || currentUser.studentId !== qrDataObj.studentId) {
        return res.status(400).json({ message: 'This QR code does not match your account' });
      }

      // Use provided period or determine current period from time
      let activePeriod = period;
      let qrSession = null;

      if (!activePeriod) {
        // Get current period based on time (NOT from QR session)
        activePeriod = getCurrentPeriod();
        
        if (!activePeriod) {
          const session = getCurrentSession();
          return res.status(400).json({ 
            message: `Cannot mark attendance: ${session.name}. Please try during class hours.` 
          });
        }

        // Try to find an active QR session for this period
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        qrSession = await QRSession.findOne({
          period: activePeriod,
          date: today,
          isActive: true
        });

        // If no QR session for current period, still allow attendance marking
        // (QR session is optional - attendance can be marked based on time)
      } else {
        // Find session for specific period
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        qrSession = await QRSession.findOne({
          period: activePeriod,
          date: today,
          isActive: true
        });

        if (!qrSession) {
          return res.status(400).json({ message: `No active session for ${activePeriod}${getOrdinalSuffix(activePeriod)} Period. Please ask admin to generate QR.` });
        }
      }

      // Check if attendance already marked
      const dateStart = new Date();
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date();
      dateEnd.setHours(23, 59, 59, 999);

      const existingAttendance = await Attendance.findOne({
        student: studentId,
        date: { $gte: dateStart, $lte: dateEnd },
        period: activePeriod
      });

      if (existingAttendance) {
        return res.status(400).json({ 
          message: `Attendance already marked for ${activePeriod}${getOrdinalSuffix(activePeriod)} Period`,
          period: activePeriod
        });
      }

      // Mark attendance (qrSession can be null if no admin QR was generated)
      const attendanceData = {
        student: studentId,
        date: new Date(),
        period: activePeriod,
        status: 'present'
      };

      // Only add qrSession if it exists
      if (qrSession && qrSession._id) {
        attendanceData.qrSession = qrSession._id;
      }

      const attendance = await Attendance.create(attendanceData);

      return res.status(201).json({
        message: `✅ Attendance marked successfully for ${activePeriod}${getOrdinalSuffix(activePeriod)} Period!`,
        attendance
      });
    }

    // Legacy support: Admin QR code (sessionId + period)
    const { sessionId, period: qrPeriod } = qrDataObj;

    if (!sessionId || !qrPeriod) {
      return res.status(400).json({ message: 'Invalid QR code. Please scan your personal QR code.' });
    }

    // Find the QR session
    qrSession = await QRSession.findOne({ sessionId });
    if (!qrSession) {
      return res.status(400).json({ message: 'Invalid QR session. Please ask admin to generate a fresh QR code for this period.' });
    }

    // Check if session is active
    if (!qrSession.isActive) {
      return res.status(400).json({ message: 'This QR session is no longer active. Please ask admin to generate a new QR code.' });
    }

    // Check if session is expired
    const periodTiming = PERIOD_TIMINGS[qrPeriod];
    if (!periodTiming) {
      return res.status(400).json({ message: 'Invalid period number' });
    }

    const [endHour, endMin] = periodTiming.end.split(':').map(Number);
    const sessionDate = new Date(qrSession.date);
    sessionDate.setHours(endHour, endMin + 30, 0, 0);
    
    if (new Date() > sessionDate) {
      return res.status(400).json({ message: 'This QR session has expired. Please ask admin to generate a new QR code.' });
    }

    // Check if attendance already marked
    const dateStart = new Date(qrSession.date);
    dateStart.setHours(0, 0, 0, 0);
    const dateEnd = new Date(qrSession.date);
    dateEnd.setHours(23, 59, 59, 999);

    const existingAttendance = await Attendance.findOne({
      student: studentId,
      date: { $gte: dateStart, $lte: dateEnd },
      period: qrPeriod
    });

    if (existingAttendance) {
      return res.status(400).json({ 
        message: `Attendance already marked for ${qrPeriod}${getOrdinalSuffix(qrPeriod)} Period`,
        period: qrPeriod
      });
    }

    // Mark attendance
    const attendance = await Attendance.create({
      student: studentId,
      date: qrSession.date,
      period: qrPeriod,
      qrSession: qrSession._id,
      status: 'present'
    });

    res.status(201).json({
      message: `Attendance marked successfully for ${qrPeriod}${getOrdinalSuffix(qrPeriod)} Period`,
      attendance
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get student attendance
// @route   GET /api/attendance/student
// @access  Private/Student
const getStudentAttendance = async (req, res) => {
  try {
    const { startDate, endDate, month } = req.query;
    const studentId = req.user._id;

    let query = { student: studentId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const attendance = await Attendance.find(query)
      .populate('qrSession', 'period startTime endTime')
      .sort({ date: -1, period: 1 });

    // Calculate statistics
    const totalPresent = attendance.length;
    const totalPossible = 8; // 8 periods per day
    const percentage = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;

    // Group by date
    const byDate = {};
    attendance.forEach(att => {
      const dateKey = att.date.toISOString().split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      byDate[dateKey].push(att.period);
    });

    res.json({
      attendance,
      statistics: {
        totalPresent,
        totalPossible,
        percentage: percentage.toFixed(2)
      },
      byDate,
      byPeriod: attendance.map(a => a.period)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all attendance (Admin)
// @route   GET /api/attendance
// @access  Private/Admin
const getAllAttendance = async (req, res) => {
  try {
    const { department, year, date, period, startDate, endDate } = req.query;

    let query = {};

    if (department || year) {
      const students = await User.find({ 
        role: 'student',
        ...(department && { department }),
        ...(year && { year })
      });
      query.student = { $in: students.map(s => s._id) };
    }

    if (date) {
      const dateStart = new Date(date);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(date);
      dateEnd.setHours(23, 59, 59, 999);
      query.date = { $gte: dateStart, $lte: dateEnd };
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (period) {
      query.period = parseInt(period);
    }

    const attendance = await Attendance.find(query)
      .populate('student', 'name email rollNumber department year studentId')
      .populate('qrSession', 'period startTime endTime')
      .sort({ date: -1, period: 1 });

    // Calculate statistics
    const students = await User.find({ role: 'student' });
    const totalStudents = students.length;
    const presentCount = new Set(attendance.map(a => a.student._id.toString())).size;
    const absentCount = totalStudents - presentCount;

    // Group by student
    const byStudent = {};
    attendance.forEach(att => {
      const sid = att.student._id.toString();
      if (!byStudent[sid]) {
        byStudent[sid] = {
          student: att.student,
          periods: [],
          total: 0
        };
      }
      byStudent[sid].periods.push(att.period);
      byStudent[sid].total++;
    });

    // Calculate defaulters (<75%)
    const defaulters = [];
    for (const sid in byStudent) {
      const studentAttendance = byStudent[sid];
      // Assuming 20 working days per month
      const totalPossible = 8 * 20;
      const percentage = (studentAttendance.total / totalPossible) * 100;
      if (percentage < 75) {
        defaulters.push({
          student: studentAttendance.student,
          attendance: studentAttendance.total,
          percentage: percentage.toFixed(2)
        });
      }
    }

    res.json({
      attendance,
      statistics: {
        totalStudents,
        presentCount,
        absentCount,
        attendancePercentage: totalStudents > 0 ? ((presentCount / totalStudents) * 100).toFixed(2) : 0
      },
      byStudent,
      defaulters: defaulters.sort((a, b) => a.percentage - b.percentage)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get attendance by student ID (Admin)
// @route   GET /api/attendance/student/:id
// @access  Private/Admin
const getStudentAttendanceById = async (req, res) => {
  try {
    const { startDate, endDate, month } = req.query;
    const studentId = req.params.id;

    let query = { student: studentId };

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      const startOfMonth = new Date(year, monthNum - 1, 1);
      const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }

    const attendance = await Attendance.find(query)
      .populate('qrSession', 'period startTime endTime')
      .sort({ date: -1, period: 1 });

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Calculate statistics
    const totalPresent = attendance.length;
    const totalPossible = 8; // 8 periods per day
    const percentage = totalPossible > 0 ? (totalPresent / totalPossible) * 100 : 0;

    res.json({
      student,
      attendance,
      statistics: {
        totalPresent,
        totalPossible,
        percentage: percentage.toFixed(2)
      }
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
  markAttendance,
  getStudentAttendance,
  getAllAttendance,
  getStudentAttendanceById,
  getCurrentSessionInfo,
  PERIOD_TIMINGS
};
