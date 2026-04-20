const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./family.db');

db.serialize(() => {
    console.log("Checking member a1:");
    db.get("SELECT * FROM members WHERE id = 'a1'", (err, row) => {
        if (err) console.error(err);
        else console.log(row);
    });

    console.log("\nChecking member b01:");
    db.get("SELECT * FROM members WHERE id = 'b01'", (err, row) => {
        if (err) console.error(err);
        else console.log(row);
    });
});

db.close();
