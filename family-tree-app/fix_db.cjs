const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('I:/proj/zupu/family-tree-app/family.db');

db.serialize(() => {
  // Keep only chen_family and the true 李_family_1775525022539
  db.run("DELETE FROM user_family_trees WHERE user_id = 'user_1774836473807' AND family_tree_id NOT IN ('chen_family', '李_family_1775525022539')", (err) => {
    if (err) console.error("Error deleting:", err);
    else console.log("Deleted corrupted records.");
  });

  db.all("SELECT * FROM user_family_trees WHERE user_id = 'user_1774836473807'", (err, rows) => {
    console.log("Current user_family_trees for user:", rows);
  });
});
