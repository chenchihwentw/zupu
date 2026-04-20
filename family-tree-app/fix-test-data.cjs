const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./family.db');

console.log('🔧 開始修復測試數據...\n');

// 1. 找到正確的李萬成記錄（ID: 1775530689351）
db.get(
  `SELECT id, name, family_tree_id FROM members WHERE id = '1775530689351'`,
  (err, liWanCheng) => {
    if (err) {
      console.error('❌ 查詢李萬成失敗:', err);
      db.close();
      return;
    }
    
    if (!liWanCheng) {
      console.log('❌ 李萬成 (1775530689351) 不存在，需要手動添加');
      db.close();
      return;
    }
    
    console.log('✅ 找到李萬成:', liWanCheng);
    
    // 2. 更新李萬成的家族屬性
    db.run(
      `UPDATE members 
       SET family_tree_id = ?, 
           primaryFamily = ?, 
           family_id = ?, 
           families = ?
       WHERE id = '1775530689351'`,
      [
        '李_family_1775525022539',
        '李_family_1775525022539',
        '李_family_1775525022539',
        JSON.stringify(['李_family_1775525022539'])
      ],
      function(err) {
        if (err) {
          console.error('❌ 更新李萬成失敗:', err);
        } else {
          console.log('✅ 更新李萬成成功 (受影響的行數:', this.changes, ')');
        }
        
        // 3. 更新李聯旺的父親關係和家族屬性
        db.run(
          `UPDATE members 
           SET father_id = ?,
               family_tree_id = ?,
               primaryFamily = ?,
               family_id = ?,
               families = ?
           WHERE id = '1775529335979'`,
          [
            '1775530689351',
            '李_family_1775525022539',
            '李_family_1775525022539',
            '李_family_1775525022539',
            JSON.stringify(['李_family_1775525022539'])
          ],
          function(err) {
            if (err) {
              console.error('❌ 更新李聯旺失敗:', err);
            } else {
              console.log('✅ 更新李聯旺成功 (受影響的行數:', this.changes, ')');
            }
            
            // 4. 驗證修改結果
            db.get(
              `SELECT id, name, father_id, family_tree_id, primaryFamily FROM members WHERE name = '李聯旺'`,
              (err, result) => {
                console.log('\n📊 最終結果 - 李聯旺:');
                console.log(JSON.stringify(result, null, 2));
                db.close();
              }
            );
          }
        );
      }
    );
  }
);
