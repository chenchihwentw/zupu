import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BiographyEditor = ({ memberId, biographyMd, permissionLevel, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [content, setContent] = useState(biographyMd || '');
    const [preview, setPreview] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setContent(biographyMd || '');
    }, [biographyMd]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put(`/api/family/${memberId}/biography`, {
                biography_md: content
            });
            if (onSave) onSave(content);
            setIsEditing(false);
            alert('事蹟已保存！');
        } catch (error) {
            console.error('保存失敗:', error);
            alert('保存失敗：' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const canEdit = permissionLevel === 'L3' || permissionLevel === 'L4';

    // 簡單的 Markdown 渲染（可替換為 react-markdown）
    const renderMarkdown = (text) => {
        if (!text) return <p style={{ color: '#999', fontStyle: 'italic' }}>暫無事蹟記錄</p>;
        
        return text.split('\n').map((line, index) => {
            // 標題
            if (line.startsWith('# ')) {
                return <h1 key={index} style={{ fontSize: '24px', marginTop: '20px' }}>{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
                return <h2 key={index} style={{ fontSize: '20px', marginTop: '16px' }}>{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
                return <h3 key={index} style={{ fontSize: '18px', marginTop: '14px' }}>{line.slice(4)}</h3>;
            }
            // 列表
            if (line.startsWith('- ') || line.startsWith('* ')) {
                return <li key={index}>{line.slice(2)}</li>;
            }
            // 粗體
            if (line.includes('**')) {
                const parts = line.split('**');
                return (
                    <p key={index}>
                        {parts.map((part, i) => 
                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                        )}
                    </p>
                );
            }
            // 空行
            if (line.trim() === '') {
                return <br key={index} />;
            }
            // 普通段落
            return <p key={index}>{line}</p>;
        });
    };

    const styles = {
        container: {
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
        },
        title: {
            fontSize: '18px',
            fontWeight: 'bold',
            margin: 0
        },
        actions: {
            display: 'flex',
            gap: '8px'
        },
        button: {
            padding: '6px 12px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px'
        },
        editBtn: {
            backgroundColor: '#1890ff',
            color: 'white'
        },
        previewBtn: {
            backgroundColor: preview ? '#52c41a' : '#f0f0f0',
            color: preview ? 'white' : '#333'
        },
        cancelBtn: {
            backgroundColor: '#d9d9d9',
            color: '#333'
        },
        saveBtn: {
            backgroundColor: '#52c41a',
            color: 'white'
        },
        textarea: {
            width: '100%',
            minHeight: '300px',
            padding: '12px',
            fontSize: '14px',
            fontFamily: 'monospace',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            resize: 'vertical'
        },
        preview: {
            padding: '15px',
            backgroundColor: 'white',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            minHeight: '300px',
            maxHeight: '500px',
            overflowY: 'auto'
        },
        permissionNotice: {
            padding: '10px',
            backgroundColor: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: '4px',
            color: '#fa8c16',
            fontSize: '13px',
            marginTop: '10px'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <h3 style={styles.title}>📖 生平事蹟</h3>
                <div style={styles.actions}>
                    {!isEditing && canEdit && (
                        <button 
                            style={{ ...styles.button, ...styles.editBtn }}
                            onClick={() => setIsEditing(true)}
                        >
                            ✏️ 編輯
                        </button>
                    )}
                </div>
            </div>

            {isEditing ? (
                <div>
                    <textarea
                        style={styles.textarea}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="使用 Markdown 格式記錄生平事蹟...&#10;&#10;例如：&#10;# 生平簡介&#10;這是某人的生平故事...&#10;&#10;## 重要成就&#10;- 成就 1&#10;- 成就 2"
                    />
                    <div style={{ ...styles.actions, marginTop: '10px' }}>
                        <button
                            style={{ ...styles.button, ...styles.previewBtn }}
                            onClick={() => setPreview(!preview)}
                        >
                            {preview ? '✏️ 編輯' : '👁️ 預覽'}
                        </button>
                        <button
                            style={{ ...styles.button, ...styles.cancelBtn }}
                            onClick={() => setIsEditing(false)}
                        >
                            取消
                        </button>
                        <button
                            style={{ ...styles.button, ...styles.saveBtn }}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? '保存中...' : '💾 保存'}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={styles.preview}>
                    {renderMarkdown(content)}
                </div>
            )}

            {!canEdit && (
                <div style={styles.permissionNotice}>
                    🔒 您目前只有閱覽權限，如需編輯事蹟請聯繫管理員授權
                </div>
            )}
        </div>
    );
};

export default BiographyEditor;
