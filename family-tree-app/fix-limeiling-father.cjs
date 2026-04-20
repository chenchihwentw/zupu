const sqlite3 = require('sqlite3');

async function fixRelationship() {
  const db = new sqlite3.Database('./family.db');
  
  try {
    console.log('=== 修復李美玲與李舅舅的家族關係 ===\n');
    
    // 1. 查詢李美玲
    const limeiling = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM members WHERE id = 'm_1775525026352'`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log('李美玲現狀：');
    console.log(`- ID: ${limeiling.id}`);
    console.log(`- name: ${limeiling.name}`);
    console.log(`- family_tree_id: ${limeiling.family_tree_id}`);
    console.log(`- father_id: ${limeiling.father_id}`);
    
    // 2. 查詢李舅舅
    const liyueshu = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM members WHERE id = '1775529335979'`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log('\n李舅舅現狀：');
    console.log(`- ID: ${liyueshu.id}`);
    console.log(`- name: ${liyueshu.name}`);
    console.log(`- family_tree_id: ${liyueshu.family_tree_id}`);
    console.log(`- user_id: ${liyueshu.user_id}`);
    
    // 3. 修復李舅舅的 family_tree_id（設置為李美玲的家族）
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE members SET family_tree_id = ?, family_id = ?, primaryFamily = ?, families = ? WHERE id = '1775529335979'`,
        [
          limeiling.family_tree_id,
          limeiling.family_tree_id,
          limeiling.family_tree_id,
          JSON.stringify([limeiling.family_tree_id])
        ],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`\n✓ 更新李舅舅的family_tree_id: ${this.changes} rows`);
            resolve();
          }
        }
      );
    });
    
    // 4. 修復李美玲的父親關係（設置 father_id 指向李舅舅）
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE members SET father_id = '1775529335979' WHERE id = 'm_1775525026352'`,
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✓ 設置李美玲的father_id: ${this.changes} rows`);
            resolve();
          }
        }
      );
    });
    
    // 5. 更新李舅舅的 children 字段（如果需要）
    const liyueshuParents = JSON.stringify(liyueshu.parents || []);
    const liyueshuChildren = JSON.stringify(['m_1775525026352']);
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE members SET children = ? WHERE id = '1775529335979'`,
        [liyueshuChildren],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✓ 設置李舅舅的children: ${this.changes} rows`);
            resolve();
          }
        }
      );
    });
    
    // 6. 更新李美玲的 parents 字段（如果需要）
    const limeilingParents = JSON.stringify(['1775529335979']);
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE members SET parents = ? WHERE id = 'm_1775525026352'`,
        [limeilingParents],
        function(err) {
          if (err) reject(err);
          else {
            console.log(`✓ 設置李美玲的parents: ${this.changes} rows`);
            resolve();
          }
        }
      );
    });
    
    // 7. 驗證修復
    console.log('\n修復後的數據：');
    const updated_limeiling = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, name, father_id, family_tree_id, parents FROM members WHERE id = 'm_1775525026352'`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log('\n李美玲：');
    console.log(JSON.stringify(updated_limeiling, null, 2));
    
    const updated_liyueshu = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, name, family_tree_id, children FROM members WHERE id = '1775529335979'`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log('\n李舅舅：');
    console.log(JSON.stringify(updated_liyueshu, null, 2));
    
    console.log('\n✅ 修復完成！');
    db.close();
    
  } catch (err) {
    console.error('Error:', err.message);
    db.close();
  }
}

fixRelationship();
