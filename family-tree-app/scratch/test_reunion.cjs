const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('i:/proj/zupu/family-tree-app/family.db');

const sql = `
  SELECT rp.*, u.full_name as author_name
  FROM reunion_posts rp
  LEFT JOIN users u ON rp.user_id = u.id
  WHERE 1=1
  ORDER BY rp.created_at DESC
`;

db.all(sql, [], (err, rows) => {
  if (err) {
    console.error('SQL ERROR:', err.message);
  } else {
    console.log('SUCCESS:', rows.length, 'posts found');
  }
  db.close();
});
