const sqlite3 = require('sqlite3').verbose();

// 測試改進後的 json_each 查詢邏輯
const db = new sqlite3.Database('family.db');

const targetFamilyId = 'chen_family';

// 複製 server.cjs 中的改進後查詢邏輯
const sql = `
    SELECT * FROM members 
    WHERE family_tree_id = ? 
       OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
`;

db.all(sql, [targetFamilyId, targetFamilyId], (err, rows) => {
    if (err) {
        console.error('查詢錯誤:', err);
        db.close();
        return;
    }

    console.log(`\n✓ json_each 查詢返回 ${rows.length} 個成員\n`);

    const keyMembers = {
        'b112': '陳進陽 (父親)',
        'b111': '陳致真 (母親)',
        'b1111': '陳昱升 (子女)',
        '1774440326499': '林之雯 (配偶)'
    };

    console.log('=== 關鍵成員檢查 ===\n');

    Object.entries(keyMembers).forEach(([id, description]) => {
        const member = rows.find(m => m.id === id);
        if (member) {
            console.log(`✓ ${description}`);
            console.log(`  - family_tree_id: ${member.family_tree_id}`);
            console.log(`  - families: ${member.families}`);
            console.log(`  - parents: ${member.parents}`);
            if (member.spouses) {
                console.log(`  - spouses: ${member.spouses}\n`);
            }
        } else {
            console.log(`✗ ${description} - 未被查詢到 ❌\n`);
        }
    });

    console.log('=== 樹構建完整性檢查 ===\n');

    const child = rows.find(m => m.id === 'b1111');
    if (child) {
        const parents = JSON.parse(child.parents || '[]');
        console.log(`陳昱升的父母: ${parents.join(', ')}`);
        
        parents.forEach(parentId => {
            const parent = rows.find(m => m.id === parentId);
            if (parent) {
                console.log(`  ✓ ${parent.name} (${parentId}) - 被查詢到`);
            } else {
                console.log(`  ✗ ${parentId} - 未被查詢到 ❌`);
            }
        });
    }

    console.log('\n=== 林之雯的位置檢查 ===\n');
    
    const linZhiWen = rows.find(m => m.id === '1774440326499');
    if (linZhiWen) {
        console.log(`林之雯 (1774440326499)`);
        console.log(`  - family_tree_id: ${linZhiWen.family_tree_id}`);
        console.log(`  - families: ${linZhiWen.families}`);
        console.log(`  - parents: ${linZhiWen.parents || '[]'}`);
        
        const parents = JSON.parse(linZhiWen.parents || '[]');
        if (parents.length === 0) {
            console.log(`  ✓ 正確：沒有父母記錄（嫁入成員）\n`);
        }
    }

    db.close();
    process.exit(0);
});
