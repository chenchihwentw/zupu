<template>
  <view class="container">
    <view class="header">
      <text class="title">編輯成員資料</text>
    </view>
    
    <view v-if="loading" class="loading">載入中...</view>
    
    <view v-else class="form-container">
      <!-- 處理大頭貼 -->
      <view class="avatar-upload-section" @click="handleUploadAvatar">
        <image v-if="form.avatar_url" :src="getFullUrl(form.avatar_url)" class="avatar-preview" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="emoji">📷</text>
          <text class="text">點擊上傳大頭貼</text>
        </view>
      </view>

      <!-- 基本資訊 -->
      <view class="section-title">基本資訊</view>
      <view class="form-group row">
        <view class="col">
          <text class="label">姓氏</text>
          <input class="input" v-model="form.surname" placeholder="輸入姓氏" />
        </view>
        <view class="col">
          <text class="label">名字</text>
          <input class="input" v-model="form.given_name" placeholder="輸入名字" />
        </view>
      </view>
      
      <view class="form-group row">
        <view class="col">
          <text class="label">性別</text>
          <picker @change="onGenderChange" :value="genderIndex" :range="genderOptions" range-key="label">
            <view class="picker-view">{{ genderOptions[genderIndex]?.label || '請選擇' }}</view>
          </picker>
        </view>
        <view class="col">
          <text class="label">國籍</text>
          <input class="input" v-model="form.nationality" placeholder="例如：台灣" />
        </view>
      </view>
      
      <view class="form-group switch-group">
        <text class="label">是否已故</text>
        <switch :checked="form.is_deceased" @change="e => form.is_deceased = e.detail.value" color="#4f46e5" />
      </view>
      
      <view class="form-group row">
        <view class="col">
          <text class="label">出生日期</text>
          <picker mode="date" :value="form.birth_date" @change="e => form.birth_date = e.detail.value">
            <view class="picker-view">{{ form.birth_date || '請選擇日期' }}</view>
          </picker>
        </view>
        <view class="col" v-if="form.is_deceased">
          <text class="label">離世日期</text>
          <picker mode="date" :value="form.death_date" @change="e => form.death_date = e.detail.value">
            <view class="picker-view">{{ form.death_date || '請選擇日期' }}</view>
          </picker>
        </view>
      </view>

      <view class="form-group row">
        <view class="col">
          <text class="label">出生地</text>
          <input class="input" v-model="form.birth_place" placeholder="輸入出生地" />
        </view>
        <view class="col">
          <text class="label">籍貫</text>
          <input class="input" v-model="form.ancestral_home" placeholder="輸入籍貫" />
        </view>
      </view>

      <!-- 聯絡方式 -->
      <view class="section-title">聯絡與地址</view>
      <view class="form-group row">
        <view class="col">
          <text class="label">主要電話</text>
          <input class="input" v-model="form.phone" placeholder="輸入聯絡電話" type="text" />
        </view>
        <view class="col">
          <text class="label">備用電話 1</text>
          <input class="input" v-model="form.phone2" placeholder="備用電話 1" type="text" />
        </view>
      </view>
      <view class="form-group row">
        <view class="col">
          <text class="label">備用電話 2</text>
          <input class="input" v-model="form.phone3" placeholder="備用電話 2" type="text" />
        </view>
        <view class="col">
          <text class="label">WeChat</text>
          <input class="input" v-model="form.wechat" placeholder="輸入微信號" />
        </view>
      </view>
      <view class="form-group">
        <text class="label">LINE</text>
        <input class="input" v-model="form.line" placeholder="輸入 LINE ID" />
      </view>
      
      <view class="form-group row">
        <view class="col">
          <text class="label">所在地 (省份/國別)</text>
          <input class="input" v-model="form.province" placeholder="例如：台灣" />
        </view>
        <view class="col">
          <text class="label">所在地 (縣市/鄉鎮)</text>
          <input class="input" v-model="form.city" placeholder="例如：台北市" />
        </view>
      </view>
      
      <view class="form-group">
        <text class="label">詳細地址</text>
        <input class="input" v-model="form.address" placeholder="輸入完整地址" />
      </view>

      <!-- 學歷與職涯 -->
      <view class="section-title">學歷與生平</view>
      <view class="form-group">
        <text class="label">最高學歷</text>
        <input class="input" v-model="form.education" placeholder="輸入學歷" />
      </view>
      <view class="form-group">
        <text class="label">職業</text>
        <input class="input" v-model="form.occupation" placeholder="輸入職業" />
      </view>
      <view class="form-group">
        <text class="label">個人成就 (使用逗號分隔)</text>
        <input class="input" v-model="form.achievementsText" placeholder="例如：傑出校友,企業家" />
      </view>

      <view class="form-group">
        <text class="label">生平事蹟</text>
        <textarea class="textarea" v-model="form.biography_md" placeholder="輸入生平簡介..."></textarea>
      </view>

      <view class="form-group">
        <text class="label">備註</text>
        <textarea class="textarea" v-model="form.remark" placeholder="其他備註資訊..." style="height: 80px;"></textarea>
      </view>
      
      <button class="save-btn" :loading="saving" @click="saveData">儲存設定</button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import request, { getFullUrl, BASE_URL } from '@/utils/request';

const memberId = ref(null);
const loading = ref(true);
const saving = ref(false);

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
];

const form = ref({
  avatar_url: '',
  surname: '', given_name: '', gender: 'male', is_deceased: false,
  birth_date: '', death_date: '', nationality: '', birth_place: '', ancestral_home: '',
  phone: '', phone2: '', phone3: '', wechat: '', line: '',
  province: '', city: '', address: '', education: '', occupation: '',
  achievementsText: '', remark: '', biography_md: ''
});

const genderIndex = computed(() => {
  const idx = genderOptions.findIndex(o => o.value === form.value.gender);
  return idx !== -1 ? idx : 0;
});

const onGenderChange = (e) => {
  form.value.gender = genderOptions[e.detail.value].value;
};

const fetchMember = async (id) => {
  loading.value = true;
  try {
    const res = await request.get('/family');
    if (Array.isArray(res)) {
      const found = res.find(m => m.id === id);
      if (found) {
        const defaultSurname = found.surname || (found.name ? found.name.charAt(0) : '');
        const defaultGivenName = found.given_name || (found.name ? found.name.slice(1) : '');
        
        form.value = {
          surname: defaultSurname,
          given_name: defaultGivenName,
          gender: found.gender || 'male',
          is_deceased: Boolean(found.is_deceased),
          birth_date: found.birth_date || '',
          death_date: found.death_date || '',
          nationality: found.nationality || '',
          birth_place: found.birth_place || '',
          ancestral_home: found.ancestral_home || '',
          phone: found.phone || '',
          phone2: found.phone2 || '',
          phone3: found.phone3 || '',
          wechat: found.wechat || '',
          line: found.line || '',
          province: found.province || '',
          city: found.city || '',
          address: found.address || '',
          education: found.education || '',
          occupation: found.occupation || '',
          achievementsText: Array.isArray(found.achievements) 
            ? found.achievements.map(a => {
                if (typeof a === 'object' && a !== null) {
                  return a.year ? `${a.year}: ${a.event}` : (a.event || '');
                }
                return String(a);
              }).filter(Boolean).join(', ') 
            : '',
          remark: found.remark || '',
          biography_md: found.biography_md || '',
          avatar_url: found.avatar_url || ''
        };
      }
    }
  } catch (error) {
    uni.showToast({ title: '讀取失敗', icon: 'none' });
  } finally {
    loading.value = false;
  }
};

const handleUploadAvatar = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (chooseRes) => {
      const tempFilePath = chooseRes.tempFilePaths[0];
      uni.showLoading({ title: '上傳中...' });
      
      const token = uni.getStorageSync('token');
      const familyTreeId = uni.getStorageSync('activeFamilyTreeId') || '';

      uni.uploadFile({
        url: BASE_URL + '/upload',
        filePath: tempFilePath,
        name: 'file',
        formData: {
          'type': 'avatar',
          'family_tree_id': familyTreeId
        },
        header: {
          'Authorization': `Bearer ${token}`
        },
        success: (uploadRes) => {
          uni.hideLoading();

          if (uploadRes.statusCode === 401 || uploadRes.statusCode === 403) {
            uni.removeStorageSync('token');
            uni.showToast({ title: '登入已過期，請重新登入', icon: 'none' });
            setTimeout(() => {
              uni.reLaunch({ url: '/pages/login/index' });
            }, 1500);
            return;
          }

          try {
            const data = JSON.parse(uploadRes.data);
            if (data.url || data.avatarUrl) {
              form.value.avatar_url = data.url || data.avatarUrl;
              uni.showToast({ title: '照片上傳成功', icon: 'success' });
            } else if (data.error) {
              uni.showToast({ title: data.error, icon: 'none' });
            }
          } catch(e) {
            uni.showToast({ title: '解析失敗', icon: 'none' });
          }
        },
        fail: (err) => {
          uni.hideLoading();
          uni.showToast({ title: '網路錯誤', icon: 'none' });
        }
      });
    }
  });
};

const saveData = async () => {
  if (!form.value.surname && !form.value.given_name) {
    uni.showToast({ title: '請至少填寫姓或名', icon: 'none' });
    return;
  }
  
  saving.value = true;
  try {
    const payload = { ...form.value };
    
    // 陣列轉換處理與年份解析
    payload.achievements = payload.achievementsText.split(',').map(s => {
      s = s.trim();
      if (!s) return null;
      // 支援 "1991: 事件" 或是 "1991：事件" 的格式
      const match = s.match(/^(\d{4})\s*[:：]\s*(.*)$/);
      if (match) {
        return { year: match[1], event: match[2] };
      }
      return { year: "", event: s };
    }).filter(Boolean);
    delete payload.achievementsText;
    
    // 如果有填寫全名，後端通常會把 surname + given_name 合併，這裡我們就交給後端處理
    payload.name = payload.surname + payload.given_name;
    
    if (payload.birth_date) {
      const [y, m, d] = payload.birth_date.split('-');
      payload.birth_year = parseInt(y);
      payload.birth_month = parseInt(m);
      payload.birth_day = parseInt(d);
    }
    
    if (payload.death_date && payload.is_deceased) {
      const [y, m, d] = payload.death_date.split('-');
      payload.death_year = parseInt(y);
      payload.death_month = parseInt(m);
      payload.death_day = parseInt(d);
    } else if (!payload.is_deceased) {
      payload.death_date = null;
      payload.death_year = null;
      payload.death_month = null;
      payload.death_day = null;
    }

    await request.put(`/family/${memberId.value}`, payload);
    uni.showToast({ title: '儲存成功', icon: 'success' });
    setTimeout(() => {
      uni.navigateBack();
    }, 1000);
  } catch (err) {
    uni.showToast({ title: '儲存失敗', icon: 'error' });
  } finally {
    saving.value = false;
  }
};

onLoad((options) => {
  if (options.id) {
    memberId.value = options.id;
    fetchMember(options.id);
  } else {
    uni.showToast({ title: '缺少 ID', icon: 'none' });
  }
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f8fafc;
  padding-bottom: 40px;
}
.header {
  background: #4f46e5;
  padding: 40px 20px 20px;
  color: white;
  text-align: center;
  border-bottom-left-radius: 20px;
  border-bottom-right-radius: 20px;
  margin-bottom: 20px;
}
.title {
  font-size: 20px;
  font-weight: bold;
}
.loading {
  text-align: center;
  padding: 40px;
  color: #64748b;
}
.form-container {
  padding: 0 20px 40px 20px;
}

.avatar-upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 30px;
  margin-top: 20px;
}

.avatar-preview {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 3px solid #e2e8f0;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  background: white;
}

.avatar-placeholder {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: 2px dashed #94a3b8;
  background: rgba(255,255,255,0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.avatar-placeholder .emoji {
  font-size: 24px;
}

.avatar-placeholder .text {
  font-size: 10px;
  color: #64748b;
  font-weight: bold;
}
.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #4f46e5;
  margin: 30px 0 15px;
  border-left: 4px solid #4f46e5;
  padding-left: 10px;
}
.form-group {
  margin-bottom: 20px;
}
.row {
  display: flex;
  gap: 15px;
}
.col {
  flex: 1;
}
.switch-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
.switch-group .label {
  margin-bottom: 0;
}
.label {
  display: block;
  font-size: 13px;
  color: #64748b;
  margin-bottom: 8px;
  font-weight: 500;
}
.input {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0 16px;
  height: 48px;
  font-size: 15px;
  color: #1e293b;
  box-sizing: border-box;
}
.picker-view, .textarea {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 15px;
  color: #1e293b;
  box-sizing: border-box;
}
.picker-view {
  min-height: 22px;
}
.textarea {
  width: 100%;
  height: 120px;
}
.save-btn {
  background: #4f46e5;
  color: white;
  border-radius: 12px;
  padding: 4px;
  font-size: 16px;
  font-weight: bold;
  margin-top: 30px;
  border: none;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}
.save-btn::after {
  border: none;
}
</style>
