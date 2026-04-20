const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve('i:/proj/zupu/family-tree-app/family.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting data migration...');

db.serialize(() => {
    // 1. 備份數據（可選，但安全）
    // db.run("CREATE TABLE members_backup_legacy AS SELECT * FROM members");

    // 2. 獲取所有成員
    db.all("SELECT id, family_id, family_tree_id, primaryFamily, families FROM members", [], (err, rows) => {
        if (err) {
            console.error('Error fetching members:', err.message);
            return;
        }

        console.log(`Processing ${rows.length} members...`);

        rows.forEach(row => {
            let needsUpdate = false;
            let newPrimaryFamily = row.primaryFamily;
            let newFamilies = JSON.parse(row.families || '[]');

            // 如果 primaryFamily 為空，從舊欄位繼承
            if (!newPrimaryFamily) {
                newPrimaryFamily = row.family_tree_id || row.family_id || 'chen_family';
                needsUpdate = true;
            }

            // 處理嵌套的 JSON 字串（有些數據可能被多次 stringify）
            let familiesData = row.families || '[]';
            let parsed = false;
            try {
                while (typeof familiesData === 'string') {
                    const next = JSON.parse(familiesData);
                    if (typeof next === 'string') {
                        familiesData = next;
                    } else {
                        newFamilies = next;
                        parsed = true;
                        break;
                    }
                }
            } catch (e) {
                console.warn(`Failed to parse families for ${row.id}:`, row.families);
                newFamilies = [];
            }

            // 確保 newFamilies 是數組
            if (!Array.isArray(newFamilies)) newFamilies = [];

            // 確保 newFamilies 首位與 newPrimaryFamily 一致
            if (newFamilies.length === 0) {
                newFamilies = [newPrimaryFamily];
                needsUpdate = true;
            } else if (newFamilies[0] !== newPrimaryFamily) {
                newFamilies = [newPrimaryFamily, ...newFamilies.filter(f => f !== newPrimaryFamily)];
                needsUpdate = true;
            }

            if (needsUpdate) {
                const familiesJson = JSON.stringify(newFamilies);
                db.run(
                    "UPDATE members SET primaryFamily = ?, families = ? WHERE id = ?",
                    [newPrimaryFamily, familiesJson, row.id],
                    (updateErr) => {
                        if (updateErr) console.error(`Error updating member ${row.id}:`, updateErr.message);
                    }
                );
            }
        });

        console.log('Migration logic applied. Now cleaning up legacy columns...');
        
        // 注意：SQLite 不支持直接 DROP COLUMN (在舊版本中)，
        // 但我們這裡的做法是透過代碼邏輯「廢除」它們。
        // 我們可以將 legacy 欄位設為 NULL 以節省空間並避免干擾。
        db.run("UPDATE members SET family_id = NULL, family_tree_id = NULL", (err) => {
            if (err) {
                console.error('Error clearing legacy columns:', err.message);
            } else {
                console.log('Legacy columns cleared successfully.');
            }
            db.close();
        });
    });
});
