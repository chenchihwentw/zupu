/**
 * Multi-Family Migration Script - 增強版三波掃描法
 * 多家族歸屬數據遷移腳本
 * 
 * 第一波：原生家庭歸位 (Initialize Native IDs)
 * 第二波：向上溯源與向下繼承 (Bloodline Inheritance)
 * 第三波：婚姻關聯補全 (Marriage Linkage)
 * 第四波：為缺失原生家族的成員創建家族
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'family.db');
const db = new sqlite3.Database(dbPath);

// 輔助函數：生成家族 ID
function generateFamilyId(member) {
    // 從成員 ID 生成家族 ID
    return `family_${member.id}_${Date.now()}`;
}

async function migrate() {
    console.log('開始多家族歸屬數據遷移（增強版三波掃描法）...');
    console.log('='.repeat(50));
    
    try {
        // ========== 第四波：為缺失原生家族的成員創建家族 ==========
        console.log('\n[第四波] 檢查需要創建原生家族的成員...');
        
        // 查找那些沒有記錄父母但在陳家中的成員（可能是姻親，需要手動處理）
        // 或者查找所有陳家成員，檢查她們的配偶家族
        const members = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM members', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const memberMap = new Map();
        members.forEach(m => memberMap.set(m.id, m));
        
        console.log(`總共 ${members.length} 個成員`);
        
        // ========== 第一波：原生家庭歸位 ==========
        console.log('\n[第一波] 確保每個成員的 families 包含原生家族...');
        
        for (const member of members) {
            const families = new Set();
            
            // 添加自己的 family_tree_id
            if (member.family_tree_id) {
                families.add(member.family_tree_id);
            }
            
            // 解析現有的 families
            if (member.families) {
                try {
                    const existing = JSON.parse(member.families);
                    if (Array.isArray(existing)) {
                        existing.forEach(f => families.add(f));
                    }
                } catch (e) {}
            }
            
            // ========== 第二波：向上溯源與向下繼承 ==========
            // 繼承父母的原生家族 ID（到祖父母級別）
            if (member.parents) {
                try {
                    const parents = JSON.parse(member.parents);
                    for (const parentId of parents) {
                        const parent = memberMap.get(parentId);
                        if (parent) {
                            // 添加父母的原生家族
                            if (parent.family_tree_id) {
                                families.add(parent.family_tree_id);
                            }
                            // 添加父母的 families（繼承祖父母級別）
                            if (parent.families) {
                                try {
                                    const parentFamilies = JSON.parse(parent.families);
                                    if (Array.isArray(parentFamilies)) {
                                        parentFamilies.forEach(f => families.add(f));
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                } catch (e) {}
            }
            
            // ========== 第三波：婚姻關聯補全 ==========
            // 關聯配偶的原生家族 ID（雙向添加）
            if (member.spouses) {
                try {
                    const spouses = JSON.parse(member.spouses);
                    for (const spouseId of spouses) {
                        const spouse = memberMap.get(spouseId);
                        if (spouse && spouse.family_tree_id) {
                            families.add(spouse.family_tree_id);
                        }
                    }
                } catch (e) {}
            }
            
            // 更新數據庫
            const finalFamilies = JSON.stringify(Array.from(families));
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE members SET families = ? WHERE id = ?',
                    [finalFamilies, member.id],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
            
            // 只打印有變化的成員
            if (member.families !== finalFamilies) {
                console.log(`✓ ${member.name || member.id}: ${finalFamilies}`);
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('數據遷移完成！');
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('遷移失敗:', error);
    } finally {
        db.close();
    }
}

migrate();
