const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// ==========================================
// 🚀 請在這裡填寫您的 Railway 資訊
// ==========================================
const RAILWAY_URL = 'https://zupu.up.railway.app'; // 結尾不要有斜線
const MIGRATION_SECRET = 'familia_migrate_2026'; // 這必須與您在 Railway 設定的環境變數一致
// ==========================================

async function migrateData() {
    console.log('開始打包本地資料...');
    
    // 1. 打包 uploads 資料夾
    const uploadsPath = path.join(__dirname, 'uploads');
    const zipPath = path.join(__dirname, 'uploads_temp.zip');
    
    if (fs.existsSync(uploadsPath)) {
        console.log('正在壓縮照片檔案...');
        const zip = new AdmZip();
        zip.addLocalFolder(uploadsPath);
        zip.writeZip(zipPath);
        console.log('照片壓縮完成！');
    } else {
        console.log('找不到 uploads 資料夾，將略過照片上傳。');
    }

    // 2. 準備上傳
    const dbPath = path.join(__dirname, 'family.db');
    if (!fs.existsSync(dbPath)) {
        console.error('找不到 family.db！請確認您是在 family-tree-app 資料夾下執行此腳本。');
        return;
    }

    console.log(`\n準備將資料上傳至：${RAILWAY_URL}`);
    console.log('正在上傳中，請稍候（如果照片很多可能會需要幾分鐘）...');

    try {
        // 使用原生 fetch (Node 18+) 和 FormData
        const formData = new FormData();
        
        // 加入資料庫檔案
        const dbBuffer = fs.readFileSync(dbPath);
        formData.append('db', new Blob([dbBuffer]), 'family.db');
        
        // 加入照片壓縮檔
        if (fs.existsSync(zipPath)) {
            const zipBuffer = fs.readFileSync(zipPath);
            formData.append('uploadsZip', new Blob([zipBuffer]), 'uploads.zip');
        }

        const response = await fetch(`${RAILWAY_URL}/api/admin/migrate-data`, {
            method: 'POST',
            headers: {
                'x-migration-secret': MIGRATION_SECRET
            },
            body: formData
        });

        const result = await response.json();
        
        if (response.ok) {
            console.log('\n✅ 恭喜！資料轉移成功！');
            console.log('伺服器回報：', JSON.stringify(result, null, 2));
            console.log('\n現在請等待約 30 秒讓 Railway 重新啟動服務，然後您就可以使用原本的帳號登入雲端版了！');
        } else {
            console.error('\n❌ 上傳失敗！');
            console.error('伺服器錯誤：', result.error || result);
            console.error('請確認您的 MIGRATION_SECRET 環境變數是否有設定正確。');
        }

    } catch (error) {
        console.error('\n❌ 網路或執行錯誤：', error.message);
    } finally {
        // 清理暫存檔
        if (fs.existsSync(zipPath)) {
            fs.unlinkSync(zipPath);
            console.log('\n已清理暫存壓縮檔。');
        }
    }
}

migrateData();
