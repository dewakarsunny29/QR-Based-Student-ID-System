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

const createAdmin = async () => {
  await connectDB();

  const adminEmail = 'dewakarsunny29@gmail.com';
  const adminPassword = 'admin123'; // Default password - can be changed

  // Check if user with this email exists (any role)
  const existingUser = await User.findOne({ email: adminEmail });
  
  if (existingUser) {
    // Update the user to admin role
    existingUser.role = 'admin';
    existingUser.name = 'Admin';
    await existingUser.save();
    
    console.log('User updated to admin successfully!');
    console.log(`Email: ${existingUser.email}`);
    console.log(`Role: ${existingUser.role}`);
  } else {
    // Create admin user
    const admin = await User.create({
      name: 'Admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin'
    });
    console.log('Admin user created successfully!');
    console.log(`Email: ${admin.email}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Password: ${adminPassword}`);
  }

  mongoose.disconnect();
};

createAdmin();
