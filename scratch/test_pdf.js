try {
    const pdf = require('pdf-parse/node');
    console.log('Type of pdf:', typeof pdf);
    console.log('pdf:', pdf);
} catch (e) {
    console.error('Error requiring pdf-parse/node:', e);
}
