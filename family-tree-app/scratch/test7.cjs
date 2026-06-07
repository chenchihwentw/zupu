const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('./family.db'); 
db.all('SELECT id, name, primaryFamily, families, spouses, children, parents FROM members WHERE name = "陳本清"', (err, rows) => console.log(rows));
