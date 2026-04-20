$RAILWAY_URL = "https://web-production-6d0a0.up.railway.app"
$SECRET = "zupu2026"

# 切換目錄
Set-Location "i:\proj\zupu\family-tree-app"

# 壓縮照片
if (Test-Path "uploads") { 
    Write-Host "正在壓縮照片..." -ForegroundColor Cyan
    Compress-Archive -Path "uploads\*" -DestinationPath "uploads.zip" -Force 
}

# 檢查資料庫
if (-not (Test-Path "family.db")) { 
    Write-Host "錯誤：找不到 family.db" -ForegroundColor Red
    return 
}

# 上傳
Write-Host "正在傳送遷移請求至：$RAILWAY_URL" -ForegroundColor Green
$curlArgs = @("-X", "POST", "$RAILWAY_URL/api/admin/migrate-data", "-H", "x-migration-secret: $SECRET", "-F", "db=@family.db")
if (Test-Path "uploads.zip") { 
    $curlArgs += "-F"
    $curlArgs += "uploadsZip=@uploads.zip" 
}

curl.exe @curlArgs

Write-Host "`n操作完成！請去 Railway 點擊 Restart。" -ForegroundColor Yellow
