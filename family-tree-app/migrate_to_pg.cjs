const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

const dbPath = './family.db';
const pgUrl = process.env.DATABASE_URL;

if (!pgUrl) {
    console.error("請設定 DATABASE_URL 環境變數 (例如: set DATABASE_URL=postgres://user:pass@host/db)");
    process.exit(1);
}

const sqliteDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);
const pgPool = new Pool({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false }
});

sqliteDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", async (err, tables) => {
    if (err) {
        console.error("無法讀取 SQLite tables:", err);
        process.exit(1);
    }
    
    for (const tableObj of tables) {
        const tableName = tableObj.name;
        console.log(`開始轉移資料表: ${tableName}`);
        
        await new Promise((resolve, reject) => {
            sqliteDb.all(`SELECT * FROM ${tableName}`, async (err, rows) => {
                if (err) return reject(err);
                if (rows.length === 0) {
                    console.log(`資料表 ${tableName} 為空，略過。`);
                    return resolve();
                }
                
                try {
                    let successCount = 0;
                    for (const row of rows) {
                        const keys = Object.keys(row);
                        const values = Object.values(row);
                        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                        
                        // 使用 ON CONFLICT 避免重複轉移時報錯
                        // 注意：假設所有 table 都有 id 這個 Primary Key
                        const query = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;
                        
                        await pgPool.query(query, values);
                        successCount++;
                    }
                    console.log(`✅ 成功轉移 ${successCount} 筆資料至 ${tableName}`);
                    
                    // 重置 SERIAL 欄位的 Sequence，確保後續新增資料 ID 不會衝突
                    if (tableName === 'biographies' || tableName === 'audit_logs') {
                        const maxRes = await pgPool.query(`SELECT MAX(id) as maxid FROM ${tableName}`);
                        const maxId = maxRes.rows[0].maxid || 0;
                        await pgPool.query(`SELECT setval('${tableName}_id_seq', ${maxId > 0 ? maxId : 1})`);
                        console.log(`✅ 已重置 ${tableName} 的 ID 序列 (Sequence)`);
                    }
                    
                    resolve();
                } catch (e) {
                    console.error(`轉移 ${tableName} 時發生錯誤:`, e);
                    reject(e);
                }
            });
        });
    }
    
    console.log("\n🎉 資料庫轉移完成！");
    process.exit(0);
});
