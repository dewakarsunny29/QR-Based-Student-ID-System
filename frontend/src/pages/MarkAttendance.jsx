import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, qrAPI } from '../services/api';

const MarkAttendance = () => {
  const { user, login: studentLogin, register: studentRegister, logout } = useAuth();
  const navigate = useNavigate();
  
  // Refs
  const html5QrcodeRef = useRef(null);
  const scannerContainerRef = useRef(null);
  
  // Auth states
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authData, setAuthData] = useState({
    email: '',
    password: '',
    name: '',
    rollNumber: '',
    department: '',
    year: ''
  });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  // Scanner states
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [attendanceMessage, setAttendanceMessage] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  // Session info
  const [sessionInfo, setSessionInfo] = useState({
    currentSession: '',
    currentPeriod: null,
    isAllowed: true,
    currentTime: ''
  });

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
    
    return () => {
      clearInterval(interval);
      stopScanning();
    };
  }, []);

  // Stop scanning function
  const stopScanning = () => {
    if (html5QrcodeRef.current) {
      html5QrcodeRef.current.stop().then(() => {
        html5QrcodeRef.current = null;
      }).catch(err => {
        console.log('Error stopping scanner:', err);
        html5QrcodeRef.current = null;
      });
    }
    setScanning(false);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      let result;
      if (isLoginMode) {
        result = await studentLogin(authData.email, authData.password);
      } else {
        result = await studentRegister({
          ...authData,
          email: authData.email,
          studentId: authData.email
        });
      }

      if (result.success) {
        startScanning();
      } else {
        setAuthError(result.message);
      }
    } catch (error) {
      setAuthError(error.response?.data?.message || 'Authentication failed');
    }
    setAuthLoading(false);
  };

  const startScanning = () => {
    setScanning(true);
    setAttendanceMessage(null);
    
    setTimeout(() => {
      if (!scannerContainerRef.current) return;
      
      html5QrcodeRef.current = new Html5Qrcode("qr-reader");
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      html5QrcodeRef.current.start(
        { facingMode: "environment" },
        config,
        onScanSuccess,
        onScanError
      ).catch(err => {
        console.error('Error starting scanner:', err);
        setAttendanceMessage({ type: 'error', text: 'Camera error: ' + err.message });
        setScanning(false);
      });
    }, 500);
  };

  const onScanSuccess = async (decodedText) => {
    if (processing) return;
    setProcessing(true);

    if (html5QrcodeRef.current) {
      await html5QrcodeRef.current.pause();
    }

    try {
      const response = await attendanceAPI.scanQR(decodedText);
      setAttendanceMessage({ type: 'success', text: response.data.message });
      stopScanning();
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to mark attendance';
      setAttendanceMessage({ type: 'error', text: errorMsg });
      
      if (html5QrcodeRef.current && processing) {
        html5QrcodeRef.current.resume();
      }
    }
    setProcessing(false);
  };

  const onScanError = (error) => {
    // Ignore scan errors
  };

  const handleLogout = () => {
    stopScanning();
    logout();
    setScanning(false);
    setAttendanceMessage(null);
    setAuthData({
      email: '',
      password: '',
      name: '',
      rollNumber: '',
      department: '',
      year: ''
    });
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setAuthError('');
  };

  const getPeriodDisplay = () => {
    if (!sessionInfo.currentPeriod) return sessionInfo.currentSession;
    return `Period ${sessionInfo.currentPeriod}`;
  };

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

  // If not authenticated, show login/register form
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="bg-green-600 p-8 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Mark Attendance</h1>
            <p className="text-green-100 mt-2">{isLoginMode ? 'Login with your credentials' : 'Register to mark your attendance'}</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="p-8">
            {authError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
                {authError}
              </div>
            )}

            <div className="space-y-4">
              {isLoginMode ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email or Roll Number
                    </label>
                    <input
                      type="text"
                      value={authData.email}
                      onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                      placeholder="Enter email or roll number"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={authData.password}
                      onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                      placeholder="Enter your password"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={authData.email}
                      onChange={(e) => setAuthData({ ...authData, email: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your email"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                    <input
                      type="text"
                      value={authData.name}
                      onChange={(e) => setAuthData({ ...authData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Enter your name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <input
                      type="password"
                      value={authData.password}
                      onChange={(e) => setAuthData({ ...authData, password: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Create a password"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Roll Number</label>
                      <input
                        type="text"
                        value={authData.rollNumber}
                        onChange={(e) => setAuthData({ ...authData, rollNumber: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Roll No."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                      <select
                        value={authData.year}
                        onChange={(e) => setAuthData({ ...authData, year: e.target.value })}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                    <select
                      value={authData.department}
                      onChange={(e) => setAuthData({ ...authData, department: e.target.value })}
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
                </>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {authLoading ? 'Please wait...' : isLoginMode ? 'Login' : 'Register'}
              </button>
            </div>

            <div className="mt-6 text-center">
              <p className="text-gray-600">
                {isLoginMode ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  {isLoginMode ? 'Register here' : 'Login here'}
                </button>
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // If authenticated, show QR scanner
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-green-600 p-6 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Scan Your QR Code</h1>
          <p className="text-green-100 text-sm mt-1">Welcome, {user.name}!</p>
        </div>

        <div className="p-6">
          {renderSessionStatus()}

          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium mb-1">📱 Instructions:</p>
            <ul className="text-sm list-disc list-inside space-y-1">
              <li>Scan YOUR OWN permanent QR code</li>
              <li>Your student ID is in the QR</li>
              <li>Make sure admin has started the session</li>
            </ul>
          </div>

          {attendanceMessage && (
            <div className={`p-4 rounded-lg mb-6 ${attendanceMessage.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {attendanceMessage.type === 'success' ? (
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <span className="font-medium">{attendanceMessage.text}</span>
              </div>
              {attendanceMessage.type === 'success' ? (
                <button
                  onClick={() => {
                    setAttendanceMessage(null);
                    startScanning();
                  }}
                  className="mt-3 w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                >
                  Scan Again
                </button>
              ) : (
                <button
                  onClick={() => {
                    setAttendanceMessage(null);
                    startScanning();
                  }}
                  className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                >
                  Try Again
                </button>
              )}
            </div>
          )}

          {!scanning && !attendanceMessage && sessionInfo.isAllowed && (
            <div className="text-center">
              <p className="text-gray-600 mb-6">Click below to scan your permanent QR code</p>
              <button
                onClick={startScanning}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Scan My QR Code
              </button>
            </div>
          )}

          <div id="qr-reader" ref={scannerContainerRef} className="w-full"></div>

          <div className="mt-6 pt-6 border-t">
            <button
              onClick={handleLogout}
              className="w-full text-gray-600 hover:text-gray-800 py-2"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarkAttendance;
