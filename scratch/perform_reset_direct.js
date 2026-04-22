const axios = require('axios');

async function performReset() {
    const email = 'hitaishiwinjob@gmail.com';
    const otp = '981444'; // OTP from server logs
    const newPassword = 'Abcd@1234';
    const baseUrl = 'http://localhost:5003/api/auth';

    try {
        console.log('Attempting to reset password via API...');
        const res = await axios.post(`${baseUrl}/reset-password`, { email, otp, newPassword });
        console.log('Response:', res.data);

        if (res.data.success) {
            console.log('✅ Password reset successful!');
        } else {
            console.error('❌ Reset failed:', res.data.message);
        }

    } catch (error) {
        console.error('❌ API call failed:', error.response ? error.response.data : error.message);
    }
}

performReset();
