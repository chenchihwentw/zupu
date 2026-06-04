<template>
  <view class="timeline-container">
    <view v-if="loading" class="loading-state">
      <text>讀取中...</text>
    </view>
    
    <view v-else-if="timelineEvents.length === 0" class="empty-state">
      <view class="empty-icon">🌱</view>
      <text class="empty-title">這裡還是一片空白</text>
      <text class="empty-desc">家族大事記是根據成員的「出生」與「逝世」年份自動生成的。\n請先到家族樹中，為長輩補上年份吧！</text>
      <button class="goto-tree-btn" @click="gotoTree">前往家族樹</button>
    </view>

    <view v-else class="timeline-content">
      <view class="timeline-line"></view>
      
      <view class="timeline-item" v-for="(ev, index) in timelineEvents" :key="ev.id">
        <view class="year-badge">
          <text>{{ ev.year }}</text>
        </view>
        
        <view class="event-node" :class="ev.type === 'birth' ? 'node-birth' : 'node-death'">
          <text>{{ ev.type === 'birth' ? '👶' : '🕊️' }}</text>
        </view>

        <view class="event-card" @click="gotoMember(ev.memberId)">
          <view class="card-header">
            <image v-if="ev.member.avatar_url" class="avatar" :src="getAvatarUrl(ev.member.avatar_url)" mode="aspectFill" />
            <view v-else class="avatar-placeholder">👤</view>
            <view class="title-area">
              <text class="event-title">{{ ev.title }}</text>
              <text class="event-date">{{ ev.month && ev.day ? `${ev.month}月${ev.day}日` : '' }}</text>
            </view>
          </view>
          <text class="event-desc">{{ ev.description }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import request from '../../utils/request'

const family = ref([])
const loading = ref(true)

const getAvatarUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  // TODO: baseUrl should come from env/config, using relative api path for now
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

const timelineEvents = computed(() => {
  const events = []
  family.value.forEach(m => {
    if (m.birth_year) {
      events.push({
        id: `${m.id}-birth`,
        memberId: m.id,
        year: m.birth_year,
        month: m.birth_month,
        day: m.birth_day,
        type: 'birth',
        title: `${m.name} 誕生`,
        description: `${m.name} 出生於 ${m.birth_year} 年`,
        member: m
      })
    }
    if (m.is_deceased && m.death_year) {
      const age = m.birth_year ? m.death_year - m.birth_year : '?'
      events.push({
        id: `${m.id}-death`,
        memberId: m.id,
        year: m.death_year,
        month: m.death_month,
        day: m.death_day,
        type: 'death',
        title: `${m.name} 辭世`,
        description: `享年 ${age} 歲`,
        member: m
      })
    }
  })

  return events.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    const aMonth = a.month || 0
    const bMonth = b.month || 0
    if (aMonth !== bMonth) return aMonth - bMonth
    const aDay = a.day || 0
    const bDay = b.day || 0
    return aDay - bDay
  })
})

const gotoTree = () => {
  uni.switchTab({ url: '/pages/tree/index' })
}

const gotoMember = (id) => {
  uni.navigateTo({ url: `/pages/member/detail?id=${id}` })
}

onMounted(() => {
  fetchFamily()
})
</script>

<style scoped>
.timeline-container {
  min-height: 100vh;
  background-color: #f8fafc;
  padding: 20px;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40px;
  color: #94a3b8;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
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
  margin-bottom: 30px;
}

.goto-tree-btn {
  background-color: #4f46e5;
  color: white;
  border-radius: 20px;
  padding: 0 30px;
  font-size: 14px;
}

.timeline-content {
  position: relative;
  padding-left: 60px; /* 給左側年份空間 */
}

.timeline-line {
  position: absolute;
  left: 70px;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: #e2e8f0;
}

.timeline-item {
  position: relative;
  margin-bottom: 30px;
  display: flex;
  align-items: flex-start;
}

.year-badge {
  position: absolute;
  left: -60px;
  width: 50px;
  text-align: right;
  font-weight: bold;
  font-size: 18px;
  color: #4f46e5;
  padding-top: 10px;
}

.event-node {
  position: absolute;
  left: 10px; /* 70 - 16 = 54 (Relative to timeline-item? No, item has no relative left offset? Ah, item is flex) */
  /* Wait, line is at left:70px of container. Item is inside content. 
     To make node center on line: container padding-left: 70px. Line left: 10px inside item? No, line is absolute to content. */
}

/* Fix node positioning */
.timeline-content {
  position: relative;
  padding-left: 20px;
}
.timeline-line {
  position: absolute;
  left: 75px;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: #e2e8f0;
}

.timeline-item {
  position: relative;
  margin-bottom: 24px;
  padding-left: 80px;
}

.year-badge {
  position: absolute;
  left: 0;
  top: 8px;
  width: 50px;
  text-align: right;
  font-weight: bold;
  font-size: 18px;
  color: #4f46e5;
}

.event-node {
  position: absolute;
  left: 60px; /* 75 - 15 = 60 (center on line 75px, width 30px -> left 60) */
  top: 6px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  background-color: white;
  border: 2px solid;
  z-index: 2;
}

.node-birth { border-color: #10b981; }
.node-death { border-color: #94a3b8; }

.event-card {
  background-color: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  margin-right: 12px;
}

.avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 20px;
  background-color: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 20px;
}

.title-area {
  display: flex;
  flex-direction: column;
}

.event-title {
  font-size: 16px;
  font-weight: bold;
  color: #1e293b;
}

.event-date {
  font-size: 12px;
  color: #94a3b8;
}

.event-desc {
  font-size: 14px;
  color: #64748b;
}
</style>
