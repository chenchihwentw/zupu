const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('./family.db'); 
db.all('SELECT name, birth_year FROM members WHERE id IN ("b11", "1775530689351")', (err, rows) => console.log(rows));
