<template>
  <view class="export-container">
    <view class="header">
      <text class="title">資料匯出中心</text>
      <text class="subtitle">將家族資料備份，或轉換為標準格式分享</text>
    </view>

    <view v-if="loading" class="loading-state">
      <text>讀取中...</text>
    </view>

    <view class="options-list" v-else>
      <!-- GEDCOM 匯出 -->
      <view class="option-card" @click="handleExportGEDCOM">
        <view class="icon-box bg-green">
          <text>🌍</text>
        </view>
        <view class="content">
          <text class="card-title">匯出 GEDCOM 檔案</text>
          <text class="card-desc">國際標準族譜格式，可匯入其他專業軟體。</text>
        </view>
        <text class="arrow">⬇️</text>
      </view>

      <!-- CSV 匯出 -->
      <view class="option-card" @click="handleExportCSV">
        <view class="icon-box bg-orange">
          <text>📊</text>
        </view>
        <view class="content">
          <text class="card-title">匯出人員名冊 (CSV)</text>
          <text class="card-desc">Excel 相容格式，方便過節聯絡、寄送賀卡。</text>
        </view>
        <text class="arrow">⬇️</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../../utils/request'

const family = ref([])
const loading = ref(true)

const fetchFamily = async () => {
  try {
    loading.value = true
    const res = await request.get('/my-family-tree')
    if (res && res.members) {
      family.value = res.members
    }
  } catch (error) {
    console.error('Failed to fetch family:', error)
    uni.showToast({ title: '讀取失敗', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const triggerDownload = (content, filename, type) => {
  // #ifdef H5
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  uni.showToast({ title: '開始下載', icon: 'success' })
  // #endif

  // #ifndef H5
  // 在 App/小程式環境，先將內容寫入暫存檔案，再呼叫分享或開啟
  const fs = uni.getFileSystemManager ? uni.getFileSystemManager() : null;
  if (fs) {
    const tempFilePath = `${wx.env.USER_DATA_PATH}/${filename}`;
    fs.writeFile({
      filePath: tempFilePath,
      data: content,
      encoding: 'utf8',
      success: () => {
        wx.shareFileMessage({
          filePath: tempFilePath,
          success() { uni.showToast({ title: '分享成功', icon: 'none' }) },
          fail(e) { console.error(e); uni.showToast({ title: '分享失敗', icon: 'none' }) }
        })
      },
      fail: (e) => {
        console.error(e);
        uni.showToast({ title: '檔案生成失敗', icon: 'none' })
      }
    });
  } else {
    // 降級處理：複製到剪貼簿 (如果檔案不大)
    uni.setClipboardData({
      data: content,
      success: () => {
        uni.showToast({ title: '內容已複製到剪貼簿', icon: 'none' })
      }
    })
  }
  // #endif
}

const handleExportCSV = () => {
  if (family.value.length === 0) return;
  
  const headers = ['ID', '姓名', '性別', '世代', '出生年', '逝世年', '聯絡電話'];
  const csvRows = [headers.join(',')];
  
  family.value.forEach(m => {
    const row = [
      m.id,
      `"${m.name || ''}"`,
      m.gender === 'male' ? '男' : (m.gender === 'female' ? '女' : ''),
      m.generation || '',
      m.birth_year || '',
      m.death_year || '',
      `"${m.phone || ''}"`
    ];
    csvRows.push(row.join(','));
  });

  const csvContent = "\uFEFF" + csvRows.join('\n');
  triggerDownload(csvContent, `familia_members_${new Date().getTime()}.csv`, 'text/csv;charset=utf-8;');
}

const handleExportGEDCOM = () => {
  if (family.value.length === 0) return;

  let gedcom = `0 HEAD\n1 SOUR Familia_App\n1 CHAR UTF-8\n`;
  family.value.forEach(m => {
    gedcom += `0 @${m.id}@ INDI\n`;
    const surname = m.surname || '';
    const givenName = m.given_name || m.name || '';
    gedcom += `1 NAME ${givenName} /${surname}/\n`;
    if (m.gender === 'male') gedcom += `1 SEX M\n`;
    else if (m.gender === 'female') gedcom += `1 SEX F\n`;
    
    if (m.birth_year) {
      gedcom += `1 BIRT\n`;
      gedcom += `2 DATE ${m.birth_year}\n`;
    }
  });
  gedcom += `0 TRLR\n`;

  triggerDownload(gedcom, `familia_export_${new Date().getTime()}.ged`, 'text/plain;charset=utf-8;');
}

onMounted(() => {
  fetchFamily()
})
</script>

<style scoped>
.export-container {
  min-height: 100vh;
  background-color: #f8fafc;
  padding: 20px;
}

.header {
  margin-bottom: 30px;
  margin-top: 20px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #1e293b;
  display: block;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #64748b;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.option-card {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.option-card:active {
  background-color: #f1f5f9;
}

.icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 16px;
}

.bg-green { background-color: #ecfdf5; }
.bg-orange { background-color: #fff7ed; }

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 16px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 4px;
}

.card-desc {
  font-size: 12px;
  color: #64748b;
}

.arrow {
  color: #94a3b8;
  font-size: 16px;
}
</style>
