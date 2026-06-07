const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('./family.db'); 
db.all('SELECT * FROM user_family_trees WHERE family_tree_id = "family_1775571737446_native"', (err, rows) => console.log(rows));
