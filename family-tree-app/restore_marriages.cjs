const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'family.db');
const db = new sqlite3.Database(dbPath);

console.log('開始恢復 marriages 表數據...\n');

db.serialize(() => {
    // 從 members 表的 spouses 字段恢復到 marriages 表
    db.all("SELECT id, name, gender, spouses FROM members WHERE spouses IS NOT NULL AND spouses != '' AND spouses != '[]'", [], (err, rows) => {
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
                        
                        // 確定丈夫和妻子的ID
                        let husbandId, wifeId;
                        if (member.gender === 'male') {
                            husbandId = member.id;
                            wifeId = spouseId;
                        } else {
                            // 如果是女性，跳過（因為會在男性的記錄中處理）
                            return;
                        }
                        
                        const marriageId = `m_${husbandId}_${wifeId}`;
                        
                        // 檢查是否已存在
                        db.get("SELECT id FROM marriages WHERE id = ? OR (husband_id = ? AND wife_id = ?)", 
                            [marriageId, husbandId, wifeId], 
                            (err, existing) => {
                                if (err) {
                                    console.error(`檢查 ${marriageId} 失敗:`, err);
                                    return;
                                }
                                
                                if (!existing) {
                                    db.run(
                                        `INSERT INTO marriages (id, husband_id, wife_id, marriage_date, is_divorced, notes) 
                                         VALUES (?, ?, ?, '1990-01-01', 0, '')`,
                                        [marriageId, husbandId, wifeId],
                                        function(err) {
                                            if (err) {
                                                console.error(`插入 ${marriageId} 失敗:`, err.message);
                                            } else {
                                                insertCount++;
                                                console.log(`  已恢復: ${member.name} (${husbandId}) <-> ${wifeId}`);
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
            console.log(`\n共插入 ${insertCount} 條婚姻記錄，跳過 ${skipCount} 條已存在記錄\n`);
            
            // 驗證結果
            console.log('驗證結果:');
            db.all("SELECT m.*, h.name as husband_name, w.name as wife_name FROM marriages m JOIN members h ON m.husband_id = h.id JOIN members w ON m.wife_id = w.id WHERE m.husband_id IN ('b11', 'b111', 'b121', 'b131', 'b01', 'b31')", [], (err, rows) => {
                if (err) {
                    console.error('驗證失敗:', err);
                } else {
                    rows.forEach(r => {
                        console.log(`  ${r.husband_name} (${r.husband_id}) <-> ${r.wife_name} (${r.wife_id})`);
                    });
                }
                db.close();
                console.log('\n婚姻記錄恢復完成！');
            });
        }, 2000);
    });
});
