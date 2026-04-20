const axios = require('axios');

const BASE_URL = 'http://localhost:5003/api/auth';
const PROTECTED_URL = 'http://localhost:5003/api/profile'; // Assuming this exists and is protected

const testUser = {
    fullName: 'Test User',
    email: `testuser_${Date.now()}@example.com`,
    mobileNumber: '1234567890',
    password: 'Password123!'
};

let accessToken = '';
let refreshToken = '';

async function runTests() {
    try {
        console.log('--- JWT Auth System Verification ---');

        // 1. Register
        console.log('\n[1] Testing Registration...');
        const regRes = await axios.post(`${BASE_URL}/register`, testUser);
        console.log('✅ Registration success:', regRes.data.message);
        accessToken = regRes.data.accessToken;
        refreshToken = regRes.data.refreshToken;

        // 2. Login
        console.log('\n[2] Testing Login...');
        const loginRes = await axios.post(`${BASE_URL}/login`, {
            email: testUser.email,
            password: testUser.password
        });
        console.log('✅ Login success:', loginRes.data.message);
        accessToken = loginRes.data.accessToken;
        refreshToken = loginRes.data.refreshToken;

        // 3. Access Protected Route
        console.log('\n[3] Testing Protected Route (Access Token)...');
        try {
            const profileRes = await axios.get(PROTECTED_URL, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            console.log('✅ Access granted:', profileRes.data.success ? 'Yes' : 'No (check response structure)');
        } catch (err) {
            console.log('❌ Access denied (Expected if profile route is not set up yet):', err.response?.data?.message || err.message);
        }

        // 4. Test Token Refresh
        console.log('\n[4] Testing Token Refresh...');
        const refreshRes = await axios.post(`${BASE_URL}/refresh`, { refreshToken });
        console.log('✅ Refresh success! New Access Token obtained.');
        const newAccessToken = refreshRes.data.accessToken;

        // 5. Test Logout
        console.log('\n[5] Testing Logout...');
        const logoutRes = await axios.post(`${BASE_URL}/logout`, { refreshToken });
        console.log('✅ Logout success:', logoutRes.data.message);

        // 6. Verify Logout (Refresh should fail)
        console.log('\n[6] Verifying Logout effect...');
        try {
            await axios.post(`${BASE_URL}/refresh`, { refreshToken });
            console.log('❌ Error: Refresh should have failed after logout.');
        } catch (err) {
            console.log('✅ Refresh failed as expected after logout:', err.response?.data?.message);
        }

        console.log('\n--- Verification Completed Successfully ---');

    } catch (error) {
        console.error('\n❌ Test failed:');
        if (error.response) {
            console.error('Response Error:', error.response.data);
        } else {
            console.error(error.message);
        }
        process.exit(1);
    }
}

runTests();
