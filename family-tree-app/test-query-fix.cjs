const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('family.db');

// Test the modified query
const targetFamilyId = 'chen_family';
const familyLike = `%"${targetFamilyId}"%`;

const sql = `
    SELECT * FROM members 
    WHERE family_tree_id = ? OR families LIKE ? 
    ORDER BY id
`;

db.all(sql, [targetFamilyId, familyLike], (err, rows) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    console.log(`\n✓ Query returned ${rows.length} members for ${targetFamilyId}\n`);

    // Find specific members
    const members = {
        b112: null,  // 陳進陽
        b111: null,  // 陳致真
        b1111: null  // 陳昱升
    };

    rows.forEach(row => {
        if (members.hasOwnProperty(row.id)) {
            members[row.id] = row;
        }
    });

    // Display results
    console.log('=== 檢查關鍵成員是否被查詢到 ===\n');

    if (members.b112) {
        console.log('✓ 陳進陽 (b112) - 被查詢到！');
        console.log(`  family_tree_id: ${members.b112.family_tree_id}`);
        console.log(`  families: ${members.b112.families}`);
        console.log(`  parents: ${members.b112.parents}`);
        console.log(`  spouses: ${members.b112.spouses}\n`);
    } else {
        console.log('✗ 陳進陽 (b112) - 未被查詢到！\n');
    }

    if (members.b111) {
        console.log('✓ 陳致真 (b111) - 被查詢到！');
        console.log(`  family_tree_id: ${members.b111.family_tree_id}`);
        console.log(`  families: ${members.b111.families}`);
        console.log(`  parents: ${members.b111.parents}\n`);
    } else {
        console.log('✗ 陳致真 (b111) - 未被查詢到！\n');
    }

    if (members.b1111) {
        console.log('✓ 陳昱升 (b1111) - 被查詢到！');
        console.log(`  family_tree_id: ${members.b1111.family_tree_id}`);
        console.log(`  families: ${members.b1111.families}`);
        console.log(`  parents: ${members.b1111.parents}\n`);
    } else {
        console.log('✗ 陳昱升 (b1111) - 未被查詢到！\n');
    }

    // Check if parents are all present for the tree to render correctly
    console.log('=== 樹結構完整性檢查 ===\n');
    
    if (members.b1111) {
        const parentIds = JSON.parse(members.b1111.parents || '[]');
        console.log(`陳昱升的父母: ${parentIds.join(', ')}`);
        
        parentIds.forEach(parentId => {
            const parent = rows.find(r => r.id === parentId);
            if (parent) {
                console.log(`  ✓ ${parent.name} (${parentId}) - 被查詢到`);
            } else {
                console.log(`  ✗ ${parentId} - 未被查詢到 - 這是問題！`);
            }
        });
    }

    db.close();
    process.exit(0);
});
