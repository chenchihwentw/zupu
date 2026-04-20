const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'family.db');
const db = new sqlite3.Database(dbPath);

console.log('開始修復數據...\n');

db.serialize(() => {
    // 1. 修復所有陳家兒女的 father_id 和 family_tree_id
    console.log('1. 修復陳家兒女的 father_id 和 family_tree_id...');
    
    // 先找出所有 children 字段中包含的成員ID
    db.all("SELECT id, children FROM members WHERE children IS NOT NULL AND children != '' AND children != '[]'", [], (err, rows) => {
        if (err) {
            console.error('查詢失敗:', err);
            return;
        }
        
        let updateCount = 0;
        
        rows.forEach(parent => {
            try {
                const children = JSON.parse(parent.children);
                if (Array.isArray(children) && children.length > 0) {
                    children.forEach(childId => {
                        db.run(
                            "UPDATE members SET father_id = ?, family_tree_id = 'chen_family' WHERE id = ? AND (father_id IS NULL OR father_id = '')",
                            [parent.id, childId],
                            function(err) {
                                if (err) {
                                    console.error(`更新 ${childId} 失敗:`, err);
                                } else if (this.changes > 0) {
                                    updateCount++;
                                    console.log(`  已修復: ${childId} -> father_id = ${parent.id}`);
                                }
                            }
                        );
                    });
                }
            } catch (e) {
                console.error(`解析 ${parent.id} 的 children 失敗:`, e);
            }
        });
        
        setTimeout(() => {
            console.log(`\n共修復 ${updateCount} 條記錄\n`);
            
            // 2. 驗證修復結果
            console.log('2. 驗證修復結果...');
            db.all("SELECT id, name, father_id, family_tree_id FROM members WHERE id IN ('b1311', 'b1312', 'b1313')", [], (err, rows) => {
                if (err) {
                    console.error('驗證失敗:', err);
                } else {
                    console.log('陳致彣的兒女:');
                    rows.forEach(r => console.log(`  ${r.id} (${r.name}): father_id=${r.father_id}, family_tree_id=${r.family_tree_id}`));
                }
                
                db.close();
                console.log('\n數據修復完成！');
            });
        }, 1000);
    });
});
