<template>
  <view class="login-container">
    <view class="header">
      <view class="logo-box">
        <text class="logo-text">F</text>
      </view>
      <text class="title">Familia</text>
      <text class="subtitle">{{ $t('家族史永久傳承') }}</text>
    </view>

    <view class="form-box">
      <view class="input-group" v-if="isRegistering">
        <text class="label">{{ $t('邀請碼') }}</text>
        <input class="input" v-model="form.inviteCode" :placeholder="$t('請輸入您的專屬邀請碼')" placeholder-class="placeholder" />
      </view>

      <view class="input-group" v-if="isRegistering">
        <text class="label">{{ $t('您的姓名') }}</text>
        <input class="input" v-model="form.name" :placeholder="$t('請輸入您的真實姓名')" placeholder-class="placeholder" />
      </view>

      <view class="input-group">
        <text class="label">{{ $t('帳號 (信箱)') }}</text>
        <input class="input" v-model="form.email" :placeholder="$t('請輸入信箱')" placeholder-class="placeholder" auto-capitalize="none" />
      </view>
      
      <view class="input-group">
        <text class="label">{{ $t('密碼') }}</text>
        <input class="input" v-model="form.password" type="password" :placeholder="$t('請輸入密碼')" placeholder-class="placeholder" />
      </view>

      <button class="btn-login" :loading="loading" @click="handleSubmit">
        {{ isRegistering ? $t('註冊並加入家族') : $t('登入') }}
      </button>

      <view class="switch-mode" @click="toggleMode">
        <text>{{ isRegistering ? $t('已有帳號？點此登入') : $t('受邀加入？使用邀請碼註冊') }}</text>
      </view>

      <view class="create-family-link" v-if="!isRegistering" @click="goToCreateFamily">
        <text>{{ $t('全新用戶？點此建立新家族') }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { reactive, ref, getCurrentInstance } from 'vue';
import request from '@/utils/request';

const { proxy } = getCurrentInstance();
const t = proxy ? proxy.$t : (s) => s;
const isRegistering = ref(false);

const form = reactive({
  email: '',
  password: '',
  name: '',
  inviteCode: ''
});

const loading = ref(false);

const toggleMode = () => {
  isRegistering.value = !isRegistering.value;
  form.password = '';
};

const goToCreateFamily = () => {
  uni.navigateTo({ url: '/pages/login/create-family' });
};

const handleSubmit = async () => {
  if (isRegistering.value) {
    if (!form.email || !form.password || !form.name || !form.inviteCode) {
      return uni.showToast({ title: t('請填寫完整註冊資訊'), icon: 'none' });
    }
  } else {
    if (!form.email || !form.password) {
      return uni.showToast({ title: t('請填寫信箱與密碼'), icon: 'none' });
    }
  }

  loading.value = true;
  try {
    if (isRegistering.value) {
      // 註冊邏輯
      const res = await request.post('/auth/register-with-invite', {
        email: form.email,
        password: form.password,
        name: form.name,
        invite_code: form.inviteCode
      });
      
      if (res.token) {
        uni.setStorageSync('token', res.token);
        uni.setStorageSync('user', JSON.stringify(res.user));
        uni.showToast({ title: '註冊成功，歡迎加入！', icon: 'success' });
        setTimeout(() => {
          uni.switchTab({ url: '/pages/index/index' });
        }, 1500);
      }
    } else {
      // 登入邏輯
      const res = await request.post('/auth/login', {
        email: form.email,
        password: form.password
      });
      
      if (res.token) {
        uni.setStorageSync('token', res.token);
        uni.setStorageSync('user', JSON.stringify(res.user));
        
        uni.showToast({ title: '登入成功', icon: 'success' });
        setTimeout(() => {
          uni.switchTab({ url: '/pages/index/index' });
        }, 1000);
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
    // request.js 內已統一處理彈跳錯誤訊息
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background-color: #f8fafc;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 60px;
  margin-bottom: 50px;
}

.logo-box {
  width: 60px;
  height: 60px;
  background: #4f46e5;
  border-radius: 16px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  margin-bottom: 16px;
}

.logo-text {
  color: white;
  font-size: 32px;
  font-weight: 800;
}

.title {
  font-size: 28px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 8px;
}

.subtitle {
  font-size: 14px;
  color: #64748b;
}

.form-box {
  width: 100%;
  background: white;
  padding: 24px;
  border-radius: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

.input-group {
  margin-bottom: 20px;
}

.label {
  display: block;
  font-size: 12px;
  font-weight: bold;
  color: #64748b;
  margin-bottom: 8px;
}

.input {
  width: 100%;
  height: 44px;
  background: #f1f5f9;
  border-radius: 10px;
  padding: 0 16px;
  font-size: 14px;
  color: #334155;
  box-sizing: border-box;
}

.placeholder {
  color: #94a3b8;
}

.btn-login {
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
  margin-top: 10px;
  border: none;
}

.btn-login:active {
  background-color: #4338ca;
}

.switch-mode {
  margin-top: 24px;
  text-align: center;
  padding: 10px;
}

.switch-mode text {
  color: #4f46e5;
  font-size: 14px;
  font-weight: 600;
}

.create-family-link {
  margin-top: 10px;
  text-align: center;
  padding: 10px;
}

.create-family-link text {
  color: #059669;
  font-size: 14px;
  font-weight: 600;
  text-decoration: underline;
}
</style>
