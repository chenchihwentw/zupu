<template>
  <view class="discover-container">
    <!-- Header -->
    <view class="header">
      <text class="page-title">{{ $t('探索與幫助') }}</text>
      <text class="page-subtitle">{{ $t('深入了解您的家族歷史，並獲得操作指引') }}</text>
    </view>

    <!-- 功能入口區塊 -->
    <view class="features-grid">
      <view class="feature-card" @click="navigateTo('timeline')">
        <view class="icon-box bg-purple">📖</view>
        <text class="feature-title">{{ $t('家族大事記') }}</text>
        <text class="feature-desc">{{ $t('回顧百年家族歷史') }}</text>
      </view>
      
      <view class="feature-card" @click="navigateTo('calendar')">
        <view class="icon-box bg-blue">📅</view>
        <text class="feature-title">{{ $t('重要行事曆') }}</text>
        <text class="feature-desc">{{ $t('生辰與祭奠提醒') }}</text>
      </view>

      <view class="feature-card" @click="navigateTo('export')">
        <view class="icon-box bg-green">📥</view>
        <text class="feature-title">{{ $t('資料匯出') }}</text>
        <text class="feature-desc">{{ $t('備份與分享族譜') }}</text>
      </view>

      <view class="feature-card" @click="toggleLanguage">
        <view class="icon-box bg-gray">🌐</view>
        <text class="feature-title">{{ $currentLanguage === 'zh-CN' ? '切換為繁體中文' : '切换为简体中文' }}</text>
        <text class="feature-desc">{{ $t('支援繁體與簡體顯示') }}</text>
      </view>
    </view>

    <!-- 管理員專區 -->
    <view class="help-section" v-if="isAdmin">
      <view class="help-header">
        <text class="help-title">{{ $t('管理員專區') }}</text>
      </view>
      <view class="features-grid" style="padding: 0;">
        <view class="feature-card" @click="navigateTo('invite')">
          <view class="icon-box bg-orange">✨</view>
          <text class="feature-title">{{ $t('邀請家族成員') }}</text>
          <text class="feature-desc">{{ $t('為成員生成專屬邀請碼') }}</text>
        </view>
      </view>
    </view>

    <!-- 新手指南區塊 -->
    <view class="help-section">
      <view class="help-header">
        <text class="help-title">{{ $t('常見問題與幫助') }}</text>
      </view>

      <view class="faq-list">
        <view class="faq-item" v-for="(faq, index) in faqs" :key="index" @click="toggleFaq(index)">
          <view class="faq-question">
            <text class="q-text">{{ $t(faq.q) }}</text>
            <text class="arrow">{{ activeFaq === index ? '▲' : '▼' }}</text>
          </view>
          <view class="faq-answer" v-if="activeFaq === index">
            <text>{{ $t(faq.a) }}</text>
          </view>
        </view>
      </view>

      <button class="replay-btn" @click="replayGuide">{{ $t('重新觀看新手導覽') }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const activeFaq = ref(-1)
const isAdmin = ref(false)

onMounted(() => {
  const userStr = uni.getStorageSync('user')
  const activeFid = uni.getStorageSync('activeFamilyTreeId')
  if (userStr && activeFid) {
    try {
      const user = JSON.parse(userStr)
      if (user && user.familyTrees) {
        const currentTree = user.familyTrees.find(f => f.id === activeFid)
        if (currentTree && (currentTree.role === 'admin' || currentTree.role === 'family_admin' || currentTree.role === 'creator')) {
          isAdmin.value = true
        }
      }
    } catch (e) {
      console.error('Failed to parse user', e)
    }
  }
})

const faqs = [
  {
    q: '如何新增親屬？',
    a: '進入「族譜」頁籤，點擊任何一位已存在的成員，然後點擊畫面右下角的「+」按鈕，即可選擇新增父母、配偶或子女。'
  },
  {
    q: '如何上傳大頭照？',
    a: '在成員詳情頁面，點擊上方的預設頭像圈圈，即可選擇手機相簿中的照片進行上傳替換。'
  },
  {
    q: '照片可以辨識人臉嗎？',
    a: '可以！在成員的「相簿」分頁中上傳合照後，系統會自動辨識人臉，您可以點擊人臉方框標註這是哪位親屬。'
  },
  {
    q: '大事記為什麼沒有資料？',
    a: '大事記是根據成員的「出生」與「逝世」年份自動生成的。請先在成員資料中填寫完整的年份，大事記就會自動出現喔！'
  }
]

const toggleFaq = (index) => {
  activeFaq.value = activeFaq.value === index ? -1 : index
}

const navigateTo = (page) => {
  uni.navigateTo({
    url: `/pages/discover/${page}`
  })
}

// 取得全域方法
import { getCurrentInstance } from 'vue';
const { proxy } = getCurrentInstance();

const toggleLanguage = () => {
  const current = proxy.$currentLanguage;
  const newLang = current === 'zh-CN' ? 'zh-TW' : 'zh-CN';
  uni.showToast({ title: newLang === 'zh-CN' ? '已切換為簡體' : '已切換為繁體', icon: 'success' });
  
  // 稍作延遲再重啟，讓 toast 顯示
  setTimeout(() => {
    proxy.$setLanguage(newLang);
  }, 1000);
}

const replayGuide = () => {
  uni.navigateTo({
    url: '/pages/guide/index'
  })
}
</script>

<style scoped>
.discover-container {
  min-height: 100vh;
  background-color: #f8fafc;
  padding-bottom: 30px;
}

.header {
  padding: 40px 20px 20px;
  background-color: #ffffff;
}

.page-title {
  font-size: 28px;
  font-weight: bold;
  color: #1e293b;
  display: block;
  margin-bottom: 8px;
}

.page-subtitle {
  font-size: 14px;
  color: #64748b;
}

.features-grid {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-card {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  position: relative;
  overflow: hidden;
}

.feature-card:active {
  transform: scale(0.98);
}

.icon-box {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-bottom: 12px;
}

.bg-purple { background-color: #f3e8ff; }
.bg-blue { background-color: #eff6ff; }
.bg-green { background-color: #ecfdf5; }
.bg-orange { background-color: #fff7ed; }
.bg-gray { background-color: #f1f5f9; }

.feature-title {
  font-size: 18px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 14px;
  color: #64748b;
}

.help-section {
  padding: 20px;
  margin-top: 10px;
}

.help-title {
  font-size: 20px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 16px;
  display: block;
}

.faq-list {
  background-color: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.faq-item {
  border-bottom: 1px solid #f1f5f9;
}

.faq-item:last-child {
  border-bottom: none;
}

.faq-question {
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.q-text {
  font-size: 15px;
  font-weight: bold;
  color: #334155;
}

.arrow {
  color: #94a3b8;
  font-size: 12px;
}

.faq-answer {
  padding: 0 20px 16px;
  font-size: 14px;
  color: #64748b;
  line-height: 1.5;
}

.replay-btn {
  margin-top: 24px;
  background-color: #ffffff;
  color: #4f46e5;
  border: 1px solid #e0e7ff;
  border-radius: 20px;
  font-size: 14px;
  padding: 8px 0;
}
</style>
