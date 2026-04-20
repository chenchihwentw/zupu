const sqlite3 = require('sqlite3');

const db = new sqlite3.Database('./family.db');

// 創建一個測試邀請碼（綁定陳致彣 b131）
const timestamp = Date.now();
const random = Math.random().toString(36).substring(2, 8).toUpperCase();
const invite_code = `CHEN_${timestamp}_${random}`;
const id = `invite_${timestamp}`;

const sql = `
    INSERT INTO invitations (id, invite_code, creator_id, family_tree_id, target_member_id, default_role, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
`;

const params = [
    id,
    invite_code,
    'system', // 系統創建
    'chen_family',
    'b131', // 陳致彣
    'family_admin',
    new Date().toISOString(),
    new Date().toISOString()
];

db.run(sql, params, function(err) {
    if (err) {
        console.error('Error:', err.message);
    } else {
        console.log('✓ 測試邀請碼已創建！');
        console.log('');
        console.log('邀請碼:', invite_code);
        console.log('');
        console.log('註冊連結:');
        console.log(`http://localhost:5174/register?invite=${invite_code}`);
        console.log('');
        console.log('綁定成員：陳致彣 (b131)');
        console.log('預設角色：家族管理員');
    }
    db.close();
});
