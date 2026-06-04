const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('I:/proj/zupu/family-tree-app/family.db');
const familyTreeId = 'chen_family';
db.get("SELECT SUM(CAST(json_extract(metadata, '$.size') AS INTEGER)) as treeUsed FROM media WHERE family_tree_id = ?", [familyTreeId], (err, usage) => {
    console.log('Error:', err);
    console.log('Usage:', usage);
    db.close();
});
