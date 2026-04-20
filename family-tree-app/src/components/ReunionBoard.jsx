import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const ReunionBoard = () => {
    const { isAuthenticated, user, hasPermission } = useAuth();
    const canManagePosts = hasPermission('user'); // At least user can create posts
    const isSuperAdmin = hasPermission('super_admin');
    const isFamilyAdmin = hasPermission('family_admin');
    
    const [posts, setPosts] = useState([]);
    const [newPost, setNewPost] = useState({ title: '', description: '', contact: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [editingPost, setEditingPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchPosts();
    }, [statusFilter]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter !== 'all') {
                params.status = statusFilter;
            }
            if (searchTerm) {
                params.search = searchTerm;
            }
            
            const response = await axios.get('/api/reunion', { params });
            setPosts(response.data);
        } catch (err) {
            console.error("Error fetching posts:", err);
            setError('Failed to load posts');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchPosts();
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPost.title || !newPost.description) return;

        try {
            const token = localStorage.getItem('token');
            console.log('[DEBUG] Creating post with token:', token ? 'Token exists' : 'No token');
            console.log('[DEBUG] Post data:', newPost);
            
            const response = await axios.post('/api/reunion', newPost, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            console.log('[DEBUG] Post created successfully:', response.data);
            setNewPost({ title: '', description: '', contact: '' });
            fetchPosts();
        } catch (err) {
            console.error("Error creating post:", err);
            console.error("Error details:", err.response?.data);
            setError(err.response?.data?.error || 'Failed to create post');
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingPost.title || !editingPost.description) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`/api/reunion/${editingPost.id}`, editingPost, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingPost(null);
            fetchPosts();
        } catch (err) {
            console.error("Error updating post:", err);
            setError(err.response?.data?.error || 'Failed to update post');
        }
    };

    const handleDelete = async (postId) => {
        if (!window.confirm('確定要刪除這個尋人啟事嗎？')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`/api/reunion/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchPosts();
        } catch (err) {
            console.error("Error deleting post:", err);
            setError(err.response?.data?.error || 'Failed to delete post');
        }
    };

    const canEditPost = (post) => {
        if (!isAuthenticated) return false;
        
        // 超级管理员可以编辑所有帖子
        if (isSuperAdmin) return true;
        
        // 家族管理員權限待後續多家族權限系統優化後重新啟用
        // if (isFamilyAdmin && post.family_id === user?.family_id) return true;
        
        // 作者可以编辑自己的帖子
        return post.user_id === user?.id;
    };
    
    const canDeletePost = (post) => {
        if (!isAuthenticated) return false;
        
        // 超级管理员可以删除所有帖子
        if (isSuperAdmin) return true;
        
        // 家族管理員權限待後續優化
        // if (isFamilyAdmin && post.family_id === user?.family_id) return true;
        
        // 作者可以删除自己的帖子
        return post.user_id === user?.id;
    };

    const getStatusLabel = (status) => {
        const labels = {
            searching: { text: '尋找中', color: '#faad14' },
            found: { text: '已找到', color: '#52c41a' },
            closed: { text: '已關閉', color: '#999' }
        };
        return labels[status] || { text: status, color: '#666' };
    };

    const styles = {
        container: {
            padding: '20px',
            maxWidth: '800px',
            margin: '0 auto',
            backgroundColor: '#fff',
            minHeight: '100vh'
        },
        form: {
            backgroundColor: '#f9f9f9',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '30px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        },
        input: {
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            boxSizing: 'border-box'
        },
        textarea: {
            width: '100%',
            padding: '10px',
            marginBottom: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            minHeight: '100px',
            boxSizing: 'border-box'
        },
        button: {
            padding: '10px 20px',
            backgroundColor: '#faad14', // Orange for "seeking"
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
        },
        postList: {
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        },
        post: {
            border: '1px solid #eee',
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: '#fff8e6' // Light orange background
        },
        postTitle: {
            margin: '0 0 10px 0',
            color: '#d46b08'
        },
        postMeta: {
            fontSize: '12px',
            color: '#999',
            marginBottom: '10px'
        },
        searchForm: {
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            flexWrap: 'wrap'
        },
        searchInput: {
            flex: '1',
            minWidth: '200px',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc'
        },
        select: {
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ccc'
        },
        statusBadge: {
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold',
            marginLeft: '10px'
        },
        postActions: {
            marginTop: '15px',
            display: 'flex',
            gap: '10px'
        },
        actionButton: {
            padding: '6px 12px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
        },
        editButton: {
            backgroundColor: '#1890ff',
            color: 'white'
        },
        deleteButton: {
            backgroundColor: '#ff4d4f',
            color: 'white'
        },
        errorMessage: {
            color: '#ff4d4f',
            padding: '10px',
            marginBottom: '20px',
            backgroundColor: '#fff1f0',
            borderRadius: '4px'
        },
        loginPrompt: {
            textAlign: 'center',
            padding: '40px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '20px'
        }
    };

    if (loading) {
        return <div style={styles.container}>Loading...</div>;
    }

    return (
        <div style={styles.container}>
            <h2 style={{ textAlign: 'center', color: '#d46b08' }}>寻亲布告栏 (Reunion Board)</h2>

            {error && (
                <div style={styles.errorMessage}>{error}</div>
            )}

            {/* Search and Filter */}
            <form style={styles.searchForm} onSubmit={handleSearch}>
                <input
                    style={styles.searchInput}
                    type="text"
                    placeholder="搜索標題或內容..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select 
                    style={styles.select}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">全部狀態</option>
                    <option value="searching">尋找中</option>
                    <option value="found">已找到</option>
                    <option value="closed">已關閉</option>
                </select>
                <button type="submit" style={styles.button}>搜索</button>
            </form>

            {/* Create Post Form - Only for authenticated users */}
            {canManagePosts ? (
                editingPost ? (
                    <form style={styles.form} onSubmit={handleUpdate}>
                        <h3>編輯尋人啟事 (Edit Notice)</h3>
                        <input
                            style={styles.input}
                            type="text"
                            placeholder="標題"
                            value={editingPost.title}
                            onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                        />
                        <textarea
                            style={styles.textarea}
                            placeholder="詳細描述"
                            value={editingPost.description}
                            onChange={(e) => setEditingPost({ ...editingPost, description: e.target.value })}
                        />
                        <input
                            style={styles.input}
                            type="text"
                            placeholder="聯繫方式"
                            value={editingPost.contact}
                            onChange={(e) => setEditingPost({ ...editingPost, contact: e.target.value })}
                        />
                        <select
                            style={styles.select}
                            value={editingPost.status}
                            onChange={(e) => setEditingPost({ ...editingPost, status: e.target.value })}
                        >
                            <option value="searching">尋找中</option>
                            <option value="found">已找到</option>
                            <option value="closed">已關閉</option>
                        </select>
                        <div style={{ marginTop: '10px' }}>
                            <button style={styles.button} type="submit">保存 (Save)</button>
                            <button 
                                type="button" 
                                onClick={() => setEditingPost(null)}
                                style={{ ...styles.button, backgroundColor: '#999', marginLeft: '10px' }}
                            >
                                取消 (Cancel)
                            </button>
                        </div>
                    </form>
                ) : (
                    <form style={styles.form} onSubmit={handleSubmit}>
                        <h3>发布寻人启事 (Post a Notice)</h3>
                        <input
                            style={styles.input}
                            type="text"
                            placeholder="标题 (Title - e.g. 寻找失散多年的叔叔)"
                            value={newPost.title}
                            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                        />
                        <textarea
                            style={styles.textarea}
                            placeholder="详细描述 (Description - e.g. 姓名、籍贯、失散时间...)"
                            value={newPost.description}
                            onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
                        />
                        <input
                            style={styles.input}
                            type="text"
                            placeholder="联系方式 (Contact Info)"
                            value={newPost.contact}
                            onChange={(e) => setNewPost({ ...newPost, contact: e.target.value })}
                        />
                        <button style={styles.button} type="submit">发布 (Post)</button>
                    </form>
                )
            ) : (
                <div style={styles.loginPrompt}>
                    <p>請登入後發布尋人啟事</p>
                </div>
            )}

            {/* Posts List */}
            <div style={styles.postList}>
                {posts.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#999' }}>暫無尋人啟事</p>
                ) : (
                    posts.map((post, index) => {
                        const statusInfo = getStatusLabel(post.status);
                        const uniqueKey = post.id || `post-${index}-${post.created_at}`;
                        
                        return (
                            <div key={uniqueKey} style={styles.post}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                    <h3 style={{ ...styles.postTitle, margin: 0 }}>{post.title}</h3>
                                    <span style={{ ...styles.statusBadge, backgroundColor: statusInfo.color + '20', color: statusInfo.color }}>
                                        {statusInfo.text}
                                    </span>
                                </div>
                                <div style={styles.postMeta}>
                                    發布於：{new Date(post.created_at).toLocaleString()}
                                    {post.author_name ? (
                                        <span> | 發布者：{post.author_name}</span>
                                    ) : (
                                        <span> | 發布者：匿名</span>
                                    )}
                                </div>
                                <p>{post.description}</p>
                                <p><strong>聯繫方式:</strong> {post.contact}</p>
                                
                                {(canEditPost(post) || canDeletePost(post)) && (
                                    <div style={styles.postActions}>
                                        {canEditPost(post) && (
                                            <button 
                                                style={{ ...styles.actionButton, ...styles.editButton }}
                                                onClick={() => setEditingPost(post)}
                                            >
                                                編輯
                                            </button>
                                        )}
                                        {canDeletePost(post) && (
                                            <button 
                                                style={{ ...styles.actionButton, ...styles.deleteButton }}
                                                onClick={() => handleDelete(post.id)}
                                            >
                                                刪除
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ReunionBoard;
