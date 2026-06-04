<template>
  <view class="container">
    <view v-if="loading" class="loading-state">
      <text>載入中...</text>
    </view>
    <view v-else-if="!member" class="error-state">
      <text>找不到該成員資料</text>
    </view>
    <view v-else class="content">
      <!-- 頂部卡片 -->
      <view class="profile-header">
        <view class="avatar-wrapper">
          <image v-if="member.avatar_url" :src="getFullUrl(member.avatar_url)" class="avatar" mode="aspectFill" />
          <view v-else class="avatar-placeholder">
            <text>{{ member.surname }}{{ member.given_name?.charAt(0) || '氏' }}</text>
          </view>
        </view>
        <view class="name-info">
          <text class="name">{{ member.name || (member.surname + member.given_name) }}</text>
          <view class="tags">
            <text class="tag gender" :class="member.gender">{{ member.gender === 'male' ? '男' : '女' }}</text>
            <text v-if="member.generation" class="tag gen">第 {{ member.generation }} 世</text>
            <text v-if="member.is_deceased" class="tag deceased">已故</text>
          </view>
        </view>
        <view class="edit-btn-wrapper">
          <button class="edit-btn" @click="goToEdit">編輯</button>
        </view>
      </view>

      <!-- 資訊列表 -->
      <view class="info-card">
        <view class="section-title">基本資料</view>
        <view class="info-row" v-if="member.birth_date">
          <text class="label">出生日期</text>
          <text class="value">{{ member.birth_date }}</text>
        </view>
        <view class="info-row" v-if="member.death_date && member.is_deceased">
          <text class="label">離世日期</text>
          <text class="value">{{ member.death_date }}</text>
        </view>
        <view class="info-row" v-if="member.nationality">
          <text class="label">國籍</text>
          <text class="value">{{ member.nationality }}</text>
        </view>
        <view class="info-row" v-if="member.birth_place">
          <text class="label">出生地</text>
          <text class="value">{{ member.birth_place }}</text>
        </view>
        <view class="info-row" v-if="member.ancestral_home">
          <text class="label">籍貫</text>
          <text class="value">{{ member.ancestral_home }}</text>
        </view>
      </view>

      <!-- 聯絡與地址 -->
      <view class="info-card" v-if="member.phone || member.phone2 || member.phone3 || member.wechat || member.line || member.province || member.city || member.address">
        <view class="section-title">聯絡與地址</view>
        <view class="info-row" v-if="member.phone">
          <text class="label">主要電話</text>
          <text class="value">{{ member.phone }}</text>
        </view>
        <view class="info-row" v-if="member.phone2">
          <text class="label">備用電話 1</text>
          <text class="value">{{ member.phone2 }}</text>
        </view>
        <view class="info-row" v-if="member.phone3">
          <text class="label">備用電話 2</text>
          <text class="value">{{ member.phone3 }}</text>
        </view>
        <view class="info-row" v-if="member.wechat">
          <text class="label">WeChat</text>
          <text class="value">{{ member.wechat }}</text>
        </view>
        <view class="info-row" v-if="member.line">
          <text class="label">LINE</text>
          <text class="value">{{ member.line }}</text>
        </view>
        <view class="info-row" v-if="member.city || member.province">
          <text class="label">所在地</text>
          <text class="value">{{ member.province }} {{ member.city }}</text>
        </view>
        <view class="info-row" v-if="member.address">
          <text class="label">詳細地址</text>
          <text class="value">{{ member.address }}</text>
        </view>
      </view>

      <!-- 學歷與其他 -->
      <view class="info-card" v-if="member.education || member.occupation || (member.achievements && member.achievements.length) || member.remark">
        <view class="section-title">學歷與其他</view>
        <view class="info-row" v-if="member.education">
          <text class="label">最高學歷</text>
          <text class="value">{{ member.education }}</text>
        </view>
        <view class="info-row" v-if="member.occupation">
          <text class="label">職業</text>
          <text class="value">{{ member.occupation }}</text>
        </view>
        <view class="info-row" v-if="member.achievements && member.achievements.length">
          <text class="label">個人成就</text>
          <view class="value achievements-list">
            <view class="achievement-item" v-for="(ach, idx) in member.achievements" :key="idx">
              <text v-if="typeof ach === 'object' && ach.year" class="ach-year">{{ ach.year }} - </text>
              <text class="ach-event">{{ typeof ach === 'string' ? ach : (ach.event || '未知成就') }}</text>
            </view>
          </view>
        </view>
        <view class="info-row" v-if="member.remark">
          <text class="label">備註</text>
          <text class="value">{{ member.remark }}</text>
        </view>
      </view>

      <!-- 生平事蹟 (若有) -->
      <view class="info-card" v-if="member.biography_md">
        <view class="section-title">生平事蹟</view>
        <view class="bio-content">
          <rich-text :nodes="parsedBio"></rich-text>
        </view>
      </view>

      <!-- 親屬關係 -->
      <view class="info-card">
        <view class="section-title">親屬關係</view>
        
        <view class="relation-group" v-if="parents.length">
          <text class="relation-label">父母</text>
          <view class="relation-list">
            <view class="relation-chip" v-for="p in parents" :key="p.id" @click="goToDetail(p.id)">
              <text>{{ p.name }}</text>
            </view>
          </view>
        </view>
        
        <view class="relation-group" v-if="spouses.length">
          <text class="relation-label">配偶</text>
          <view class="relation-list">
            <view class="relation-chip" v-for="s in spouses" :key="s.id" @click="goToDetail(s.id)">
              <text>{{ s.name }}</text>
            </view>
          </view>
        </view>
        
        <view class="relation-group" v-if="children.length">
          <text class="relation-label">子女</text>
          <view class="relation-list">
            <view class="relation-chip" v-for="c in children" :key="c.id" @click="goToDetail(c.id)">
              <text>{{ c.name }}</text>
            </view>
          </view>
        </view>
        
        <view v-if="!parents.length && !spouses.length && !children.length" class="empty-relation">
          <text>暫無親屬資料</text>
        </view>
      </view>

      <!-- 個人相片館 -->
      <view class="info-card gallery-card">
        <view class="section-title gallery-title">
          <view>
            <text>個人相片館</text>
            <text class="gallery-size">已使用空間: {{ totalMediaSize }}</text>
          </view>
          <button class="upload-btn" @click="handleUploadMedia">上傳照片</button>
        </view>
        
        <view v-if="mediaLoading" class="gallery-loading">
          <text>載入中...</text>
        </view>
        <view v-else-if="mediaList.length === 0" class="empty-relation">
          <text>尚無照片，點擊右上方按鈕上傳</text>
        </view>
        <view v-else class="gallery-grid">
          <view class="gallery-item" v-for="media in mediaList" :key="media.id" @click="openMediaEdit(media)">
            <image :src="getFullUrl(media.file_path)" class="gallery-img" mode="aspectFill" />
            <view v-if="media.description || (media.title && media.title !== '手機上傳')" class="media-title-overlay">
              <text>{{ media.description || media.title }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 相片編輯彈窗 -->
    <view v-if="editingMedia" class="media-modal-overlay" @click="closeMediaEdit">
      <view class="media-modal-content" @click.stop>
        <view class="modal-header">
          <text class="modal-title">相片詳情</text>
          <text class="modal-close" @click="closeMediaEdit">✕</text>
        </view>
        <view class="modal-body">
          <view class="media-preview-container">
            <image :src="getFullUrl(editingMedia.file_path)" class="preview-img" mode="widthFix" @click="previewImage(editingMedia)" />
            <!-- Tags Overlay -->
            <view v-for="(tag, index) in mediaTags" :key="tag.id || index"
                  class="face-box"
                  :style="{ left: tag.box.x + '%', top: tag.box.y + '%', width: tag.box.w + '%', height: tag.box.h + '%' }"
                  :class="{'ai-suggested': tag.isAiSuggested}"
                  @click="handleTagClick(tag, index)">
               <view class="tag-label">
                 <text>{{ tag.name || tag.suggestedName || '?' }}</text>
                 <text v-if="calculateAge(tag.memberId || tag.suggestedMemberId, editingMedia.photo_date) !== null" class="age-text">
                   ({{ calculateAge(tag.memberId || tag.suggestedMemberId, editingMedia.photo_date) }}歲)
                 </text>
               </view>
            </view>
          </view>
          <view class="scan-action">
             <button class="ai-scan-btn" :loading="aiScanning" @click="runAiScan">🤖 AI 識別人臉</button>
             <button class="manual-tag-btn" @click="addManualTag">➕ 手動標註</button>
          </view>

          <view class="form-group">
            <text class="label">相片標題</text>
            <input class="input" v-model="editingMedia.title" placeholder="例如：1987年全家福" />
          </view>
          <view class="form-group">
            <text class="label">相片描述</text>
            <textarea class="textarea" v-model="editingMedia.description" placeholder="輸入照片背後的故事..." style="height: 60px;"></textarea>
          </view>
          <view class="form-group">
            <text class="label">拍攝日期</text>
            <picker mode="date" :value="editingMedia.photo_date" @change="e => editingMedia.photo_date = e.detail.value">
              <view class="picker-view">{{ editingMedia.photo_date || '請選擇日期' }}</view>
            </picker>
          </view>
        </view>
        <view class="modal-footer">
          <button class="delete-btn" @click="deleteMedia">刪除</button>
          <button class="save-btn modal-save" :loading="savingMedia" @click="saveMediaEdit">儲存設定</button>
        </view>
      </view>
    </view>

    <!-- 成員選擇彈窗 -->
    <view v-if="memberSelector.visible" class="media-modal-overlay" style="z-index: 1000" @click="memberSelector.visible = false">
      <view class="media-modal-content" style="max-height: 70vh; display: flex; flex-direction: column;" @click.stop>
        <view class="modal-header">
          <text class="modal-title">選擇成員</text>
          <text class="modal-close" @click="memberSelector.visible = false">✕</text>
        </view>
        <scroll-view scroll-y style="max-height: calc(70vh - 60px); padding: 0 16px;">
          <view v-for="m in allMembers" :key="m.id" class="member-list-item" @click="confirmMemberSelection(m)">
            <text>{{ m.name || (m.surname + (m.given_name || '')) }}</text>
            <text v-if="m.gender === 'male'" style="color: #60a5fa; margin-left: 8px;">♂</text>
            <text v-if="m.gender === 'female'" style="color: #f472b6; margin-left: 8px;">♀</text>
          </view>
        </scroll-view>
      </view>
    </view>

  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import request, { getFullUrl, BASE_URL } from '@/utils/request';
import { detectFacesAndDescriptors, compareFaces } from '@/utils/faceRecognition';

const member = ref(null);
const allMembers = ref([]);
const loading = ref(true);

// 相片館狀態
const mediaList = ref([]);
const mediaLoading = ref(false);
const editingMedia = ref(null);
const savingMedia = ref(false);
const mediaTags = ref([]);
const aiScanning = ref(false);

const totalMediaSize = computed(() => {
  let totalBytes = 0;
  mediaList.value.forEach(media => {
    try {
      if (media.metadata) {
        const meta = typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata;
        if (meta.size) totalBytes += parseInt(meta.size);
      }
    } catch(e) {}
  });
  if (totalBytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(totalBytes) / Math.log(k));
  return parseFloat((totalBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

const memberSelector = ref({
  visible: false,
  tag: null,
  isNew: false
});

const getMemberById = (id) => allMembers.value.find(m => m.id === id);

const calculateAge = (memberId, photoDate) => {
  if (!memberId || !photoDate) return null;
  const m = getMemberById(memberId);
  if (!m || !m.birth_date) return null;
  
  const birth = new Date(m.birth_date);
  const photo = new Date(photoDate);
  
  if (isNaN(birth.getTime()) || isNaN(photo.getTime())) return null;
  
  let age = photo.getFullYear() - birth.getFullYear();
  const monthDiff = photo.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && photo.getDate() < birth.getDate())) {
      age--;
  }
  
  return age >= 0 ? age : null;
};

// 將生平事蹟的簡單 Markdown (圖片與換行) 轉為 rich-text 可用的 HTML
const parsedBio = computed(() => {
  if (!member.value?.biography_md) return '';
  let md = member.value.biography_md;
  
  // 轉換 Markdown 圖片: ![alt](url) -> <img src="url" alt="alt" />
  md = md.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    const fullSrc = getFullUrl(src);
    return `<img src="${fullSrc}" alt="${alt}" style="max-width:100%; height:auto; margin:10px 0; border-radius:8px; display:block;" />`;
  });
  
  // 轉換換行: \n -> <br/>
  md = md.replace(/\n/g, '<br/>');
  
  return `<div style="line-height:1.6; color:#334155; font-size:15px;">${md}</div>`;
});

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

// 解析後的親屬資料
const parents = computed(() => {
  if (!member.value) return [];
  const rels = new Set();
  try {
    const parsed = typeof member.value.parents === 'string' ? JSON.parse(member.value.parents) : member.value.parents;
    if (Array.isArray(parsed)) parsed.forEach(r => rels.add(typeof r === 'string' ? r : r.id));
  } catch(e) {}

  allMembers.value.forEach(m => {
    try {
      const parsed = typeof m.children === 'string' ? JSON.parse(m.children) : m.children;
      if (Array.isArray(parsed) && parsed.map(c => typeof c === 'string' ? c : c.id).includes(member.value.id)) {
        rels.add(m.id);
      }
    } catch(e) {}
  });

  return sortByAge(Array.from(rels).map(id => getMemberById(id)).filter(Boolean));
});

const spouses = computed(() => {
  if (!member.value) return [];
  const rels = new Set();
  try {
    const parsed = typeof member.value.spouses === 'string' ? JSON.parse(member.value.spouses) : member.value.spouses;
    if (Array.isArray(parsed)) parsed.forEach(r => rels.add(typeof r === 'string' ? r : r.id));
  } catch(e) {}

  allMembers.value.forEach(m => {
    try {
      const parsed = typeof m.spouses === 'string' ? JSON.parse(m.spouses) : m.spouses;
      if (Array.isArray(parsed) && parsed.map(s => typeof s === 'string' ? s : s.id).includes(member.value.id)) {
        rels.add(m.id);
      }
    } catch(e) {}
  });

  return sortByAge(Array.from(rels).map(id => getMemberById(id)).filter(Boolean));
});

const children = computed(() => {
  if (!member.value) return [];
  const rels = new Set();
  try {
    const parsed = typeof member.value.children === 'string' ? JSON.parse(member.value.children) : member.value.children;
    if (Array.isArray(parsed)) parsed.forEach(r => rels.add(typeof r === 'string' ? r : r.id));
  } catch(e) {}

  allMembers.value.forEach(m => {
    try {
      const parsed = typeof m.parents === 'string' ? JSON.parse(m.parents) : m.parents;
      if (Array.isArray(parsed) && parsed.map(p => typeof p === 'string' ? p : p.id).includes(member.value.id)) {
        rels.add(m.id);
      }
    } catch(e) {}
  });

  return sortByAge(Array.from(rels).map(id => getMemberById(id)).filter(Boolean));
});

const fetchMemberDetail = async (id) => {
  loading.value = true;
  try {
    const res = await request.get('/family');
    if (Array.isArray(res)) {
      allMembers.value = res;
      const found = res.find(m => m.id === id);
      if (found) {
        member.value = found;
        fetchMedia(found.id);
      }
    }
  } catch (error) {
    console.error('Fetch detail error:', error);
  } finally {
    loading.value = false;
  }
};

const fetchMedia = async (memberId) => {
  mediaLoading.value = true;
  try {
    const res = await request.get(`/media?member_id=${memberId}`);
    if (Array.isArray(res)) {
      mediaList.value = res;
    }
  } catch (err) {
    console.error('Failed to fetch media:', err);
  } finally {
    mediaLoading.value = false;
  }
};

const previewImage = (media) => {
  const urls = mediaList.value.map(m => getFullUrl(m.file_path));
  const current = getFullUrl(media.file_path);
  uni.previewImage({
    urls: urls,
    current: current
  });
};

const openMediaEdit = async (media) => {
  editingMedia.value = { ...media };
  mediaTags.value = [];
  await fetchMediaTags(media.id);
};

const closeMediaEdit = () => {
  editingMedia.value = null;
};

const safeJSONParse = (str, defaultVal = null) => {
  try {
    if (!str || str === 'undefined') return defaultVal;
    return typeof str === 'string' ? JSON.parse(str) : str;
  } catch (e) {
    return defaultVal;
  }
};

const fetchMediaTags = async (mediaId) => {
  try {
    const res = await request.get(`/face-embeddings/${mediaId}`);
    if (Array.isArray(res)) {
      mediaTags.value = res.map(t => ({
        id: t.id,
        memberId: t.member_id,
        name: t.member_name,
        box: safeJSONParse(t.bounding_box, { x:0, y:0, w:0, h:0 })
      }));
    }
  } catch (e) {
    console.error('Failed to fetch tags', e);
  }
};

const runAiScan = async () => {
  aiScanning.value = true;
  uni.showLoading({ title: 'AI 掃描中...' });
  try {
    const fid = uni.getStorageSync('activeFamilyTreeId');
    let familyVectors = [];
    try {
      const res = await request.get(`/face-embeddings/family/${fid}`);
      if (Array.isArray(res)) {
        familyVectors = res.map(v => ({
          memberId: v.member_id,
          name: v.member_name,
          descriptor: safeJSONParse(v.embedding_data)
        })).filter(v => v.descriptor !== null); // 過濾掉沒有特徵值的資料
      }
    } catch(e) { console.log('No existing vectors'); }

    const imageUrl = getFullUrl(editingMedia.value.file_path);
    const detections = await detectFacesAndDescriptors(imageUrl);
    
    const newTags = detections.map(d => {
      let bestMatch = { memberId: null, name: null, distance: 1.0 };
      for (const fv of familyVectors) {
        const dist = compareFaces(d.descriptor, fv.descriptor);
        if (dist < bestMatch.distance) {
          bestMatch = { memberId: fv.memberId, name: fv.name, distance: dist };
        }
      }
      return {
        isAiSuggested: true,
        descriptor: d.descriptor,
        box: d.box,
        suggestedMemberId: bestMatch.distance < 0.6 ? bestMatch.memberId : null,
        suggestedName: bestMatch.distance < 0.6 ? bestMatch.name : null,
        name: bestMatch.distance < 0.6 ? bestMatch.name : '未知'
      };
    });
    
    mediaTags.value = [...mediaTags.value, ...newTags];
    uni.showToast({ title: `發現 ${newTags.length} 張人臉`, icon: 'success' });
  } catch(err) {
    console.error(err);
    uni.showToast({ title: '分析失敗', icon: 'none' });
  } finally {
    uni.hideLoading();
    aiScanning.value = false;
  }
};

const handleTagClick = (tag, index) => {
  uni.showActionSheet({
    itemList: ['儲存此標註', '選擇其他成員', '移除方框'],
    success: (res) => {
      if (res.tapIndex === 0) {
        if (tag.suggestedMemberId || tag.memberId) {
          saveTag(tag, tag.suggestedMemberId || tag.memberId);
        } else {
          uni.showToast({ title: '請先選擇成員', icon: 'none' });
        }
      } else if (res.tapIndex === 1) {
        memberSelector.value = { visible: true, tag, isNew: false };
      } else if (res.tapIndex === 2) {
        if (tag.id) deleteTag(tag.id, index);
        else mediaTags.value.splice(index, 1);
      }
    }
  });
};

const confirmMemberSelection = (selectedMember) => {
  memberSelector.value.visible = false;
  const tag = memberSelector.value.tag;
  if (memberSelector.value.isNew) {
    const newTag = { box: { x: 30, y: 30, w: 40, h: 40 }, isAiSuggested: false };
    saveTag(newTag, selectedMember.id);
  } else {
    saveTag(tag, selectedMember.id);
  }
};

const addManualTag = () => {
  memberSelector.value = { visible: true, tag: null, isNew: true };
};

const saveTag = async (tag, memberId) => {
  try {
    uni.showLoading({ title: '儲存中...' });
    await request.post('/face-embeddings', {
      id: tag.id || `tag_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      media_id: editingMedia.value.id,
      family_tree_id: uni.getStorageSync('activeFamilyTreeId'),
      member_id: memberId,
      bounding_box: JSON.stringify(tag.box),
      embedding_data: tag.descriptor ? JSON.stringify(tag.descriptor) : null,
      confidence: 1.0
    });
    uni.hideLoading();
    uni.showToast({ title: '標註成功', icon: 'success' });
    fetchMediaTags(editingMedia.value.id);
  } catch (e) {
    uni.hideLoading();
    uni.showToast({ title: '標註失敗', icon: 'none' });
  }
};

const deleteTag = async (tagId, index) => {
  try {
    await request.delete(`/face-embeddings/${tagId}`);
    uni.showToast({ title: '已移除', icon: 'success' });
    mediaTags.value.splice(index, 1);
  } catch(e) {
    uni.showToast({ title: '移除失敗', icon: 'none' });
  }
};

const saveMediaEdit = async () => {
  if (!editingMedia.value) return;
  savingMedia.value = true;
  try {
    const payload = {
      title: editingMedia.value.title,
      description: editingMedia.value.description,
      photo_date: editingMedia.value.photo_date
    };
    await request.put(`/media/${editingMedia.value.id}`, payload);
    uni.showToast({ title: '儲存成功', icon: 'success' });
    fetchMedia(member.value.id);
    closeMediaEdit();
  } catch (error) {
    uni.showToast({ title: '儲存失敗', icon: 'none' });
  } finally {
    savingMedia.value = false;
  }
};

const deleteMedia = () => {
  uni.showModal({
    title: '確認刪除',
    content: '確定要刪除這張照片嗎？此動作無法復原。',
    success: async (res) => {
      if (res.confirm) {
        try {
          await request.delete(`/media/${editingMedia.value.id}`);
          uni.showToast({ title: '已刪除', icon: 'success' });
          fetchMedia(member.value.id);
          closeMediaEdit();
        } catch (error) {
          uni.showToast({ title: '刪除失敗', icon: 'none' });
        }
      }
    }
  });
};

const handleUploadMedia = () => {
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
          'type': 'image',
          'family_tree_id': familyTreeId,
          'member_id': member.value.id
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
            if (data.url) {
              saveMediaRecord(data.url, data);
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

const saveMediaRecord = async (url, fileInfo) => {
  try {
    await request.post('/media', {
      id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      member_id: member.value.id,
      family_tree_id: uni.getStorageSync('activeFamilyTreeId'),
      file_path: url,
      media_type: 'image',
      title: '手機上傳',
      description: '',
      photo_date: new Date().toISOString().split('T')[0],
      metadata: JSON.stringify({
        size: fileInfo.size,
        mimetype: fileInfo.mimetype,
        originalName: fileInfo.originalname
      })
    });
    uni.showToast({ title: '上傳成功', icon: 'success' });
    fetchMedia(member.value.id);
  } catch (err) {
    console.error('Failed to save media record:', err);
    uni.showToast({ title: '照片儲存失敗', icon: 'none' });
  }
};

const goToDetail = (id) => {
  uni.redirectTo({
    url: `/pages/member/detail?id=${id}`
  });
};

const goToEdit = () => {
  uni.navigateTo({
    url: `/pages/member/edit?id=${member.value.id}`
  });
};

const currentId = ref(null);

onLoad((options) => {
  if (options.id) {
    currentId.value = options.id;
    fetchMemberDetail(options.id);
  } else {
    loading.value = false;
  }
});

onShow(() => {
  if (currentId.value && !loading.value) {
    fetchMemberDetail(currentId.value);
  }
});
</script>

<style scoped>
.container {
  min-height: 100vh;
  background-color: #f1f5f9;
  padding-bottom: 40px;
}
.loading-state, .error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50vh;
  color: #64748b;
}
.profile-header {
  position: relative;
  background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%);
  padding: 40px 20px 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border-bottom-left-radius: 30px;
  border-bottom-right-radius: 30px;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.2);
}
.avatar-wrapper {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 4px solid rgba(255,255,255,0.3);
  margin-bottom: 16px;
  overflow: hidden;
}
.avatar {
  display: block;
  width: 100%;
  height: 100%;
}
.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 28px;
  font-weight: bold;
  color: #4f46e5;
}
.name-info {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.name {
  color: white;
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 12px;
}
.tags {
  display: flex;
  gap: 8px;
}
.tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: bold;
}
.tag.gender.male { background: rgba(255,255,255,0.2); color: white; }
.tag.gender.female { background: rgba(255,255,255,0.2); color: white; }
.tag.gen { background: rgba(255,255,255,0.2); color: white; }
.tag.deceased { background: #ef4444; color: white; }

.edit-btn-wrapper {
  position: absolute;
  top: 20px;
  right: 20px;
}
.edit-btn {
  background: rgba(255,255,255,0.2);
  color: white;
  border: 1px solid rgba(255,255,255,0.4);
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  line-height: 1.5;
  margin: 0;
}

.content {
  padding: 20px;
  margin-top: -10px;
}
.info-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.03);
}
.section-title {
  font-size: 16px;
  font-weight: bold;
  color: #1e293b;
  margin-bottom: 16px;
  border-left: 4px solid #4f46e5;
  padding-left: 8px;
}
.info-row {
  display: flex;
  margin-bottom: 12px;
}
.info-row:last-child {
  margin-bottom: 0;
}
.label {
  width: 80px;
  color: #64748b;
  font-size: 14px;
}
.value {
  flex: 1;
  color: #334155;
  font-size: 14px;
  font-weight: 500;
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.achievement-item {
  font-size: 14px;
  color: #1e293b;
  line-height: 1.5;
}
.ach-year {
  font-weight: 500;
  color: #4f46e5;
}

.bio-content {
  font-size: 14px;
  line-height: 1.6;
  color: #475569;
}
.relation-group {
  margin-bottom: 16px;
}
.relation-group:last-child {
  margin-bottom: 0;
}
.relation-label {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
}
.relation-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.relation-chip {
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  border: 1px solid #e2e8f0;
}
.empty-relation {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  padding: 10px 0;
}

/* 相片館專屬樣式 */
.gallery-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.upload-btn {
  background: #4f46e5;
  color: white;
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 16px;
  line-height: 1.5;
  margin: 0;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-top: 10px;
}

.gallery-item {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  background: #f1f5f9;
  position: relative;
}

.gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-title-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.5);
  padding: 4px;
}

.media-title-overlay text {
  color: white;
  font-size: 10px;
  display: block;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gallery-loading {
  text-align: center;
  padding: 20px;
  color: #94a3b8;
  font-size: 14px;
}

/* Modal Styles */
.media-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.media-modal-content {
  background: white;
  width: 100%;
  border-radius: 16px;
  padding: 20px;
  box-sizing: border-box;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.modal-title {
  font-size: 18px;
  font-weight: bold;
  color: #1e293b;
}

.media-preview-container {
  position: relative;
  width: 100%;
  max-height: 250px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.face-box {
  position: absolute;
  border: 2px solid #22c55e;
  background: rgba(34, 197, 94, 0.1);
  border-radius: 4px;
}

.face-box.ai-suggested {
  border-color: #eab308;
  background: rgba(234, 179, 8, 0.2);
}

.tag-label {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  display: flex;
  align-items: center;
}

.age-text {
  font-size: 10px;
  margin-left: 4px;
  opacity: 0.9;
}

.scan-action {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.ai-scan-btn {
  background: #8b5cf6;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3);
  flex: 1;
}

.manual-tag-btn {
  background: #10b981;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);
  flex: 1;
}

.member-list-item {
  padding: 16px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 16px;
  display: flex;
  align-items: center;
}
.member-list-item:active {
  background-color: #f8fafc;
}

.modal-close {
  font-size: 20px;
  color: #94a3b8;
  padding: 4px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
  gap: 12px;
}

.delete-btn {
  background: #ef4444;
  color: white;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  flex: 1;
}

.modal-save {
  margin-top: 0;
  flex: 1;
}

.gallery-size {
  font-size: 12px;
  color: #64748b;
  margin-left: 10px;
  font-weight: normal;
}
</style>
