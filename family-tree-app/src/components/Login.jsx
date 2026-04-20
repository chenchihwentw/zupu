import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const Login = () => {
    const [view, setView] = useState('login'); // 'login' | 'create-family-step1' | 'create-family-step2'
    
    // 登录表单状态
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    
    // 创建家族步骤1状态
    const [surname, setSurname] = useState('');
    const [ancestralHome, setAncestralHome] = useState('');
    const [hallName, setHallName] = useState('');
    
    // 创建家族步骤2状态
    const [founderName, setFounderName] = useState('');
    const [founderEmail, setFounderEmail] = useState('');
    const [founderPassword, setFounderPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const hasNavigated = useRef(false);

    // 如果已經登入，使用 useEffect 跳轉（避免在渲染時調用 navigate）
    useEffect(() => {
        if (isAuthenticated && !hasNavigated.current) {
            hasNavigated.current = true;
            navigate('/tree', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // 处理登录
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password, rememberMe);

        if (result.success) {
            navigate('/tree');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    // 处理创建家族步骤1
    const handleStep1Submit = (e) => {
        e.preventDefault();
        if (!surname.trim()) {
            setError('請輸入家族姓氏');
            return;
        }
        setError('');
        setView('create-family-step2');
    };

    // 处理创建家族步骤2
    const handleCreateFamily = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!founderName.trim() || !founderEmail.trim() || !founderPassword) {
            setError('請填寫所有必填欄位');
            return;
        }
        
        if (founderPassword !== confirmPassword) {
            setError('兩次輸入的密碼不一致');
            return;
        }
        
        setLoading(true);
        
        try {
            const response = await axios.post('/api/family/create', {
                surname: surname.trim(),
                ancestralHome: ancestralHome.trim(),
                hallName: hallName.trim(),
                founderName: founderName.trim(),
                founderEmail: founderEmail.trim(),
                founderPassword
            });
            
            // 创建成功后自动登录
            const result = await login(founderEmail, founderPassword, false);
            
            if (result.success) {
                navigate('/tree');
            } else {
                setError('家族創建成功，但自動登入失敗，請手動登入');
                setView('login');
            }
        } catch (err) {
            setError(err.response?.data?.error || '創建家族失敗，請稍後再試');
        } finally {
            setLoading(false);
        }
    };

    // 渲染登录视图
    const renderLoginView = () => (
        <>
            <h1 style={styles.title}>家族譜管理系統</h1>
            <p style={styles.subtitle}>記錄家族歷史，傳承家族文化</p>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.viewToggle}>
                <button 
                    style={{...styles.toggleButton, ...styles.toggleButtonActive}}
                    onClick={() => setView('login')}
                >
                    登入
                </button>
                <button 
                    style={styles.toggleButton}
                    onClick={() => setView('create-family-step1')}
                >
                    創建新家族
                </button>
            </div>

            {/* 新用户引导说明 */}
            <div style={styles.newUserGuide}>
                <p style={styles.guideText}>
                    <span style={styles.guideIcon}>👋</span>
                    還沒有賬號？<strong>首次使用</strong>請選擇「創建新家族」
                </p>
                <p style={styles.guideSubtext}>
                    註冊並創建屬於您自己的家族樹，成為家族管理員
                </p>
            </div>

            <form onSubmit={handleLogin} style={styles.form}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>電子郵件 / 帳號</label>
                    <input
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="請輸入電子郵件或帳號"
                        required
                        style={styles.input}
                    />
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>密碼</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="請輸入密碼"
                        required
                        style={styles.input}
                        autoComplete="current-password"
                    />
                </div>

                <div style={styles.checkboxGroup}>
                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            style={styles.checkbox}
                        />
                        記住我（7 天免登入）
                    </label>
                </div>

                <button 
                    type="submit" 
                    disabled={loading}
                    style={{
                        ...styles.button,
                        ...(loading ? styles.buttonDisabled : {})
                    }}
                >
                    {loading ? '登入中...' : '登入'}
                </button>
            </form>

            <div style={styles.divider}>
                <span style={styles.dividerText}>或有邀請碼？</span>
            </div>

            <div style={styles.inviteSection}>
                <Link to="/register" style={styles.inviteButton}>
                    使用邀請碼加入家族
                </Link>
            </div>
        </>
    );

    // 渲染创建家族步骤1
    const renderStep1View = () => (
        <>
            <h1 style={styles.title}>創建您的家族樹</h1>
            <p style={styles.subtitle}>步驟 1/2：家族基本信息</p>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.progressBar}>
                <div style={{...styles.progressStep, ...styles.progressStepActive}}>1</div>
                <div style={styles.progressLine}></div>
                <div style={styles.progressStep}>2</div>
            </div>

            <form onSubmit={handleStep1Submit} style={styles.form}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>
                        家族姓氏 <span style={styles.required}>*</span>
                    </label>
                    <input
                        type="text"
                        value={surname}
                        onChange={(e) => setSurname(e.target.value)}
                        placeholder="如：陳、林、黃、李..."
                        required
                        style={styles.input}
                    />
                    <p style={styles.hint}>您的家族姓氏，將用於生成家族名稱</p>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>祖籍位置</label>
                    <input
                        type="text"
                        value={ancestralHome}
                        onChange={(e) => setAncestralHome(e.target.value)}
                        placeholder="如：福建泉州、廣東潮州..."
                        style={styles.input}
                    />
                    <p style={styles.hint}>家族的祖籍地，可選填</p>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>家族堂號</label>
                    <input
                        type="text"
                        value={hallName}
                        onChange={(e) => setHallName(e.target.value)}
                        placeholder="如：潁川堂、隴西堂..."
                        style={styles.input}
                    />
                    <p style={styles.hint}>家族的堂號，可選填</p>
                </div>

                <div style={styles.buttonGroup}>
                    <button 
                        type="button"
                        onClick={() => setView('login')}
                        style={styles.secondaryButton}
                    >
                        返回
                    </button>
                    <button 
                        type="submit" 
                        style={styles.button}
                    >
                        下一步
                    </button>
                </div>
            </form>
        </>
    );

    // 渲染创建家族步骤2
    const renderStep2View = () => (
        <>
            <h1 style={styles.title}>創建您的家族樹</h1>
            <p style={styles.subtitle}>步驟 2/2：創建管理員帳號</p>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.progressBar}>
                <div style={{...styles.progressStep, ...styles.progressStepCompleted}}>✓</div>
                <div style={{...styles.progressLine, ...styles.progressLineActive}}></div>
                <div style={{...styles.progressStep, ...styles.progressStepActive}}>2</div>
            </div>

            <div style={styles.familyInfoSummary}>
                <p><strong>家族姓氏：</strong>{surname}</p>
                {ancestralHome && <p><strong>祖籍：</strong>{ancestralHome}</p>}
                {hallName && <p><strong>堂號：</strong>{hallName}</p>}
            </div>

            <form onSubmit={handleCreateFamily} style={styles.form}>
                <div style={styles.formGroup}>
                    <label style={styles.label}>
                        您的姓名 <span style={styles.required}>*</span>
                    </label>
                    <input
                        type="text"
                        value={founderName}
                        onChange={(e) => setFounderName(e.target.value)}
                        placeholder="請輸入您的姓名"
                        required
                        style={styles.input}
                    />
                    <p style={styles.hint}>您將成為家族的創始人和最高管理員</p>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>
                        電子郵件 <span style={styles.required}>*</span>
                    </label>
                    <input
                        type="email"
                        value={founderEmail}
                        onChange={(e) => setFounderEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        style={styles.input}
                    />
                    <p style={styles.hint}>用於登入和找回密碼</p>
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>
                        設置密碼 <span style={styles.required}>*</span>
                    </label>
                    <input
                        type="password"
                        value={founderPassword}
                        onChange={(e) => setFounderPassword(e.target.value)}
                        placeholder="請設置密碼"
                        required
                        style={styles.input}
                        autoComplete="new-password"
                    />
                </div>

                <div style={styles.formGroup}>
                    <label style={styles.label}>
                        確認密碼 <span style={styles.required}>*</span>
                    </label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="請再次輸入密碼"
                        required
                        style={styles.input}
                        autoComplete="new-password"
                    />
                </div>

                <div style={styles.buttonGroup}>
                    <button 
                        type="button"
                        onClick={() => setView('create-family-step1')}
                        style={styles.secondaryButton}
                    >
                        上一步
                    </button>
                    <button 
                        type="submit" 
                        disabled={loading}
                        style={{
                            ...styles.button,
                            ...(loading ? styles.buttonDisabled : {})
                        }}
                    >
                        {loading ? '創建中...' : '完成創建'}
                    </button>
                </div>
            </form>
        </>
    );

    return (
        <div style={styles.container}>
            <div style={styles.loginCard}>
                {view === 'login' && renderLoginView()}
                {view === 'create-family-step1' && renderStep1View()}
                {view === 'create-family-step2' && renderStep2View()}
            </div>
        </div>
    );
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
    loginCard: {
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
        marginBottom: '8px',
        color: '#333'
    },
    subtitle: {
        textAlign: 'center',
        color: '#666',
        marginBottom: '30px',
        fontSize: '14px'
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
    checkboxGroup: {
        display: 'flex',
        alignItems: 'center'
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        color: '#666',
        cursor: 'pointer'
    },
    checkbox: {
        width: '16px',
        height: '16px',
        cursor: 'pointer'
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
    secondaryButton: {
        padding: '14px',
        backgroundColor: '#f0f0f0',
        color: '#666',
        border: 'none',
        borderRadius: '8px',
        fontSize: '16px',
        fontWeight: '600',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
        flex: 1
    },
    buttonGroup: {
        display: 'flex',
        gap: '12px',
        marginTop: '10px'
    },
    error: {
        padding: '12px',
        backgroundColor: '#fee',
        color: '#c33',
        borderRadius: '6px',
        fontSize: '14px',
        marginBottom: '20px'
    },
    viewToggle: {
        display: 'flex',
        gap: '10px',
        marginBottom: '25px',
        backgroundColor: '#f5f5f5',
        padding: '4px',
        borderRadius: '8px'
    },
    toggleButton: {
        flex: 1,
        padding: '10px',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        color: '#666',
        transition: 'all 0.3s'
    },
    toggleButtonActive: {
        backgroundColor: 'white',
        color: '#667eea',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    divider: {
        display: 'flex',
        alignItems: 'center',
        margin: '25px 0',
        color: '#999',
        fontSize: '14px'
    },
    dividerText: {
        flex: 1,
        textAlign: 'center',
        position: 'relative',
        '&::before, &::after': {
            content: '""',
            position: 'absolute',
            top: '50%',
            width: '40%',
            height: '1px',
            backgroundColor: '#ddd'
        }
    },
    inviteSection: {
        textAlign: 'center'
    },
    inviteButton: {
        display: 'inline-block',
        padding: '12px 24px',
        backgroundColor: '#52c41a',
        color: 'white',
        borderRadius: '8px',
        textDecoration: 'none',
        fontWeight: '600',
        fontSize: '14px',
        transition: 'background-color 0.3s'
    },
    progressBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '30px',
        gap: '10px'
    },
    progressStep: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        backgroundColor: '#e0e0e0',
        color: '#999',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '14px'
    },
    progressStepActive: {
        backgroundColor: '#667eea',
        color: 'white'
    },
    progressStepCompleted: {
        backgroundColor: '#52c41a',
        color: 'white'
    },
    progressLine: {
        width: '60px',
        height: '2px',
        backgroundColor: '#e0e0e0'
    },
    progressLineActive: {
        backgroundColor: '#667eea'
    },
    required: {
        color: '#c33',
        marginLeft: '4px'
    },
    hint: {
        fontSize: '12px',
        color: '#999',
        marginTop: '4px'
    },
    familyInfoSummary: {
        backgroundColor: '#f8f9fa',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '20px',
        fontSize: '14px',
        color: '#666'
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
    },
    newUserGuide: {
        backgroundColor: '#e6f7ff',
        border: '1px solid #91d5ff',
        borderRadius: '8px',
        padding: '12px 16px',
        marginBottom: '20px',
        textAlign: 'center'
    },
    guideText: {
        color: '#096dd9',
        fontSize: '14px',
        margin: '0 0 4px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px'
    },
    guideIcon: {
        fontSize: '16px'
    },
    guideSubtext: {
        color: '#666',
        fontSize: '12px',
        margin: '0'
    }
};

export default Login;
