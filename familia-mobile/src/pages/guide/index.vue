<template>
  <view class="guide-container">
    <swiper class="swiper" :indicator-dots="true" :autoplay="false" indicator-active-color="#4f46e5" @change="onSwiperChange">
      <!-- 第 1 頁 -->
      <swiper-item>
        <view class="slide">
          <view class="illustration bg-blue">
            <text class="icon">🏠</text>
          </view>
          <text class="title">歡迎來到 Familia</text>
          <text class="desc">您的掌上家族史館，隨時隨地連結親族、傳承歷史。</text>
        </view>
      </swiper-item>

      <!-- 第 2 頁 -->
      <swiper-item>
        <view class="slide">
          <view class="illustration bg-green">
            <text class="icon">🌳</text>
          </view>
          <text class="title">探索家族樹</text>
          <text class="desc">上下滑動查看祖先與後代，點擊成員即可查看詳情或新增親屬。</text>
        </view>
      </swiper-item>

      <!-- 第 3 頁 -->
      <swiper-item>
        <view class="slide">
          <view class="illustration bg-pink">
            <text class="icon">🖼️</text>
          </view>
          <text class="title">珍藏老照片</text>
          <text class="desc">上傳老照片並利用 AI 辨識人臉，讓回憶永遠不褪色。</text>
        </view>
      </swiper-item>

      <!-- 第 4 頁 -->
      <swiper-item>
        <view class="slide">
          <view class="illustration bg-orange">
            <text class="icon">📖</text>
          </view>
          <text class="title">記錄家族大事</text>
          <text class="desc">在「探索」中查看家族大事記與重要行事曆，不忘本、不忘恩。</text>
          <button class="start-btn" @click="startApp">開始探索我的家族</button>
        </view>
      </swiper-item>
    </swiper>
    
    <view class="skip-btn" v-if="currentIndex < 3" @click="startApp">
      <text>跳過</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const currentIndex = ref(0)

const onSwiperChange = (e) => {
  currentIndex.value = e.detail.current
}

const startApp = () => {
  // 記錄已看過教學
  uni.setStorageSync('has_seen_guide', true)
  // 跳轉到首頁
  uni.switchTab({
    url: '/pages/index/index'
  })
}
</script>

<style scoped>
.guide-container {
  width: 100vw;
  height: 100vh;
  background-color: #ffffff;
  position: relative;
}

.swiper {
  width: 100%;
  height: 100%;
}

.slide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  box-sizing: border-box;
}

.illustration {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 40px;
}

.bg-blue { background-color: #eff6ff; }
.bg-green { background-color: #ecfdf5; }
.bg-pink { background-color: #fdf2f8; }
.bg-orange { background-color: #fff7ed; }

.icon {
  font-size: 80px;
}

.title {
  font-size: 24px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 16px;
}

.desc {
  font-size: 16px;
  color: #64748b;
  text-align: center;
  line-height: 1.6;
  margin-bottom: 40px;
}

.start-btn {
  background-color: #4f46e5;
  color: white;
  width: 80%;
  border-radius: 25px;
  font-size: 16px;
  font-weight: bold;
  margin-top: 20px;
  border: none;
}

.skip-btn {
  position: absolute;
  top: 50px;
  right: 20px;
  padding: 10px;
  z-index: 10;
}

.skip-btn text {
  color: #94a3b8;
  font-size: 16px;
}
</style>
