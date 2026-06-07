const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('./family.db'); 
db.all('SELECT id, name, primaryFamily, families, spouses, children FROM members WHERE id = "1775529335979"', (err, rows) => console.log(rows));
