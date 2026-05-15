import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [identifier, setIdentifier] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarMasked, setAadhaarMasked] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const formatAadhaar = (value) => {
    const digits = value.replace(/\D/g, '').slice(0, 12);
    const masked = digits.replace(/(\d{4})(?=.)/g, '$1 ');
    setAadhaarMasked(masked);
    setAadhaarNumber(digits);
  };

  const handleVerifyIdentity = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await authAPI.forgotPassword(identifier, aadhaarNumber);
      setResetToken(response.data.resetToken);
      setMessage(response.data.message);
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to verify identity. Please try again.';
      const remaining = err.response?.data?.remainingAttempts;
      setError(remaining !== undefined ? `${msg} (${remaining} attempts remaining)` : msg);
    }

    setLoading(false);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    // Client-side complexity check (must contain at least one letter and one number)
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      setError('Password must contain at least one letter and one number');
      setLoading(false);
      return;
    }

    try {
      await authAPI.resetPassword(resetToken, newPassword);
      setMessage('Password reset successful. Redirecting to login...');
      setTimeout(() => {
        navigate('/student/login');
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-emerald-100 mt-2">
              {step === 1 && 'Enter your username/student ID and Aadhaar number'}
              {step === 2 && 'Create your new password'}
            </p>
          </div>

          {step === 1 && (
            <form onSubmit={handleVerifyIdentity} className="p-8">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6">
                  {error}
                </div>
              )}

              {message && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl mb-6">
                  {message}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="identifier" className="block text-sm font-medium text-gray-200 mb-2">
                    Username / Student ID / Email
                  </label>
                  <input
                    type="text"
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value.trim())}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., STU0001 or your@email.com"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Enter your registered student ID, email, or roll number</p>
                </div>

                <div>
                  <label htmlFor="aadhaarNumber" className="block text-sm font-medium text-gray-200 mb-2">
                    Aadhaar Number
                  </label>
                  <input
                    type="text"
                    id="aadhaarNumber"
                    value={aadhaarMasked}
                    onChange={(e) => formatAadhaar(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-emerald-500"
                    placeholder="XXXX XXXX XXXX"
                    maxLength={19}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Only last 4 digits visible for security</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !identifier || aadhaarNumber.length !== 12}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-xl font-semibold disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify Identity'}
                </button>
              </div>

              <div className="mt-6 text-center">
                <Link to="/student/login" className="text-gray-300 hover:text-white">Back to Login</Link>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="p-8">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6">
                  {error}
                </div>
              )}

              {message && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-xl mb-6">
                  {message}
                </div>
              )}

              <div className="space-y-5">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-200 mb-2">
                    New Password
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                    placeholder="Enter new password"
                    minLength={6}
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Min 6 chars, at least 1 letter and 1 number</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-200 mb-2">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                    placeholder="Confirm new password"
                    minLength={6}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-4 rounded-xl font-semibold disabled:opacity-50"
                >
                  {loading ? 'Resetting Password...' : 'Reset Password'}
                </button>
              </div>

              <div className="mt-6 text-center">
                <button type="button" onClick={() => setStep(1)} className="text-gray-300 hover:text-white">
                  Back to identity verification
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

