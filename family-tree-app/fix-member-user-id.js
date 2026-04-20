const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./family.db', (err) => {
  if(err) {
    console.error('DB Error:', err);
    process.exit(1);
  }
  
  // 更新 member 的 user_id
  db.run("UPDATE members SET user_id = 'user_1775523928805_pus3bu63a' WHERE id = 'm_1775523932730'", function(err) {
    if(err) {
      console.error('Update Error:', err);
    } else {
      console.log('✓ Updated member:', this.changes, 'rows');
    }
    
    // 驗證更新
    db.get("SELECT id, name, user_id FROM members WHERE id = 'm_1775523932730'", (err, row) => {
      if(err) console.error('Verify Error:', err);
      else console.log('✓ Verified member:', JSON.stringify(row, null, 2));
      
      db.close();
      process.exit(0);
    });
  });
});
