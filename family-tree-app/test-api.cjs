const sqlite3 = require('sqlite3').verbose();

// Test the full query logic used in /api/family endpoint
const db = new sqlite3.Database('family.db');

const targetFamilyId = 'chen_family';
const familyLike = `%"${targetFamilyId}"%`;

// Replicate the exact query from server.cjs
const sql = "SELECT * FROM members WHERE family_tree_id = ? OR families LIKE ?";
const params = [targetFamilyId, familyLike];

db.all(sql, params, (err, rows) => {
    if (err) {
        console.error('Error:', err);
        db.close();
        return;
    }

    // Parse like the server does
    const members = rows.map(row => ({
        ...row,
        spouses: JSON.parse(row.spouses || "[]"),
        children: JSON.parse(row.children || "[]"),
        parents: JSON.parse(row.parents || "[]"),
        aliases: JSON.parse(row.aliases || "[]"),
        achievements: JSON.parse(row.achievements || "[]"),
        is_deceased: !!row.is_deceased,
        email: row.email || null,
        avatar_url: row.avatar_url || null,
        has_biography: !!row.biography_md,
        tags: JSON.parse(row.biography_tags || '[]'),
        family_id: row.family_id || 'chen_family',
        primaryFamily: row.primaryFamily || 'chen_family',
        families: JSON.parse(row.families || '["chen_family"]')
    }));

    console.log(`\n✓ Query returned ${members.length} members for ${targetFamilyId}\n`);
    console.log('=== 關鍵成員檢查 ===\n');

    const keyMembers = {
        'b112': '陳進陽 (父親)',
        'b111': '陳致真 (母親)',
        'b1111': '陳昱升 (子女)'
    };

    Object.entries(keyMembers).forEach(([id, name]) => {
        const member = members.find(m => m.id === id);
        if (member) {
            console.log(`✓ ${name} - 被查詢到`);
            console.log(`  family_tree_id: ${member.family_tree_id}`);
            console.log(`  families: ${JSON.stringify(member.families)}`);
            console.log(`  parents: ${JSON.stringify(member.parents)}`);
            console.log(`  spouses: ${JSON.stringify(member.spouses)}`);
        } else {
            console.log(`✗ ${name} (${id}) - 未被查詢到 ❌`);
        }
    });

    console.log('\n=== 樹構建完整性檢查 ===\n');
    
    const child = members.find(m => m.id === 'b1111');
    if (child) {
        console.log(`陳昱升 (b1111) 的父母: ${child.parents.join(', ')}`);
        child.parents.forEach(parentId => {
            const parent = members.find(m => m.id === parentId);
            if (parent) {
                console.log(`  ✓ ${parent.name} (${parentId}) - 在查詢結果中`);
            } else {
                console.log(`  ✗ ${parentId} - 未在查詢結果中 ❌`);
            }
        });
    }

    db.close();
    process.exit(0);
});
