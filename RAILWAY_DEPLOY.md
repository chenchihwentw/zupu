# Railway 部署指南

## 📋 部署前準備

### 1. 註冊 Railway
- 訪問 https://railway.app
- 使用 GitHub 帳號登錄

### 2. 準備工作
- 確保代碼已推送到 GitHub
- 準備好 Railway 帳戶（新用戶有 $5 免費額度）

---

## 🚀 部署步驟

### 第一步：創建新專案

1. 登入 Railway Dashboard
2. 點擊 **"New Project"**
3. 選擇 **"Deploy from GitHub repo"**
4. 選擇您的倉庫：`zupu`

### 第二步：配置環境變數

在 Railway Dashboard 的 **Variables** 標籤頁添加：

```bash
NODE_ENV=production
PORT=3001
```

### 第三步：掛載 Volume（關鍵步驟！）

這是確保 SQLite 數據不丟失的關鍵：

1. 在專案頁面，點擊 **"New"** → **"Volume"**
2. 配置 Volume：
   - **Mount Path**: `/app/data`
   - **Size**: `1 GB` (約 $0.15/月)
3. 點擊 **"Add Volume"**

### 第四步：等待自動部署

Railway 會自動執行 Procfile 中的命令：
```bash
cd family-tree-app && npm install && npm run build && node ../server.cjs
```

部署過程：
1. ✅ 安裝前端依賴
2. ✅ 構建 Vite 應用（生成 dist/ 目錄）
3. ✅ 啟動後端服務器

### 第五步：檢查日誌

在 Railway Dashboard 查看 **Deployments** 標籤：
- 確認沒有錯誤
- 看到 "Server running on port XXXX" 訊息

### 第六步：訪問應用

- Railway 會自動生成一個公開 URL：`https://your-app.up.railway.app`
- 點擊該 URL 訪問您的家譜應用

---

## 💰 費用估算

| 項目 | 用量 | 月費用 |
|------|------|--------|
| Execution (CPU/RAM) | 基礎配置 | ~$3-5 |
| Persistent Volume | 1GB SSD | ~$0.15 |
| Network Egress | 少量傳輸 | ~$0.05 |
| **總計** | | **~$3.2-5.2** |

> 💡 Railway 提供 $5 免費額度，個人使用可能幾乎不需要付費！

---

## 🔧 後續維護

### 更新代碼

每次推送到 GitHub 後，Railway 會自動重新部署：
```bash
git add .
git commit -m "your changes"
git push origin main
```

### 查看監控

在 Railway Dashboard 可以查看：
- CPU 和記憶體使用情況
- 網路流量
- 日誌記錄

### 資料庫備份

建議定期備份 SQLite 資料庫：

1. SSH 連接到 Railway 實例（需要進階配置）
2. 或使用 Railway CLI：
```bash
railway ssh
cp /app/data/family.db ./backup-$(date +%Y%m%d).db
```

---

## ⚠️ 注意事項

### 1. Volume 必須正確掛載
- 如果沒有掛載 Volume，重啟後數據會丟失
- 確認 Mount Path 是 `/app/data`

### 2. 文件大小限制
- 上傳文件限制：50MB
- 資料庫大小建議控制在 1GB 以內

### 3. 冷啟動問題
- Railway 免費層級可能有冷啟動延遲
- 第一次訪問可能需要 10-30 秒啟動時間

### 4. 升級方案
如果用戶量增長，考慮：
- 增加 Volume 容量
- 升級 Railway 計劃（Hobby → Pro）
- 或遷移到 PostgreSQL

---

## 🆘 故障排除

### 問題：部署失敗
**解決方案：**
1. 檢查 Railway Daylog 中的錯誤訊息
2. 確認 Procfile 格式正確
3. 驗證 package.json 依賴完整

### 問題：無法訪問網站
**解決方案：**
1. 確認 PORT 環境變數已設置
2. 檢查健康檢查端點：`/api/health`
3. 查看日誌確認服務正常運行

### 問題：數據丟失
**解決方案：**
1. 確認 Volume 已正確掛載到 `/app/data`
2. 檢查代碼中資料庫路徑是否正確
3. 從備份恢復數據

---

## 📞 技術支持

- Railway 文檔：https://docs.railway.app
- Railway Discord 社區
- 項目 Issues 頁面

---

## ✨ 下一步優化

當應用穩定運行後，可以考慮：

1. **添加自定義域名**
   - 在 Railway Dashboard 配置 Domain
   
2. **性能優化**
   - 添加 Redis 緩存
   - 使用 CDN 加速靜態資源

3. **功能增強**
   - 實現用戶認證系統
   - 添加協作編輯功能
   - 集成 AI 人臉識別

祝您部署順利！🎉
