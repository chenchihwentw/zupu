const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('family.db');

db.all("PRAGMA table_info(members)", [], (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    const columns = rows.map(r => r.name);
    console.log("Columns in members table:");
    console.log(columns.join(', '));
    
    const required = ['phone2', 'phone3', 'wechat', 'line', 'province', 'city', 'nationality', 'birth_place', 'religion', 'father_id', 'mother_id'];
    const missing = required.filter(c => !columns.includes(c));
    
    if (missing.length > 0) {
        console.log("\n[WARNING] Missing columns:", missing.join(', '));
    } else {
        console.log("\n[SUCCESS] All required columns are present.");
    }
    db.close();
});
