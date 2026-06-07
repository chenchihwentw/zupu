const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('./family.db'); 
db.all('SELECT * FROM user_family_trees WHERE user_id = "user_1775525022539_0gfi49mbm"', (err, rows) => console.log(rows));
