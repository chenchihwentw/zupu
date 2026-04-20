import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TreeDeciduous, 
  MessageSquare, 
  Settings, 
  Dna, 
  ChevronRight, 
  Languages, 
  BookOpen, 
  LogOut, 
  User, 
  Database,
  HelpCircle,
  ShieldCheck,
  X
} from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import FamilyTree from './components/FamilyTree';
import ReunionBoard from './components/ReunionBoard';
import Login from './components/Login';
import Register from './components/Register';
import MemberDetail from './components/MemberDetail';
import EditMemberPage from './components/EditMemberPage';
import BiographyEditPage from './components/BiographyEditPage';
import DbMaintenance from './components/DbMaintenance';
import FamilyManagement from './components/FamilyManagement';
import TabletGenerator from './components/TabletGenerator';
import MemorialHall from './components/MemorialHall';
import AdminDashboard from './components/AdminDashboard';
import ManualPage from './components/ManualPage';

function App() {
  const [currentView, setCurrentView] = useState('tree'); // 'tree' or 'reunion'
  const [showHelp, setShowHelp] = useState(false); // 操作說明模態窗口

  return (
    <Router>
      <AuthProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </AuthProvider>
    </Router>
  );
}

// Separate component to use auth context inside Router
const AppContent = () => {
  const [currentView, setCurrentView] = useState('tree'); // 'tree' or 'reunion'
  const [showHelp, setShowHelp] = useState(false); // 操作說明模態窗口
  const navigate = useNavigate();
  const { hasPermission, user, isAuthenticated, logout, currentFamilyId, switchFamily } = useAuth();
  const { isTraditional, toggleLanguage } = useLanguage();
  
  // PrivateRoute 組件：保護需要登入的路由
  const PrivateRoute = ({ children, requiredRole }) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    
    // ✅ 修改：對於家族管理頁面，檢查是否有任何家族的管理權限
    if (requiredRole && user?.familyRoles) {
      const roleHierarchy = {
        guest: 0,
        user: 1,
        family_admin: 2,
        super_admin: 3
      };
      
      // 檢查是否有任何一個家族滿足權限要求
      const hasAnyPermission = Object.values(user.familyRoles).some(role => {
        return (roleHierarchy[role] || 0) >= (roleHierarchy[requiredRole] || 0);
      });
      
      if (!hasAnyPermission) {
        return <Navigate to="/" replace />;
      }
    } else if (requiredRole && !hasPermission(requiredRole)) {
      // 向後兼容：如果沒有 familyRoles，使用舊邏輯
      return <Navigate to="/" replace />;
    }
    
    return children;
  };

  return (
    <div className="App" style={{ 
      minHeight: '100vh', 
      paddingTop: window.innerWidth < 768 ? '60px' : '80px' 
    }}>
      {/* Modern Floating Navigation Bar */}
      <nav style={{ 
        position: 'fixed',
        top: window.innerWidth < 768 ? '0' : '15px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: window.innerWidth < 768 ? '100%' : 'calc(100% - 40px)',
        maxWidth: '1280px',
        zIndex: 2000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: window.innerWidth < 768 ? '6px 12px' : '8px 20px',
        borderRadius: window.innerWidth < 768 ? '0' : 'var(--radius-full)',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: window.innerWidth < 768 ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255, 255, 255, 0.4)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: window.innerWidth < 768 ? '2px' : '8px' }}>
          {window.innerWidth >= 768 && (
            <>
              <div style={{ 
                backgroundColor: 'var(--primary-color)', 
                color: 'white', 
                width: '32px', 
                height: '32px', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '8px'
              }}>
                <TreeDeciduous size={18} />
              </div>
              <span style={{ 
                fontFamily: 'var(--font-heading)', 
                fontWeight: 800, 
                fontSize: '20px', 
                background: 'linear-gradient(45deg, var(--primary-color), var(--secondary-color))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginRight: '20px'
              }}>
                Familia
              </span>
            </>
          )}

          {/* Global Family Switcher */}
          {isAuthenticated && user?.familyTrees?.length > 1 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              backgroundColor: 'rgba(79, 70, 229, 0.05)', 
              padding: window.innerWidth < 768 ? '2px 8px' : '4px 12px', 
              borderRadius: 'var(--radius-full)',
              marginRight: window.innerWidth < 768 ? '4px' : '12px',
              border: '1px solid rgba(79, 70, 229, 0.1)'
            }}>
              <Database size={window.innerWidth < 768 ? 12 : 14} color="var(--primary-color)" />
              <select 
                value={currentFamilyId || ''} 
                onChange={(e) => switchFamily(e.target.value)}
                style={{
                  border: 'none',
                  background: 'none',
                  fontSize: window.innerWidth < 768 ? '11px' : '13px',
                  fontWeight: 700,
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '2px 0',
                  maxWidth: window.innerWidth < 768 ? '60px' : 'none'
                }}
              >
                {user.familyTrees.map(fam => (
                  <option key={fam.id} value={fam.id}>{fam.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Main Navigation Tabs */}
          <div style={{ display: 'flex', gap: '2px', backgroundColor: 'rgba(0,0,0,0.03)', padding: '2px', borderRadius: 'var(--radius-full)' }}>
            {[
              { id: 'tree', label: '家族樹', path: '/tree', icon: TreeDeciduous },
              { id: 'reunion', label: '尋親', path: '/reunion', icon: MessageSquare },
              { id: 'manage', label: '管理', path: '/family/manage', icon: Settings },
              { id: 'tablet', label: '牌位', path: '/tablet', icon: Dna },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  navigate(item.path);
                }}
                style={{
                  padding: window.innerWidth < 768 ? '6px 8px' : '6px 16px',
                  borderRadius: 'var(--radius-full)',
                  background: currentView === item.id ? 'white' : 'transparent',
                  color: currentView === item.id ? 'var(--primary-color)' : 'var(--text-muted)',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: currentView === item.id ? 'var(--shadow-sm)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: window.innerWidth < 768 ? '40px' : 'auto',
                  justifyContent: 'center'
                }}
                title={item.label}
              >
                <item.icon size={window.innerWidth < 768 ? 18 : 14} />
                {window.innerWidth >= 768 && item.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Admin Tools Quick Action */}
          {isAuthenticated && user && hasPermission('super_admin') && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => navigate('/admin/dashboard')}
                style={{
                  background: 'rgba(79, 70, 229, 0.1)',
                  color: 'var(--primary-color)',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
                title="數據安全中心"
              >
                <ShieldCheck size={18} />
              </button>
              <button 
                onClick={() => navigate('/db-maintenance')}
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--danger-color)',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
                title="數據庫維護 (開發用)"
              >
                <Database size={18} />
              </button>
            </div>
          )}

          {/* Language Toggle */}
          <button 
            onClick={toggleLanguage}
            style={{
              background: 'rgba(79, 70, 229, 0.1)',
              color: 'var(--primary-color)',
              border: 'none',
              padding: '8px',
              borderRadius: '50%',
              cursor: 'pointer'
            }}
            title={isTraditional ? '切換至簡體' : '切換至繁體'}
          >
            <Languages size={18} />
          </button>

          {/* User Info & Actions */}
          {isAuthenticated && user && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: window.innerWidth < 768 ? '4px' : '8px', 
              paddingLeft: window.innerWidth < 768 ? '4px' : '12px', 
              borderLeft: '1px solid #eee' 
            }}>
              <div style={{ 
                width: window.innerWidth < 768 ? '24px' : '32px', 
                height: window.innerWidth < 768 ? '24px' : '32px', 
                borderRadius: '50%', 
                backgroundColor: '#f3f4f6', 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}>
                <User size={window.innerWidth < 768 ? 14 : 18} />
              </div>
              {window.innerWidth >= 1024 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{user.name || '用戶'}</span>
                </div>
              )}
              <button 
                onClick={logout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-light)',
                  padding: '4px',
                  cursor: 'pointer'
                }}
              >
                <LogOut size={window.innerWidth < 768 ? 14 : 16} />
              </button>
            </div>
          )}

          <button 
            onClick={() => navigate('/manual')}
            style={{
              padding: window.innerWidth < 768 ? '6px 8px' : '8px 16px',
              background: 'var(--text-main)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <HelpCircle size={window.innerWidth < 768 ? 14 : 14} />
            {window.innerWidth >= 768 ? '指南' : ''}
          </button>
        </div>
      </nav>

      {/* Modernized Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '20px'
            }} 
            onClick={() => setShowHelp(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              style={{
                backgroundColor: 'white',
                borderRadius: 'var(--radius-lg)',
                width: '100%',
                maxWidth: '800px',
                maxHeight: '80vh',
                boxShadow: 'var(--shadow-xl)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }} 
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '24px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '24px', fontWeight: 800 }}>📖 操作指南</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>歡迎來到 Familia，讓您的家族史永久傳承。</p>
                </div>
                <button 
                  onClick={() => setShowHelp(false)}
                  style={{ background: '#f3f4f6', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '24px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {[
                  { title: '🌳 家族樹', items: ['點擊成員查看詳情', '長按或鼠標右鍵新增親屬', '支持手機端水平滑動導覽'], color: '#4f46e5' },
                  { title: '🏛️ 線上祭殿', items: ['3D 沉浸式祭祀體驗', '手機端 FAB 快捷操作', '自動生成家族牌位'], color: '#8b4513' },
                  { title: '🖼️ 家族相冊', items: ['多端同步影像照片', '支持生平大事記關聯', '珍貴影像永久存儲'], color: '#ec4899' },
                  { title: '⚙️ 家族管理', items: ['配置成員邀請碼', '數據編輯自動日誌', '誤刪數據管理員恢復'], color: '#f59e0b' }
                ].map((section, idx) => (
                  <div key={idx} style={{ padding: '20px', borderRadius: 'var(--radius-md)', backgroundColor: `${section.color}08`, border: `1px solid ${section.color}15` }}>
                    <h3 style={{ color: section.color, fontSize: '18px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {section.title}
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {section.items.map((text, i) => (
                        <li key={i} style={{ fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <ChevronRight size={14} style={{ marginTop: '3px', color: section.color }} />
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div style={{ padding: '20px 24px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
                <button 
                  onClick={() => setShowHelp(false)}
                  style={{
                    padding: '10px 30px',
                    background: 'var(--primary-color)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 600
                  }}
                >
                  開始使用
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Routes>
        {/* 公開路由 */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* 根路由 - 直接重定向到 /tree */}
        <Route path="/" element={<Navigate to="/tree" replace />} />
        
        {/* 保護路由：需要登入 */}
        <Route path="/tree" element={
          <PrivateRoute>
            <FamilyTree />
          </PrivateRoute>
        } />
        <Route path="/reunion" element={
          <PrivateRoute>
            <ReunionBoard />
          </PrivateRoute>
        } />
        <Route path="/member/:id" element={<PrivateRoute><MemberDetail /></PrivateRoute>} />
        <Route path="/member/:id/edit" element={<PrivateRoute requiredRole="family_admin"><EditMemberPage /></PrivateRoute>} />
        <Route path="/member/:id/biography/edit" element={<PrivateRoute requiredRole="family_admin"><BiographyEditPage /></PrivateRoute>} />
        <Route path="/db-maintenance" element={<PrivateRoute requiredRole="super_admin"><DbMaintenance /></PrivateRoute>} />
        <Route path="/admin/dashboard" element={<PrivateRoute requiredRole="super_admin"><AdminDashboard /></PrivateRoute>} />
        <Route path="/family/manage" element={<PrivateRoute requiredRole="family_admin"><FamilyManagement /></PrivateRoute>} />
        <Route path="/tablet" element={<PrivateRoute><TabletGenerator /></PrivateRoute>} />
        <Route path="/memorial/:id" element={<PrivateRoute><MemorialHall user={user} /></PrivateRoute>} />
        <Route path="/manual" element={<ManualPage />} />
      </Routes>
    </div>
  );
}

// 操作說明樣式
const styles = {
  helpOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  helpModal: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    width: '80%',
    maxWidth: '900px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  helpHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e8e8e8',
  },
  helpTitle: {
    margin: 0,
    fontSize: '24px',
    color: '#333',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: '#666',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
  },
  helpContent: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
  helpSection: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '18px',
    color: '#007bff',
  },
  helpList: {
    margin: 0,
    paddingLeft: '20px',
  },
  helpList: {
    margin: 0,
    paddingLeft: '20px',
  },
};

export default App;