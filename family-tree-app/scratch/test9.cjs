const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('./family.db'); 
db.all('SELECT id, name, primaryFamily, families, spouses, children, parents FROM members WHERE id IN ("1775530689351","1775571737446")', (err, rows) => console.log(rows));
