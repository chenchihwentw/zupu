<template>
  <view class="container">
    <!-- Header -->
    <view class="header">
      <view class="title-bar">
        <picker 
          mode="selector" 
          :range="familyTrees" 
          range-key="name" 
          :value="activeFamilyIndex" 
          @change="onFamilyChange"
        >
          <view class="title" style="display:flex; align-items:center;">
            {{ activeFamilyName || $t('家族成員') }} <text style="font-size:14px; margin-left:6px; opacity: 0.8;">▼</text>
          </view>
        </picker>
        <view class="right-actions">
          <view class="stats">{{ $t('共') }} {{ members.length }} {{ $t('人') }}</view>
          <text class="logout-text" @click="handleLogout">{{ $t('登出') }}</text>
        </view>
      </view>
      <view class="search-box">
        <input class="search-input" v-model="searchQuery" :placeholder="$t('搜尋姓名或所在地...')" placeholder-class="placeholder" />
      </view>
    </view>

    <!-- Member List -->
    <scroll-view scroll-y class="list-container">
      <view v-if="loading" class="loading">{{ $t('載入中...') }}</view>
      
      <view 
        v-else 
        class="member-card" 
        v-for="member in filteredMembers" 
        :key="member.id"
        @click="goToDetail(member.id)"
      >
        <view class="avatar-box">
          <image v-if="member.avatar_url" :src="getFullUrl(member.avatar_url)" class="avatar" mode="aspectFill" />
          <view v-else class="avatar-placeholder">
            <text>{{ member.surname }}{{ member.given_name.charAt(0) }}</text>
          </view>
        </view>
        
        <view class="info-box">
          <view class="name-row">
            <text class="name">{{ member.name || (member.surname + member.given_name) }}</text>
            <text class="gender" :class="member.gender">{{ member.gender === 'male' ? $t('男') : $t('女') }}</text>
            <text v-if="member.is_deceased" class="tag deceased">{{ $t('已故') }}</text>
          </view>
          
          <view class="detail-row">
            <text class="detail-text" v-if="member.generation">{{ $t('第') }} {{ member.generation }} {{ $t('世') }}</text>
            <text class="detail-text" v-if="member.city">📍 {{ member.city }}</text>
          </view>
        </view>
      </view>
      
      <view v-if="!loading && filteredMembers.length === 0" class="empty">
        <text>{{ $t('找不到符合的成員') }}</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { getFullUrl } from '@/utils/request';
import request from '@/utils/request';

const members = ref([]);
const loading = ref(true);
const searchQuery = ref('');

// 家族切換相關狀態
const familyTrees = ref([]);
const activeFamilyId = ref('');

const activeFamilyIndex = computed(() => {
  return familyTrees.value.findIndex(f => f.id === activeFamilyId.value) !== -1 
    ? familyTrees.value.findIndex(f => f.id === activeFamilyId.value) 
    : 0;
});

const activeFamilyName = computed(() => {
  const f = familyTrees.value.find(f => f.id === activeFamilyId.value);
  // 我們需要用到全域的 proxy 來拿到 $t，不過這是 computed，可以在 setup 裡取用
  const { proxy } = getCurrentInstance();
  const t = proxy ? proxy.$t : (s) => s;
  return f ? f.name || t('未命名家族') : t('選擇家族');
});

const onFamilyChange = (e) => {
  const idx = e.detail.value;
  const selectedFid = familyTrees.value[idx].id;
  activeFamilyId.value = selectedFid;
  uni.setStorageSync('activeFamilyTreeId', selectedFid);
  // 切換家族後重新抓取資料
  fetchMembers();
};

const fetchMembers = async () => {
  loading.value = true;
  try {
    const res = await request.get('/family');
    if (Array.isArray(res)) {
      members.value = res;
    }
  } catch (error) {
    console.error('Fetch members error:', error);
  } finally {
    loading.value = false;
  }
};

const handleLogout = () => {
  const { proxy } = getCurrentInstance();
  const t = proxy ? proxy.$t : (s) => s;
  uni.showModal({
    title: t('登出確認'),
    content: t('確定要登出目前的帳號嗎？'),
    success: (res) => {
      if (res.confirm) {
        uni.removeStorageSync('token');
        uni.removeStorageSync('user');
        uni.removeStorageSync('activeFamilyTreeId');
        uni.reLaunch({ url: '/pages/login/index' });
      }
    }
  });
};

const goToDetail = (id) => {
  uni.navigateTo({
    url: `/pages/member/detail?id=${id}`
  });
};

const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value;
  const q = searchQuery.value.toLowerCase();
  return members.value.filter(m => {
    const name = (m.name || m.surname + m.given_name).toLowerCase();
    const city = (m.city || '').toLowerCase();
    return name.includes(q) || city.includes(q);
  });
});

onLoad(() => {
  // Check if logged in
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.reLaunch({ url: '/pages/login/index' });
    return;
  }
  
  // 初始化家族列表
  const userStr = uni.getStorageSync('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.familyTrees) {
        familyTrees.value = user.familyTrees;
        const storedFid = uni.getStorageSync('activeFamilyTreeId');
        if (storedFid) {
          activeFamilyId.value = storedFid;
        } else if (familyTrees.value.length > 0) {
          const primaryTree = familyTrees.value.find(f => f.role === 'family_admin') || familyTrees.value[0];
          activeFamilyId.value = primaryTree.id;
          uni.setStorageSync('activeFamilyTreeId', primaryTree.id);
        }
      }
    } catch(e) {
      console.error(e);
    }
  }
});

onShow(() => {
  if (uni.getStorageSync('token')) {
    const hasSeenGuide = uni.getStorageSync('has_seen_guide');
    if (!hasSeenGuide) {
      uni.navigateTo({
        url: '/pages/guide/index'
      });
      return;
    }
    fetchMembers();
  }
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f8fafc;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #4f46e5;
  padding: 20px 20px 15px;
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
}

.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  color: white;
  font-size: 22px;
  font-weight: bold;
}

.right-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats {
  background: rgba(255,255,255,0.2);
  color: white;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
}

.logout-text {
  color: #fca5a5; /* 淡紅色 */
  font-size: 14px;
  font-weight: bold;
}
.logout-text:active {
  opacity: 0.7;
}

.search-box {
  background: white;
  border-radius: 12px;
  padding: 8px 16px;
}

.search-input {
  height: 24px;
  font-size: 14px;
}

.placeholder {
  color: #cbd5e1;
}

.list-container {
  flex: 1;
  padding: 20px;
}

.member-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}

.avatar-box {
  width: 50px;
  height: 50px;
  margin-right: 16px;
}

.avatar {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 12px;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: #e0e7ff;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #4f46e5;
  font-weight: bold;
  font-size: 16px;
}

.info-box {
  flex: 1;
}

.name-row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}

.name {
  font-size: 16px;
  font-weight: bold;
  color: #1e293b;
  margin-right: 8px;
}

.gender {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 6px;
}
.gender.male { background: #e0f2fe; color: #0284c7; }
.gender.female { background: #fce7f3; color: #db2777; }

.tag.deceased {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #fef2f2;
  color: #dc2626;
}

.detail-row {
  display: flex;
  gap: 12px;
}

.detail-text {
  font-size: 12px;
  color: #64748b;
}

.loading, .empty {
  text-align: center;
  color: #94a3b8;
  padding: 40px 0;
  font-size: 14px;
}
</style>
