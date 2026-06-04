<template>
  <view class="container">
    <view class="header">
      <text class="title">邀請成員入駐</text>
      <text class="desc">為家族成員生成專屬邀請碼，讓他們能登入並共同維護家族樹。</text>
    </view>

    <view v-if="isLoadingMembers" class="loading-state">
      <text>讀取成員列表中...</text>
    </view>

    <view v-else class="form-box">
      <text class="label">選擇要邀請的家族成員</text>
      <picker @change="onMemberChange" :range="availableMembers" range-key="name">
        <view class="picker-value" :class="{ 'placeholder': selectedMemberIndex === -1 }">
          {{ selectedMemberIndex > -1 ? availableMembers[selectedMemberIndex].name : '-- 請選擇成員 --' }}
        </view>
      </picker>

      <text class="label" style="margin-top: 20px;">賦予權限等級</text>
      <picker @change="onRoleChange" :range="roles" range-key="label">
        <view class="picker-value">
          {{ roles[selectedRoleIndex].label }}
        </view>
      </picker>

      <button class="btn-primary" :disabled="selectedMemberIndex === -1" :loading="isGenerating" @click="generateInvite">生成授權邀請碼</button>
    </view>

    <view class="result-box" v-if="generatedResult">
      <view class="result-header">
        <text class="result-title">{{ generatedResult.memberName }} 的邀請碼</text>
      </view>
      <view class="code-box">
        <text class="code-text">{{ generatedResult.inviteCode }}</text>
        <view class="btn-copy" @click="copyCode">
          <text>📋 複製</text>
        </view>
      </view>
      <view class="expiry">
        <text>🛡️ 有效期：{{ generatedResult.expiresAt }}</text>
      </view>

      <view class="guide-box">
        <text class="guide-title">💡 接下來該怎麼做？</text>
        <text class="guide-text">1. 點擊複製邀請碼，傳送給該親屬。</text>
        <text class="guide-text">2. 請親屬打開 App，在登入畫面點擊<text class="highlight">「使用邀請碼註冊」</text>。</text>
        <text class="guide-text">3. 註冊後，系統即會自動將他的帳號與族譜身分安全綁定！</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import request from '@/utils/request';

const allMembers = ref([]);
const isLoadingMembers = ref(true);
const isGenerating = ref(false);

const selectedMemberIndex = ref(-1);
const selectedRoleIndex = ref(0);

const generatedResult = ref(null);

const roles = [
  { value: 'user', label: '普通成員 (僅編輯自己)' },
  { value: 'editor', label: '編輯者 (可編輯他人)' },
  { value: 'admin', label: '管理員 (擁有管理權)' }
];

const availableMembers = computed(() => {
  return allMembers.value.filter(m => !m.is_deceased && !m.user_id);
});

const onMemberChange = (e) => {
  selectedMemberIndex.value = e.detail.value;
  generatedResult.value = null; // 重新選擇時清空先前的結果
};

const onRoleChange = (e) => {
  selectedRoleIndex.value = e.detail.value;
};

const fetchMembers = async () => {
  try {
    isLoadingMembers.value = true;
    const res = await request.get('/my-family-tree');
    if (res && res.members) {
      allMembers.value = res.members;
    }
  } catch (error) {
    console.error('Fetch members error:', error);
    uni.showToast({ title: '無法讀取家族成員', icon: 'none' });
  } finally {
    isLoadingMembers.value = false;
  }
};

const generateInvite = async () => {
  if (selectedMemberIndex.value === -1) {
    return uni.showToast({ title: '請先選擇成員', icon: 'none' });
  }

  const member = availableMembers.value[selectedMemberIndex.value];
  const role = roles[selectedRoleIndex.value].value;

  try {
    isGenerating.value = true;
    const activeFamilyId = uni.getStorageSync('activeFamilyTreeId');
    
    // 這裡我們直接傳送 family_id，後端邏輯有兼容 family_id 與 family_tree_id
    const res = await request.post('/invite/generate', {
      target_member_id: member.id,
      family_id: activeFamilyId,
      default_role: role
    });

    if (res && res.invitation) {
      generatedResult.value = {
        memberName: member.name,
        inviteCode: res.invitation.invite_code,
        expiresAt: res.invitation.expires_at 
          ? new Date(res.invitation.expires_at).toLocaleDateString()
          : '永久有效'
      };
      uni.showToast({ title: '生成成功', icon: 'success' });
    }
  } catch (error) {
    console.error('Generate invite error:', error);
  } finally {
    isGenerating.value = false;
  }
};

const copyCode = () => {
  if (!generatedResult.value) return;
  uni.setClipboardData({
    data: generatedResult.value.inviteCode,
    success: () => {
      uni.showToast({ title: '已複製', icon: 'success' });
    }
  });
};

onMounted(() => {
  fetchMembers();
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f8fafc;
  padding: 20px;
}

.header {
  margin-bottom: 24px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #1e293b;
  display: block;
  margin-bottom: 8px;
}

.desc {
  font-size: 14px;
  color: #64748b;
  display: block;
}

.form-box {
  background-color: #ffffff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.label {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  display: block;
  margin-bottom: 10px;
}

.picker-value {
  background-color: #f1f5f9;
  padding: 14px 16px;
  border-radius: 12px;
  font-size: 15px;
  color: #1e293b;
  border: 1px solid #e2e8f0;
}

.picker-value.placeholder {
  color: #94a3b8;
}

.btn-primary {
  background-color: #4f46e5;
  color: white;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  margin-top: 30px;
  border: none;
}

.btn-primary[disabled] {
  background-color: #a5b4fc;
  color: #ffffff;
}

.btn-primary:active {
  background-color: #4338ca;
}

.loading-state {
  text-align: center;
  padding: 40px;
  color: #64748b;
}

.result-box {
  margin-top: 24px;
  background-color: #ecfdf5;
  border: 1px solid #d1fae5;
  padding: 20px;
  border-radius: 16px;
}

.result-header {
  margin-bottom: 12px;
}

.result-title {
  font-size: 15px;
  font-weight: bold;
  color: #065f46;
}

.code-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #ffffff;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px dashed #10b981;
  margin-bottom: 12px;
}

.code-text {
  font-size: 16px;
  font-weight: 900;
  color: #047857;
  letter-spacing: 1px;
  word-break: break-all;
  flex: 1;
  margin-right: 12px;
}

.btn-copy {
  flex-shrink: 0;
  background-color: #d1fae5;
  padding: 6px 12px;
  border-radius: 20px;
}

.btn-copy text {
  font-size: 13px;
  font-weight: bold;
  color: #059669;
}

.expiry {
  font-size: 13px;
  color: #059669;
  display: flex;
  align-items: center;
}

.guide-box {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #a7f3d0;
}

.guide-title {
  font-size: 14px;
  font-weight: bold;
  color: #065f46;
  margin-bottom: 8px;
  display: block;
}

.guide-text {
  font-size: 13px;
  color: #047857;
  line-height: 1.6;
  display: block;
  margin-bottom: 4px;
}

.highlight {
  font-weight: bold;
  color: #065f46;
  background-color: #d1fae5;
  padding: 0 4px;
  border-radius: 4px;
}
</style>
