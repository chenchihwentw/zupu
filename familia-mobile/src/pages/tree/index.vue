<template>
  <view class="premium-container">
    <view v-if="loading" class="loading-state">
      <view class="spinner"></view>
      <text>{{ $t('正在繪製家族樹...') }}</text>
    </view>
    
    <view v-else-if="!focusMember" class="error-state">
      <text>{{ $t('無法載入族譜起點') }}</text>
    </view>

    <!-- 歷史返回導航 (固定在頂部) -->
    <view v-if="!loading && focusMember" class="nav-header">
      <button v-if="history.length > 0" class="glass-btn" @click="goBack">
        <text class="icon">←</text> 
        <text class="btn-text">{{ $t('返回') }} {{ history[history.length - 1].name }}</text>
      </button>
      <view class="spacer"></view>
      <text class="tree-title">{{ $t('家族世系圖') }}</text>
    </view>

    <scroll-view v-if="!loading && focusMember" scroll-y scroll-x class="tree-scroll-area">
      <view class="tree-wrapper">
        
        <!-- ================= 上層：父母 ================= -->
        <view class="tier parents-tier">
          <view class="nodes-container">
            <view class="node-branch" v-for="(p, index) in parents" :key="p.id">
              <view class="glass-card clickable" @click="setFocus(p)">
                <image v-if="p.avatar_url" :src="request.getFullUrl(p.avatar_url)" class="avatar" mode="aspectFill"/>
                <view v-else class="avatar-ph">{{ p.name.charAt(0) }}</view>
                <text class="name">{{ p.name }}</text>
                <text class="relation-tag">{{ $t('父母') }}</text>
              </view>
              <!-- 向下連接線 -->
              <view class="line-down"></view>
            </view>
          </view>
          <!-- 匯聚線 -->
          <view class="line-horizontal" v-if="parents.length > 1"></view>
          <view class="line-trunk" v-if="parents.length > 0"></view>
        </view>


        <!-- ================= 中層：主角與配偶 ================= -->
        <view class="tier focus-tier">
          <view class="focus-group">
            
            <!-- 主角 -->
            <view class="glass-card focus-card clickable" @click="goToDetail(focusMember.id)">
              <view class="halo-effect"></view>
              <image v-if="focusMember.avatar_url" :src="request.getFullUrl(focusMember.avatar_url)" class="avatar large" mode="aspectFill"/>
              <view v-else class="avatar-ph large">{{ focusMember.name.charAt(0) }}</view>
              <view class="info-block">
                <text class="name focus-name">{{ focusMember.name }}</text>
                <text class="generation" v-if="focusMember.generation">{{ $t('第') }} {{ focusMember.generation }} {{ $t('世') }}</text>
                <text class="instruction">{{ $t('點擊查看詳情') }}</text>
              </view>
            </view>

            <!-- 配偶連線與節點 -->
            <template v-if="spouses.length > 0">
              <view class="spouse-connector">
                <text class="heart">⚭</text>
              </view>
              <view class="spouses-container">
                <view class="glass-card clickable spouse-card" v-for="s in spouses" :key="s.id" @click="setFocus(s)">
                  <image v-if="s.avatar_url" :src="request.getFullUrl(s.avatar_url)" class="avatar small" mode="aspectFill"/>
                  <view v-else class="avatar-ph small">{{ s.name.charAt(0) }}</view>
                  <text class="name">{{ s.name }}</text>
                  <text class="relation-tag spouse">{{ $t('配偶') }}</text>
                </view>
              </view>
            </template>

          </view>
          <!-- 向下延伸的樹幹 -->
          <view class="line-trunk" v-if="children.length > 0"></view>
        </view>


        <!-- ================= 下層：子女 ================= -->
        <view class="tier children-tier" v-if="children.length > 0">
          <!-- 分支橫線 -->
          <view class="line-horizontal children-horizontal" v-if="children.length > 1"></view>
          
          <view class="nodes-container children-nodes">
            <view class="node-branch child-branch" v-for="(c, index) in children" :key="c.id" :class="{'first-child': index === 0, 'last-child': index === children.length - 1}">
              <!-- 曲線與直線透過 CSS 偽元素繪製 -->
              <view class="glass-card clickable" @click="setFocus(c)">
                <image v-if="c.avatar_url" :src="request.getFullUrl(c.avatar_url)" class="avatar" mode="aspectFill"/>
                <view v-else class="avatar-ph">{{ c.name.charAt(0) }}</view>
                <text class="name">{{ c.name }}</text>
                <text class="relation-tag child">{{ $t('子女') }}</text>
              </view>
            </view>
          </view>
        </view>

      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import request from '@/utils/request';

const allMembers = ref([]);
const loading = ref(true);

const focusMemberId = ref(null);
const history = ref([]); 

const fetchTreeData = async () => {
  loading.value = true;
  try {
    const res = await request.get('/family');
    if (Array.isArray(res)) {
      allMembers.value = res;
      if (!focusMemberId.value && res.length > 0) {
        let defaultId = res[0].id;
        
        // 嘗試優先聚焦於當前登入使用者
        try {
          const userStr = uni.getStorageSync('user');
          if (userStr) {
            const user = JSON.parse(userStr);
            const myMemberId = user.linkedMemberId;
            if (myMemberId && res.some(m => m.id == myMemberId)) {
              defaultId = myMemberId;
            }
          }
        } catch (e) {
          console.error('Failed to parse user', e);
        }
        
        focusMemberId.value = defaultId; 
      }
    }
  } catch (error) {
    console.error('Fetch tree error:', error);
  } finally {
    loading.value = false;
  }
};

const getMemberById = (id) => allMembers.value.find(m => m.id == id);
const focusMember = computed(() => getMemberById(focusMemberId.value));

const parseRelation = (jsonStr) => {
  try {
    const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    return Array.isArray(parsed) ? parsed : [];
  } catch(e) { return []; }
};

// 年齡排序小工具：長幼有序
const sortByAge = (arr) => {
  return arr.sort((a, b) => {
    if (a.birth_date && b.birth_date) {
      return a.birth_date.localeCompare(b.birth_date);
    }
    const yearA = a.birth_year || 9999;
    const yearB = b.birth_year || 9999;
    if (yearA !== yearB) return yearA - yearB;
    return 0; // 若無出生資訊則維持原樣
  });
};

const parents = computed(() => {
  if (!focusMember.value) return [];
  const rels = new Set(parseRelation(focusMember.value.parents).map(r => typeof r === 'string' ? r : r.id));
  
  // 反向查詢：如果有人說我是他的孩子（他的 children 有我），那他就是我的父母
  allMembers.value.forEach(m => {
    const theirChildren = parseRelation(m.children).map(c => typeof c === 'string' ? c : c.id);
    if (theirChildren.includes(focusMember.value.id)) rels.add(m.id);
  });

  return sortByAge(Array.from(rels).map(id => getMemberById(id)).filter(Boolean));
});

const spouses = computed(() => {
  if (!focusMember.value) return [];
  const rels = new Set(parseRelation(focusMember.value.spouses).map(r => typeof r === 'string' ? r : r.id));
  
  // 反向查詢：如果有人說我是他的配偶，那他也是我的配偶
  allMembers.value.forEach(m => {
    const theirSpouses = parseRelation(m.spouses).map(s => typeof s === 'string' ? s : s.id);
    if (theirSpouses.includes(focusMember.value.id)) rels.add(m.id);
  });

  return sortByAge(Array.from(rels).map(id => getMemberById(id)).filter(Boolean));
});

const children = computed(() => {
  if (!focusMember.value) return [];
  const rels = new Set(parseRelation(focusMember.value.children).map(r => typeof r === 'string' ? r : r.id));
  
  // 反向查詢：如果有人說我是他的父母（他的 parents 有我），那他就是我的子女
  allMembers.value.forEach(m => {
    const theirParents = parseRelation(m.parents).map(p => typeof p === 'string' ? p : p.id);
    if (theirParents.includes(focusMember.value.id)) rels.add(m.id);
  });

  return sortByAge(Array.from(rels).map(id => getMemberById(id)).filter(Boolean));
});

const setFocus = (member) => {
  if (member && member.id !== focusMemberId.value) {
    // 震動反饋 (H5 支援度視瀏覽器而定)
    // #ifdef APP-PLUS || MP-WEIXIN || H5
    uni.vibrateShort();
    // #endif
    history.value.push(focusMember.value);
    focusMemberId.value = member.id;
  }
};

const goBack = () => {
  if (history.value.length > 0) {
    uni.vibrateShort();
    const prev = history.value.pop();
    focusMemberId.value = prev.id;
  }
};

const goToDetail = (id) => {
  uni.navigateTo({ url: `/pages/member/detail?id=${id}` });
};

onShow(() => {
  fetchTreeData();
});
</script>

<style scoped>
/* ========== 全局背景與佈局 ========== */
.premium-container {
  min-height: 100vh;
  background: radial-gradient(circle at 50% 30%, #1e293b 0%, #020617 100%);
  color: #f8fafc;
  display: flex;
  flex-direction: column;
}

.tree-scroll-area {
  flex: 1;
  height: 100vh;
}

.nav-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(10px);
  z-index: 100;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tree-title {
  font-size: 14px;
  color: #94a3b8;
  letter-spacing: 2px;
}

.glass-btn {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 20px;
  color: #f8fafc;
  font-size: 12px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  line-height: 1.5;
}

/* ========== 樹狀結構容器 ========== */
.tree-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 10px 80px;
  min-width: max-content; /* 允許橫向滑動時內容不被壓縮 */
  margin: 0 auto;
}

.tier {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 100%;
}

.nodes-container {
  display: flex;
  justify-content: center;
  gap: 30px;
  position: relative;
}

.node-branch {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* ========== 節點卡片 (毛玻璃效果) ========== */
.glass-card {
  background: rgba(30, 41, 59, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 70px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  z-index: 10;
}

.glass-card.clickable:active {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.1);
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  margin-bottom: 8px;
}
.avatar-ph {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5, #8b5cf6);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 8px;
}

.name {
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  color: #f8fafc;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.relation-tag {
  font-size: 9px;
  color: #94a3b8;
  margin-top: 4px;
  background: rgba(0,0,0,0.3);
  padding: 2px 6px;
  border-radius: 8px;
}

/* ========== 焦點主角專屬樣式 ========== */
.focus-group {
  display: flex;
  align-items: center;
  position: relative;
  z-index: 10;
}

.focus-card {
  width: 110px;
  padding: 20px 10px;
  background: rgba(79, 70, 229, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.4);
  box-shadow: 0 0 20px rgba(79, 70, 229, 0.3);
}

.halo-effect {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 120%; height: 120%;
  background: radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%);
  z-index: -1;
  pointer-events: none;
}

.avatar.large, .avatar-ph.large {
  width: 64px;
  height: 64px;
  border: 3px solid #c4b5fd;
  font-size: 28px;
}

.info-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 8px;
}

.focus-name {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
}

.generation {
  font-size: 10px;
  color: #fcd34d; /* 金色世代 */
  margin-top: 4px;
}

.instruction {
  font-size: 9px;
  color: #8b5cf6;
  margin-top: 8px;
  opacity: 0.8;
}

/* 配偶樣式 */
.spouse-connector {
  width: 30px;
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
}
.heart {
  font-size: 14px;
  color: #fb7185;
  background: #0f172a;
  padding: 0 2px;
}

.spouses-container {
  display: flex;
  gap: 15px;
}
.spouse-card {
  width: 60px;
  padding: 10px;
}
.avatar.small, .avatar-ph.small {
  width: 40px; height: 40px; font-size: 16px;
}

/* ========== 連線繪製 (核心 CSS 邏輯) ========== */
.line-down {
  width: 2px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
}
.line-horizontal {
  height: 2px;
  background: rgba(255, 255, 255, 0.2);
  /* 寬度會由 JavaScript 或 Flex 動態決定，這裡用簡單的佈局對齊 */
  width: calc(100% - 70px); /* 減去卡片寬度 */
}
.line-trunk {
  width: 2px;
  height: 30px;
  background: rgba(255, 255, 255, 0.2);
}

/* 子女層分支線邏輯 (完美曲線) */
.children-nodes {
  padding-top: 20px;
}
.child-branch {
  position: relative;
}
.child-branch::before {
  content: '';
  position: absolute;
  top: -20px;
  left: 50%;
  width: 50%;
  height: 20px;
  border-top: 2px solid rgba(255, 255, 255, 0.2);
  border-left: 2px solid rgba(255, 255, 255, 0.2);
  border-top-left-radius: 12px;
}
.child-branch::after {
  content: '';
  position: absolute;
  top: -20px;
  right: 50%;
  width: 50%;
  height: 20px;
  border-top: 2px solid rgba(255, 255, 255, 0.2);
  border-right: 2px solid rgba(255, 255, 255, 0.2);
  border-top-right-radius: 12px;
}

/* 修正第一個與最後一個節點的連線 */
.child-branch.first-child::after { display: none; }
.child-branch.first-child::before {
  width: 50%; left: 50%; border-left: 2px solid rgba(255,255,255,0.2); border-top: 2px solid rgba(255,255,255,0.2);
}

.child-branch.last-child::before { display: none; }
.child-branch.last-child::after {
  width: 50%; right: 50%; border-right: 2px solid rgba(255,255,255,0.2); border-top: 2px solid rgba(255,255,255,0.2);
}

/* 如果只有一個小孩，只需要垂直線 */
.child-branch.first-child.last-child::before,
.child-branch.first-child.last-child::after {
  display: none;
}
.child-branch.first-child.last-child {
  padding-top: 0;
}
.child-branch.first-child.last-child::before {
  content: '';
  display: block;
  width: 2px;
  height: 20px;
  background: rgba(255,255,255,0.2);
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
}

/* 載入與錯誤狀態 */
.loading-state, .error-state {
  flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; color: #94a3b8;
}
.spinner {
  width: 40px; height: 40px;
  border: 4px solid rgba(255,255,255,0.1);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
