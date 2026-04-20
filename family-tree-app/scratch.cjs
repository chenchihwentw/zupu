const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('family.db');

const query = `
  SELECT id, name, family_id, families, user_id, primaryFamily 
  FROM members 
  WHERE name LIKE '%李瑞珠%' OR name LIKE '%陳致彣%' OR family_id = 'b12' 
  LIMIT 20
`;

db.all(query, [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
