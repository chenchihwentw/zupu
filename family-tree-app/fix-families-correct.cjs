const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./family.db', (err) => {
  if(err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }

  // 修復李美玲 - 使用正確的 family_tree_id（包含中文"李"）
  const familyId1 = '李_family_1775525022539';
  const families1 = JSON.stringify([familyId1]);
  
  db.run(
    `UPDATE members SET family_id = ?, primaryFamily = ?, families = ? WHERE id = ?`,
    [familyId1, familyId1, families1, 'm_1775525026352'],
    function(err) {
      if (err) {
        console.error('Update error:', err);
      } else {
        console.log('✓ 李美玲已更新:', this.changes, 'rows');
      }

      // 驗證李美玲
      db.get(
        `SELECT id, name, family_tree_id, family_id, primaryFamily, families FROM members WHERE id = ?`,
        ['m_1775525026352'],
        (err, row) => {
          if (row) {
            console.log('\n李美玲更新後：');
            console.log(JSON.stringify(row, null, 2));
          }
          
          // 也修復李瑞春 - 使用正確的 family_tree_id（包含中文"李"）
          const familyId2 = '李_family_1775523928805';
          const families2 = JSON.stringify([familyId2]);
          
          db.run(
            `UPDATE members SET family_id = ?, primaryFamily = ?, families = ? WHERE id = ?`,
            [familyId2, familyId2, families2, 'm_1775523932730'],
            function(err) {
              if (err) {
                console.error('Update error for 李瑞春:', err);
              } else {
                console.log('\n✓ 李瑞春已更新:', this.changes, 'rows');
              }
              
              db.get(
                `SELECT id, name, family_tree_id, family_id, primaryFamily, families FROM members WHERE id = ?`,
                ['m_1775523932730'],
                (err, row) => {
                  if (row) {
                    console.log('\n李瑞春更新後：');
                    console.log(JSON.stringify(row, null, 2));
                  }
                  
                  // 驗證現在可以找到成員
                  db.all(
                    `SELECT id, name FROM members WHERE family_tree_id = ?`,
                    ['李_family_1775525022539'],
                    (err, rows) => {
                      console.log('\n李_family_1775525022539 的所有成員：');
                      console.log(JSON.stringify(rows, null, 2));
                      db.close();
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});
