import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [currentFamilyId, setCurrentFamilyId] = useState(localStorage.getItem('currentFamilyId'));

    // 初始化時檢查用戶是否已登入
    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                try {
                    const response = await axios.get('/api/auth/me', {
                        headers: { Authorization: `Bearer ${storedToken}` }
                    });
                    const userData = response.data;
                    setUser(userData);
                    setToken(storedToken);

                    // 如果沒有選中的家族，設置一個默認的
                    if (!localStorage.getItem('currentFamilyId') && userData.familyTrees?.length > 0) {
                        const defaultFamilyId = userData.familyTrees[0].id;
                        setCurrentFamilyId(defaultFamilyId);
                        localStorage.setItem('currentFamilyId', defaultFamilyId);
                    }
                } catch (error) {
                    console.error('Token validation failed:', error);
                    localStorage.removeItem('token');
                    setToken(null);
                }
            }
            setLoading(false);
        };

        initAuth();
    }, []);

    // 登入
    const login = async (email, password, rememberMe = false) => {
        try {
            const response = await axios.post('/api/auth/login', {
                email,
                password,
                rememberMe
            });

            const { token: newToken, user: userData } = response.data;
            
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(userData);

            // 登入後自動選擇第一個家族
            if (userData.familyTrees?.length > 0) {
                const defaultFamilyId = userData.familyTrees[0].id;
                setCurrentFamilyId(defaultFamilyId);
                localStorage.setItem('currentFamilyId', defaultFamilyId);
            }

            return { success: true, user: userData };
        } catch (error) {
            console.error('Login failed:', error);
            return { 
                success: false, 
                error: error.response?.data?.error || '登入失敗' 
            };
        }
    };

    // 註冊（帶邀請碼）
    const register = async (formData) => {
        try {
            const response = await axios.post('/api/auth/register-with-invite', formData);
            
            const { token: newToken, user: userData } = response.data;
            
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(userData);

            if (userData.familyTrees?.length > 0) {
                const defaultFamilyId = userData.familyTrees[0].id;
                setCurrentFamilyId(defaultFamilyId);
                localStorage.setItem('currentFamilyId', defaultFamilyId);
            }

            return { success: true, user: userData };
        } catch (error) {
            console.error('Registration failed:', error);
            return { 
                success: false, 
                error: error.response?.data?.error || '註冊失敗' 
            };
        }
    };

    // 登出
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('currentFamilyId');
        setToken(null);
        setUser(null);
        setCurrentFamilyId(null);
    };

    // 切換家族
    const switchFamily = (familyId) => {
        setCurrentFamilyId(familyId);
        localStorage.setItem('currentFamilyId', familyId);
        // 發送全局自定義事件，以便非 React 組件也能感知
        window.dispatchEvent(new CustomEvent('familyChange', { detail: { familyId } }));
    };

    // 檢查權限
    const hasPermission = (requiredRole, familyId = null) => {
        if (!user) return false;
        
        const roleHierarchy = {
            guest: 0,
            user: 1,
            editor: 1.5,
            family_admin: 2,
            super_admin: 3
        };

        const targetFamilyId = familyId || currentFamilyId;
        let userRole;
        
        if (targetFamilyId && user.familyRoles && user.familyRoles[targetFamilyId]) {
            userRole = user.familyRoles[targetFamilyId];
        } else {
            // 向後兼容
            userRole = user.role;
        }
        
        const userRoleLevel = roleHierarchy[userRole] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

        return userRoleLevel >= requiredRoleLevel;
    };

    const value = {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        hasPermission,
        token,
        currentFamilyId,
        switchFamily
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
