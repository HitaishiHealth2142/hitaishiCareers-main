#!/usr/bin/env node

/**
 * Admin Account Initialization Script
 * Creates initial admin account in database
 * Run with: node scripts/create-admin.js
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const prompt = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
};

const hidePassword = async (question) => {
    return new Promise((resolve) => {
        const stdin = process.stdin;
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');

        let password = '';
        rl.question(question, (answer) => {
            process.stdin.setRawMode(false);
            process.stdin.resume();
            resolve(answer);
        });
    });
};

async function createAdmin() {
    try {
        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║     WinJob Admin Account Creation Tool      ║');
        console.log('╚════════════════════════════════════════════╝\n');

        // Get admin email
        const email = await prompt('📧 Enter Admin Email: ');
        if (!email || !email.includes('@')) {
            console.error('❌ Invalid email format. Please try again.');
            rl.close();
            return;
        }

        // Check if admin already exists
        const [existingAdmin] = await query('SELECT id FROM admins WHERE email = ?', [email]);
        if (existingAdmin) {
            console.error('❌ An admin account with this email already exists!');
            rl.close();
            return;
        }

        // Get password
        const password = await prompt('🔐 Enter Admin Password (min 8 chars): ');
        if (!password || password.length < 8) {
            console.error('❌ Password must be at least 8 characters long.');
            rl.close();
            return;
        }

        // Confirm password
        const confirmPassword = await prompt('🔐 Confirm Password: ');
        if (password !== confirmPassword) {
            console.error('❌ Passwords do not match. Please try again.');
            rl.close();
            return;
        }

        // Hash password
        console.log('\n⏳ Hashing password...');
        const passwordHash = await bcrypt.hash(password, 10);

        // Create admin
        const adminId = uuidv4();
        await query(
            'INSERT INTO admins (id, email, password_hash) VALUES (?, ?, ?)',
            [adminId, email, passwordHash]
        );

        console.log('\n✅ Admin account created successfully!\n');
        console.log('╔════════════════════════════════════════════╗');
        console.log('║           Admin Credentials Created        ║');
        console.log('╠════════════════════════════════════════════╣');
        console.log(`║ 📧 Email:    ${email.padEnd(33)}║`);
        console.log(`║ 🔑 Admin ID: ${adminId}║`);
        console.log('╠════════════════════════════════════════════╣');
        console.log('║ 🔐 Password: ••••••••••••••••••••••••••••  ║');
        console.log('╚════════════════════════════════════════════╝\n');

        console.log('📝 Next Steps:');
        console.log('1. Keep these credentials secure');
        console.log('2. Access admin panel at: /admin.html');
        console.log('3. Login with email and password');
        console.log('4. Complete OTP verification with code sent to email\n');

        rl.close();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Error creating admin account:', error.message);
        rl.close();
        process.exit(1);
    }
}

// Start the script
createAdmin();
