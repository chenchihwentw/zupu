<template>
  <view class="calendar-container">
    <view class="tabs">
      <view class="tab-item" :class="{ active: currentTab === 'birth' }" @click="currentTab = 'birth'">
        <text>🎉 生辰提醒</text>
      </view>
      <view class="tab-item" :class="{ active: currentTab === 'memorial' }" @click="currentTab = 'memorial'">
        <text>🕊️ 祭日提醒</text>
      </view>
    </view>

    <view class="mode-switcher">
      <view class="mode-item" :class="{ active: calendarMode === 'original' }" @click="calendarMode = 'original'">
        <text>🌍 預設</text>
      </view>
      <view class="mode-item" :class="{ active: calendarMode === 'lunar' }" @click="calendarMode = 'lunar'">
        <text>🌙 全農曆</text>
      </view>
      <view class="mode-item" :class="{ active: calendarMode === 'solar' }" @click="calendarMode = 'solar'">
        <text>☀️ 全國曆</text>
      </view>
    </view>

    <view v-if="loading" class="loading-state">
      <text>讀取中...</text>
    </view>

    <scroll-view v-else scroll-y class="scroll-area">
      <!-- 空狀態 -->
      <view v-if="displayReminders.length === 0" class="empty-state">
        <view class="empty-icon">{{ currentTab === 'birth' ? '🎂' : '🕯️' }}</view>
        <text class="empty-title">近期沒有需要提醒的日子</text>
        <text class="empty-desc">
          行事曆會自動換算國曆與農曆，幫您計算下次的日期與倒數天數。
        </text>
      </view>

      <!-- 卡片列表 -->
      <view class="cards-list" v-else>
        <view 
          class="reminder-card" 
          v-for="item in displayReminders" 
          :key="item.id"
          @click="gotoMember(item.member.id)"
        >
          <view class="card-left">
            <image v-if="item.member.avatar_url" class="avatar" :src="getAvatarUrl(item.member.avatar_url)" mode="aspectFill" />
            <view v-else class="avatar-placeholder">👤</view>
            <view class="info">
              <text class="name">{{ item.member.name }}</text>
              <text class="detail">{{ currentTab === 'birth' ? `${item.targetAge} 歲生日` : `第 ${item.targetAge} 週年忌辰` }}</text>
              <text class="date">{{ getFormattedDate(item) }}</text>
              <text class="date" v-if="calendarMode === 'original'" style="opacity: 0.7; font-size: 11px;">(國曆 {{ item.nextDate.getMonth() + 1 }}月{{ item.nextDate.getDate() }}日)</text>
            </view>
          </view>
          
          <view class="card-right">
            <view class="countdown-badge" :class="getCountdownClass(item.daysUntil)">
              <text class="number">{{ item.daysUntil }}</text>
              <text class="unit">天</text>
            </view>
            <text class="is-lunar" v-if="item.isLunar">農曆</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import request from '../../utils/request'
import { Lunar, Solar } from 'lunar-javascript'

const family = ref([])
const loading = ref(true)
const currentTab = ref('birth')
const calendarMode = ref('original')

const getAvatarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `/api/${url}`;
}

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

// 日期計算邏輯 (從 Web 版移植)
const calculateNextDate = (year, month, day, isLunar) => {
  if (!month || !day) return null;
  const now = new Date();
  const currentYear = now.getFullYear();
  let nextDate = null;

  if (isLunar) {
    try {
      let lunar = Lunar.fromYmd(currentYear, month, day);
      let solar = lunar.getSolar();
      nextDate = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
      if (nextDate < now) {
        lunar = Lunar.fromYmd(currentYear + 1, month, day);
        solar = lunar.getSolar();
        nextDate = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
      }
    } catch (e) {
      return null;
    }
  } else {
    nextDate = new Date(currentYear, month - 1, day);
    if (nextDate < now) {
      nextDate = new Date(currentYear + 1, month - 1, day);
    }
  }

  const diffTime = Math.abs(nextDate - now);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    date: nextDate,
    daysUntil: diffDays,
    dateString: `${nextDate.getFullYear()}年${nextDate.getMonth() + 1}月${nextDate.getDate()}日`
  };
}

const getPhysicalCoordinates = (m, type, targetMode) => {
  const isBirthday = type === 'birthday';
  const originalYear = isBirthday ? m.birth_year : m.death_year;
  const originalMonth = isBirthday ? m.birth_month : m.death_month;
  const originalDay = isBirthday ? m.birth_day : m.death_day;
  const originalIsLunar = (isBirthday ? m.birth_calendar : m.death_calendar) === 'lunar';

  if (!originalMonth || !originalDay || targetMode === 'original') {
    return { month: originalMonth, day: originalDay, isLunar: originalIsLunar };
  }

  try {
    const refYear = originalYear || 2000;
    if (targetMode === 'lunar' && !originalIsLunar) {
      const solar = Solar.fromYmd(refYear, originalMonth, originalDay);
      const lunar = solar.getLunar();
      return { month: lunar.getMonth(), day: lunar.getDay(), isLunar: true };
    }
    
    if (targetMode === 'solar' && originalIsLunar) {
      const lunar = Lunar.fromYmd(refYear, originalMonth, originalDay);
      const solar = lunar.getSolar();
      return { month: solar.getMonth(), day: solar.getDay(), isLunar: false };
    }
  } catch (e) {
    console.warn('Date conversion error:', e);
  }
  
  return { month: originalMonth, day: originalDay, isLunar: targetMode === 'lunar' };
}

const getFormattedDate = (item) => {
  if (calendarMode.value === 'lunar') {
    const l = Lunar.fromDate(item.nextDate);
    return `農曆 ${l.getMonth()}月${l.getDayInChinese()}`;
  } else if (calendarMode.value === 'solar') {
    return `國曆 ${item.nextDate.getMonth() + 1}月${item.nextDate.getDate()}日`;
  } else {
    if (item.isLunar) {
      try {
        const l = Lunar.fromYmd(2000, item.displayMonth, item.displayDay);
        return `農曆 ${item.displayMonth}月${l.getDayInChinese()}`;
      } catch (e) {
        return `農曆 ${item.displayMonth}月${item.displayDay}`;
      }
    } else {
      return `國曆 ${item.displayMonth}月${item.displayDay}日`;
    }
  }
}

const reminders = computed(() => {
  const birthList = [];
  const memorialList = [];

  family.value.forEach(m => {
    // 生辰
    if (!m.is_deceased && m.birth_month && m.birth_day) {
      const coords = getPhysicalCoordinates(m, 'birthday', calendarMode.value);
      const calc = calculateNextDate(m.birth_year, coords.month, coords.day, coords.isLunar);
      if (calc) {
        birthList.push({
          id: `birth-${m.id}`,
          member: m,
          isLunar: coords.isLunar,
          displayMonth: coords.month,
          displayDay: coords.day,
          nextDate: calc.date,
          nextDateString: calc.dateString,
          daysUntil: calc.daysUntil,
          targetAge: m.birth_year ? calc.date.getFullYear() - m.birth_year : '?'
        });
      }
    }

    // 祭日
    if (m.is_deceased && m.death_month && m.death_day) {
      const coords = getPhysicalCoordinates(m, 'death', calendarMode.value);
      const calc = calculateNextDate(m.death_year, coords.month, coords.day, coords.isLunar);
      if (calc) {
        memorialList.push({
          id: `death-${m.id}`,
          member: m,
          isLunar: coords.isLunar,
          displayMonth: coords.month,
          displayDay: coords.day,
          nextDate: calc.date,
          nextDateString: calc.dateString,
          daysUntil: calc.daysUntil,
          targetAge: m.death_year ? calc.date.getFullYear() - m.death_year : '?'
        });
      }
    }
  });

  return {
    birth: birthList.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 30),
    memorial: memorialList.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 30)
  };
})

const displayReminders = computed(() => {
  return reminders.value[currentTab.value] || []
})

const getCountdownClass = (days) => {
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'soon';
  return 'normal';
}

const gotoMember = (id) => {
  uni.navigateTo({ url: `/pages/member/detail?id=${id}` })
}

onMounted(() => {
  fetchFamily()
})
</script>

<style scoped>
.calendar-container {
  min-height: 100vh;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  background-color: #ffffff;
  border-bottom: 1px solid #e2e8f0;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 16px 0;
  font-size: 16px;
  font-weight: bold;
  color: #64748b;
  border-bottom: 2px solid transparent;
}

.tab-item.active {
  color: #4f46e5;
  border-bottom-color: #4f46e5;
}

.mode-switcher {
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background-color: #f8fafc;
}

.mode-item {
  padding: 6px 12px;
  border-radius: 16px;
  background-color: #ffffff;
  color: #64748b;
  font-size: 13px;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
}

.mode-item.active {
  background-color: #4f46e5;
  color: white;
  border-color: #4f46e5;
}

.scroll-area {
  flex: 1;
  height: 0; /* Important for flex child scroll-view */
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
}

.empty-title {
  font-size: 20px;
  font-weight: bold;
  color: #334155;
  margin-bottom: 12px;
}

.empty-desc {
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
}

.cards-list {
  padding: 16px;
}

.reminder-card {
  background-color: #ffffff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.02);
}

.card-left {
  display: flex;
  align-items: center;
}

.avatar {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  margin-right: 12px;
}

.avatar-placeholder {
  width: 50px;
  height: 50px;
  border-radius: 25px;
  background-color: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 24px;
}

.info {
  display: flex;
  flex-direction: column;
}

.name {
  font-size: 18px;
  font-weight: bold;
  color: #1e293b;
}

.detail {
  font-size: 14px;
  color: #4f46e5;
  margin: 2px 0;
}

.date {
  font-size: 12px;
  color: #94a3b8;
}

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.countdown-badge {
  background-color: #f1f5f9;
  padding: 4px 12px;
  border-radius: 16px;
  display: flex;
  align-items: baseline;
  margin-bottom: 4px;
}

.countdown-badge.urgent { background-color: #fee2e2; color: #ef4444; }
.countdown-badge.soon { background-color: #fef3c7; color: #f59e0b; }

.number {
  font-size: 20px;
  font-weight: bold;
  margin-right: 4px;
}

.unit {
  font-size: 12px;
}

.is-lunar {
  font-size: 10px;
  background-color: #e2e8f0;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
