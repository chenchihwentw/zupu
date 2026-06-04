const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('i:/proj/zupu/family-tree-app/family.db');

const columnsToAdd = [
    { name: 'province', type: 'TEXT' },
    { name: 'city', type: 'TEXT' },
    { name: 'wechat', type: 'TEXT' },
    { name: 'line', type: 'TEXT' },
    { name: 'phone2', type: 'TEXT' },
    { name: 'phone3', type: 'TEXT' }
];

db.serialize(() => {
    columnsToAdd.forEach(col => {
        db.run(`ALTER TABLE members ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log(`Column ${col.name} already exists.`);
                } else {
                    console.error(`Error adding column ${col.name}:`, err.message);
                }
            } else {
                console.log(`Successfully added column ${col.name}.`);
            }
        });
    });
});

db.close();
