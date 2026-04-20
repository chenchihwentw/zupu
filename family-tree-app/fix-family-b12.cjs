/**
 * 修復李瑞春的家族ID
 * 將臨時 family_b12_1774453775611 替換為正確的 李_family_1775525022539
 */

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./family.db');

const OLD_FAMILY_ID = 'family_b12_1774453775611';
const NEW_FAMILY_ID = '李_family_1775525022539';

db.serialize(() => {
  console.log('開始修復家族ID...\n');

  // Step 1: 更新李瑞春的 family_tree_id
  console.log('Step 1: 更新李瑞春的 family_tree_id...');
  db.run(
    `UPDATE members SET family_tree_id = ? WHERE id = 'b12'`,
    [NEW_FAMILY_ID],
    function(err) {
      if (err) console.error('  ❌ 失敗:', err.message);
      else console.log('  ✅ 成功');
    }
  );

  // Step 2: 更新所有成員的 families 數組
  console.log('\nStep 2: 更新所有成員的 families 數組...');
  
  // 先找出所有包含舊家族ID的成員
  db.all(
    `SELECT id, name, families FROM members WHERE families LIKE ?`,
    [`%${OLD_FAMILY_ID}%`],
    (err, members) => {
      if (err) {
        console.error('  ❌ 查詢失敗:', err.message);
        return;
      }

      console.log(`  找到 ${members.length} 個成員需要更新\n`);

      members.forEach((member, index) => {
        try {
          // 解析並替換 families
          let families = JSON.parse(member.families);
          const oldIndex = families.indexOf(OLD_FAMILY_ID);
          
          if (oldIndex !== -1) {
            families[oldIndex] = NEW_FAMILY_ID;
            
            // 去重
            families = [...new Set(families)];
            
            const newFamiliesStr = JSON.stringify(families);
            
            db.run(
              `UPDATE members SET families = ? WHERE id = ?`,
              [newFamiliesStr, member.id],
              function(err) {
                if (err) {
                  console.error(`  ❌ ${member.id} ${member.name}: ${err.message}`);
                } else {
                  console.log(`  ✅ ${member.id} ${member.name}`);
                  console.log(`     舊: ${member.families}`);
                  console.log(`     新: ${newFamiliesStr}\n`);
                }

                // 所有更新完成後執行驗證
                if (index === members.length - 1) {
                  verifyFix();
                }
              }
            );
          }
        } catch (e) {
          console.error(`  ❌ ${member.id} ${member.name}: JSON 解析失敗`);
        }
      });
    }
  );

  // Step 3: 驗證修復結果
  function verifyFix() {
    console.log('\n========== 驗證修復結果 ==========');
    
    // 檢查是否還有成員引用舊家族ID
    db.all(
      `SELECT id, name FROM members WHERE families LIKE ?`,
      [`%${OLD_FAMILY_ID}%`],
      (err, remaining) => {
        if (err) console.error('驗證失敗:', err.message);
        else {
          if (remaining.length === 0) {
            console.log('✅ 所有成員的 families 已更新');
          } else {
            console.log(`❌ 還有 ${remaining.length} 個成員未更新:`);
            remaining.forEach(m => console.log(`   ${m.id} ${m.name}`));
          }
        }

        // 檢查李瑞春的 family_tree_id
        db.get(
          `SELECT id, name, family_tree_id FROM members WHERE id = 'b12'`,
          (err, row) => {
            if (err) console.error('驗證失敗:', err.message);
            else {
              console.log(`\n李瑞春的家族ID: ${row.family_tree_id}`);
              if (row.family_tree_id === NEW_FAMILY_ID) {
                console.log('✅ 李瑞春的 family_tree_id 已正確更新');
              } else {
                console.log('❌ 李瑞春的 family_tree_id 未更新');
              }
            }

            // 檢查新家族有多少成員
            db.all(
              `SELECT id, name FROM members WHERE families LIKE ?`,
              [`%${NEW_FAMILY_ID}%`],
              (err, newMembers) => {
                if (err) console.error('驗證失敗:', err.message);
                else {
                  console.log(`\n✅ ${NEW_FAMILY_ID} 現有 ${newMembers.length} 個成員:`);
                  newMembers.forEach(m => console.log(`   ${m.id} ${m.name}`));
                }

                console.log('\n========== 修復完成 ==========');
                db.close();
              }
            );
          }
        );
      }
    );
  }
});
