const mongoose = require('mongoose');
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

const checkAndResetAdmin = async () => {
  await connectDB();

  const adminEmail = 'dewakarsunny29@gmail.com';
  
  // Find the user
  const user = await User.findOne({ email: adminEmail });
  
  if (user) {
    console.log('User found:');
    console.log('- Email:', user.email);
    console.log('- Name:', user.name);
    console.log('- Role:', user.role);
    console.log('- Password hash:', user.password);
    
    // Reset password to 'admin123'
    const salt = await require('bcryptjs').genSalt(10);
    const hashedPassword = await require('bcryptjs').hash('admin123', salt);
    user.password = hashedPassword;
    user.role = 'admin';
    await user.save();
    
    console.log('\nPassword has been reset to: admin123');
    console.log('Role has been set to: admin');
  } else {
    console.log('No user found with email:', adminEmail);
  }

  mongoose.disconnect();
};

checkAndResetAdmin();
