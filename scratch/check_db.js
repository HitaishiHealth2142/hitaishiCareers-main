const { query } = require('../db');

async function check() {
    try {
        console.log('--- Table Structure: refresh_tokens ---');
        const schema = await query('DESCRIBE refresh_tokens');
        console.table(schema);

        console.log('--- Last 5 entries: refresh_tokens ---');
        const entries = await query('SELECT * FROM refresh_tokens ORDER BY id DESC LIMIT 5');
        console.table(entries);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
