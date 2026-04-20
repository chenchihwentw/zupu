const sqlite3 = require('sqlite3').verbose();

// 測試兩套查詢邏輯是否一致
const db = new sqlite3.Database('family.db');

const targetFamilyId = 'chen_family';

console.log('\n=== 驗證兩套查詢邏輯是否一致 ===\n');

// 模擬 /api/my-family-tree 的查詢（include_related=true）
const myFamilyTreeSQL = `
    SELECT DISTINCT m.* FROM members m
    WHERE m.id IN (
        -- 1. 原生家族成員（使用 json_each 對 families 進行精確查詢）
        SELECT id FROM members 
        WHERE family_tree_id = ?
           OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
        UNION
        -- 2. 他們的配偶（可能在其他家族）
        SELECT DISTINCT json_each.value as spouse_id
        FROM members, json_each(members.spouses)
        WHERE members.family_tree_id = ?
           OR EXISTS (SELECT 1 FROM json_each(members.families) WHERE value = ?)
        UNION
        -- 3. 他們的父母（可能在其他家族）
        SELECT DISTINCT json_each.value as parent_id
        FROM members base, json_each(base.parents)
        WHERE base.family_tree_id = ?
           OR EXISTS (SELECT 1 FROM json_each(base.families) WHERE value = ?)
        UNION
        -- 4. 他們的子女（通過父母欄位反向查找，可能在其他家族）
        SELECT DISTINCT target.id
        FROM members target, json_each(target.parents)
        WHERE json_each.value IN (
            SELECT id FROM members 
            WHERE family_tree_id = ?
               OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
        )
    )
`;

const myFamilyParams = [targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, 
                        targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId];

// 模擬 /api/family 的查詢（include_related=true）
const apiFamilySQL = `
    SELECT DISTINCT m.* FROM members m
    WHERE m.id IN (
        -- 1. 目標家族的所有成員（使用 json_each 對 families 進行精確查詢）
        SELECT id FROM members
        WHERE family_tree_id = ? 
           OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
        UNION
        -- 2. 目標家族成員的配偶（可能在其他家族）
        SELECT DISTINCT json_each.value as spouse_id
        FROM members, json_each(members.spouses)
        WHERE members.family_tree_id = ? 
           OR EXISTS (SELECT 1 FROM json_each(members.families) WHERE value = ?)
        UNION
        -- 3. 目標家族成員的父母（可能在其他家族）
        SELECT DISTINCT json_each.value as parent_id
        FROM members base, json_each(base.parents)
        WHERE base.family_tree_id = ? 
           OR EXISTS (SELECT 1 FROM json_each(base.families) WHERE value = ?)
        UNION
        -- 4. 目標家族成員的子女（通過父母欄位反向查找，可能在其他家族）
        SELECT DISTINCT target.id
        FROM members target, json_each(target.parents)
        WHERE json_each.value IN (
            SELECT id FROM members 
            WHERE family_tree_id = ?
               OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
        )
    )
`;

const apiFamilyParams = [targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, 
                         targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId];

let results1, results2;
let done = 0;

db.all(myFamilyTreeSQL, myFamilyParams, (err, rows) => {
    if (err) {
        console.error('myFamilyTree 查詢錯誤:', err);
        results1 = [];
    } else {
        results1 = rows;
        console.log(`✓ /api/my-family-tree 返回 ${rows.length} 個成員`);
    }
    done++;
    if (done === 2) compare();
});

db.all(apiFamilySQL, apiFamilyParams, (err, rows) => {
    if (err) {
        console.error('/api/family 查詢錯誤:', err);
        results2 = [];
    } else {
        results2 = rows;
        console.log(`✓ /api/family 返回 ${rows.length} 個成員`);
    }
    done++;
    if (done === 2) compare();
});

function compare() {
    console.log('\n=== 對比結果 ===\n');
    
    if (results1.length === results2.length) {
        console.log(`✓ 返回成員數一致：${results1.length} 個`);
    } else {
        console.log(`✗ 成員數不一致：myFamilyTree=${results1.length}, apiFamily=${results2.length}`);
    }
    
    // 對比關鍵成員
    const keyMembers = ['b112', 'b111', 'b1111', '1774440326499', 'b132', 'b1211'];
    console.log('\n=== 關鍵成員檢查 ===\n');
    
    keyMembers.forEach(memberId => {
        const inResults1 = results1.some(m => m.id === memberId);
        const inResults2 = results2.some(m => m.id === memberId);
        
        if (inResults1 && inResults2) {
            console.log(`✓ ${memberId} - 在兩個查詢中都被查詢到`);
        } else if (inResults1 && !inResults2) {
            console.log(`✗ ${memberId} - 只在 /api/my-family-tree 中被查詢到`);
        } else if (!inResults1 && inResults2) {
            console.log(`✗ ${memberId} - 只在 /api/family 中被查詢到`);
        } else {
            console.log(`✗ ${memberId} - 在兩個查詢中都未被查詢到`);
        }
    });
    
    console.log('\n=== 配偶查詢驗證 ===\n');
    
    // 檢查陳致真 (b111) 及其配偶陳進陽 (b112)
    const chenZhiZhen = results1.find(m => m.id === 'b111');
    if (chenZhiZhen) {
        const spouse = JSON.parse(chenZhiZhen.spouses || '[]')[0];
        if (spouse && results1.some(m => m.id === spouse)) {
            console.log(`✓ 陳致真的配偶 ${spouse} 在 /api/my-family-tree 結果中`);
        } else {
            console.log(`✗ 陳致真的配偶在 /api/my-family-tree 結果中缺失`);
        }
    }
    
    // 檢查孫亞男 (b132) 及其配偶
    const sunYaNan = results1.find(m => m.id === 'b132');
    if (sunYaNan) {
        const spouses = JSON.parse(sunYaNan.spouses || '[]');
        console.log(`✓ 孫亞男的配偶: ${spouses.join(', ')}`);
        spouses.forEach(spouseId => {
            if (results1.some(m => m.id === spouseId)) {
                console.log(`  ✓ 配偶 ${spouseId} 在 /api/my-family-tree 結果中`);
            } else {
                console.log(`  ✗ 配偶 ${spouseId} 在 /api/my-family-tree 結果中缺失`);
            }
        });
    }
    
    console.log('\n=== 診斷完成 ===\n');
    console.log('如果所有成員和配偶都在兩個查詢中一致被查詢到，說明問題已修復。\n');
    
    db.close();
    process.exit(0);
}
