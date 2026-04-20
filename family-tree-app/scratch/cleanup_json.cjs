const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = 'i:/proj/zupu/family-tree-app/family.db';

const db = new sqlite3.Database(dbPath);

function deepParse(data) {
    if (typeof data !== 'string') return data;
    try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'string') {
            return deepParse(parsed);
        }
        if (Array.isArray(parsed)) {
            return parsed.map(item => deepParse(item)).flat();
        }
        return parsed;
    } catch (e) {
        return data;
    }
}

db.serialize(() => {
    db.all("SELECT id, name, families, children, parents, spouses FROM members", [], (err, rows) => {
        if (err) {
            console.error(err);
            return;
        }

        rows.forEach(row => {
            const fields = ['families', 'children', 'parents', 'spouses'];
            let needsUpdate = false;
            const updates = {};

            fields.forEach(field => {
                const original = row[field];
                if (!original) return;

                const parsed = deepParse(original);
                // Ensure it's a flat array of strings, no duplicates, no nulls
                const cleaned = Array.from(new Set(
                    (Array.isArray(parsed) ? parsed : [parsed])
                    .filter(item => typeof item === 'string' && item.length > 0)
                ));

                const finalStr = JSON.stringify(cleaned);
                if (finalStr !== original) {
                    updates[field] = finalStr;
                    needsUpdate = true;
                }
            });

            if (needsUpdate) {
                console.log(`Cleaning member ${row.id} (${row.name})...`);
                const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
                const params = [...Object.values(updates), row.id];
                db.run(`UPDATE members SET ${setClause} WHERE id = ?`, params);
            }
        });

        console.log("Cleanup job submitted.");
    });
});
