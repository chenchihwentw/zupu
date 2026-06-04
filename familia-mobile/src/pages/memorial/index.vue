<template>
  <view class="memorial-container">
    <view v-if="loading" class="loading">
      <text>{{ $t('開啟追思大殿...') }}</text>
    </view>
    
    <view v-else-if="deceasedMembers.length === 0" class="empty">
      <text>{{ $t('目前沒有過世的先人記錄') }}</text>
    </view>

    <template v-else>
      <!-- 背景：復古光影 -->
      <view class="background-effect"></view>

      <!-- 輪播先人靈位 -->
      <swiper 
        class="swiper-box" 
        :indicator-dots="true" 
        indicator-color="rgba(255, 255, 255, 0.3)"
        indicator-active-color="#fde68a"
        :autoplay="false" 
        :current="currentIndex"
        @change="onSwiperChange"
      >
        <swiper-item v-for="(member, index) in deceasedMembers" :key="member.id">
          <view class="altar-card">
            <!-- 遺像展示 -->
            <view class="portrait-frame">
              <image 
                v-if="member.avatar_url" 
                :src="getFullUrl(member.avatar_url)" 
                class="portrait-img" 
                mode="aspectFill"
              />
              <view v-else class="portrait-placeholder">
                <text>{{ member.surname }}{{ member.given_name?.charAt(0) || $t('氏') }}</text>
              </view>
              <!-- 黑色半透明遮罩增添莊重感 -->
              <view class="portrait-overlay"></view>
            </view>

            <!-- 靈位文字 -->
            <view class="tablet">
              <text class="tablet-title">{{ $t('故') }}{{ member.name }}{{ $t('之靈位') }}</text>
              <view class="tablet-dates">
                <text class="date-line">{{ $t('生於：') }}{{ member.birth_date || $t('不詳') }}</text>
                <text class="date-line">{{ $t('歿於：') }}{{ member.death_date || $t('不詳') }}</text>
              </view>
            </view>

            <!-- 祭祀紀錄與留言 -->
            <view class="ritual-records" v-if="member.stats && member.stats.total_count > 0">
              <view class="stats-text">🌸 {{ $t('已累積') }} {{ member.stats.total_count }} {{ $t('次祭祀祈福') }}</view>
              <view class="message-list" v-if="member.messages && member.messages.length > 0">
                <view class="message-item" v-for="(msg, idx) in member.messages" :key="idx">
                  <text class="msg-user">{{ msg.full_name || msg.username || $t('家屬') }}:</text>
                  <text class="msg-content">{{ msg.message }}</text>
                  <text class="msg-date">{{ formatDate(msg.ritual_date) }}</text>
                </view>
              </view>
            </view>
          </view>
        </swiper-item>
      </swiper>

      <!-- 底部祭祀控制面板 -->
      <view class="ritual-panel">
        <view class="panel-header">
          <button class="nav-btn" @click="prevMember">〈</button>
          <text class="instruction">{{ $t('左右滑動或點擊切換先人') }}</text>
          <button class="nav-btn" @click="nextMember">〉</button>
        </view>
        
        <view class="ritual-actions">
          <button class="action-btn flower" @click="performRitual('flower')">
            <text class="emoji">🌸</text> {{ $t('獻花') }}
          </button>
          <button class="action-btn incense" @click="performRitual('incense')">
            <text class="emoji">🕯️</text> {{ $t('上香') }}
          </button>
          <button class="action-btn bow" @click="performRitual('bow')">
            <text class="emoji">🙏</text> {{ $t('鞠躬') }}
          </button>
        </view>
      </view>

      <!-- 動畫特效層 -->
      <view v-if="activeRitual" class="ritual-animation" :class="activeRitual">
        <text class="ritual-emoji">{{ ritualEmoji }}</text>
      </view>
    </template>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import request, { getFullUrl } from '@/utils/request';

const { proxy } = getCurrentInstance();
const t = proxy ? proxy.$t : (s) => s;

const loading = ref(true);
const deceasedMembers = ref([]);
const allCount = ref(0);
const currentIndex = ref(0);

const activeRitual = ref(null);
const ritualEmoji = ref('');

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const fetchRitualData = async (index) => {
  const member = deceasedMembers.value[index];
  if (!member) return;
  try {
    const res = await request.get(`/memorial/rituals/${member.id}`);
    if (res && res.stats) {
      deceasedMembers.value[index].stats = res.stats;
      deceasedMembers.value[index].messages = res.recent_messages || [];
    }
  } catch (error) {
    console.error('Fetch rituals error:', error);
  }
};

const fetchDeceasedMembers = async () => {
  loading.value = true;
  try {
    const res = await request.get('/family');
    console.log('[Memorial] API Response:', res);
    if (Array.isArray(res)) {
      allCount.value = res.length;
      // 篩選出已過世的先人
      deceasedMembers.value = res.filter(m => m.is_deceased);
      if (deceasedMembers.value.length > 0) {
        fetchRitualData(0);
      }
      console.log('[Memorial] Deceased Members filtered:', deceasedMembers.value);
    } else {
      console.log('[Memorial] API Response is not an array:', res);
    }
  } catch (error) {
    console.error('Fetch memorial members error:', error);
  } finally {
    loading.value = false;
  }
};

const onSwiperChange = (e) => {
  currentIndex.value = e.detail.current;
  const currentMember = deceasedMembers.value[currentIndex.value];
  if (currentMember && !currentMember.stats) {
    fetchRitualData(currentIndex.value);
  }
};

const prevMember = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = deceasedMembers.value.length - 1;
  }
};

const nextMember = () => {
  if (currentIndex.value < deceasedMembers.value.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
};

const performRitual = (type) => {
  // 手機震動反饋
  // #ifdef APP-PLUS || MP-WEIXIN || H5
  if (uni.vibrateShort) {
    uni.vibrateShort({
      success: function () {
          console.log('vibrate success');
      }
    });
  }
  // #endif

  // 設定動畫
  activeRitual.value = type;
  if (type === 'flower') ritualEmoji.value = '🌸';
  else if (type === 'incense') ritualEmoji.value = '🕯️';
  else if (type === 'bow') ritualEmoji.value = '🙏';

  // 1.5秒後清除動畫
  setTimeout(() => {
    activeRitual.value = null;
  }, 1500);

  // 稍微延遲後彈出留言視窗
  setTimeout(() => {
    const currentMember = deceasedMembers.value[currentIndex.value];
    if (!currentMember) return;

    uni.showModal({
      title: `${t('向')} ${currentMember.name} ${t('獻上思念')}`,
      content: '',
      editable: true,
      placeholderText: t('寫下您想對先人說的話...'),
      confirmText: t('送出'),
      cancelText: t('略過'),
      success: async (res) => {
        if (res.confirm) {
          const message = res.content || t('思念與祈禱，永遠銘記心間...');
          const ritualType = type === 'flower' ? 'MODERN' : (type === 'incense' ? 'TRADITIONAL' : 'CHRISTIAN');
          try {
            await request.post('/memorial/rituals', {
              member_id: currentMember.id,
              ritual_type: ritualType,
              message: message
            });
            uni.showToast({ title: t('心意已傳達'), icon: 'success' });
            // 重新拉取該先人的最新留言
            fetchRitualData(currentIndex.value);
          } catch (e) {
            console.error('Ritual API error:', e);
            uni.showToast({ title: t('傳送失敗'), icon: 'none' });
          }
        }
      }
    });
  }, 500);
};

onShow(() => {
  fetchDeceasedMembers();
});
</script>

<style scoped>
.memorial-container {
  height: 100vh;
  width: 100vw;
  background-color: #0f172a; /* 深藍偏黑背景 */
  color: #f8fafc;
  position: relative;
  overflow: hidden;
}

.loading, .empty {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #94a3b8;
}

.background-effect {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(circle at center, #1e293b 0%, #020617 100%);
  z-index: 1;
}

.swiper-box {
  position: absolute;
  top: 40px;
  left: 0;
  width: 100%;
  height: calc(100vh - 180px);
  z-index: 2;
}

.altar-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  padding: 10px 20px 20px 20px;
  box-sizing: border-box;
  overflow-y: auto;
}

.portrait-frame {
  width: 140px;
  height: 180px;
  border: 8px solid #27272a;
  border-radius: 4px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  margin-bottom: 20px;
  position: relative;
  background: #18181b;
  flex-shrink: 0;
  overflow: hidden;
}

/* 復古濾鏡效果 */
.portrait-img {
  width: 100%;
  height: 100%;
  filter: sepia(0.3) contrast(1.1) brightness(0.9);
}

.portrait-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 48px;
  color: #475569;
  font-weight: bold;
}

.portrait-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.2);
}

.tablet {
  width: 120px;
  background: linear-gradient(180deg, #b45309 0%, #78350f 100%);
  border: 4px solid #fcd34d;
  border-radius: 8px;
  padding: 15px 15px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  flex-shrink: 0;
}

.tablet-title {
  display: block;
  font-size: 20px;
  font-weight: bold;
  color: #fef3c7;
  letter-spacing: 2px;
  margin-bottom: 12px;
  writing-mode: vertical-rl;
  text-orientation: upright;
  height: 220px; /* 拉長高度避免斷行 */
  margin: 0 auto 12px auto;
}

.tablet-dates {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.date-line {
  font-size: 11px;
  color: #fde68a;
  opacity: 0.9;
  text-align: center;
}

/* 祭祀紀錄區塊 */
.ritual-records {
  width: 100%;
  margin-top: 30px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 15px;
  box-sizing: border-box;
}

.stats-text {
  font-size: 14px;
  color: #f8fafc;
  font-weight: bold;
  margin-bottom: 15px;
  text-align: center;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.05);
  padding: 10px 12px;
  border-radius: 8px;
  border-left: 3px solid #4f46e5;
}

.msg-user {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 4px;
}

.msg-content {
  font-size: 14px;
  color: #e2e8f0;
  line-height: 1.4;
  margin-bottom: 4px;
}

.msg-date {
  font-size: 10px;
  color: #64748b;
  text-align: right;
}

.ritual-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 140px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(10px);
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 0;
  border-top: 1px solid #334155;
  box-sizing: border-box;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0 40px;
  margin-bottom: 15px;
  box-sizing: border-box;
}

.instruction {
  font-size: 13px;
  color: #94a3b8;
}

.nav-btn {
  background: transparent;
  border: 1px solid #475569;
  color: #cbd5e1;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  padding: 0;
  margin: 0;
}
.nav-btn:active {
  background: #334155;
}

.ritual-actions {
  display: flex;
  gap: 20px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #1e293b;
  border: 1px solid #475569;
  border-radius: 12px;
  width: 80px;
  height: 70px;
  padding: 0;
  color: #cbd5e1;
  font-size: 12px;
  transition: all 0.2s;
}
.action-btn:active {
  background: #334155;
  transform: scale(0.95);
}

.emoji {
  font-size: 24px;
  margin-bottom: 4px;
}

/* 祭祀動畫特效 */
.ritual-animation {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  pointer-events: none;
}

.ritual-emoji {
  font-size: 80px;
  opacity: 0;
}

.flower .ritual-emoji {
  animation: floatUp 1.5s ease-out forwards;
}

.incense .ritual-emoji {
  animation: fadePulse 1.5s ease-in-out forwards;
}

.bow .ritual-emoji {
  animation: bowDown 1.5s ease-in-out forwards;
}

@keyframes floatUp {
  0% { transform: translateY(50px) scale(0.5); opacity: 0; }
  20% { opacity: 1; }
  100% { transform: translateY(-100px) scale(1.2); opacity: 0; }
}

@keyframes fadePulse {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}

@keyframes bowDown {
  0% { transform: rotate(0deg); opacity: 0; }
  30% { transform: rotate(20deg); opacity: 1; }
  70% { transform: rotate(20deg); opacity: 1; }
  100% { transform: rotate(0deg); opacity: 0; }
}
</style>
