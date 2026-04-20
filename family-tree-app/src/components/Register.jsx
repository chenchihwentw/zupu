import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Register = () => {
    const [searchParams] = useSearchParams();
    const inviteCodeFromUrl = searchParams.get('invite');

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        name: '',
        invite_code: inviteCodeFromUrl || ''
    });

    const [inviteInfo, setInviteInfo] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { register, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // 如果已經登入，直接跳轉（使用 useEffect）
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/tree', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // 驗證邀請碼
    useEffect(() => {
        if (!inviteCodeFromUrl) return;

        const verifyInvite = async () => {
            setVerifying(true);
            try {
                const response = await axios.get(`/api/invite/verify?code=${inviteCodeFromUrl}`);
                const inviteData = response.data.invitation;
                setInviteInfo(inviteData);
                
                // 如果邀請碼綁定了特定成員，自動填充姓名
                if (inviteData.target_member_name) {
                    setFormData(prev => ({
                        ...prev,
                        name: inviteData.target_member_name
                    }));
                }
            } catch (err) {
                console.error('Invitation verification failed:', err);
                setError('邀請碼無效或已過期');
            } finally {
                setVerifying(false);
            }
        };

        verifyInvite();
    }, [inviteCodeFromUrl]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    // 手動驗證邀請碼
    const handleManualVerify = async () => {
        if (!formData.invite_code) {
            setError('請輸入邀請碼');
            return;
        }

        setVerifying(true);
        setError('');

        try {
            const response = await axios.get(`/api/invite/verify?code=${formData.invite_code}`);
            const inviteData = response.data.invitation;
            setInviteInfo(inviteData);
            
            // 如果邀請碼綁定了特定成員，自動填充姓名
            if (inviteData.target_member_name) {
                setFormData(prev => ({
                    ...prev,
                    name: inviteData.target_member_name
                }));
            }
        } catch (err) {
            console.error('Invitation verification failed:', err);
            setError('邀請碼無效或已過期');
            setInviteInfo(null);
        } finally {
            setVerifying(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // 驗證
        if (formData.password !== formData.confirmPassword) {
            setError('密碼不一致');
            return;
        }

        if (formData.password.length < 6) {
            setError('密碼長度至少為 6 個字符');
            return;
        }

        if (!formData.invite_code) {
            setError('請提供邀請碼');
            return;
        }

        setLoading(true);

        // 移除 confirmPassword，不發送到後端
        const { confirmPassword, ...submitData } = formData;
        
        const result = await register(submitData);

        if (result.success) {
            // 標記首次登入，用於顯示歡迎提示
            localStorage.setItem('firstLoginAfterRegister', 'true');
            navigate('/tree?highlight=' + (result.user.linkedMemberId || ''));
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div style={styles.container}>
            <div style={styles.registerCard}>
                <h1 style={styles.title}>加入陳家族譜</h1>
                
                {verifying ? (
                    <div style={styles.loading}>驗證邀請碼中...</div>
                ) : inviteInfo ? (
                    <div style={styles.inviteBanner}>
                        <h3 style={styles.inviteTitle}>歡迎加入 {inviteInfo.family_tree_name}</h3>
                        <p style={styles.inviteText}>
                            您將以 <strong>{inviteInfo.target_member_name || '家族成員'}</strong> 的身份加入
                        </p>
                        <p style={styles.inviteRole}>
                            權限：<span style={styles.roleBadge}>{translateRole(inviteInfo.default_role)}</span>
                        </p>
                    </div>
                ) : (
                    <div style={styles.noInvite}>
                        <p>請使用邀請碼連結進行註冊</p>
                    </div>
                )}

                {error && (
                    <div style={styles.error}>{error}</div>
                )}

                {/* 手動輸入邀請碼區域 */}
                {!inviteInfo && !verifying && (
                    <div style={styles.manualInvite}>
                        <label style={styles.label}>邀請碼：</label>
                        <input
                            type="text"
                            name="invite_code"
                            value={formData.invite_code}
                            onChange={handleChange}
                            placeholder="CHEN_xxxxx_xxxxx"
                            style={styles.input}
                        />
                        <button 
                            type="button"
                            onClick={handleManualVerify}
                            disabled={!formData.invite_code || verifying}
                            style={{
                                ...styles.button,
                                marginTop: '10px',
                                width: '100%'
                            }}
                        >
                            {verifying ? '驗證中...' : '驗證邀請碼'}
                        </button>
                    </div>
                )}

                {/* 自動或手動驗證成功後顯示表單 */}
                {inviteInfo && (
                    <form onSubmit={handleSubmit} style={styles.form}>
                        <div style={styles.formGroup}>
                            <label style={styles.label}>姓名</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder={inviteInfo.target_member_name ? `系統將自動匹配到 ${inviteInfo.target_member_name}` : "請輸入您的真實姓名"}
                                required
                                style={styles.input}
                                readOnly={!!inviteInfo.target_member_name}
                            />
                            {inviteInfo.target_member_name && (
                                <p style={styles.hint}>
                                    ✓ 系統將自動匹配到 {inviteInfo.target_member_name}
                                </p>
                            )}
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>電子郵件</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="your@email.com"
                                required
                                style={styles.input}
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>密碼</label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="至少 6 個字符"
                                required
                                minLength={6}
                                style={styles.input}
                                autoComplete="new-password"
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>確認密碼</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="再次輸入密碼"
                                required
                                style={styles.input}
                                autoComplete="new-password"
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading || !inviteInfo}
                            style={{
                                ...styles.button,
                                ...(loading || !inviteInfo ? styles.buttonDisabled : {})
                            }}
                        >
                            {loading ? '註冊中...' : '立即加入'}
                        </button>
                    </form>
                )}

                <div style={styles.footer}>
                    <p style={styles.footerText}>
                        已有帳號？{' '}
                        <Link to="/login" style={styles.link}>
                            返回登入
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

// 輔助函數：翻譯角色名稱
const translateRole = (role) => {
    const roleMap = {
        super_admin: '超級管理員',
        family_admin: '家族管理員',
        user: '普通用戶',
        guest: '訪客'
    };
    return roleMap[role] || role;
};

const styles = {
    container: {
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
    },
    registerCard: {
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '450px'
    },
    title: {
        fontSize: '28px',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '20px',
        color: '#333'
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#666'
    },
    inviteBanner: {
        padding: '20px',
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #bae6fd'
    },
    inviteTitle: {
        fontSize: '18px',
        fontWeight: 'bold',
        marginBottom: '12px',
        color: '#0369a1'
    },
    inviteText: {
        fontSize: '14px',
        color: '#0c4a6e',
        marginBottom: '8px'
    },
    inviteRole: {
        fontSize: '14px',
        color: '#0c4a6e',
        marginTop: '12px'
    },
    roleBadge: {
        display: 'inline-block',
        padding: '4px 12px',
        backgroundColor: '#0ea5e9',
        color: 'white',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600'
    },
    noInvite: {
        padding: '30px',
        textAlign: 'center',
        color: '#666',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        marginBottom: '20px'
    },
    manualInvite: {
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
    },
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },
    label: {
        fontWeight: '600',
        color: '#555',
        fontSize: '14px'
    },
    input: {
        padding: '12px 16px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        fontSize: '16px',
        outline: 'none',
        transition: 'border-color 0.3s'
    },
    hint: {
        fontSize: '13px',
        color: '#059669',
        marginTop: '4px'
    },
    button: {
        padding: '14px',
        backgroundColor: '#667eea',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.3s'
    },
    buttonDisabled: {
        backgroundColor: '#a0a0a0',
        cursor: 'not-allowed'
    },
    error: {
        padding: '12px',
        backgroundColor: '#fee',
        color: '#c33',
        borderRadius: '6px',
        fontSize: '14px',
        marginBottom: '20px'
    },
    footer: {
        marginTop: '30px',
        textAlign: 'center',
        paddingTop: '20px',
        borderTop: '1px solid #eee'
    },
    footerText: {
        color: '#666',
        fontSize: '14px'
    },
    link: {
        color: '#667eea',
        textDecoration: 'none',
        fontWeight: '600'
    }
};

export default Register;
