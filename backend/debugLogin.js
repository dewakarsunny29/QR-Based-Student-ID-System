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

const debugLogin = async () => {
  await connectDB();

  const email = 'dewakarsunny29@gmail.com';
  const password = 'admin123';
  
  console.log('Looking for user with email:', email);
  
  // First try to find by exact email
  let user = await User.findOne({ email });
  console.log('User found by email:', user ? 'Yes' : 'No');
  
  if (user) {
    console.log('\nUser details:');
    console.log('- Email:', user.email);
    console.log('- Name:', user.name);
    console.log('- Role:', user.role);
    
    // Check password
    console.log('\nTesting password:', password);
    const isMatch = await user.comparePassword(password);
    console.log('- Password match:', isMatch);
    
    // Check with bcrypt directly
    const bcryptMatch = await bcrypt.compare(password, user.password);
    console.log('- Bcrypt direct match:', bcryptMatch);
    
    // Try to find admin specifically
    const adminUser = await User.findOne({ email, role: 'admin' });
    console.log('\nAdmin user found:', adminUser ? 'Yes' : 'No');
    if (adminUser) {
      const adminMatch = await adminUser.comparePassword(password);
      console.log('Admin password match:', adminMatch);
    }
  } else {
    console.log('No user found!');
  }

  mongoose.disconnect();
};

debugLogin();
