const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/qr-attendance');
    console.log('MongoDB Connected');
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const createFreshAdmin = async () => {
  await connectDB();

  const adminEmail = 'dewakarsunny29@gmail.com';
  const adminPassword = 'admin123';
  
  // Delete existing user
  await User.deleteOne({ email: adminEmail });
  console.log('Deleted existing user');
  
  // Create new admin user with plain password (will be hashed by pre-save hook)
  const admin = new User({
    name: 'Admin',
    email: adminEmail,
    password: adminPassword,
    role: 'admin'
  });
  
  await admin.save();
  console.log('Created new admin user');
  
  // Verify by finding and testing
  const user = await User.findOne({ email: adminEmail });
  console.log('\nVerifying user:');
  console.log('- Email:', user.email);
  console.log('- Role:', user.role);
  
  const isMatch = await user.comparePassword(adminPassword);
  console.log('- Password match:', isMatch);

  mongoose.disconnect();
};

createFreshAdmin();
