const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../family.db');
const db = new sqlite3.Database(dbPath);

console.log('--- 🛡️ Starting Data Repair Script ---');

function recursiveParse(data) {
    if (typeof data !== 'string') return data;
    try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'string') {
            return recursiveParse(parsed);
        }
        return parsed;
    } catch (e) {
        return data; // Not JSON or already broken
    }
}

db.serialize(() => {
    // 1. Repair members table (achievements, aliases, etc.)
    db.all("SELECT id, name, achievements, aliases, biography_tags FROM members", (err, rows) => {
        if (err) {
            console.error('Error fetching members:', err);
            return;
        }

        console.log(`Processing ${rows.length} members...`);
        rows.forEach(row => {
            const cleanAchievements = JSON.stringify(recursiveParse(row.achievements) || []);
            const cleanAliases = JSON.stringify(recursiveParse(row.aliases) || []);
            const cleanBioTags = JSON.stringify(recursiveParse(row.biography_tags) || []);

            // Identify if fix is needed
            const needsFix = 
                cleanAchievements !== row.achievements || 
                cleanAliases !== row.aliases || 
                cleanBioTags !== row.biography_tags;

            if (needsFix) {
                console.log(`[FIX] Repairing data for member: ${row.name} (${row.id})`);
                db.run(
                    "UPDATE members SET achievements = ?, aliases = ?, biography_tags = ? WHERE id = ?",
                    [cleanAchievements, cleanAliases, cleanBioTags, row.id]
                );
            }
        });
    });

    // 2. Repair biographies table (tags)
    db.all("SELECT id, member_id, tags FROM biographies", (err, rows) => {
        if (err) {
            console.error('Error fetching biographies:', err);
            return;
        }

        console.log(`Processing ${rows.length} biography versions...`);
        rows.forEach(row => {
            const cleanTags = JSON.stringify(recursiveParse(row.tags) || []);
            
            if (cleanTags !== row.tags) {
                console.log(`[FIX] Repairing tags for biography version: ${row.id} (Member: ${row.member_id})`);
                db.run(
                    "UPDATE biographies SET tags = ? WHERE id = ?",
                    [cleanTags, row.id]
                );
            }
        });
    });
});

// Final summary will be hard to show due to async nature of sqlite3 without wrappers, 
// but the logs should suffice.
// Wait a bit then close
setTimeout(() => {
    console.log('--- ✅ Data Repair Completed ---');
    db.close();
}, 5000);
