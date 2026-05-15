const API = 'http://localhost:5000/api';

async function postJson(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data)}`);
  return data;
}

(async () => {
  try {
    console.log('Admin login...');
    const admin = await postJson('/auth/admin/login', { email: 'dewakarsunny29@gmail.com', password: 'admin123' });
    const adminToken = admin.token;
    console.log('Admin token obtained');

    console.log('Admin verify (activate)...');
    const verify = await postJson('/auth/admin/verify', { secretKey: 'ADMIN2024' }, adminToken);
    console.log('Verify response:', verify);

    console.log('Admin generates QR for period 1...');
    // Set future date to avoid expiration (end time is 09:05 + 10 mins grace = 09:15, but we need it now)
    // Instead, generate with tomorrow's date if current time is after period 1 (08:15-09:05)
    const now = new Date();
    const hour = now.getHours();
    const min = now.getMinutes();
    const currentMinutes = hour * 60 + min;
    
    // Period 1 runs from 08:15 (495) to 09:05 (545)
    let qrDate = new Date();
    if (currentMinutes >= 545) {
      // Already past period 1, use today but period won't be active for marking
      qrDate.setDate(qrDate.getDate() + 1); // use tomorrow
    }
    
    const qrGen = await postJson('/qr/generate', { period: 1, date: qrDate.toISOString() }, adminToken);
    console.log('QR Session generated:', { sessionId: qrGen.session.sessionId, period: qrGen.session.period });
    const sessionId = qrGen.session.sessionId;

    console.log('\nStudent login...');
    const student = await postJson('/auth/login', { email: 'student1@example.com', password: 'studentpass' });
    console.log('Student logged in:', { studentId: student.studentId, name: student.name });

    const qrData = JSON.stringify({ sessionId, period: 1 });
    console.log('Marking attendance with qrData:', qrData);

    const scan = await postJson('/attendance/scan', { qrData }, student.token);
    console.log('Scan response:', scan);

  } catch (err) {
    console.error('E2E error:', err.toString());
    process.exit(1);
  }
})();
