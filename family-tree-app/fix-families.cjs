const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./family.db', (err) => {
  if(err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }

  // 修復李美玲
  const familyId = 'li_family_1775525022539';
  const families = JSON.stringify([familyId]);
  
  db.run(
    `UPDATE members SET family_id = ?, primaryFamily = ?, families = ? WHERE id = ?`,
    [familyId, familyId, families, 'm_1775525026352'],
    function(err) {
      if (err) {
        console.error('Update error:', err);
      } else {
        console.log('✓ Updated:', this.changes, 'rows');
      }

      // 驗證更新
      db.get(
        `SELECT id, name, family_id, primaryFamily, families FROM members WHERE id = ?`,
        ['m_1775525026352'],
        (err, row) => {
          if (row) {
            console.log('\n李美玲更新後：');
            console.log(JSON.stringify(row, null, 2));
          }
          
          // 也修復李瑞春
          const familyId2 = 'li_family_1775523928805';
          const families2 = JSON.stringify([familyId2]);
          
          db.run(
            `UPDATE members SET family_id = ?, primaryFamily = ?, families = ? WHERE id = ?`,
            [familyId2, familyId2, families2, 'm_1775523932730'],
            function(err) {
              if (err) {
                console.error('Update error for 李瑞春:', err);
              } else {
                console.log('\n✓ 李瑞春也已更新');
              }
              
              db.get(
                `SELECT id, name, family_id, primaryFamily, families FROM members WHERE id = ?`,
                ['m_1775523932730'],
                (err, row) => {
                  if (row) {
                    console.log('\n李瑞春更新後：');
                    console.log(JSON.stringify(row, null, 2));
                  }
                  db.close();
                }
              );
            }
          );
        }
      );
    }
  );
});
