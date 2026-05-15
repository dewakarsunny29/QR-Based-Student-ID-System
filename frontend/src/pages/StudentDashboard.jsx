import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, qrAPI } from '../services/api';
import { Html5Qrcode } from 'html5-qrcode';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [attendance, setAttendance] = useState([]);
  const [stats, setStats] = useState({
    totalPresent: 0,
    totalPossible: 0,
    percentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);
  const [personalQR, setPersonalQR] = useState(null);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);

  // Session info state
  const [sessionInfo, setSessionInfo] = useState({
    currentSession: '',
    currentPeriod: null,
    isAllowed: true,
    currentTime: ''
  });

  // Use stored QR code from database (generated once during registration)
  useEffect(() => {
    loadAttendanceData();
    
    // Use stored QR code from database
    if (user?.qrCode) {
      setPersonalQR(user.qrCode);
    }
    
    return () => {
      stopScanning();
    };
  }, [user]);

  // Update session info every second
  useEffect(() => {
    const updateSessionInfo = async () => {
      try {
        const response = await attendanceAPI.getCurrentSession();
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: true 
        });
        setSessionInfo({
          ...response.data,
          currentTime: timeString
        });
      } catch (error) {
        console.error('Error fetching session info:', error);
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: true 
        });
        setSessionInfo(prev => ({
          ...prev,
          currentTime: timeString
        }));
      }
    };

    updateSessionInfo();
    const interval = setInterval(updateSessionInfo, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getStudentAttendance();
      setAttendance(response.data.attendance);
      setStats(response.data.statistics);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
    setLoading(false);
  };

  const startScanning = () => {
    setScannerActive(true);
    setScanning(true);
    setMessage(null);
    
    setTimeout(() => {
      const qrReader = document.getElementById('qr-reader');
      if (!qrReader) return;
      
      // Clear previous content
      qrReader.innerHTML = '';
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 }
      };

      html5QrcodeRef.current = new Html5Qrcode("qr-reader");
      
      html5QrcodeRef.current.start(
        { facingMode: "environment" },
        config,
        async (decodedText) => {
          try {
            const response = await attendanceAPI.scanQR(decodedText);
            setMessage({ type: 'success', text: response.data.message });
            loadAttendanceData();
          } catch (error) {
            setMessage({ 
              type: 'error', 
              text: error.response?.data?.message || 'Failed to mark attendance' 
            });
          }
          stopScanning();
        },
        (error) => {
          // Ignore scan errors
        }
      ).catch(err => {
        console.error('Camera error:', err);
        setMessage({ 
          type: 'error', 
          text: 'Camera error: Please ensure camera permissions are granted and HTTPS is used.' 
        });
        setScannerActive(false);
        setScanning(false);
      });
    }, 300);
  };

  const stopScanning = () => {
    if (html5QrcodeRef.current) {
      html5QrcodeRef.current.stop().then(() => {
        html5QrcodeRef.current = null;
      }).catch(err => {
        console.log('Error stopping scanner:', err);
        html5QrcodeRef.current = null;
      });
    }
    setScannerActive(false);
    setScanning(false);
  };

  const handleLogout = () => {
    stopScanning();
    logout();
    navigate('/student/login');
  };

  const getOrdinalSuffix = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const getPeriodDisplay = () => {
    if (!sessionInfo.currentPeriod) return sessionInfo.currentSession;
    return `Period ${sessionInfo.currentPeriod}`;
  };

  // Render session status banner
  const renderSessionStatus = () => {
    const isBreak = sessionInfo.currentSession === 'Break';
    const isLunch = sessionInfo.currentSession === 'Lunch';
    const isOutsideHours = sessionInfo.currentSession === 'Outside College Hours';
    
    if (!sessionInfo.isAllowed) {
      if (isBreak) {
        return (
          <div className="bg-amber-100 border-2 border-amber-400 text-amber-900 px-4 py-4 rounded-xl mb-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">☕</span>
              <div className="text-center">
                <p className="font-bold text-lg">Morning Break</p>
                <p className="text-sm">10:05 - 10:20 | Attendance Disabled</p>
              </div>
            </div>
          </div>
        );
      } else if (isLunch) {
        return (
          <div className="bg-orange-100 border-2 border-orange-400 text-orange-900 px-4 py-4 rounded-xl mb-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">🍽</span>
              <div className="text-center">
                <p className="font-bold text-lg">Lunch Break</p>
                <p className="text-sm">12:40 - 13:40 | Attendance Disabled</p>
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div className="bg-gray-100 border-2 border-gray-400 text-gray-900 px-4 py-4 rounded-xl mb-4">
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl">⏰</span>
              <div className="text-center">
                <p className="font-bold text-lg">Outside College Hours</p>
                <p className="text-sm">Attendance not available</p>
              </div>
            </div>
          </div>
        );
      }
    }
    
    return (
      <div className="bg-gradient-to-r from-green-500 to-green-600 border-2 border-green-400 text-white px-4 py-4 rounded-xl mb-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🕒</span>
            <div>
              <p className="text-lg font-bold">{sessionInfo.currentTime}</p>
              <p className="text-green-100 text-sm">Current Time</p>
            </div>
          </div>
          {sessionInfo.currentPeriod && (
            <div className="bg-white text-green-700 px-4 py-2 rounded-full font-bold shadow">
              📚 {getPeriodDisplay()}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total Present</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalPresent}</p>
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
                    <p className="text-sm text-gray-500">Total Possible</p>
                    <p className="text-3xl font-bold text-gray-800">{stats.totalPossible}</p>
                  </div>
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Attendance %</p>
                    <p className={`text-3xl font-bold ${stats.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                      {stats.percentage}%
                    </p>
                  </div>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${stats.percentage >= 75 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <svg className={`w-8 h-8 ${stats.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Mark Attendance</h3>
                <p className="text-gray-500 mb-4">Scan the QR code displayed by your instructor to mark attendance for the current period.</p>
                <button
                  onClick={() => setActiveTab('scan')}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Scan QR Code
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Your QR Card</h3>
                <p className="text-gray-500 mb-4">Show this QR code to your instructors for verification.</p>
                {personalQR && (
                  <div className="flex justify-center">
                    <img src={personalQR} alt="Personal QR" className="w-32 h-32" />
                  </div>
                )}
              </div>
            </div>

            {/* Recent Attendance */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Attendance</h3>
              <div className="space-y-3">
                {attendance.slice(0, 5).map((att, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{getOrdinalSuffix(att.period)} Period</p>
                      <p className="text-sm text-gray-500">{new Date(att.date).toLocaleDateString()}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                      Present
                    </span>
                  </div>
                ))}
                {attendance.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No attendance records yet</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'scan':
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Scan Attendance QR</h2>
            
            {/* Session Status Banner with Time and Period */}
            {renderSessionStatus()}

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
              <p className="font-medium mb-1">📱 Instructions:</p>
              <ul className="text-sm list-disc list-inside space-y-1">
                <li>Scan YOUR OWN permanent QR code</li>
                <li>Your student ID is in the QR</li>
                <li>Make sure admin has started the session</li>
              </ul>
            </div>
            
            {message && (
              <div className={`p-4 rounded-lg mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                <div className="flex items-center gap-2">
                  {message.type === 'success' ? (
                    <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <span className="font-medium">{message.text}</span>
                </div>
                {message.type === 'success' && (
                  <button
                    onClick={() => {
                      setMessage(null);
                      setActiveTab('dashboard');
                    }}
                    className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                  >
                    Back to Dashboard
                  </button>
                )}
                {message.type === 'error' && (
                  <button
                    onClick={() => {
                      setMessage(null);
                      startScanning();
                    }}
                    className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}

            {!scannerActive && !message && sessionInfo.isAllowed && (
              <div className="text-center py-8">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Ready to Scan</h3>
                <p className="text-gray-500 mb-6">Click the button below to start scanning the attendance QR code</p>
                <button
                  onClick={startScanning}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                >
                  Start Scanning
                </button>
              </div>
            )}

            {!scannerActive && !message && !sessionInfo.isAllowed && (
              <div className="text-center py-8">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Attendance Not Available</h3>
                <p className="text-gray-500">You can only mark attendance during class hours.</p>
              </div>
            )}

            <div id="qr-reader" ref={scannerRef} className="w-full"></div>

            {scannerActive && (
              <button
                onClick={stopScanning}
                className="block w-full max-w-md mx-auto mt-4 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            )}
          </div>
        );

      case 'profile':
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">My Profile</h2>
            
            <div className="flex flex-col md:flex-row gap-8">
              <div className="flex-shrink-0">
                <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mx-auto md:mx-0">
                  <span className="text-4xl font-bold text-green-600">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-500">Student ID</label>
                  <p className="font-semibold text-gray-800">{user?.studentId}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">Name</label>
                  <p className="font-semibold text-gray-800">{user?.name}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">Roll Number</label>
                  <p className="font-semibold text-gray-800">{user?.rollNumber || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">Email</label>
                  <p className="font-semibold text-gray-800">{user?.email}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">Department</label>
                  <p className="font-semibold text-gray-800">{user?.department || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">Year</label>
                  <p className="font-semibold text-gray-800">{user?.year ? `${user.year}${getOrdinalSuffix(user.year)} Year` : 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-500">Mobile Number</label>
                  <p className="font-semibold text-gray-800">{user?.mobileNumber || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Personal QR Card */}
            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">My QR Card</h3>
              {personalQR && (
                <div className="flex flex-col items-center">
                  <img src={personalQR} alt="Personal QR" className="w-40 h-40" />
                  <p className="mt-2 font-semibold text-gray-800">{user?.studentId}</p>
                  <p className="text-gray-500">{user?.name}</p>
                </div>
              )}
            </div>
          </div>
        );

      case 'reports':
        return (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">Attendance Reports</h2>
            
            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">Total Present</p>
                <p className="text-2xl font-bold text-blue-800">{stats.totalPresent}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Possible</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalPossible}</p>
              </div>
              <div className={`p-4 rounded-lg ${stats.percentage >= 75 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-sm ${stats.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>Attendance %</p>
                <p className={`text-2xl font-bold ${stats.percentage >= 75 ? 'text-green-800' : 'text-red-800'}`}>{stats.percentage}%</p>
              </div>
            </div>

            {/* Attendance List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-800">Attendance History</h3>
              {attendance.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-800">
                      {new Date(att.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                    <p className="text-sm text-gray-500">{getOrdinalSuffix(att.period)} Period</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    Present ✓
                  </span>
                </div>
              ))}
              {attendance.length === 0 && (
                <p className="text-gray-500 text-center py-8">No attendance records found</p>
              )}
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">QR Attendance System</h1>
              <p className="text-green-200 text-sm">Student Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium">{user?.name}</p>
                <p className="text-green-200 text-sm">{user?.studentId}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg flex items-center gap-2"
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
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Dashboard
                </button>

                <button
                  onClick={() => setActiveTab('scan')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'scan' ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Scan QR
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'profile' ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 ${activeTab === 'reports' ? 'bg-green-50 text-green-600' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Attendance Reports
                </button>

                <hr className="my-4" />

                <Link
                  to="/login"
                  className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 text-gray-600 hover:bg-gray-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Admin Login
                </Link>
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

export default StudentDashboard;
