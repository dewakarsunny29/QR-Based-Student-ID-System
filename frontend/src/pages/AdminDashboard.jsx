import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, qrAPI, attendanceAPI } from '../services/api';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // State management
  const [activeTab, setActiveTab] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayAttendance: 0,
    totalSessions: 0
  });
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentQR, setStudentQR] = useState(null);
  const [message, setMessage] = useState(null);
  const [filters, setFilters] = useState({
    department: '',
    year: '',
    date: '',
    period: ''
  });
  
  // System activation state
  const [systemSettings, setSystemSettings] = useState({
    systemActivated: false,
    studentLoginEnabled: false,
    studentRegistrationEnabled: true
  });
  const [activating, setActivating] = useState(false);

  // Student form state
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [studentFormData, setStudentFormData] = useState({
    email: '',
    password: '',
    name: '',
    rollNumber: '',
    department: '',
    year: ''
  });
  const [studentFormLoading, setStudentFormLoading] = useState(false);
  const [studentFormError, setStudentFormError] = useState('');
  const [studentFormSuccess, setStudentFormSuccess] = useState('');

  useEffect(() => {
    loadDashboardData();
    loadSystemSettings();
  }, []);

  const loadSystemSettings = async () => {
    try {
      const response = await authAPI.getSystemSettings();
      setSystemSettings({
        systemActivated: response.data.systemActivated,
        studentLoginEnabled: response.data.studentLoginEnabled,
        studentRegistrationEnabled: response.data.studentRegistrationEnabled
      });
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  };

  const handleToggleSystem = async () => {
    setActivating(true);
    try {
      const newStatus = !systemSettings.systemActivated;
      await authAPI.updateSystemSettings({ systemActivated: newStatus });
      setSystemSettings(prev => ({
        ...prev,
        systemActivated: newStatus,
        studentLoginEnabled: newStatus
      }));
      setMessage({ 
        type: 'success', 
        text: newStatus 
          ? 'System activated! Students can now login and mark attendance.' 
          : 'System deactivated. Students cannot login until system is activated.' 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update system status' });
    }
    setActivating(false);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadStudents(),
        loadSessions(),
        loadAttendanceStats()
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
    setLoading(false);
  };

  const loadStudents = async () => {
    try {
      const response = await authAPI.getStudents(filters);
      setStudents(response.data);
      setStats(prev => ({ ...prev, totalStudents: response.data.length }));
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await qrAPI.getSessions();
      setSessions(response.data);
      setStats(prev => ({ ...prev, totalSessions: response.data.length }));
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadAttendanceStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await attendanceAPI.getAllAttendance({ date: today });
      setAttendance(response.data.attendance);
      setStats(prev => ({ 
        ...prev, 
        todayAttendance: response.data.statistics?.presentCount || 0 
      }));
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  // Handle student registration from admin dashboard
  const handleStudentRegister = async (e) => {
    e.preventDefault();
    setStudentFormError('');
    setStudentFormSuccess('');
    setStudentFormLoading(true);

    try {
      const result = await authAPI.register({
        ...studentFormData,
        studentId: studentFormData.email
      });
      
      setStudentFormSuccess('Student registered successfully!');
      setStudentFormData({
        email: '',
        password: '',
        name: '',
        rollNumber: '',
        department: '',
        year: ''
      });
      loadStudents(); // Refresh student list
      
      setTimeout(() => {
        setShowStudentForm(false);
        setStudentFormSuccess('');
      }, 2000);
    } catch (error) {
      setStudentFormError(error.response?.data?.message || 'Failed to register student');
    }
    setStudentFormLoading(false);
  };

  const handleViewStudentQR = async (student) => {
    setSelectedStudent(student);
    setStudentQR(student.qrCode);
  };

  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete this student?')) return;
    
    try {
      await authAPI.deleteStudent(studentId);
      loadStudents();
      setMessage({ type: 'success', text: 'Student deleted successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete student' });
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    loadStudents();
  };

  // Get unique departments and years
  const departments = [...new Set(students.map(s => s.department).filter(Boolean))];
  const years = [...new Set(students.map(s => s.year).filter(Boolean))];

  // Render student registration modal
  const renderStudentRegisterModal = () => {
    if (!showStudentForm) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Register New Student</h2>
              <button
                onClick={() => setShowStudentForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {studentFormSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                {studentFormSuccess}
              </div>
            )}

            {studentFormError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                {studentFormError}
              </div>
            )}

            <form onSubmit={handleStudentRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email / Student ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentFormData.email}
                  onChange={(e) => setStudentFormData({ ...studentFormData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter email or student ID"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={studentFormData.password}
                  onChange={(e) => setStudentFormData({ ...studentFormData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Create a password"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={studentFormData.name}
                  onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Roll Number
                  </label>
                  <input
                    type="text"
                    value={studentFormData.rollNumber}
                    onChange={(e) => setStudentFormData({ ...studentFormData, rollNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Roll No."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year
                  </label>
                  <select
                    value={studentFormData.year}
                    onChange={(e) => setStudentFormData({ ...studentFormData, year: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select Year</option>
                    {[1, 2, 3, 4].map(y => (
                      <option key={y} value={y}>Year {y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={studentFormData.department}
                  onChange={(e) => setStudentFormData({ ...studentFormData, department: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Information Technology">Information Technology</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Mechanical">Mechanical</option>
                  <option value="Civil">Civil</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={studentFormLoading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {studentFormLoading ? 'Registering...' : 'Register Student'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* System Activation Toggle */}
            <div className={`rounded-xl shadow-lg p-6 ${systemSettings.systemActivated ? 'bg-gradient-to-r from-green-500 to-teal-600' : 'bg-gradient-to-r from-red-500 to-orange-500'} text-white`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold mb-2">🔐 System Activation</h2>
                  <p className="opacity-90">
                    {systemSettings.systemActivated 
                      ? 'System is ACTIVE. Students can login and mark attendance.' 
                      : 'System is INACTIVE. Students cannot login or mark attendance.'}
                  </p>
                  <p className="text-sm mt-2 opacity-75">
                    Status: {systemSettings.systemActivated ? '🟢 Activated' : '🔴 Deactivated'}
                  </p>
                </div>
                <button
                  onClick={handleToggleSystem}
                  disabled={activating}
                  className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
                    systemSettings.systemActivated 
                      ? 'bg-white text-red-600 hover:bg-gray-100' 
                      : 'bg-white text-green-600 hover:bg-gray-100'
                  } disabled:opacity-50`}
                >
                  {activating ? 'Processing...' : (systemSettings.systemActivated ? 'Deactivate System' : 'Activate System')}
                </button>
              </div>
              {message && (
                <div className="mt-4 p-3 bg-white bg-opacity-20 rounded-lg">
                  {message.text}
                </div>
              )}
            </div>

            {/* Student Access Section - Only Register */}
            <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-xl font-bold mb-4">👨‍🎓 Student Management</h2>
              <p className="mb-4 opacity-90">Register new students to the system</p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setShowStudentForm(true)}
                  className="bg-white text-green-600 px-6 py-2 rounded-lg font-semibold hover:bg-gray-100 transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Register Student
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Students</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalStudents}</p>
                  </div>
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Today's Attendance</p>
                    <p className="text-3xl font-bold text-green-600">{stats.todayAttendance}</p>
                  </div>
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">QR Sessions Today</p>
                    <p className="text-3xl font-bold text-purple-600">{stats.totalSessions}</p>
                  </div>
                  <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Student Attendance - Detailed Table */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-800">📋 Today's Student Attendance</h2>
                <button
                  onClick={loadAttendanceStats}
                  className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              {attendance.length === 0 ? (
                <p className="text-gray-500">No attendance marked yet today</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Sr.No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Reg No</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Date</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Time</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Period</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attendance.map((record, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{index + 1}</td>
                          <td className="px-4 py-3 text-sm font-medium">{record.student?.name || 'Unknown'}</td>
                          <td className="px-4 py-3 text-sm">{record.student?.rollNumber || record.student?.studentId || '-'}</td>
                          <td className="px-4 py-3 text-sm">
                            {record.scannedAt ? new Date(record.scannedAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : 
                             record.createdAt ? new Date(record.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            {record.scannedAt ? new Date(record.scannedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 
                             record.createdAt ? new Date(record.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              Period {record.period}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${record.status === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {record.status === 'present' ? '✅ Present' : '❌ Absent'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      case 'generate-qr':
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Student QR Codes</h2>
            <p className="text-gray-500 mb-6">View permanent QR codes for registered students</p>
            
            {message && (
              <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message.text}
              </div>
            )}

            {/* Student QR Display */}
            {selectedStudent && studentQR && (
              <div className="mb-8 p-6 bg-gray-50 rounded-xl">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="bg-white p-4 border rounded-lg">
                    <img src={studentQR} alt="Student QR Code" className="w-48 h-48" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{selectedStudent.name}</h3>
                    <p className="text-gray-600">Student ID: {selectedStudent.studentId}</p>
                    <p className="text-gray-600">Roll No: {selectedStudent.rollNumber || 'N/A'}</p>
                    <p className="text-gray-600">Department: {selectedStudent.department || 'N/A'}</p>
                    <p className="text-gray-600">Year: {selectedStudent.year || 'N/A'}</p>
                    <button
                      onClick={() => { setSelectedStudent(null); setStudentQR(null); }}
                      className="mt-4 text-blue-600 hover:text-blue-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Students List */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Student ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Roll No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Department</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Year</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">QR Code</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map(student => (
                    <tr key={student._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{student.studentId}</td>
                      <td className="px-4 py-3 text-sm font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-sm">{student.rollNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm">{student.department || '-'}</td>
                      <td className="px-4 py-3 text-sm">{student.year || '-'}</td>
                      <td className="px-4 py-3">
                        {student.qrCode ? (
                          <button
                            onClick={() => handleViewStudentQR(student)}
                            className="text-blue-600 hover:text-blue-700 text-sm"
                          >
                            View QR
                          </button>
                        ) : (
                          <span className="text-gray-400 text-sm">Not generated</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteStudent(student._id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length === 0 && (
                <p className="text-center text-gray-500 py-8">No students found</p>
              )}
            </div>
          </div>
        );

      case 'students':
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Student Management</h2>
              <button
                onClick={() => setShowStudentForm(true)}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Student
              </button>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Years</option>
                {[1,2,3,4].map(y => (
                  <option key={y} value={y}>Year {y}</option>
                ))}
              </select>
              
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>

            {/* Students Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Student ID</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Roll No</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Department</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Year</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map(student => (
                    <tr key={student._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm">{student.studentId}</td>
                      <td className="px-4 py-3 text-sm font-medium">{student.name}</td>
                      <td className="px-4 py-3 text-sm">{student.rollNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm">{student.department || '-'}</td>
                      <td className="px-4 py-3 text-sm">{student.year || '-'}</td>
                      <td className="px-4 py-3 text-sm">{student.email}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDeleteStudent(student._id)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {students.length === 0 && (
                <p className="text-center text-gray-500 py-8">No students found</p>
              )}
            </div>
          </div>
        );

      case 'attendance':
        // Calculate attendance by period
        const periodAttendance = [1,2,3,4,5,6,7,8].map(period => {
          const periodData = attendance.filter(a => a.period === period);
          return {
            period,
            count: periodData.length,
            label: `${period}${getOrdinalSuffix(period)} Period`
          };
        });
        
        const maxAttendance = Math.max(...periodAttendance.map(p => p.count), 1);
        
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Attendance Bargraph</h2>
            
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-8">
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleFilterChange('date', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              
              <select
                value={filters.period}
                onChange={(e) => handleFilterChange('period', e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Periods</option>
                {[1,2,3,4,5,6,7,8].map(p => (
                  <option key={p} value={p}>{p}{getOrdinalSuffix(p)} Period</option>
                ))}
              </select>
              
              <button
                onClick={async () => {
                  try {
                    const response = await attendanceAPI.getAllAttendance(filters);
                    setAttendance(response.data.attendance);
                  } catch (error) {
                    console.error('Error loading attendance:', error);
                  }
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Apply Filters
              </button>
            </div>

            {/* Bar Graph */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Attendance by Period</h3>
              <div className="flex items-end justify-around h-64 border-b border-l border-gray-300 px-4 pb-4">
                {periodAttendance.map((item) => (
                  <div key={item.period} className="flex flex-col items-center flex-1 max-w-16">
                    <div className="relative w-full flex justify-center">
                      <div 
                        className="w-12 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md transition-all duration-300"
                        style={{ 
                          height: `${(item.count / maxAttendance) * 200}px`,
                          minHeight: item.count > 0 ? '20px' : '4px'
                        }}
                      >
                        <span className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-sm font-bold text-gray-700">
                          {item.count}
                        </span>
                      </div>
                    </div>
                    <span className="mt-2 text-xs text-gray-600 text-center">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{attendance.length}</p>
                <p className="text-sm text-gray-600">Total Records</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">
                  {attendance.filter(a => a.status === 'present').length}
                </p>
                <p className="text-sm text-gray-600">Present</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">
                  {attendance.filter(a => a.status === 'absent').length}
                </p>
                <p className="text-sm text-gray-600">Absent</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {periodAttendance.reduce((max, p) => p.count > max.count ? p : max, {count: 0}).period}{getOrdinalSuffix(periodAttendance.reduce((max, p) => p.count > max.count ? p : max, {count: 0}).period)}
                </p>
                <p className="text-sm text-gray-600">Peak Period</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Student Registration Modal */}
      {renderStudentRegisterModal()}

      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">QR Attendance System</h1>
              <p className="text-blue-200 text-sm">Admin Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{user?.name}</p>
                <p className="text-blue-200 text-sm">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className="w-full md:w-64">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <nav className="p-4 space-y-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('generate-qr')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'generate-qr' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Student QR Codes
                </button>

                <button
                  onClick={() => setActiveTab('students')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'students' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Students
                </button>

                <button
                  onClick={() => setActiveTab('attendance')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'attendance' ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Attendance Bargraph
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {renderContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

export default AdminDashboard;
