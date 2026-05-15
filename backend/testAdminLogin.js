const axios = require('axios');

const testAdminLogin = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/admin/login', {
      email: 'dewakarsunny29@gmail.com',
      password: 'admin123'
    });
    console.log('Admin Login Successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.response) {
      console.log('Admin Login Failed!');
      console.log('Status:', error.response.status);
      console.log('Message:', error.response.data.message);
    } else {
      console.log('Error:', error.message);
    }
  }
};

testAdminLogin();
