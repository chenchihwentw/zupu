/**
 * 全面清理數據與同步欄位腳本
 * 1. 展平 families, parents, spouses 的 JSON 嵌套
 * 2. 清理無引號或格式錯誤的 JSON
 * 3. 根據性別同步 parents[0,1] 到 father_id 和 mother_id 欄位
 */
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '..', 'family.db'));

function fixArr(raw) {
    if (!raw) return [];
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch(e) {
        const match = raw.match(/^\[(.+)\]$/);
        if (match) {
            parsed = match[1].split(',').map(s => s.trim().replace(/"/g, ''));
        } else {
            return [];
        }
    }
    if (!Array.isArray(parsed)) return [];
    
    // 展平
    const flatSet = new Set();
    const flatten = (arr) => {
        arr.forEach(item => {
            if (typeof item !== 'string') return;
            if (item.startsWith('[') || item.startsWith('"')) {
                try {
                    const inner = JSON.parse(item);
                    if (Array.isArray(inner)) flatten(inner);
                    else if (typeof inner === 'string') flatSet.add(inner);
                } catch(e) { flatSet.add(item); }
            } else {
                flatSet.add(item);
            }
        });
    };
    flatten(parsed);
    return [...flatSet];
}

db.all('SELECT * FROM members', [], async (err, rows) => {
    if (err) { console.error(err); return; }
    
    const memberMap = new Map();
    rows.forEach(r => memberMap.set(r.id, r));

    const updates = [];
    
    for (const row of rows) {
        const parents = fixArr(row.parents);
        const families = fixArr(row.families);
        const spouses = fixArr(row.spouses);
        const children = fixArr(row.children);
        
        let father_id = row.father_id || '';
        let mother_id = row.mother_id || '';

        // 根據 parents 內容與 memberMap 性別自動補全 father_id / mother_id
        if (parents.length > 0) {
            parents.forEach(pid => {
                const p = memberMap.get(pid);
                if (p) {
                    if (p.gender === 'male') father_id = pid;
                    else if (p.gender === 'female') mother_id = pid;
                }
            });
            // 如果只有一個父母且性別不明，按位置猜測 (僅作後備)
            if (!father_id && !mother_id && parents.length > 0) {
                // 如果後端沒數據庫內沒這個人，暫不賦值
            }
        }

        const newParents = JSON.stringify(parents);
        const newFamilies = JSON.stringify(families);
        const newSpouses = JSON.stringify(spouses);
        const newChildren = JSON.stringify(children);

        const hasChange = 
            newParents !== row.parents || 
            newFamilies !== row.families ||
            newSpouses !== row.spouses ||
            newChildren !== row.children ||
            father_id !== (row.father_id || '') ||
            mother_id !== (row.mother_id || '');

        if (hasChange) {
            updates.push({
                id: row.id,
                parents: newParents,
                families: newFamilies,
                spouses: newSpouses,
                children: newChildren,
                father_id,
                mother_id
            });
        }
    }

    if (updates.length === 0) {
        console.log('✅ 所有數據已是最新，無需更新');
        db.close();
        return;
    }

    console.log(`即將更新 ${updates.length} 條記錄...`);
    let done = 0;
    
    for (const u of updates) {
        db.run(`UPDATE members SET 
            parents = ?, 
            families = ?, 
            spouses = ?, 
            children = ?, 
            father_id = ?, 
            mother_id = ? 
            WHERE id = ?`, 
            [u.parents, u.families, u.spouses, u.children, u.father_id, u.mother_id, u.id], 
            function(err) {
                if (err) console.error(`[ERR] ${u.id}:`, err.message);
                else console.log(`[OK] ${u.id} 已同步`);
                if (++done === updates.length) {
                    console.log('\n✅ 數據同步完成！');
                    db.close();
                }
            }
        );
    }
});
