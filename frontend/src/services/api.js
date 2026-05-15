import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create axios instance with defaults
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  adminLogin: (credentials) => api.post('/auth/admin/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  verifyAdmin: (data) => api.post('/auth/admin/verify', data),
  getSystemSettings: () => api.get('/auth/settings'),
  updateSystemSettings: (data) => api.put('/auth/settings', data),
  getMe: () => api.get('/auth/me'),
  getStudents: (params) => api.get('/auth/students', { params }),
  getStudentById: (id) => api.get(`/auth/students/${id}`),
  deleteStudent: (id) => api.delete(`/auth/students/${id}`),
  // Password reset APIs
  forgotPassword: (identifier, aadhaarNumber) => api.post('/auth/forgot-password', { identifier, aadhaarNumber }),
  verifyOTP: (mobileNumber, otp) => api.post('/auth/verify-otp', { mobileNumber, otp }),
  resetPassword: (resetToken, newPassword) => api.post('/auth/reset-password', { resetToken, newPassword })
};

// QR API
export const qrAPI = {
  generateQR: (data) => api.post('/qr/generate', data),
  getSessions: () => api.get('/qr/sessions'),
  getPeriods: () => api.get('/qr/periods'),
  deactivateSession: (id) => api.put(`/qr/sessions/${id}/deactivate`),
  validateQR: (qrData) => api.post('/qr/validate', { qrData })
};

// Attendance API
export const attendanceAPI = {
  scanQR: (qrData) => api.post('/attendance/scan', { qrData }),
  getStudentAttendance: (params) => api.get('/attendance/student', { params }),
  getAllAttendance: (params) => api.get('/attendance', { params }),
  getStudentAttendanceById: (id, params) => api.get(`/attendance/student/${id}`, { params }),
  getCurrentSession: () => api.get('/attendance/current-session')
};

export default api;

