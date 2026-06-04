const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('i:/proj/zupu/family-tree-app/family.db');

db.all('PRAGMA table_info(members)', (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        const columns = rows.map(r => r.name);
        console.log('Columns in members table:', JSON.stringify(columns, null, 2));
    }
    db.close();
});
