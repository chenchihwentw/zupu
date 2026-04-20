const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'family.db');
const db = new sqlite3.Database(dbPath);

console.log('檢查缺失的婚姻記錄...\n');

const missingMarriages = [];

db.all("SELECT id, name, spouses FROM members WHERE gender='male' AND spouses IS NOT NULL AND spouses != '[]' AND spouses != ''", [], (err, rows) => {
    if (err) {
        console.error('查詢失敗:', err);
        db.close();
        return;
    }
    
    let totalChecks = 0;
    let completedChecks = 0;
    
    // 計算總檢查數
    rows.forEach(member => {
        try {
            const spouses = JSON.parse(member.spouses);
            if (Array.isArray(spouses)) {
                totalChecks += spouses.filter(s => !s.includes('_old')).length;
            }
        } catch (e) {}
    });
    
    if (totalChecks === 0) {
        console.log('沒有需要檢查的婚姻記錄');
        db.close();
        return;
    }
    
    rows.forEach(member => {
        try {
            const spouses = JSON.parse(member.spouses);
            if (Array.isArray(spouses)) {
                spouses.forEach(spouseId => {
                    if (spouseId.includes('_old')) {
                        completedChecks++;
                        return;
                    }
                    
                    db.get("SELECT id FROM marriages WHERE husband_id = ? AND wife_id = ?", 
                        [member.id, spouseId], 
                        (err, row) => {
                            if (err) {
                                console.error(`檢查 ${member.id} <-> ${spouseId} 失敗:`, err);
                            } else if (!row) {
                                missingMarriages.push({husband: member.id, wife: spouseId, name: member.name});
                            }
                            
                            completedChecks++;
                            if (completedChecks >= totalChecks) {
                                console.log('缺失的婚姻記錄:');
                                missingMarriages.forEach(m => {
                                    console.log(`  ${m.husband} (${m.name}) <-> ${m.wife}`);
                                });
                                console.log(`\n共 ${missingMarriages.length} 條缺失`);
                                db.close();
                            }
                        }
                    );
                });
            }
        } catch (e) {
            console.error(`解析 ${member.id} 的 spouses 失敗:`, e);
        }
    });
});
