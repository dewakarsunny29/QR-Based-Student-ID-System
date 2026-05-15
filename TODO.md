# Password Recovery via Aadhaar — Implementation Complete

## Completed Steps

### ✅ Step 1: backend/controllers/authController.js
- Added `resetAttempts` in-memory store for rate limiting (max 3 attempts per 15-min window)
- Rewrote `forgotPassword`: accepts `identifier` (studentId/email/rollNumber) + `aadhaarNumber`
- Finds user by studentId, email, or rollNumber
- Enforces attempt limits before processing
- Verifies Aadhaar via `compareAadhaar()` (hashed comparison)
- On success → directly returns JWT `resetToken` (15 min expiry, purpose `password-reset`)
- On failure → increments attempt counter, returns generic error (prevents user enumeration)
- Added Aadhaar validation in `registerStudent` (required 12-digit Aadhaar)
- Enhanced `resetPassword`: password strength validation (min 6 chars + 1 letter + 1 number)
- Kept `verifyOTP` for backward compatibility

### ✅ Step 2: frontend/src/services/api.js
- Updated `forgotPassword(mobileNumber, aadhaarNumber)` → `forgotPassword(identifier, aadhaarNumber)`

### ✅ Step 3: frontend/src/pages/ForgotPassword.jsx
- Redesigned from 3-step to 2-step flow
- Step 1: Input identifier (Student ID / Email / Roll Number) + Aadhaar Number (masked input)
- Step 2: New password + Confirm password
- Removed all OTP-related state, handlers, and UI
- Added rate limit error handling with remaining attempts display
- Added client-side password complexity validation

### ✅ Step 4: frontend/src/pages/StudentRegister.jsx
- Added `aadhaarNumber` input field (12 digits, masked formatting XXXX XXXX XXXX)
- Added client-side validation (exactly 12 digits required)
- Included in registration payload
- Made mobileNumber and aadhaarNumber required fields

### ✅ Step 5: backend/models/User.js
- Already had `aadhaarNumber` field with bcrypt hashing on save
- Already had `compareAadhaar()` method for secure hashed comparison
- No changes needed

## Security Features Implemented

1. **Aadhaar Storage Security**: Aadhaar numbers are hashed with bcrypt before storage (same mechanism as passwords)
2. **Password Hashing**: Passwords hashed with bcrypt + salt (already existing, preserved)
3. **Rate Limiting**: Max 3 failed reset attempts per 15-minute window per identifier
4. **Generic Error Messages**: Prevents user enumeration attacks by returning same error for invalid user vs invalid Aadhaar
5. **JWT Reset Tokens**: Short-lived (15 min) signed tokens with specific purpose claim
6. **Password Strength**: Minimum 6 characters, must contain at least one letter and one number
7. **Input Validation**: Server-side validation for Aadhaar format (12 digits) on both registration and password reset
8. **Masked Input**: Aadhaar input is visually masked (XXXX XXXX XXXX format) in the UI

## Next Steps (Testing)
- [ ] Register a new student with Aadhaar number
- [ ] Test forgot-password flow with studentId + Aadhaar
- [ ] Verify rate limiting blocks after 3 failed attempts
- [ ] Verify successful password reset allows login with new password
- [ ] Test with email and rollNumber as identifiers

