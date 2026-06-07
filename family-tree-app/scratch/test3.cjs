const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('./family.db'); 
db.all('SELECT * FROM members WHERE id = "m_1775525026352"', (err, rows) => console.log(rows));
