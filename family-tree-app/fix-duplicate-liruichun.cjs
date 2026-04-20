/**
 * 修復腳本：刪除重複的李瑞春記錄
 * 
 * 問題：李瑞春在數據庫中有三個記錄
 * - b12: 正確記錄（已嫁到陳家，families 包含兩個家族）
 * - m_1775523932730: 重複記錄（空）
 * - 1775537295267: 重複記錄
 * 
 * 解決方案：保留 b12，刪除另外兩個
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./family.db');

console.log('🔧 開始修復：刪除重複的李瑞春記錄\n');

// 要刪除的重複記錄ID
const duplicateIds = ['m_1775523932730', '1775537295267'];

// 檢查重複記錄的依賴關係
const checkDependencies = async (memberId) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name, parents, spouses, children FROM members', [], (err, allMembers) => {
      if (err) reject(err);
      
      const member = allMembers.find(m => m.id === memberId);
      if (!member) {
        console.log(`⚠️  成員 ${memberId} 不存在`);
        resolve({ parents: [], spouses: [], children: [], referencedBy: [] });
        return;
      }
      
      const parents = JSON.parse(member.parents || '[]');
      const spouses = JSON.parse(member.spouses || '[]');
      const children = JSON.parse(member.children || '[]');
      
      // 檢查是否有其他成員引用了這個成員
      const referencedBy = allMembers.filter(m => {
        const mParents = JSON.parse(m.parents || '[]');
        const mSpouses = JSON.parse(m.spouses || '[]');
        const mChildren = JSON.parse(m.children || '[]');
        
        return mParents.includes(memberId) || 
               mSpouses.includes(memberId) || 
               mChildren.includes(memberId);
      }).map(m => ({ id: m.id, name: m.name }));
      
      resolve({ parents, spouses, children, referencedBy });
    });
  });
};

// 主函數
const main = async () => {
  try {
    // 1. 驗證 b12 存在且正確
    console.log('📋 步驟 1: 驗證 b12（要保留的記錄）');
    const b12 = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM members WHERE id = ?', ['b12'], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!b12) {
      console.error('❌ b12 不存在！無法繼續');
      process.exit(1);
    }
    
    console.log('✅ b12 存在:');
    console.log(`   - 姓名: ${b12.name}`);
    console.log(`   - 性別: ${b12.gender}`);
    console.log(`   - 家族: ${b12.family_tree_id}`);
    console.log(`   - 配偶: ${b12.spouses}`);
    console.log(`   - families: ${b12.families}`);
    
    const b12Families = JSON.parse(b12.families || '[]');
    if (b12Families.length < 2) {
      console.error('⚠️  警告: b12 的 families 字段應該包含兩個家族！');
    } else {
      console.log('✅ b12 已正確關聯兩個家族\n');
    }
    
    // 2. 檢查重複記錄的依賴關係
    console.log('📋 步驟 2: 檢查重複記錄的依賴關係\n');
    
    for (const dupId of duplicateIds) {
      console.log(`🔍 檢查 ${dupId}...`);
      const deps = await checkDependencies(dupId);
      
      if (deps.referencedBy.length > 0) {
        console.log(`   ⚠️  被以下成員引用:`);
        deps.referencedBy.forEach(ref => {
          console.log(`      - ${ref.name} (${ref.id})`);
        });
      } else {
        console.log(`   ✅ 沒有被其他成員引用`);
      }
      console.log('');
    }
    
    // 3. 確認刪除
    console.log('❓ 是否繼續刪除這兩個重複記錄？');
    console.log('   要刪除的ID:');
    duplicateIds.forEach(id => console.log(`   - ${id}`));
    console.log('');
    
    // 自動確認（如果要交互式，可以改為手動確認）
    const confirmed = true; // 改為 false 可以手動確認
    
    if (!confirmed) {
      console.log('❌ 操作已取消');
      db.close();
      process.exit(0);
    }
    
    // 4. 執行刪除
    console.log('📋 步驟 3: 刪除重複記錄\n');
    
    for (const dupId of duplicateIds) {
      console.log(`🗑️  刪除 ${dupId}...`);
      
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM members WHERE id = ?', [dupId], function(err) {
          if (err) {
            console.error(`   ❌ 刪除失敗: ${err.message}`);
            reject(err);
          } else {
            if (this.changes > 0) {
              console.log(`   ✅ 成功刪除 ${this.changes} 條記錄`);
            } else {
              console.log(`   ⚠️  記錄不存在`);
            }
            resolve();
          }
        });
      });
    }
    
    // 5. 驗證結果
    console.log('\n📋 步驟 4: 驗證結果');
    
    const remaining = await new Promise((resolve, reject) => {
      db.all('SELECT id, name, family_tree_id, families FROM members WHERE name LIKE "%李瑞春%"', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log(`\n✅ 剩餘 ${remaining.length} 個李瑞春記錄:`);
    remaining.forEach(row => {
      console.log(`\n   ID: ${row.id}`);
      console.log(`   家族: ${row.family_tree_id}`);
      console.log(`   families: ${row.families}`);
    });
    
    if (remaining.length === 1 && remaining[0].id === 'b12') {
      console.log('\n✅ 修復完成！只保留了正確的 b12 記錄');
    } else {
      console.log('\n⚠️  警告：結果不符合預期！');
    }
    
    db.close();
    
  } catch (error) {
    console.error('\n❌ 錯誤:', error);
    db.close();
    process.exit(1);
  }
};

main();
