import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { MEMBER_FIELDS, formatMemberValue, getFullDateString } from '../utils/memberSchema';
import HelpLink from './HelpLink';

const MemberDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { hasPermission, token, currentFamilyId } = useAuth();
    const canEdit = hasPermission('family_admin');
    const [member, setMember] = useState(null);
    const [activeTab, setActiveTab] = useState('basic'); // 'basic', 'biography', 'photos'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMemberDetail();
    }, [id]);

    const fetchMemberDetail = async () => {
        try {
            const response = await axios.get(`/api/member/${id}`);
            setMember(response.data);
        } catch (error) {
            console.error('Failed to fetch member detail:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={styles.loading}>正在載入資料...</div>;
    }

    if (!member) {
        return <div style={styles.error}>找不到該成員資料</div>;
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <button 
                    onClick={() => navigate('/')} 
                    style={styles.backButton}
                >
                    ← 返回族譜
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <h1 style={styles.name}>{member.name}</h1>
                    <HelpLink section="tree-navigation" style={{ backgroundColor: 'white' }} />
                </div>
                {member.is_deceased && (
                    <button 
                        onClick={() => navigate(`/memorial/${id}`)}
                        style={{ 
                            ...styles.editButton, 
                            backgroundColor: '#C41E3A', 
                            color: 'white',
                            marginRight: '10px'
                        }}
                    >
                        {member.religion === 'CHRISTIAN' ? '🙏 進殿追思' : '🙏 進殿祭奠'}
                    </button>
                )}
                {canEdit && (
                    <button 
                        onClick={() => navigate(`/member/${id}/edit`)}
                        style={styles.editButton}
                    >
                        編輯資料
                    </button>
                )}
                {canEdit && activeTab === 'biography' && (
                    <button 
                        onClick={() => navigate(`/member/${id}/biography/edit`)}
                        style={{ ...styles.editButton, backgroundColor: '#52c41a' }}
                    >
                        ✏️ 編輯生平
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
                <button
                    onClick={() => setActiveTab('basic')}
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'basic' ? styles.activeTab : {})
                    }}
                >
                    基本資料
                </button>
                <button
                    onClick={() => setActiveTab('biography')}
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'biography' ? styles.activeTab : {})
                    }}
                >
                    {member.is_deceased ? '🏮 紀念館' : '📝 個人自傳'}
                </button>
                <button
                    onClick={() => setActiveTab('photos')}
                    style={{
                        ...styles.tab,
                        ...(activeTab === 'photos' ? styles.activeTab : {})
                    }}
                >
                    🖼️ 相冊照片
                </button>
            </div>

            {/* Tab Content */}
            <div style={styles.content}>
                {activeTab === 'basic' && (
                    <BasicInfoTab member={member} />
                )}
                {activeTab === 'biography' && (
                    <BiographyTab memberId={id} member={member} canEdit={canEdit} />
                )}
                {activeTab === 'photos' && (
                    <PhotosTab member={member} />
                )}
            </div>
        </div>
    );
};

// Basic Info Tab Component
const BasicInfoTab = ({ member }) => {
    // 定義要顯示的欄位組合
    const fieldGroups = [
        { title: '核心身分', fields: ['name', 'gender', 'generation'] },
        { title: '文化稱謂', fields: ['courtesy_name', 'pseudonym', 'aliases', 'clan_name', 'ancestral_home'] },
        { title: '生卒年代', fields: ['birth_date_full', 'death_date_full', 'nationality', 'birth_place'] },
        { title: '社會背景', fields: ['education', 'occupation'] },
        { title: '聯繫方式', fields: ['phone', 'email', 'address', 'remark'] }
    ];

    return (
        <div style={styles.tabContent}>
            {fieldGroups.map((group, gIdx) => (
                <div key={gIdx} style={{ marginBottom: '24px' }}>
                    <h3 style={styles.groupTitle}>{group.title}</h3>
                    <div style={styles.infoGrid}>
                        {group.fields.map(key => {
                            let label = MEMBER_FIELDS[key]?.label || key;
                            let value = '';
                            
                            if (key === 'birth_date_full') value = getFullDateString(member, 'birth');
                            else if (key === 'death_date_full') {
                                if (!member.is_deceased) return null;
                                value = getFullDateString(member, 'death');
                            }
                            else value = formatMemberValue(key, member[key], member);

                            return <InfoItem key={key} label={label} value={value} />;
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

const InfoItem = ({ label, value }) => (
    <div style={styles.infoItem}>
        <div style={styles.infoLabel}>{label}</div>
        <div style={styles.infoValue}>{value}</div>
    </div>
);

// Biography Tab Component
const BiographyTab = ({ memberId, member, canEdit }) => {
    const [biography, setBiography] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBiography();
    }, [memberId]);

    const fetchBiography = async () => {
        try {
            const response = await axios.get(`/api/member/${memberId}/biography`);
            setBiography(response.data);
        } catch (error) {
            console.error('Failed to fetch biography:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div style={styles.loading}>Loading biography...</div>;
    }

    // 🛡️ Robust parsing for achievements from member object
    const safeParseAchievements = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        let parsed = data;
        // Recursive parse to handle multiple stringifications
        while (typeof parsed === 'string') {
            try {
                const next = JSON.parse(parsed);
                if (next === parsed) break; // Infinite loop protection
                parsed = next;
            } catch (e) {
                break;
            }
        }
        return Array.isArray(parsed) ? parsed : [];
    };

    const achievements = safeParseAchievements(member.achievements);
    const sortedAchievements = [...achievements].sort((a, b) => {
        const yearA = parseInt(a.year) || 0;
        const yearB = parseInt(b.year) || 0;
        return yearB - yearA; // Newest first
    });

    return (
        <div style={styles.biographyContent}>
            {/* 🏆 Achievements Timeline */}
            {sortedAchievements.length > 0 && (
                <div style={styles.timelineSection}>
                    <h3 style={styles.timelineHeader}>
                        <span style={styles.timelineIcon}>📜</span> 大事記 / 成就
                    </h3>
                    <div style={styles.timelineContainer}>
                        {sortedAchievements.map((item, idx) => (
                            <div key={idx} style={styles.timelineItem}>
                                <div style={styles.timelineYear}>{item.year}</div>
                                <div style={styles.timelineDot}></div>
                                <div style={styles.timelineCard}>
                                    <div style={styles.timelineEvent}>{item.event}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {biography?.content_md ? (
                <div style={styles.biographyViewer}>
                    <div style={styles.biographyText}>
                        <SimpleMarkdownRenderer content={biography.content_md} />
                    </div>
                </div>
            ) : (
                <div style={styles.emptyBiography}>
                    <p>目前尚未為此成員編寫生平介紹。</p>
                    {canEdit && (
                        <button
                            onClick={() => window.location.href = `/member/${memberId}/biography/edit`}
                            style={styles.createButton}
                        >
                            撰寫生平
                        </button>
                    )}
                </div>
            )}

            {canEdit && biography?.content_md && (
                <div style={styles.editAction}>
                    <button
                        onClick={() => window.location.href = `/member/${memberId}/biography/edit`}
                        style={styles.editBioButton}
                    >
                        ✏️ 編輯生平
                    </button>
                </div>
            )}
        </div>
    );
};

// Simple Markdown Renderer
const SimpleMarkdownRenderer = ({ content }) => {
    if (!content) return null;

    const lines = content.split('\n');
    
    return (
        <div>
            {lines.map((line, index) => {
                if (line.startsWith('# ')) {
                    return <h1 key={index} style={{ fontSize: '28px', marginTop: '24px', marginBottom: '16px' }}>{line.slice(2)}</h1>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={index} style={{ fontSize: '24px', marginTop: '20px', marginBottom: '12px' }}>{line.slice(3)}</h2>;
                }
                if (line.startsWith('### ')) {
                    return <h3 key={index} style={{ fontSize: '20px', marginTop: '16px', marginBottom: '8px' }}>{line.slice(4)}</h3>;
                }
                if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <li key={index} style={{ marginLeft: '20px' }}>{line.slice(2)}</li>;
                }
                if (line.trim() === '') {
                    return <br key={index} />;
                }
                // Check for Markdown image: ![alt](url "size:xxx")
                if (line.startsWith('![')) {
                    const match = line.match(/!\[(.*?)\]\((.*?)(?:\s+"(.*?)")?\)/);
                    if (match) {
                        const alt = match[1];
                        const src = match[2];
                        const title = match[3] || '';
                        
                        // Extract size from title
                        let width = '600px'; // default medium
                        if (title.includes('size:small')) width = '300px';
                        else if (title.includes('size:large')) width = '900px';
                        else if (title.includes('size:full')) width = '100%';
                        
                        return <img key={index} src={src} alt={alt} style={{ maxWidth: width, width: '100%', borderRadius: '8px', margin: '16px 0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', display: 'block' }} />;
                    }
                }
                return <p key={index} style={{ marginBottom: '12px' }}>{line}</p>;
            })}
        </div>
    );
};

// Photos Tab Component
const PhotosTab = ({ member }) => {
    const { user, token, currentFamilyId, hasPermission } = useAuth();
    const canEdit = hasPermission('family_admin');
    const [photos, setPhotos] = useState([]);
    const [allMembers, setAllMembers] = useState([]); // 用於標註時選擇
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [tags, setTags] = useState([]); // 當前照片的標籤
    const [aiSuggestions, setAiSuggestions] = useState([]); // AI 偵測到的建議
    const [memberDescriptor, setMemberDescriptor] = useState(null); // 當前成員的基準特徵
    const [showMemberSelector, setShowMemberSelector] = useState(false); // 顯示成員選擇彈窗
    const [pendingTagPosition, setPendingTagPosition] = useState(null); // 待標記的位置
    const [showUploadForm, setShowUploadForm] = useState(false); // 顯示上傳表單
    const [uploadFormData, setUploadFormData] = useState({
        description: '',
        photoDate: '',
        file: null
    }); // 上傳表單數據
    const [showPhotoEditor, setShowPhotoEditor] = useState(false); // 顯示照片編輯器
    const [photoEditData, setPhotoEditData] = useState({
        description: '',
        photoDate: ''
    }); // 照片編輯數據
    const [familyDescriptors, setFamilyDescriptors] = useState([]); // ✨ 家族成員特徵庫 [{ memberId, name, descriptor }]
    const [isPreloading, setIsPreloading] = useState(false);
    const [storageStatus, setStorageStatus] = useState(null); // ✨ 存儲配額狀態

    useEffect(() => {
        const initAI = async () => {
            try {
                const { loadFaceModels } = await import('../utils/faceRecognition');
                await loadFaceModels();
                console.log('[AI] 準備就緒');
                
                // 學習當前人物特徵 (優先)
                if (member.avatar) {
                    learnMemberFace(member.avatar);
                }

                // 獲取數據後觸發全族預加載與儲存狀態
                const fetchData = async () => {
                    await fetchPhotos();
                    await fetchStorageStatus();
                    const members = await fetchAllMembers();
                    if (members && members.length > 0) {
                        preloadFamilyDescriptors(members);
                    }
                };
                fetchData();
            } catch (err) {
                console.error('[AI] 初始化失敗', err);
            }
        };
        initAI();
    }, [member.id]);

    // 2. 當切換照片時，獲取標籤並執行自動掃描
    useEffect(() => {
        if (selectedPhoto) {
            fetchTags(selectedPhoto.id);
            runAiScan(selectedPhoto.file_path);
        } else {
            setAiSuggestions([]);
        }
    }, [selectedPhoto]);

    const learnMemberFace = async (avatarUrl) => {
        try {
            const { detectFacesAndDescriptors } = await import('../utils/faceRecognition');
            const detections = await detectFacesAndDescriptors(avatarUrl);
            if (detections.length > 0) {
                setMemberDescriptor(detections[0].descriptor);
                console.log('[AI] 已學習該成員的面部特徵');
            }
        } catch (err) { console.error('[AI] 學習失敗', err); }
    };

    const preloadFamilyDescriptors = async (members) => {
        if (isPreloading) return;
        setIsPreloading(true);
        console.log(`[AI] 開始預加載家族特徵庫 (成員總數: ${members.length})`);
        
        try {
            const { detectFacesAndDescriptors } = await import('../utils/faceRecognition');
            const membersWithAvatar = members.filter(m => m.avatar);
            const descriptors = [];
            
            // 併發限制：逐個學習或分批，避免阻塞
            for (const m of membersWithAvatar) {
                try {
                    const detections = await detectFacesAndDescriptors(m.avatar);
                    if (detections.length > 0) {
                        descriptors.push({
                            memberId: m.id,
                            name: m.name,
                            descriptor: detections[0].descriptor
                        });
                    }
                } catch (e) { /* 靜默處理單個錯誤 */ }
            }
            
            setFamilyDescriptors(descriptors);
            console.log(`[AI] 家族特徵庫預加載完成，已學習 ${descriptors.length} 位成員`);
        } catch (err) {
            console.error('[AI] 預加載失敗', err);
        } finally {
            setIsPreloading(false);
        }
    };

    const runAiScan = async (imageUrl) => {
        try {
            const { detectFacesAndDescriptors, compareFaces } = await import('../utils/faceRecognition');
            const detections = await detectFacesAndDescriptors(imageUrl);
            
            const suggestions = detections.map(d => {
                let bestMatch = { memberId: null, name: null, distance: 1.0 };
                
                // ✨ [GLOBAL MATCH] 與家族特徵庫進行比對
                for (const fd of familyDescriptors) {
                    const dist = compareFaces(d.descriptor, fd.descriptor);
                    if (dist < bestMatch.distance) {
                        bestMatch = { memberId: fd.memberId, name: fd.name, distance: dist };
                    }
                }
                
                // 也要考慮當前頁面主角 (可能不在 descriptors 列表中)
                if (memberDescriptor) {
                    const dist = compareFaces(d.descriptor, memberDescriptor);
                    if (dist < bestMatch.distance) {
                        bestMatch = { memberId: member.id, name: member.name, distance: dist };
                    }
                }

                let status = 'unknown';
                // 距離 < 0.45 視為強匹配，< 0.6 視為疑似
                if (bestMatch.distance < 0.45) status = 'strong';
                else if (bestMatch.distance < 0.6) status = 'weak';

                return {
                    ...d,
                    status,
                    distance: bestMatch.distance,
                    suggestedMemberId: bestMatch.memberId,
                    suggestedName: status !== 'unknown' ? bestMatch.name : null
                };
            });
            
            console.log(`[AI] 掃描完成，發現 ${suggestions.length} 張人臉`, suggestions);
            setAiSuggestions(suggestions);

            // ✨ [AUTO TAG] 對於強匹配且尚未被標註的人臉，自動執行保存
            setTimeout(() => {
                performAutoTagging(suggestions);
            }, 1000);

        } catch (err) { console.error('[AI] 掃描失敗', err); }
    };

    const performAutoTagging = async (suggestions) => {
        const strongMatches = suggestions.filter(s => s.status === 'strong' && s.suggestedMemberId);
        if (strongMatches.length === 0) return;

        console.log(`[AI] 啟動自動標註，發現 ${strongMatches.length} 個強匹配對象`);
        
        for (const s of strongMatches) {
            // 檢查是否已經存在相同成員的標籤，避免重複
            const isAlreadyTagged = tags.some(t => t.member_id === s.suggestedMemberId);
            if (isAlreadyTagged) continue;

            try {
                await axios.post('/api/face-embeddings', {
                    id: `autotag_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    media_id: selectedPhoto.id,
                    member_id: s.suggestedMemberId,
                    embedding_data: null,
                    bounding_box: JSON.stringify({ x: s.box.x + s.box.w/2, y: s.box.y + s.box.h/2, w: s.box.w, h: s.box.h }),
                    confidence: (1 - s.distance).toFixed(2)
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log(`[AI] ✨ 自動標註成功: ${s.suggestedName}`);
            } catch (err) { console.error(`[AI] 自動標註 ${s.suggestedName} 失敗:`, err); }
        }
        
        // 重新獲取標籤以更新 UI
        if (selectedPhoto) fetchTags(selectedPhoto.id);
    };

    const fetchStorageStatus = async () => {
        try {
            const response = await axios.get(`/api/user/storage?family_tree_id=${currentFamilyId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStorageStatus(response.data);
        } catch (err) { console.error('[Storage] Fetch failed:', err); }
    };

    const fetchPhotos = async () => {
        try {
            const response = await axios.get(`/api/media?member_id=${member.id}`);
            console.log(`[Photos] Fetched ${response.data.length} photos for member ${member.id}`, response.data);
            setPhotos(response.data);
        } catch (error) {
            console.error('Failed to fetch photos:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllMembers = async () => {
        try {
            const response = await axios.get(`/api/family?family_tree_id=${currentFamilyId}`);
            setAllMembers(response.data);
            return response.data;
        } catch (err) { 
            console.error(err); 
            return [];
        }
    };

    const fetchTags = async (mediaId) => {
        try {
            const response = await axios.get(`/api/face-embeddings/${mediaId}`);
            setTags(response.data);
        } catch (err) { console.error(err); }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 嘗試從 EXIF 提取日期
        let extractedDate = '';
        try {
            const { extractDateFromImage } = await import('../utils/imageUtils');
            extractedDate = await extractDateFromImage(file);
        } catch (err) {
            console.log('無法提取 EXIF 日期');
        }
        
        console.log('[EXIF] Extracted raw date:', extractedDate);
        
        const finalDate = extractedDate || new Date().toISOString().split('T')[0];
        console.log('[EXIF] Setting photoDate in form to:', finalDate);
        
        setUploadFormData({
            description: '',
            photoDate: finalDate,
            file: file
        });
        setShowUploadForm(true);
    };

    const submitUpload = async () => {
        if (!uploadFormData.file) return;
        
        setUploading(true);
        const formData = new FormData();
        formData.append('photo_date', uploadFormData.photoDate);
        formData.append('type', 'gallery');
        formData.append('file', uploadFormData.file);
        
        try {
            const uploadRes = await axios.post('/api/upload', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (uploadRes.data.success) {
                await axios.post('/api/media', {
                    // ... 
                    id: `media_${Date.now()}`,
                    member_id: member.id,
                    family_tree_id: currentFamilyId,
                    file_path: uploadRes.data.url,
                    media_type: 'image',
                    title: uploadFormData.file.name,
                    description: uploadFormData.description,
                    photo_date: uploadFormData.photoDate,
                    uploaded_by: user?.id || 'anonymous',
                    metadata: JSON.stringify({ 
                        size: uploadRes.data.size, 
                        mime: uploadRes.data.mimetype,
                        photo_date: uploadFormData.photoDate 
                    })
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                setShowUploadForm(false);
                setUploadFormData({ description: '', photoDate: '', file: null });
                fetchPhotos();
                fetchStorageStatus(); // ✨ 更新存儲狀態
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || '上傳失敗';
            alert(`上傳失敗: ${errorMsg}`);
        } finally { setUploading(false); }
    };

    // 計算年齡
    const calculateAge = (memberId, photoDate) => {
        const member = allMembers.find(m => m.id === memberId);
        if (!member || !member.birth_date || !photoDate) return null;
        
        const birth = new Date(member.birth_date);
        const photo = new Date(photoDate);
        
        if (isNaN(birth.getTime()) || isNaN(photo.getTime())) return null;
        
        let age = photo.getFullYear() - birth.getFullYear();
        const monthDiff = photo.getMonth() - birth.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && photo.getDate() < birth.getDate())) {
            age--;
        }
        
        return age >= 0 ? age : null;
    };

    // 打開照片編輯器
    const openPhotoEditor = () => {
        if (!selectedPhoto) return;
        
        // ✨ [STRENGTHENED] 使用統一的日期提取助手，確保編輯回顯不再為空
        const photoDate = getPhotoDate(selectedPhoto) || '';
        
        setPhotoEditData({
            description: selectedPhoto.description || '',
            photoDate: photoDate
        });
        setShowPhotoEditor(true);
    };

    // 保存照片編輯
    const savePhotoEdit = async () => {
        if (!selectedPhoto) return;
        
        try {
            await axios.put(`/api/media/${selectedPhoto.id}`, {
                description: photoEditData.description,
                photo_date: photoEditData.photoDate,
                metadata: JSON.stringify({
                    ...JSON.parse(selectedPhoto.metadata || '{}'),
                    photo_date: photoEditData.photoDate
                })
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // 更新本地數據
            setSelectedPhoto(prev => ({
                ...prev,
                description: photoEditData.description,
                photo_date: photoEditData.photoDate
            }));
            
            setShowPhotoEditor(false);
            fetchPhotos(); // 刷新列表
        } catch (err) {
            alert('保存失敗: ' + err.message);
        }
    };

    const handleAddTag = async (e, customData = null) => {
        if (!canEdit || !selectedPhoto) return;
        
        let x, y, targetId;
        if (customData) {
            x = customData.x;
            y = customData.y;
            targetId = customData.member_id;
            // AI 建議直接標記
            try {
                await axios.post('/api/face-embeddings', {
                    id: `tag_${Date.now()}`,
                    media_id: selectedPhoto.id,
                    member_id: targetId,
                    embedding_data: null,
                    bounding_box: JSON.stringify({ x, y, w: 5, h: 5 }),
                    confidence: 1.0
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                fetchTags(selectedPhoto.id);
                setAiSuggestions(prev => prev.filter(s => s.distance !== customData.distance));
            } catch (err) { alert("標註失敗"); }
        } else {
            // 手動點擊 - 顯示成員選擇彈窗
            const rect = e.target.getBoundingClientRect();
            x = ((e.clientX - rect.left) / rect.width) * 100;
            y = ((e.clientY - rect.top) / rect.height) * 100;
            setPendingTagPosition({ x, y });
            setShowMemberSelector(true);
        }
    };

    const handleSelectMemberForTag = async (targetId) => {
        if (!targetId || !pendingTagPosition) return;
        
        try {
            await axios.post('/api/face-embeddings', {
                id: `tag_${Date.now()}`,
                media_id: selectedPhoto.id,
                member_id: targetId,
                embedding_data: null,
                bounding_box: JSON.stringify({ x: pendingTagPosition.x, y: pendingTagPosition.y, w: 5, h: 5 }),
                confidence: 1.0
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTags(selectedPhoto.id);
        } catch (err) { 
            alert("標註失敗"); 
        } finally {
            setShowMemberSelector(false);
            setPendingTagPosition(null);
        }
    };

    const getPhotoDate = (photo) => {
        if (!photo) return null;
        if (photo.photo_date && photo.photo_date !== 'null') return photo.photo_date;
        if (photo.metadata) {
            try {
                const meta = typeof photo.metadata === 'string' ? JSON.parse(photo.metadata) : photo.metadata;
                return meta.photo_date || null;
            } catch (e) { return null; }
        }
        return null;
    };

    const handleDeleteTag = async (e, tagId) => {
        e.stopPropagation();
        if (!window.confirm("確定刪除此標記？")) return;
        try {
            await axios.delete(`/api/face-embeddings/${tagId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTags(selectedPhoto.id);
        } catch (err) { alert("刪除失敗"); }
    };

    if (loading) return <div style={styles.loading}>正在載入相冊...</div>;

    return (
        <div style={styles.photosContent}>
            {/* ✨ 智能容量儀表板 */}
            {storageStatus && (
                <div style={styles.storageDashboard}>
                    <div style={styles.storageItem}>
                        <div style={styles.storageLabel}>
                            <span>📂 家族空間已用 ({Math.round(storageStatus.family.used_bytes / 1024 / 1024)}MB / {storageStatus.family.limit_mb}MB)</span>
                            <span>{Math.round((storageStatus.family.used_bytes / 1024 / 1024 / storageStatus.family.limit_mb) * 100)}%</span>
                        </div>
                        <div style={styles.progressBarBg}>
                            <div style={{
                                ...styles.progressBarFill,
                                width: `${Math.min(100, (storageStatus.family.used_bytes / 1024 / 1024 / storageStatus.family.limit_mb) * 100)}%`,
                                backgroundColor: storageStatus.family.used_bytes / 1024 / 1024 / storageStatus.family.limit_mb > 0.9 ? '#ff4d4f' : '#1890ff'
                            }} />
                        </div>
                    </div>
                    <div style={styles.storageItem}>
                        <div style={styles.storageLabel}>
                            <span>🤝 我的公平額度 ({Math.round(storageStatus.user.used_kb / 1024)}MB / {storageStatus.user.personal_limit_mb}MB)</span>
                            <span>{Math.round((storageStatus.user.used_kb / 1024 / storageStatus.user.personal_limit_mb) * 100)}%</span>
                        </div>
                        <div style={styles.progressBarBg}>
                            <div style={{
                                ...styles.progressBarFill,
                                width: `${Math.min(100, (storageStatus.user.used_kb / 1024 / storageStatus.user.personal_limit_mb) * 100)}%`,
                                backgroundColor: storageStatus.user.used_kb / 1024 / storageStatus.user.personal_limit_mb > 0.9 ? '#faad14' : '#52c41a'
                            }} />
                        </div>
                    </div>
                </div>
            )}

            <div style={styles.photosHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h3 style={styles.groupTitle}>家族影像館 ({photos.length})</h3>
                    <HelpLink section="photo-ai" showText={true} style={{ padding: '4px 10px' }} />
                </div>
                {canEdit && (
                    <label style={styles.uploadButton}>
                        {uploading ? '上傳中...' : '➕ 上傳照片'}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                    </label>
                )}
            </div>

            <div style={styles.photoGrid}>
                {photos.map(photo => (
                    <div key={photo.id} style={styles.photoCard} onClick={() => setSelectedPhoto(photo)}>
                        <img src={photo.file_path} alt={photo.title} style={styles.photoThumb} />
                        <div style={styles.photoInfo}>
                            {getPhotoDate(photo) && (
                                <div style={styles.photoMiniDate}>
                                    📅 {getPhotoDate(photo)}
                                </div>
                            )}
                            {photo.description && (
                                <div style={styles.photoSummary}>{photo.description}</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {selectedPhoto && (
                <div style={styles.lightboxOverlay} onClick={() => setSelectedPhoto(null)}>
                    <div style={styles.lightboxContent} onClick={e => e.stopPropagation()}>
                            {/* ✨ 佈局校準容器 (綁定圖片與標記框) */}
                            <div style={{
                                position: 'relative',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                maxWidth: '100%',
                                maxHeight: '100%'
                            }}>
                                <img 
                                    src={selectedPhoto.file_path} 
                                    alt={selectedPhoto.title} 
                                    style={styles.lightboxImage}
                                    onClick={handleAddTag}
                                />
                                
                                {/* 手動標籤 (相對定位於圖片) */}
                                {tags.map(tag => {
                                    const box = JSON.parse(tag.bounding_box || '{"x":0,"y":0,"w":0,"h":0}');
                                    const taggedMember = allMembers.find(m => m.id === tag.member_id);
                                    const age = calculateAge(tag.member_id, getPhotoDate(selectedPhoto));
                                    return (
                                        <div key={tag.id} style={{
                                            position: 'absolute',
                                            left: `${box.x}%`,
                                            top: `${box.y}%`,
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 100
                                        }}>
                                            <div style={styles.tagMarker}>
                                                <div style={styles.tagLabel}>
                                                    {taggedMember?.name || tag.member_id}
                                                    {age !== null && <span style={styles.ageTag}> ({age}歲)</span>}
                                                    {canEdit && <span onClick={(e) => handleDeleteTag(e, tag.id)} style={styles.tagDelete}> ×</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* AI 建議標籤 (相對定位於圖片) */}
                                {aiSuggestions.map((s, idx) => {
                                    const isAlreadyTagged = tags.some(t => {
                                        try {
                                            const b = JSON.parse(t.bounding_box);
                                            const dist = Math.sqrt(Math.pow(b.x - (s.box.x + s.box.w/2), 2) + Math.pow(b.y - (s.box.y + s.box.h/2), 2));
                                            return dist < 5;
                                        } catch(e) { return false; }
                                    });
                                    if (isAlreadyTagged) return null;
                                    const borderColor = s.status === 'strong' ? '#52c41a' : (s.status === 'weak' ? '#1890ff' : 'rgba(255, 77, 79, 0.6)');

                                    return (
                                        <div key={`ai-${idx}`} style={{
                                            position: 'absolute',
                                            left: `${s.box.x}%`,
                                            top: `${s.box.y}%`,
                                            width: `${s.box.w}%`,
                                            height: `${s.box.h}%`,
                                            border: `2px ${s.status === 'unknown' ? 'dashed' : 'solid'} ${borderColor}`,
                                            borderRadius: '4px',
                                            zIndex: 90,
                                            cursor: 'pointer'
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (s.status !== 'unknown') {
                                                handleAddTag(null, { x: s.box.x + s.box.w/2, y: s.box.y + s.box.h/2, member_id: member.id, distance: s.distance });
                                            } else {
                                                setPendingTagPosition({ x: s.box.x + s.box.w/2, y: s.box.y + s.box.h/2 });
                                                setShowMemberSelector(true);
                                            }
                                        }}>
                                            <div style={{
                                                position: 'absolute', bottom: '-22px', left: '50%', transform: 'translateX(-50%)',
                                                backgroundColor: borderColor, color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px'
                                            }}>
                                                {s.status === 'strong' ? `✅ ${s.suggestedName}` : (s.status === 'weak' ? `❓ 疑似 ${s.suggestedName}` : '🔍 未知面孔')}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        <div style={styles.lightboxDetails}>
                            {selectedPhoto.description && (
                                <div style={styles.detailSection}>
                                    <h5 style={styles.detailLabel}>📍 背景說明</h5>
                                    <p style={styles.photoDescription}>{selectedPhoto.description}</p>
                                </div>
                            )}

                            <div style={styles.detailSection}>
                                <h5 style={styles.detailLabel}>🕒 拍攝時間</h5>
                                <p style={styles.photoDate}>
                                    {getPhotoDate(selectedPhoto) || '未記錄日期'}
                                </p>
                            </div>

                            <div style={styles.detailSection}>
                                <h5 style={styles.detailLabel}>👥 照片中的人</h5>
                                <div style={styles.taggedList}>
                                    {tags.length === 0 ? (
                                        <p style={styles.emptyText}>尚未標註成員</p>
                                    ) : (
                                        tags.map(tag => {
                                            const taggedMember = allMembers.find(m => m.id === tag.member_id);
                                            const age = calculateAge(tag.member_id, selectedPhoto.photo_date || selectedPhoto.metadata?.photo_date);
                                            return (
                                                <div key={tag.id} style={styles.taggedItem}>
                                                    <span style={styles.taggedName}>{taggedMember?.name || tag.member_id}</span>
                                                    {age !== null && <span style={styles.taggedAge}>{age} 歲</span>}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                            
                            <div style={styles.lightboxMeta}>
                                <p>上傳者: {selectedPhoto.uploaded_by}</p>
                                <p>系統狀態: {memberDescriptor ? '✅ AI 識別已開啟' : '⌛ 正在加載模型...'}</p>
                            </div>

                            {canEdit && (
                                <button onClick={openPhotoEditor} style={styles.editPhotoButton}>
                                    ✏️ 編輯照片資訊
                                </button>
                            )}
                            <button onClick={() => setSelectedPhoto(null)} style={styles.closeButton}>返回相冊</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 成員選擇彈窗 */}
            {showMemberSelector && (
                <div style={styles.memberSelectorOverlay} onClick={() => setShowMemberSelector(false)}>
                    <div style={styles.memberSelectorModal} onClick={e => e.stopPropagation()}>
                        <h4 style={styles.memberSelectorTitle}>選擇要標註的成員</h4>
                        <div style={styles.memberList}>
                            {allMembers.length === 0 ? (
                                <p style={styles.memberListEmpty}>暫無成員數據</p>
                            ) : (
                                allMembers.map(m => (
                                    <button
                                        key={m.id}
                                        style={styles.memberListItem}
                                        onClick={() => handleSelectMemberForTag(m.id)}
                                    >
                                        <span style={styles.memberName}>{m.name}</span>
                                        <span style={styles.memberId}>{m.id}</span>
                                    </button>
                                ))
                            )}
                        </div>
                        <button style={styles.memberSelectorCancel} onClick={() => setShowMemberSelector(false)}>取消</button>
                    </div>
                </div>
            )}

            {/* 上傳表單彈窗 */}
            {showUploadForm && (
                <div style={styles.modalOverlay} onClick={() => setShowUploadForm(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h4 style={styles.modalTitle}>添加照片資訊</h4>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>背景說明 / 描述</label>
                            <textarea
                                style={styles.formTextarea}
                                value={uploadFormData.description}
                                onChange={(e) => setUploadFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="請輸入照片背景說明..."
                                rows={3}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>拍照日期</label>
                            <input
                                type="date"
                                style={styles.formInput}
                                value={uploadFormData.photoDate}
                                onChange={(e) => setUploadFormData(prev => ({ ...prev, photoDate: e.target.value }))}
                            />
                            <p style={styles.formHint}>已從照片 EXIF 自動提取（如可用）</p>
                        </div>
                        <div style={styles.modalButtons}>
                            <button style={styles.modalButtonSecondary} onClick={() => setShowUploadForm(false)}>取消</button>
                            <button style={styles.modalButtonPrimary} onClick={submitUpload} disabled={uploading}>
                                {uploading ? '上傳中...' : '確認上傳'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 照片編輯彈窗 */}
            {showPhotoEditor && (
                <div style={styles.modalOverlay} onClick={() => setShowPhotoEditor(false)}>
                    <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h4 style={styles.modalTitle}>編輯照片資訊</h4>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>背景說明 / 描述</label>
                            <textarea
                                style={styles.formTextarea}
                                value={photoEditData.description}
                                onChange={(e) => setPhotoEditData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="請輸入照片背景說明..."
                                rows={3}
                            />
                        </div>
                        <div style={styles.formGroup}>
                            <label style={styles.formLabel}>拍照日期</label>
                            <input
                                type="date"
                                style={styles.formInput}
                                value={photoEditData.photoDate}
                                onChange={(e) => setPhotoEditData(prev => ({ ...prev, photoDate: e.target.value }))}
                            />
                        </div>
                        <div style={styles.modalButtons}>
                            <button style={styles.modalButtonSecondary} onClick={() => setShowPhotoEditor(false)}>取消</button>
                            <button style={styles.modalButtonPrimary} onClick={savePhotoEdit}>保存</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        gap: '20px'
    },
    backButton: {
        padding: '8px 16px',
        backgroundColor: '#f0f0f0',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    name: {
        fontSize: '32px',
        fontWeight: 'bold',
        margin: 0
    },
    editButton: {
        padding: '8px 16px',
        backgroundColor: 'var(--accent-color)',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    groupTitle: {
        fontSize: '14px',
        color: 'var(--primary-color)',
        marginBottom: '12px',
        borderLeft: '4px solid var(--accent-color)',
        paddingLeft: '10px',
        fontWeight: 'bold'
    },
    tabs: {
        display: 'flex',
        gap: '10px',
        borderBottom: '2px solid #e8e8e8',
        marginBottom: '20px'
    },
    tab: {
        padding: '12px 24px',
        backgroundColor: 'transparent',
        borderWidth: 0,
        borderBottomWidth: '2px',
        borderStyle: 'solid',
        borderBottomColor: 'transparent', // 只設置底部邊框顏色
        cursor: 'pointer',
        fontSize: '15px',
        color: 'var(--text-muted)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        fontWeight: 500
    },
    activeTab: {
        borderBottomColor: 'var(--primary-color)',
        color: 'var(--primary-color)',
        fontWeight: 700
    },
    content: {
        minHeight: '400px'
    },
    tabContent: {
        padding: '20px 0'
    },
    infoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '16px'
    },
    infoItem: {
        padding: '12px',
        backgroundColor: '#fafafa',
        borderRadius: '4px'
    },
    infoLabel: {
        fontSize: '12px',
        color: '#666',
        marginBottom: '4px'
    },
    infoValue: {
        fontSize: '16px',
        color: '#333'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        fontSize: '18px',
        color: '#666'
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        fontSize: '18px',
        color: '#ff4d4f'
    },
    biographyContent: {
        position: 'relative'
    },
    biographyViewer: {
        backgroundColor: '#fff',
        padding: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    },
    biographyText: {
        lineHeight: '1.8',
        fontSize: '16px'
    },
    // Timeline Styles
    timelineSection: {
        marginBottom: '40px',
        padding: '0 10px'
    },
    timelineHeader: {
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '20px',
        color: 'var(--primary-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    timelineIcon: {
        fontSize: '24px'
    },
    timelineContainer: {
        position: 'relative',
        paddingLeft: '100px',
        borderLeft: '2px solid #e8e8e8',
        marginLeft: '20px'
    },
    timelineItem: {
        position: 'relative',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column'
    },
    timelineYear: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: 'var(--accent-color)',
        marginBottom: '4px',
        left: '-85px',
        width: '75px',
        textAlign: 'left',
        position: 'absolute',
        zIndex: 5
    },
    timelineDot: {
        position: 'absolute',
        left: '-101px',
        top: '6px',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        backgroundColor: 'var(--accent-color)',
        border: '3px solid #fff',
        boxShadow: '0 0 0 1px #e8e8e8'
    },
    timelineCard: {
        backgroundColor: '#fff',
        padding: '12px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        border: '1px solid #f0f0f0',
        transition: 'transform 0.2s',
        cursor: 'default',
        ':hover': {
            transform: 'translateX(5px)'
        }
    },
    timelineEvent: {
        fontSize: '15px',
        color: '#333',
        lineHeight: '1.6'
    },
    emptyBiography: {
        textAlign: 'center',
        padding: '60px 20px',
        backgroundColor: '#fafafa',
        borderRadius: '8px'
    },
    createButton: {
        marginTop: '16px',
        padding: '12px 24px',
        backgroundColor: '#1890ff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '16px'
    },
    editAction: {
        marginTop: '20px',
        textAlign: 'right'
    },
    editBioButton: {
        padding: '10px 20px',
        backgroundColor: '#52c41a',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
    },
    photosContent: {
        padding: '20px 0'
    },
    photosHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
    },
    uploadWrapper: {
        display: 'inline-block'
    },
    uploadButton: {
        backgroundColor: '#1890ff',
        color: 'white',
        padding: '8px 20px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        transition: 'all 0.3s',
        boxShadow: '0 2px 4px rgba(24, 144, 255, 0.2)'
    },
    photoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '20px'
    },
    photoCard: {
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: 'white',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        cursor: 'pointer',
        transition: 'transform 0.2s',
    },
    photoThumb: {
        width: '100%',
        height: '200px',
        objectFit: 'cover'
    },
    photoInfo: {
        padding: '10px'
    },
    photoTitle: {
        fontSize: '14px',
        fontWeight: '700',
        color: '#1a1a1a',
        marginBottom: '4px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    },
    photoMiniDate: {
        fontSize: '11px',
        color: '#999',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        marginBottom: '4px'
    },
    photoSummary: {
        fontSize: '11px',
        color: '#666',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        opacity: 0.8
    },
    photoDate: {
        fontSize: '11px',
        color: '#999',
        marginTop: '4px'
    },
    emptyState: {
        textAlign: 'center',
        padding: '60px 20px',
        backgroundColor: '#fafafa',
        borderRadius: '8px',
        color: '#999'
    },
    lightboxOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.95)',
        display: 'flex',
        alignItems: window.innerWidth < 768 ? 'flex-start' : 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: window.innerWidth < 768 ? '0' : '40px',
        overflowY: window.innerWidth < 768 ? 'auto' : 'hidden'
    },
    lightboxContent: {
        display: 'flex',
        flexDirection: window.innerWidth < 768 ? 'column' : 'row',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: window.innerWidth < 768 ? 'none' : '90vh',
        minHeight: window.innerWidth < 768 ? '100vh' : 'auto',
        backgroundColor: '#000',
        borderRadius: window.innerWidth < 768 ? '0' : '12px',
        overflow: window.innerWidth < 768 ? 'visible' : 'hidden',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
    },
    lightboxMain: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        position: 'relative',
        overflow: 'hidden',
        minHeight: window.innerWidth < 768 ? '300px' : 'auto',
        order: 1
    },
    lightboxImage: {
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'contain'
    },
    lightboxDetails: {
        width: window.innerWidth < 768 ? '100%' : '350px',
        padding: window.innerWidth < 768 ? '20px' : '30px',
        backgroundColor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'visible',
        order: 2
    },
    lightboxTitle: {
        fontSize: '22px',
        fontWeight: '700',
        color: '#1a1a1a',
        margin: '0 0 5px 0'
    },
    detailSection: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
    },
    detailLabel: {
        fontSize: '12px',
        fontWeight: '700',
        color: 'var(--primary-color)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        opacity: 0.8
    },
    photoDescription: {
        fontSize: '14px',
        lineHeight: '1.6',
        color: '#444',
        margin: 0,
        whiteSpace: 'pre-wrap'
    },
    photoDate: {
        fontSize: '15px',
        fontWeight: '500',
        color: '#1a1a1a',
        margin: 0
    },
    taggedList: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    taggedItem: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px'
    },
    taggedName: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#1a1a1a'
    },
    taggedAge: {
        fontSize: '11px',
        padding: '2px 6px',
        backgroundColor: 'rgba(56, 158, 13, 0.1)',
        color: '#389e0d',
        borderRadius: '4px',
        fontWeight: '700'
    },
    lightboxMeta: {
        marginTop: 'auto',
        paddingTop: '20px',
        borderTop: '1px solid #eee',
        fontSize: '12px',
        color: '#999',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px'
    },
    emptyText: {
        fontSize: '13px',
        color: '#999',
        fontStyle: 'italic'
    },
    editPhotoButton: {
        padding: '10px',
        backgroundColor: 'var(--accent-color)',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600'
    },
    storageDashboard: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px',
        padding: '16px',
        backgroundColor: '#f9f9f9',
        borderRadius: '10px',
        marginBottom: '20px',
        border: '1px solid #eee'
    },
    storageItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    storageLabel: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '12px',
        color: '#666',
        fontWeight: '600'
    },
    progressBarBg: {
        height: '8px',
        backgroundColor: '#e8e8e8',
        borderRadius: '4px',
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        borderRadius: '4px',
        transition: 'width 0.3s ease'
    },
    closeButton: {
        padding: '10px',
        backgroundColor: '#f5f5f5',
        color: '#666',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: '600'
    },
    tagMarker: {
        width: '12px',
        height: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        border: '2px solid var(--accent-color)',
        borderRadius: '50%',
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        position: 'relative'
    },
    tagLabel: {
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        marginTop: '8px',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
    },
    tagDelete: {
        cursor: 'pointer',
        color: '#ff4d4f',
        fontWeight: 'bold',
        fontSize: '14px',
        padding: '0 2px'
    },
    memberSelectorOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3000
    },
    memberSelectorModal: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '500px',
        width: window.innerWidth < 768 ? '100%' : '90%',
        height: window.innerWidth < 768 ? '100%' : 'auto',
        maxHeight: window.innerWidth < 768 ? '100vh' : '70vh',
        display: 'flex',
        flexDirection: 'column'
    },
    memberSelectorTitle: {
        margin: '0 0 16px 0',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center'
    },
    memberList: {
        overflowY: 'auto',
        maxHeight: '400px',
        marginBottom: '16px'
    },
    memberListEmpty: {
        textAlign: 'center',
        color: '#999',
        padding: '20px'
    },
    memberListItem: {
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transition: 'background-color 0.2s',
        ':hover': {
            backgroundColor: '#f5f5f5'
        }
    },
    memberName: {
        fontSize: '16px',
        fontWeight: '500',
        color: '#333'
    },
    memberId: {
        fontSize: '12px',
        color: '#999'
    },
    memberSelectorCancel: {
        width: '100%',
        padding: '12px',
        backgroundColor: '#f5f5f5',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#666',
        transition: 'background-color 0.2s'
    },
    ageTag: {
        color: '#ffd700',
        fontWeight: 'bold'
    },
    photoDescription: {
        fontSize: '14px',
        color: '#ddd',
        margin: '8px 0',
        maxWidth: '500px',
        lineHeight: '1.5'
    },
    photoDate: {
        fontSize: '13px',
        color: '#aaa',
        margin: '4px 0'
    },
    editPhotoButton: {
        marginTop: '10px',
        marginRight: '10px',
        padding: '8px 20px',
        backgroundColor: '#1890ff',
        border: 'none',
        borderRadius: '20px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '14px'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3500
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '450px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto'
    },
    modalTitle: {
        margin: '0 0 20px 0',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#333',
        textAlign: 'center'
    },
    formGroup: {
        marginBottom: '16px'
    },
    formLabel: {
        display: 'block',
        fontSize: '14px',
        fontWeight: '500',
        color: '#555',
        marginBottom: '8px'
    },
    formInput: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box'
    },
    formTextarea: {
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #ddd',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box',
        resize: 'vertical',
        fontFamily: 'inherit'
    },
    formHint: {
        fontSize: '12px',
        color: '#999',
        marginTop: '4px',
        marginBottom: 0
    },
    modalButtons: {
        display: 'flex',
        gap: '12px',
        marginTop: '20px'
    },
    modalButtonPrimary: {
        flex: 1,
        padding: '12px',
        backgroundColor: '#1890ff',
        border: 'none',
        borderRadius: '8px',
        color: 'white',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
    },
    modalButtonSecondary: {
        flex: 1,
        padding: '12px',
        backgroundColor: '#f5f5f5',
        border: 'none',
        borderRadius: '8px',
        color: '#666',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
    }
};

export default MemberDetail;
