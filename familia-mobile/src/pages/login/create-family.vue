<template>
  <view class="create-container">
    <view class="header">
      <text class="title">建立新家族</text>
      <text class="subtitle">成為家族管理員，開啟您的族譜傳承之旅</text>
    </view>
    
    <view class="form-box">
      <!-- 帳號資訊 -->
      <text class="section-title">管理員帳號設定</text>
      <view class="input-group">
        <text class="label">真實姓名</text>
        <input class="input" v-model="form.founderName" placeholder="請輸入您的姓名" />
      </view>
      <view class="input-group">
        <text class="label">電子信箱</text>
        <input class="input" v-model="form.founderEmail" placeholder="請輸入信箱" auto-capitalize="none" />
      </view>
      <view class="input-group">
        <text class="label">密碼</text>
        <input class="input" v-model="form.founderPassword" type="password" placeholder="請設定 6 位以上密碼" />
      </view>

      <!-- 家族資訊 -->
      <text class="section-title" style="margin-top:20px;">家族基本資訊</text>
      <view class="input-group">
        <text class="label">家族姓氏</text>
        <input class="input" v-model="form.surname" placeholder="例如：陳" />
      </view>
      <view class="input-group">
        <text class="label">祖籍 (選填)</text>
        <input class="input" v-model="form.ancestralHome" placeholder="例如：福建泉州" />
      </view>
      <view class="input-group">
        <text class="label">堂號 (選填)</text>
        <input class="input" v-model="form.hallName" placeholder="例如：穎川堂" />
      </view>

      <button class="btn-primary" :loading="loading" @click="handleCreate">建立家族並登入</button>
      
      <view class="back-link" @click="goBack">
        <text>取消，返回登入</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref } from 'vue';
import request from '@/utils/request';

const form = reactive({
  founderName: '',
  founderEmail: '',
  founderPassword: '',
  surname: '',
  ancestralHome: '',
  hallName: ''
});

const loading = ref(false);

const handleCreate = async () => {
  if (!form.founderName || !form.founderEmail || !form.founderPassword || !form.surname) {
    return uni.showToast({ title: '請填寫必填欄位 (姓名、信箱、密碼、姓氏)', icon: 'none' });
  }

  if (form.founderPassword.length < 6) {
    return uni.showToast({ title: '密碼長度至少需 6 個字元', icon: 'none' });
  }

  loading.value = true;
  try {
    const res = await request.post('/family/create', form);
    
    if (res.token) {
      uni.setStorageSync('token', res.token);
      uni.setStorageSync('user', JSON.stringify(res.user));
      if (res.user.familyTrees && res.user.familyTrees.length > 0) {
        uni.setStorageSync('activeFamilyTreeId', res.user.familyTrees[0].id);
      }
      uni.showToast({ title: '建立成功，歡迎加入！', icon: 'success' });
      setTimeout(() => {
        uni.switchTab({ url: '/pages/tree/index' });
      }, 1500);
    }
  } catch (error) {
    console.error('Create family error:', error);
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  uni.navigateBack();
};
</script>

<style scoped>
.create-container {
  min-height: 100vh;
  background-color: #f8fafc;
  padding: 30px 20px;
}

.header {
  margin-bottom: 24px;
}

.title {
  font-size: 26px;
  font-weight: bold;
  color: #1e293b;
  display: block;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #64748b;
}

.form-box {
  background-color: #ffffff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #4f46e5;
  margin-bottom: 16px;
  display: block;
  border-left: 4px solid #4f46e5;
  padding-left: 8px;
}

.input-group {
  margin-bottom: 16px;
}

.label {
  font-size: 14px;
  font-weight: bold;
  color: #334155;
  display: block;
  margin-bottom: 8px;
}

.input {
  background-color: #f1f5f9;
  height: 48px;
  border-radius: 12px;
  padding: 0 16px;
  font-size: 15px;
}

.btn-primary {
  width: 100%;
  height: 50px;
  background-color: #4f46e5;
  color: white;
  border-radius: 12px;
  font-size: 16px;
  font-weight: bold;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 24px;
  border: none;
}

.btn-primary:active {
  background-color: #4338ca;
}

.back-link {
  margin-top: 20px;
  text-align: center;
  padding: 10px;
}

.back-link text {
  color: #64748b;
  font-size: 14px;
  font-weight: 500;
  text-decoration: underline;
}
</style>
