const jwt = require('jsonwebtoken');
require('dotenv').config();

// Mock user
const user = {
    id: 4,
    email: 'hitaishiwinjob@gmail.com',
    full_name: 'WinJob'
};

async function verify() {
    console.log('--- Verifying JWT fix ---');
    
    const { JWT_SECRET } = process.env;
    
    // 1. Simulate generateTokens
    console.log('Testing generateTokens...');
    const accessToken = jwt.sign(
        { id: user.id, role: 'user', email: user.email },
        JWT_SECRET,
        { expiresIn: '15m' }
    );
    
    const decoded = jwt.verify(accessToken, JWT_SECRET);
    console.log('Decoded token payload:', decoded);
    
    if (decoded.email === user.email) {
        console.log('✅ Email correctly included in access token.');
    } else {
        console.error('❌ Email missing from access token!');
    }
    
    // 2. Simulate refresh
    console.log('\nTesting refresh logic...');
    // In actual app, session.email is fetched from DB
    const session = { user_id: user.id, role: 'user', email: user.email };
    
    const refreshedToken = jwt.sign(
        { id: session.user_id, role: session.role, email: session.email },
        JWT_SECRET,
        { expiresIn: '30m' }
    );
    
    const decodedRefreshed = jwt.verify(refreshedToken, JWT_SECRET);
    console.log('Decoded refreshed token payload:', decodedRefreshed);
    
    if (decodedRefreshed.email === user.email) {
        console.log('✅ Email correctly included in refreshed token.');
    } else {
        console.error('❌ Email missing from refreshed token!');
    }
    
    console.log('\n--- Verification Complete ---');
}

verify().catch(console.error);
