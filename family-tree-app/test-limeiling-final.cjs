const sqlite3 = require('sqlite3');
const axios = require('axios');

async function test() {
  try {
    console.log('=== 測試李美玲能否看到她的卡片 ===\n');
    
    // 1. 查詢數據庫確認數據
    const db = new sqlite3.Database('./family.db');
    
    const member = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, name, family_tree_id, user_id FROM members WHERE id = 'm_1775525026352'`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log('1. 李美玲的成員記錄：');
    console.log(JSON.stringify(member, null, 2));
    
    const familyTree = await new Promise((resolve, reject) => {
      db.get(
        `SELECT id, name FROM family_trees WHERE id = ?`,
        [member.family_tree_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log('\n2. 對應的家族：');
    console.log(JSON.stringify(familyTree, null, 2));
    
    // 2. 檢查 user_family_trees 關係
    const userFamily = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM user_family_trees WHERE user_id = ?`,
        [member.user_id],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
    
    console.log('\n3. user_family_trees 關係：');
    console.log(JSON.stringify(userFamily, null, 2));
    
    db.close();
    
    // 3. 測試 API - 模擬調用 /api/my-family-tree
    console.log('\n4. 直接查詢該家族的成員（模擬後端邏輯）...');
    const members = await new Promise((resolve, reject) => {
      const db2 = new sqlite3.Database('./family.db');
      db2.all(
        `SELECT id, name FROM members WHERE family_tree_id = ?`,
        [member.family_tree_id],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
          db2.close();
        }
      );
    });
    
    console.log(`\n找到 ${members.length} 個成員：`);
    console.log(JSON.stringify(members, null, 2));
    
    if (members.some(m => m.id === 'm_1775525026352')) {
      console.log('\n✅ 李美玲的卡片應該會顯示！');
    } else {
      console.log('\n❌ 李美玲的卡片不會顯示');
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
