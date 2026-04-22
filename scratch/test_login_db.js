const authController = require('../controllers/authController');
const { query } = require('../db');

async function test() {
    try {
        console.log('Testing performLogin with DB...');
        
        // Find a user first
        const users = await query('SELECT * FROM users LIMIT 1');
        if (users.length === 0) {
            console.log('No users found to test with.');
            process.exit(0);
        }
        
        const user = users[0];
        console.log('Testing with user:', user.email);
        
        // Mock res object
        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                this.data = data;
                return this;
            }
        };
        
        await authController.performLogin(user, 'user', res);
        
        console.log('Response Status:', res.statusCode);
        console.log('Response Data:', JSON.stringify(res.data, null, 2));
        
        if (res.statusCode === 200) {
            console.log('✅ performLogin succeeded.');
        } else {
            console.error('❌ performLogin failed.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed with error:', err);
        process.exit(1);
    }
}

test();
