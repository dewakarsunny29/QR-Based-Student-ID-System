const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'student'],
    default: 'student'
  },
  rollNumber: {
    type: String,
    sparse: true,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  year: {
    type: Number,
    min: 1,
    max: 4
  },
  mobileNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  aadhaarNumber: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Accept raw 12-digit Aadhaar or already-hashed bcrypt value
        return /^\d{12}$/.test(v) || /^\$2[aby]\$/.test(v);
      },
      message: 'Aadhaar must be exactly 12 digits'
    },
    unique: true,
    sparse: true
  },
  studentId: {
    type: String,
    unique: true,
    sparse: true
  },
  qrCode: {
    type: String, // Base64 encoded QR code image
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password and aadhaarNumber before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  if (this.isModified('aadhaarNumber')) {
    const salt = await bcrypt.genSalt(10);
    this.aadhaarNumber = await bcrypt.hash(this.aadhaarNumber, salt);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Compare Aadhaar method
userSchema.methods.compareAadhaar = async function(candidateAadhaar) {
  return await bcrypt.compare(candidateAadhaar, this.aadhaarNumber);
};

// Generate student ID
userSchema.statics.generateStudentId = async function() {
  const lastUser = await this.findOne({ role: 'student' }).sort({ createdAt: -1 });
  let num = 1;
  if (lastUser && lastUser.studentId) {
    num = parseInt(lastUser.studentId.split('STU')[1]) + 1;
  }
  return `STU${String(num).padStart(4, '0')}`;
};

module.exports = mongoose.model('User', userSchema);
