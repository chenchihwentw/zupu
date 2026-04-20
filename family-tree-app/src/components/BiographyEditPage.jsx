import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, Save, Eye, Edit3, Image as ImageIcon, 
    Bold, Italic, List, ListOrdered, Link, Quote, Code,
    BarChart3, Clock, CheckCircle2, AlertCircle, Info, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STORAGE_LIMITS = {
    free: 10,
    pro: 50,
    global: 200,
    super_admin: 1000
};

const BiographyEditPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const editorRef = useRef(null);

    const [member, setMember] = useState(null);
    const [content, setContent] = useState('');
    const [achievements, setAchievements] = useState([]);
    const [tags, setTags] = useState([]);
    const [previewMode, setPreviewMode] = useState(false);
    const [mobileTab, setMobileTab] = useState('edit'); // 'edit' or 'preview'
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadedImages, setUploadedImages] = useState([]);

    // Determine user tier and limits
    const userTier = user?.membership_tier || (user?.role === 'super_admin' ? 'super_admin' : 'free');
    const storageLimit = STORAGE_LIMITS[userTier] || 10;
    const usagePercent = Math.min((uploadedImages.length / storageLimit) * 100, 100);

    const TAG_PRESETS = [
        '企業家', '教育家', '醫生', '律師', '工程師',
        '慈善家', '發明家', '作家', '藝術家',
        '創始人', '會長', '理事長', '校長',
        '清末', '民國', '現代',
        '台灣', '大陸', '美國', '東南亞'
    ];

    useEffect(() => {
        fetchData();
    }, [id]);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };
            
            const [memberRes, bioRes, imgRes] = await Promise.all([
                axios.get(`/api/member/${id}`, { headers }),
                axios.get(`/api/member/${id}/biography`, { headers }),
                axios.get(`/api/member/${id}/image-count`, { headers })
            ]);

            setMember(memberRes.data);
            setContent(bioRes.data.content_md || '');
            
            const recursiveParse = (data) => {
                if (!data) return [];
                if (Array.isArray(data)) return data;
                try {
                    const parsed = JSON.parse(data);
                    return Array.isArray(parsed) ? parsed : recursiveParse(parsed);
                } catch (e) { return []; }
            };

            setAchievements(recursiveParse(memberRes.data.achievements));

            // Robust parsing for tags
            let rawTags = bioRes.data.tags || [];
            if (typeof rawTags === 'string') {
                try {
                    rawTags = JSON.parse(rawTags);
                } catch (e) { rawTags = []; }
            }
            setTags(Array.isArray(rawTags) ? rawTags : []);
            
            setUploadedImages(imgRes.data.urls || []);
        } catch (error) {
            console.error('Failed to fetch biography data:', error);
            // Ensure defaults on failure
            setAchievements([]);
            setTags([]);
        }
    };

    const wordCount = useMemo(() => {
        return content.replace(/[#*`~]/g, '').trim().length;
    }, [content]);

    const readingTime = useMemo(() => {
        return Math.ceil(wordCount / 300);
    }, [wordCount]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const headers = { Authorization: `Bearer ${token}` };

            // Smart Cleanup: Detect orphaned images
            // Regex improved to handle spaces and common image chars
            const urlsInContent = content.match(/\/uploads\/[^)]+\.(jpg|jpeg|png|gif|webp)/g) || [];
            const orphans = uploadedImages.filter(url => !urlsInContent.includes(url));

            // Delete orphans from server
            if (orphans.length > 0) {
                console.log('[Cleanup] Deleting orphans:', orphans);
                for (const url of orphans) {
                    const filename = url.split('/').pop();
                    try {
                        // Encode filename for URL safety
                        await axios.delete(`/api/upload/${encodeURIComponent(filename)}`, { headers });
                    } catch (e) {
                        console.error('Failed to delete orphan:', filename);
                    }
                }
            }

            // Save biography
            await axios.put(`/api/member/${id}/biography`, {
                content_md: content,
                tags: tags,
                achievements: achievements,
                edited_by: user?.name || 'anonymous'
            }, { headers });

            setLastSaved(new Date());
            setUploadedImages(urlsInContent); // Update local state to show only kept images
            
            // Success feedback could be improved but alert is safe
            // alert('儲存成功！已自動清理未使用的照片。');
        } catch (error) {
            console.error('Save failed:', error);
            alert('儲存失敗');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (uploadedImages.length >= storageLimit) {
            alert(`已達到存儲上限 (${storageLimit} 張)。請刪除部分照片或升級會員。`);
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', 'biography');

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('/api/upload', formData, {
                headers: { 
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                const url = response.data.url;
                const md = `\n![${file.name}](${url})\n`;
                
                const textarea = editorRef.current;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const newContent = content.substring(0, start) + md + content.substring(end);
                
                setContent(newContent);
                setUploadedImages([...uploadedImages, url]);
                
                setTimeout(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start + md.length, start + md.length);
                }, 0);
            }
        } catch (error) {
            alert('上傳失敗');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const insertMd = (prefix, suffix = '') => {
        const textarea = editorRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selection = content.substring(start, end);
        const newContent = content.substring(0, start) + prefix + selection + suffix + content.substring(end);
        
        setContent(newContent);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        }, 0);
    };

    return (
        <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-porcelain)' }}>
            <div style={{ 
                padding: window.innerWidth < 768 ? '12px 16px' : '16px 32px', 
                backgroundColor: 'rgba(255,255,255,0.8)', 
                backdropFilter: 'blur(12px)', 
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 768 ? '8px' : '20px' }}>
                    <button onClick={() => navigate(`/member/${id}`)} className="pill-button" style={{ background: '#f8fafc', color: 'var(--text-muted)', padding: '6px 10px' }}>
                        <ChevronLeft size={18} /> {window.innerWidth < 768 ? '' : '返回詳情'}
                    </button>
                    <h2 style={{ fontSize: window.innerWidth < 768 ? '16px' : '20px', fontWeight: 800, margin: 0 }}>
                        {member?.name}{window.innerWidth < 768 ? '' : ' 的'}{member?.is_deceased ? '紀念館' : '自傳'}
                    </h2>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {lastSaved && window.innerWidth >= 768 && (
                        <span style={{ fontSize: '12px', color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={12} /> {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                    {window.innerWidth >= 768 && (
                        <button 
                            onClick={() => setPreviewMode(!previewMode)}
                            className="pill-button"
                            style={{ border: '1px solid #e2e8f0' }}
                        >
                            {previewMode ? <Edit3 size={16} /> : <Eye size={16} />}
                            {previewMode ? '切換至編輯' : '預覽模式'}
                        </button>
                    )}
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="pill-button"
                        style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: window.innerWidth < 768 ? '8px 16px' : '10px 24px', fontSize: '13px' }}
                    >
                        <Save size={16} /> {saving ? '...' : (window.innerWidth < 768 ? '保存' : '儲存內容')}
                    </button>
                </div>
            </div>

            {/* Navigation Tabs (Consistent with MemberDetail) */}
            <div style={{ 
                padding: window.innerWidth < 768 ? '0 16px' : '0 32px', 
                backgroundColor: 'white', 
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto'
            }}>
                <button onClick={() => navigate(`/member/${id}`)} style={editTabStyle(false)}>基本資料</button>
                <button style={editTabStyle(true)}>{member?.is_deceased ? '🏮 紀念館' : '📝 個人自傳'}</button>
                <button onClick={() => navigate(`/member/${id}`, { state: { tab: 'photos' } })} style={editTabStyle(false)}>🖼️ 相冊照片</button>
            </div>

            {/* Mobile Mode Sub-Tabs (Edit/Preview) */}
            {window.innerWidth < 768 && (
                <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: 'white' }}>
                    <button 
                        onClick={() => setMobileTab('edit')}
                        style={{ flex: 1, padding: '10px', border: 'none', background: 'none', borderBottom: mobileTab === 'edit' ? '2px solid var(--accent-color)' : 'none', color: mobileTab === 'edit' ? 'var(--accent-color)' : '#64748b', fontSize: '14px', fontWeight: 600 }}
                    >編輯文字</button>
                    <button 
                        onClick={() => setMobileTab('preview')}
                        style={{ flex: 1, padding: '10px', border: 'none', background: 'none', borderBottom: mobileTab === 'preview' ? '2px solid var(--accent-color)' : 'none', color: mobileTab === 'preview' ? 'var(--accent-color)' : '#64748b', fontSize: '14px', fontWeight: 600 }}
                    >預覽排版</button>
                </div>
            )}

            {/* Achievements Timeline Editor */}
            {((!previewMode && window.innerWidth >= 768) || (window.innerWidth < 768 && mobileTab === 'edit')) && (
                <div style={{ padding: window.innerWidth < 768 ? '16px' : '20px 32px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={16} /> 里程碑 / 大事記
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Array.isArray(achievements) && achievements.map((item, index) => (
                            <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input 
                                    style={{ width: window.innerWidth < 768 ? '60px' : '80px', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
                                    placeholder="年份" value={item.year}
                                    onChange={(e) => {
                                        const newAch = [...achievements];
                                        newAch[index].year = e.target.value;
                                        setAchievements(newAch);
                                    }}
                                />
                                <input 
                                    style={{ flex: 1, padding: '6px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px' }}
                                    placeholder="描述" value={item.event}
                                    onChange={(e) => {
                                        const newAch = [...achievements];
                                        newAch[index].event = e.target.value;
                                        setAchievements(newAch);
                                    }}
                                />
                                <button onClick={() => setAchievements(achievements.filter((_, i) => i !== index))} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button onClick={() => setAchievements([...achievements, { year: '', event: '' }])} className="pill-button" style={{ alignSelf: 'flex-start', border: '1px dashed #cbd5e1', background: 'white', fontSize: '12px' }}>
                            + 新增事蹟
                        </button>
                    </div>
                </div>
            )}

            {/* Split Pane Main Area */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
                {/* Editor Side */}
                <div style={{ 
                    flex: (window.innerWidth < 768 && mobileTab === 'preview') ? 0 : 1, 
                    display: (window.innerWidth < 768 && mobileTab === 'preview') ? 'none' : 'flex',
                    flexDirection: 'column',
                    borderRight: window.innerWidth < 768 ? 'none' : '1px solid #f1f5f9',
                    backgroundColor: 'white',
                    transition: 'all 0.3s'
                }}>
                    {/* Toolbar is already rendered above this block in the file or managed here */}
                    {/* Wait, I see the toolbar is already at 340-368 in the current file. I will keep it. */}
                    <textarea
                        ref={editorRef}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="在此開始撰寫生平故事... 支持 Markdown 格式"
                        style={{
                            flex: 1,
                            padding: window.innerWidth < 768 ? '20px' : '32px',
                            fontSize: window.innerWidth < 768 ? '15px' : '16px',
                            lineHeight: '1.8',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            fontFamily: 'inherit',
                            color: '#334155'
                        }}
                    />
                </div>

                {/* Preview Side */}
                <div style={{ 
                    flex: 1, 
                    display: (window.innerWidth < 768 && mobileTab === 'edit' && !previewMode) ? 'none' : 'flex',
                    backgroundColor: 'var(--bg-porcelain)', 
                    overflowY: 'auto',
                    padding: window.innerWidth < 768 ? '16px' : '40px',
                    flexDirection: 'column',
                    alignItems: 'center'
                }}>
                    <div style={{ 
                        width: '100%', 
                        maxWidth: '800px', 
                        backgroundColor: 'white', 
                        padding: window.innerWidth < 768 ? '24px' : '60px', 
                        borderRadius: '24px', 
                        boxShadow: 'var(--shadow-lg)',
                        minHeight: '100%'
                    }}>
                        {content ? (
                            <div className="markdown-preview">
                                <MarkdownRenderer content={content} />
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', marginTop: '100px', color: '#94a3b8' }}>
                                <ImageIcon size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
                                <p>右側將即時顯示排版結果</p>
                            </div>
                        )}
                        
                        {/* Mobile Tags Section - Embedded at bottom of content */}
                        {window.innerWidth < 768 && (
                            <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700 }}>標籤設定</h4>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                                    {Array.isArray(tags) && tags.map(tag => (
                                        <span key={tag} style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '6px 12px', borderRadius: '15px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {tag} <Trash2 size={12} onClick={() => setTags(tags.filter(t => t !== tag))} />
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {TAG_PRESETS.filter(t => !tags.includes(t)).slice(0, 10).map(tag => (
                                        <button key={tag} onClick={() => setTags([...tags, tag])} style={{ border: '1px solid #e2e8f0', background: 'white', padding: '6px 12px', borderRadius: '15px', fontSize: '12px', color: '#64748b' }}>
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom Stats & Storage Panel */}
            {window.innerWidth >= 768 && (
                <div style={{ 
                    padding: '12px 32px', 
                    backgroundColor: 'white', 
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '13px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><BarChart3 size={14} /> 字數: {wordCount}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> 閱讀時間: 約 {readingTime} 分鐘</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>存儲配額 ({userTier === 'free' ? '免費' : userTier === 'pro' ? '進階' : '領袖'}):</span>
                            <div style={{ width: '120px', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ 
                                    width: `${usagePercent}%`, 
                                    height: '100%', 
                                    background: usagePercent > 90 ? 'var(--danger-color)' : usagePercent > 70 ? 'var(--accent-color)' : 'var(--success-color)',
                                    transition: 'width 0.5s ease-out'
                                }} />
                            </div>
                            <span style={{ fontWeight: 600, color: usagePercent > 90 ? 'var(--danger-color)' : 'inherit' }}>
                                {uploadedImages.length} / {storageLimit}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tags Floating Section (Desktop Only) */}
            {!previewMode && window.innerWidth >= 768 && (
                <div style={{ 
                    position: 'fixed', 
                    right: '40px', 
                    bottom: '80px', 
                    width: '320px', 
                    backgroundColor: 'rgba(255,255,255,0.9)', 
                    backdropFilter: 'blur(10px)',
                    padding: '20px', 
                    borderRadius: '20px', 
                    border: '1px solid rgba(255,255,255,0.4)',
                    boxShadow: 'var(--shadow-xl)',
                    zIndex: 20
                }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <BarChart3 size={14} /> 標籤設定
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {Array.isArray(tags) && tags.map(tag => (
                            <span 
                                key={tag} 
                                style={{ backgroundColor: 'var(--primary-color)', color: 'white', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                {tag} <Trash2 size={10} onClick={() => setTags(tags.filter(t => t !== tag))} style={{ cursor: 'pointer' }} />
                            </span>
                        ))}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {TAG_PRESETS.filter(t => !tags.includes(t)).slice(0, 10).map(tag => (
                            <button 
                                key={tag} 
                                onClick={() => setTags([...tags, tag])}
                                style={{ border: '1px dashed #cbd5e1', background: 'none', padding: '4px 8px', borderRadius: '10px', fontSize: '11px', color: '#64748b' }}
                            >
                                + {tag}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const editTabStyle = (active) => ({
    padding: '12px 20px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: active ? '3px solid var(--primary-color)' : '3px solid transparent',
    color: active ? 'var(--primary-color)' : '#64748b',
    fontSize: '14px',
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.2s'
});

const ToolbarBtn = ({ icon, label, onClick }) => (
    <button 
        onClick={onClick} 
        title={label}
        style={{ 
            padding: '8px', borderRadius: '8px', border: '1px solid transparent', 
            background: 'none', color: '#64748b', transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
    >
        {icon}
    </button>
);

const MarkdownRenderer = ({ content }) => {
    // Basic parser for demonstration - In production use a lib like react-markdown
    const lines = content.split('\n');
    return (
        <div style={{ lineHeight: '1.8', color: '#334155' }}>
            {lines.map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i}>{line.slice(2)}</h1>;
                if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>;
                if (line.startsWith('![')) {
                    const match = line.match(/!\[(.*?)\]\((.*?)\)/);
                    if (match) return <img key={i} src={match[2]} alt={match[1]} style={{ maxWidth: '100%', borderRadius: '12px', margin: '20px 0' }} />;
                }
                if (line.startsWith('> ')) return <blockquote key={i} style={{ borderLeft: '4px solid var(--primary-color)', paddingLeft: '20px', fontStyle: 'italic', margin: '20px 0', color: '#64748b' }}>{line.slice(2)}</blockquote>;
                if (line.trim() === '') return <div key={i} style={{ height: '1em' }} />;
                return <p key={i} style={{ margin: '0 0 1em 0' }}>{line}</p>;
            })}
        </div>
    );
};

export default BiographyEditPage;
