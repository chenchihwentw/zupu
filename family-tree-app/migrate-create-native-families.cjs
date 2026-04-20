/**
 * 為嫁入成員創建原生家族
 * 根據用戶指導：為沒有父母記錄但有配偶的成員創建原生家族
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'family.db');
const db = new sqlite3.Database(dbPath);

async function migrateCreateNativeFamilies() {
    console.log('開始為嫁入成員創建原生家族...');
    console.log('='.repeat(50));
    
    try {
        // 1. 找出所有沒有父母記錄但有配偶的成員
        const members = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM members WHERE (parents = '[]' OR parents IS NULL) AND spouses IS NOT NULL AND spouses != '[]'", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`發現 ${members.length} 位成員需要創建原生家族...`);
        console.log('');
        
        // 2. 創建成員映射，方便查找
        const allMembers = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM members", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const memberMap = new Map();
        allMembers.forEach(m => memberMap.set(m.id, m));
        
        // 3. 為每個成員創建原生家族
        for (const member of members) {
            const surname = member.name.charAt(0);
            const newFamilyId = `family_${surname}_${member.id}`;
            const familyName = `${surname}氏家族`;
            
            console.log(`[處理中] ${member.name} (${member.id}) - 姓氏: ${surname}`);
            
            // 3.1 在 families_registry 創建家族
            await new Promise((resolve, reject) => {
                db.run(
                    "INSERT OR IGNORE INTO families_registry (family_uid, name, surname, root_id, created_at) VALUES (?, ?, ?, ?, ?)",
                    [newFamilyId, familyName, surname, member.id, new Date().toISOString()],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            // 3.2 更新成員的原生家族
            const currentFamilies = JSON.parse(member.families || '[]');
            if (!currentFamilies.includes(newFamilyId)) {
                currentFamilies.push(newFamilyId);
            }
            
            await new Promise((resolve, reject) => {
                db.run(
                    "UPDATE members SET family_tree_id = ?, families = ? WHERE id = ?",
                    [newFamilyId, JSON.stringify(currentFamilies), member.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            console.log(`  ✓ 創建家族: ${newFamilyId}`);
            console.log(`  ✓ 更新 families: ${JSON.stringify(currentFamilies)}`);
            
            // 3.3 讓子女繼承這個新家族
            // 查找所有父母數組中包含此成員ID的人
            for (const [childId, child] of memberMap) {
                const childParents = JSON.parse(child.parents || '[]');
                if (childParents.includes(member.id)) {
                    const childFamilies = JSON.parse(child.families || '[]');
                    if (!childFamilies.includes(newFamilyId)) {
                        childFamilies.push(newFamilyId);
                        
                        await new Promise((resolve, reject) => {
                            db.run(
                                "UPDATE members SET families = ? WHERE id = ?",
                                [JSON.stringify(childFamilies), childId],
                                (err) => {
                                    if (err) reject(err);
                                    else resolve();
                                }
                            );
                        });
                        
                        console.log(`  ✓ 子女 ${child.name || childId} 繼承家族: ${newFamilyId}`);
                    }
                }
            }
            
            console.log('');
        }
        
        console.log('='.repeat(50));
        console.log('遷移完成！');
        
    } catch (error) {
        console.error('遷移失敗:', error);
    } finally {
        db.close();
    }
}

migrateCreateNativeFamilies();
