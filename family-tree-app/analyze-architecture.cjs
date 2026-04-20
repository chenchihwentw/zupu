const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./family.db');

const tables = ['members', 'family_trees', 'marriages', 'member_spouses', 'users', 'user_family_trees'];

console.log('\n================== 數據庫架構分析 ==================\n');

Promise.all(tables.map(table => {
  return new Promise((resolve) => {
    db.all(`PRAGMA table_info(${table})`, (err, cols) => {
      console.log(`📋 ${table}`);
      console.log('─'.repeat(60));
      cols.forEach(col => {
        const type = col.type.padEnd(15);
        const nullable = col.notnull ? '✓ NOT NULL' : '○ nullable';
        const isPK = col.pk ? '🔑 PK' : '';
        console.log(`  ${col.name.padEnd(20)} ${type} ${nullable} ${isPK}`);
      });
      console.log('');
      resolve();
    });
  });
})).then(() => {
  // 分析表關係
  console.log('\n================== 表關係分析 ==================\n');
  
  console.log('1️⃣  members (成員表)');
  console.log('   ├─ 核心字段: id, name, family_tree_id, father_id, mother_id');
  console.log('   ├─ 家族字段: family_id, primaryFamily, families (JSON)');
  console.log('   ├─ 關係字段: spouses (JSON), children (JSON), parents (JSON)');
  console.log('   └─ 關聯: 通過 family_tree_id → family_trees');
  
  console.log('\n2️⃣  family_trees (家族表)');
  console.log('   ├─ 核心字段: id, name, surname, ancestral_home, hall_name');
  console.log('   └─ 反向關聯: members.family_tree_id');
  
  console.log('\n3️⃣  marriages (婚姻登記表)');
  console.log('   ├─ 字段: id, husband_id, wife_id, is_divorced');
  console.log('   └─ 用途: 記錄婚姻狀態和離婚信息');
  
  console.log('\n4️⃣  member_spouses (配偶表)');
  console.log('   ├─ 字段: id, member_id, spouse_member_id, is_current');
  console.log('   └─ 用途: 記錄當前配偶關係');
  
  console.log('\n5️⃣  users (用戶表)');
  console.log('   ├─ 字段: id, email, linkedMemberId');
  console.log('   └─ 關聯: 通過 linkedMemberId → members.id');
  
  console.log('\n6️⃣  user_family_trees (用戶-家族關聯表)');
  console.log('   ├─ 字段: user_id, family_tree_id, role');
  console.log('   └─ 用途: 記錄用戶對家族的訪問權限');
  
  console.log('\n\n================== 核心問題 ==================\n');
  console.log('❓ members 表中 spouses/children/parents 都用 JSON 存儲');
  console.log('❓ marriages 和 member_spouses 表有什麼區別？');
  console.log('❓ families 是什麼，與 family_id/primaryFamily 有何區別？');
  
  db.close();
});
