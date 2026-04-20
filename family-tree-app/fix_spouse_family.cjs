const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'family.db');
const db = new sqlite3.Database(dbPath);

console.log('開始修復配偶的 family_tree_id...\n');

db.serialize(() => {
    // 找出所有男性成員的配偶
    db.all("SELECT id, name, spouses FROM members WHERE gender='male' AND spouses IS NOT NULL AND spouses != '[]' AND spouses != ''", [], (err, rows) => {
        if (err) {
            console.error('查詢失敗:', err);
            db.close();
            return;
        }
        
        let updateCount = 0;
        let checkCount = 0;
        let totalChecks = 0;
        
        // 計算總檢查數
        rows.forEach(m => {
            try {
                const spouses = JSON.parse(m.spouses);
                totalChecks += spouses.filter(s => !s.includes('_old')).length;
            } catch (e) {}
        });
        
        rows.forEach(member => {
            try {
                const spouses = JSON.parse(member.spouses);
                spouses.forEach(spouseId => {
                    if (spouseId.includes('_old')) {
                        checkCount++;
                        return;
                    }
                    
                    // 更新配偶的 family_tree_id 為 chen_family
                    db.run(
                        "UPDATE members SET family_tree_id = 'chen_family' WHERE id = ? AND (family_tree_id IS NULL OR family_tree_id = '')",
                        [spouseId],
                        function(err) {
                            if (err) {
                                console.error(`更新 ${spouseId} 失敗:`, err);
                            } else if (this.changes > 0) {
                                updateCount++;
                                console.log(`  已修復: ${spouseId} -> family_tree_id = chen_family`);
                            }
                            
                            checkCount++;
                            if (checkCount >= totalChecks) {
                                console.log(`\n共修復 ${updateCount} 位配偶的 family_tree_id`);
                                
                                // 驗證結果
                                console.log('\n驗證結果:');
                                db.all("SELECT id, name, family_tree_id FROM members WHERE id IN ('b12', 'b122', 'b02', 'b32', 'b62', 'b72')", [], (err, rows) => {
                                    if (err) {
                                        console.error('驗證失敗:', err);
                                    } else {
                                        rows.forEach(r => {
                                            console.log(`  ${r.id} (${r.name}): family_tree_id = ${r.family_tree_id}`);
                                        });
                                    }
                                    db.close();
                                    console.log('\n修復完成！');
                                });
                            }
                        }
                    );
                });
            } catch (e) {
                console.error(`解析 ${member.id} 的 spouses 失敗:`, e);
            }
        });
    });
});
