const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'family.db');
const db = new sqlite3.Database(dbPath);

console.log('開始恢復配偶關係數據...\n');

db.serialize(() => {
    // 從 members 表的 spouses 字段恢復到 member_spouses 表
    db.all("SELECT id, name, spouses FROM members WHERE spouses IS NOT NULL AND spouses != '' AND spouses != '[]'", [], (err, rows) => {
        if (err) {
            console.error('查詢失敗:', err);
            db.close();
            return;
        }
        
        let insertCount = 0;
        let skipCount = 0;
        
        rows.forEach(member => {
            try {
                const spouses = JSON.parse(member.spouses);
                if (Array.isArray(spouses)) {
                    spouses.forEach((spouseId, index) => {
                        // 跳過舊的/無效的配偶ID
                        if (spouseId.includes('_old')) {
                            console.log(`  跳過舊配偶: ${member.id} -> ${spouseId}`);
                            return;
                        }
                        
                        const msId = `ms_${member.id}_${spouseId}`;
                        
                        // 檢查是否已存在
                        db.get("SELECT id FROM member_spouses WHERE id = ? OR (member_id = ? AND spouse_member_id = ?)", 
                            [msId, member.id, spouseId], 
                            (err, existing) => {
                                if (err) {
                                    console.error(`檢查 ${msId} 失敗:`, err);
                                    return;
                                }
                                
                                if (!existing) {
                                    db.run(
                                        `INSERT INTO member_spouses (id, member_id, spouse_member_id, marriage_date, is_current, created_at) 
                                         VALUES (?, ?, ?, '1990-01-01', 1, datetime('now'))`,
                                        [msId, member.id, spouseId],
                                        function(err) {
                                            if (err) {
                                                console.error(`插入 ${msId} 失敗:`, err.message);
                                            } else {
                                                insertCount++;
                                                console.log(`  已恢復: ${member.name} (${member.id}) -> ${spouseId}`);
                                            }
                                        }
                                    );
                                } else {
                                    skipCount++;
                                }
                            }
                        );
                    });
                }
            } catch (e) {
                console.error(`解析 ${member.id} 的 spouses 失敗:`, e);
            }
        });
        
        setTimeout(() => {
            console.log(`\n共插入 ${insertCount} 條配偶記錄，跳過 ${skipCount} 條已存在記錄\n`);
            
            // 驗證結果
            console.log('驗證結果:');
            db.all("SELECT ms.*, m1.name as member_name, m2.name as spouse_name FROM member_spouses ms JOIN members m1 ON ms.member_id = m1.id JOIN members m2 ON ms.spouse_member_id = m2.id WHERE ms.member_id IN ('b11', 'b111', 'b121', 'b131')", [], (err, rows) => {
                if (err) {
                    console.error('驗證失敗:', err);
                } else {
                    rows.forEach(r => {
                        console.log(`  ${r.member_name} (${r.member_id}) <-> ${r.spouse_name} (${r.spouse_member_id})`);
                    });
                }
                db.close();
                console.log('\n配偶關係恢復完成！');
            });
        }, 2000);
    });
});
