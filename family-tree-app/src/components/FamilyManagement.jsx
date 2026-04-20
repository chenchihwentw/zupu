import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import BatchFamilyLabels from './BatchFamilyLabels';
import HelpLink from './HelpLink';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  UserPlus, 
  Home, 
  GitMerge, 
  Tag, 
  Info, 
  Copy, 
  CheckCircle, 
  RefreshCw,
  ShieldCheck,
  Search,
  HardDrive,
  Database,
  UserCheck
} from 'lucide-react';

function FamilyManagement() {
  const { user, currentFamilyId, switchFamily } = useAuth();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [searchCode, setSearchCode] = useState('');
  const [foundFamily, setFoundFamily] = useState(null);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('member-invite');
  const [userFamilies, setUserFamilies] = useState([]);
  
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [memberRole, setMemberRole] = useState('user');
  const [generatedMemberInvite, setGeneratedMemberInvite] = useState(null);
  
  const [isEditingFamilyInfo, setIsEditingFamilyInfo] = useState(false);
  const [editFamilyName, setEditFamilyName] = useState('');
  const [editSurname, setEditSurname] = useState('');
  const [editAncestralHome, setEditAncestralHome] = useState('');
  const [editHallName, setEditHallName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Storage Quota Management States
  const [storageUsers, setStorageUsers] = useState([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [familyStorageLimit, setFamilyStorageLimit] = useState(200);
  const [isUpdatingStorage, setIsUpdatingStorage] = useState(false);

  useEffect(() => {
    fetchFamilyInfo();
  }, [currentFamilyId]);

  useEffect(() => {
    if (activeTab === 'member-invite' && family && members.length === 0 && !membersLoading) {
      fetchMembers();
    }
    if (activeTab === 'storage-settings' && currentFamilyId) {
      fetchStorageDetails();
    }
  }, [activeTab, family, currentFamilyId]);

  const fetchStorageDetails = async () => {
    try {
      setStorageLoading(true);
      const token = localStorage.getItem('token');
      
      // 獲取用戶儲存明細
      const usersRes = await axios.get(`/api/family/${currentFamilyId}/storage-users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStorageUsers(usersRes.data);
      
      // 更新當前家族限額
      if (family) {
        setFamilyStorageLimit(family.storage_limit_mb || 200);
      }
    } catch (err) {
      console.error('Fetch storage details failed:', err);
    } finally {
      setStorageLoading(false);
    }
  };

  const handleUpdateFamilyLimit = async () => {
    try {
      setIsUpdatingStorage(true);
      const token = localStorage.getItem('token');
      await axios.put(`/api/family/${currentFamilyId}/storage-limit`, 
        { limit_mb: parseInt(familyStorageLimit) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setFamily({ ...family, storage_limit_mb: familyStorageLimit });
      setMessage('家族總上限已更新！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('更新失敗: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsUpdatingStorage(false);
    }
  };

  const handleUpdateUserLimit = async (targetUserId, newLimit) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/user/${targetUserId}/fair-use-limit`, 
        { limit_mb: parseInt(newLimit) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // 更新本地狀態
      setStorageUsers(prev => prev.map(u => 
        u.userId === targetUserId ? { ...u, fairUseLimit: parseInt(newLimit) } : u
      ));
      
      setMessage('用戶限額已更新！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('更新失敗: ' + (err.response?.data?.error || err.message));
    }
  };

  const fetchFamilyInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const viewMemberId = localStorage.getItem('currentViewMemberId');
      
      const userResponse = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const accountFamilies = userResponse.data.familyTrees || [];
      const mappedAccountFamilies = accountFamilies.map(ft => ({
        id: ft.id,
        name: ft.name,
        role: ft.role
      }));

      let allFamiliesMap = new Map();
      mappedAccountFamilies.forEach(f => allFamiliesMap.set(f.id, f));

      if (viewMemberId) {
        try {
          const treeResponse = await axios.get(`/api/my-family-tree?view_member_id=${encodeURIComponent(viewMemberId)}&include_related=true`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (treeResponse.data.family_info) {
            const currentFam = treeResponse.data.family_info;
            if (!allFamiliesMap.has(currentFam.id)) {
              allFamiliesMap.set(currentFam.id, {
                id: currentFam.id,
                name: currentFam.name,
                role: 'viewer'
              });
            }
          }
          
          const allMembersData = treeResponse.data.members || [];
          const viewMemberData = allMembersData.find(m => m.id === viewMemberId);
          if (viewMemberData && viewMemberData.families) {
            viewMemberData.families.forEach(famId => {
              if (famId && !allFamiliesMap.has(famId)) {
                allFamiliesMap.set(famId, {
                  id: famId,
                  name: famId === 'b12' ? '李家' : famId,
                  role: 'viewer'
                });
              }
            });
          }
        } catch (treeErr) {
          console.error('Fetch perspective families failed:', treeErr);
        }
      }

      const mergedFamilies = Array.from(allFamiliesMap.values());
      setUserFamilies(mergedFamilies);
      
      const activeFamilyId = currentFamilyId || (mergedFamilies.length > 0 ? mergedFamilies[0].id : null);
      
      if (activeFamilyId) {
        const response = await axios.get(`/api/family/${activeFamilyId}/manage`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFamily(response.data);
      } else {
        setError('您尚未加入任何家族');
      }
    } catch (err) {
      setError('獲取家族信息失敗: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const handleFamilyChange = (newFamilyId) => {
    switchFamily(newFamilyId);
    setMembers([]);
    setGeneratedMemberInvite(null);
    setSelectedMember('');
  };

  const fetchMembers = async () => {
    try {
      setMembersLoading(true);
      const token = localStorage.getItem('token');
      const familyId = family.id;
      const response = await axios.get(`/api/family?family_tree_id=${familyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const allMembers = response.data;
      const currentFamilyId = familyId;
      
      // 精準篩選：根據 families 欄位判斷成員是否屬於當前正在管理的家族
      const sortedMembers = allMembers
        .filter(m => {
          // 解析 families 欄位
          const mFamilies = m.families ? (typeof m.families === 'string' ? JSON.parse(m.families) : m.families) : [];
          return (
            (Array.isArray(mFamilies) && mFamilies.includes(currentFamilyId)) ||
            m.primaryFamily === currentFamilyId
          );
        })
        .map(m => ({
          ...m,
          displayName: m.user_id ? `${m.name} (已註冊)` : m.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-HK'));
      
      setMembers(sortedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setMembersLoading(false);
    }
  };

  const generateMemberInviteCode = async () => {
    try {
      if (!selectedMember) {
        setError('請選擇要邀請的成員');
        return;
      }
      const token = localStorage.getItem('token');
      // 將參數名稱對齊後端
      const response = await axios.post('/api/invite/generate', {
        target_member_id: selectedMember,
        family_id: currentFamilyId,
        default_role: memberRole
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setGeneratedMemberInvite(response.data);
      setMessage('邀請碼生成成功！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('生成失敗: ' + (err.response?.data?.error || err.message));
    }
  };

  const generateFamilyInviteCode = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`/api/family/${family.id}/invite-code`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInviteCode(response.data.inviteCode);
      setFamily({ ...family, invite_code: response.data.inviteCode, invite_code_expires_at: response.data.expiresAt });
      setMessage('家族邀請碼已更新！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('生成失敗: ' + (err.response?.data?.error || err.message));
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    setMessage('邀請碼已複製！');
    setTimeout(() => setMessage(''), 2000);
  };

  const searchFamilyByCode = async () => {
    try {
      if (!searchCode || searchCode.length !== 6) {
        setError('請輸入6位數邀請碼');
        return;
      }
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/family/find-by-code?code=${searchCode}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFoundFamily(response.data);
      setError('');
    } catch (err) {
      setFoundFamily(null);
      setError('找不到該家族，請檢查邀請碼是否正確');
    }
  };

  const saveFamilyInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`/api/family/${family.id}/info`, {
        name: editFamilyName,
        surname: editSurname,
        ancestral_home: editAncestralHome,
        hall_name: editHallName,
        description: editDescription
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFamily({
        ...family,
        name: editFamilyName,
        surname: editSurname,
        ancestral_home: editAncestralHome,
        hall_name: editHallName,
        description: editDescription
      });
      
      setIsEditingFamilyInfo(false);
      setMessage('信息已更新！');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError('保存失敗: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return (
    <div style={styles.loadingOverlay}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
        <RefreshCw size={32} color="#3b82f6" />
      </motion.div>
    </div>
  );

  const tabs = [
    { id: 'member-invite', label: '成員邀請', icon: UserPlus },
    { id: 'storage-settings', label: '儲存設定', icon: HardDrive },
    { id: 'family-info', label: '家族信息', icon: Home },
    // { id: 'family-merge', label: '家族合併', icon: GitMerge },
    { id: 'batch-labels', label: '批量標籤', icon: Tag }
  ];

  return (
    <div className="family-management" style={styles.outerContainer}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.titleArea}>
            <div style={styles.iconCircle}><Settings size={28} /></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h1 style={styles.title}>家族管理</h1>
              <HelpLink section="permissions" showText={true} style={{ backgroundColor: '#fff' }} />
            </div>
          </div>
          
          {userFamilies.length > 1 && (
            <div style={styles.familySwitcher}>
              <span style={styles.switchLabel}>當前家族:</span>
              <select 
                value={currentFamilyId} 
                onChange={(e) => handleFamilyChange(e.target.value)}
                style={styles.switchSelect}
              >
                {userFamilies.map(fam => (
                  <option key={fam.id} value={fam.id}>
                    {fam.name} ({fam.role === 'admin' || fam.role === 'family_admin' ? '管理員' : '查看'})
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }}
              style={styles.message}
            >
              <CheckCircle size={18} /> {message}
            </motion.div>
          )}
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              style={styles.error}
              onClick={() => setError('')}
            >
              <Info size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <nav style={styles.tabNav}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tabButton,
                color: activeTab === tab.id ? '#3b82f6' : '#64748b'
              }}
            >
              {activeTab === tab.id && (
                <motion.div layoutId="active-pill" style={styles.activePill} transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} />
              )}
              <tab.icon size={18} style={{ zIndex: 1 }} />
              <span style={{ zIndex: 1, fontWeight: activeTab === tab.id ? 700 : 500 }}>{tab.label}</span>
            </button>
          ))}
        </nav>

        <motion.main
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          style={styles.content}
        >
          {activeTab === 'member-invite' && (
            <div style={styles.section}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <Info size={20} color="#3b82f6" />
                  <h2 style={styles.cardTitle}>邀請成員入駐</h2>
                </div>
                <p style={styles.cardDesc}>為家族成員生成專屬邀請碼。現有用戶（已註冊）也可通過此邀請獲得新家族權限。</p>
                
                <div style={styles.formBox}>
                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>選擇家族成員</label>
                    <div style={styles.selectWrapper}>
                      <select 
                        value={selectedMember} 
                        onChange={(e) => setSelectedMember(e.target.value)}
                        style={styles.proSelect}
                      >
                        <option value="">{membersLoading ? '加載中...' : '-- 選擇已建立的成員 --'}</option>
                        {members.map(m => (
                          <option key={m.id} value={m.id}>{m.displayName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={styles.inputGroup}>
                    <label style={styles.inputLabel}>權限等級</label>
                    <div style={styles.selectWrapper}>
                      <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)} style={styles.proSelect}>
                        <option value="user">普通成員 (僅編輯自己)</option>
                        <option value="editor">編輯者 (可編輯他人)</option>
                        <option value="admin">管理員 (擁有管理權)</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={generateMemberInviteCode}
                    disabled={!selectedMember}
                    style={{...styles.proButton, opacity: selectedMember ? 1 : 0.6}}
                  >
                    生成授權邀請碼
                  </button>
                </div>

                {generatedMemberInvite && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={styles.inviteResult}>
                    <div style={styles.codeRow}>
                      <span style={styles.inviteTarget}>{generatedMemberInvite.memberName} 的邀請碼</span>
                      <div style={styles.codePill}>
                        <code style={styles.codeStyle}>{generatedMemberInvite.inviteCode}</code>
                        <button onClick={() => copyToClipboard(generatedMemberInvite.inviteCode)} style={styles.inlineCopy}><Copy size={14} /></button>
                      </div>
                    </div>
                    <div style={styles.expiryBox}>
                      <ShieldCheck size={14} /> 有效期至：{new Date(generatedMemberInvite.expiresAt).toLocaleDateString()}
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'family-info' && (
            <div style={styles.section}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <Home size={20} color="#3b82f6" />
                  <h2 style={styles.cardTitle}>家族基本信息</h2>
                  {!isEditingFamilyInfo && (
                    <button onClick={() => {
                       setEditFamilyName(family.name || '');
                       setEditSurname(family.surname || '');
                       setEditAncestralHome(family.ancestral_home || '');
                       setEditHallName(family.hall_name || '');
                       setEditDescription(family.description || '');
                       setIsEditingFamilyInfo(true);
                    }} style={styles.editBtn}>編輯</button>
                  )}
                </div>

                {isEditingFamilyInfo ? (
                  <div style={styles.editForm}>
                    <div style={styles.gridForm}>
                      <div style={styles.inputGroup}><label style={styles.inputLabel}>家族名稱</label><input type="text" value={editFamilyName || ''} onChange={e => setEditFamilyName(e.target.value)} style={styles.proInput} /></div>
                      <div style={styles.inputGroup}><label style={styles.inputLabel}>姓氏</label><input type="text" value={editSurname || ''} onChange={e => setEditSurname(e.target.value)} style={styles.proInput} /></div>
                      <div style={styles.inputGroup}><label style={styles.inputLabel}>祖籍</label><input type="text" value={editAncestralHome || ''} onChange={e => setEditAncestralHome(e.target.value)} style={styles.proInput} /></div>
                      <div style={styles.inputGroup}><label style={styles.inputLabel}>堂號</label><input type="text" value={editHallName || ''} onChange={e => setEditHallName(e.target.value)} style={styles.proInput} /></div>
                    </div>
                    <div style={styles.inputGroup}><label style={styles.inputLabel}>家族描述</label><textarea value={editDescription || ''} onChange={e => setEditDescription(e.target.value)} style={{...styles.proInput, height: '100px', resize: 'none'}} /></div>
                    <div style={styles.formActions}>
                      <button onClick={() => setIsEditingFamilyInfo(false)} style={styles.ghostBtn}>取消</button>
                      <button onClick={saveFamilyInfo} style={styles.proButton}>保存更改</button>
                    </div>
                  </div>
                ) : (
                  <div style={styles.infoGrid}>
                    <div style={styles.infoCell}><label style={styles.cellLabel}>家族名稱</label><div style={styles.cellValue}>{family?.name}</div></div>
                    <div style={styles.infoCell}><label style={styles.cellLabel}>姓氏</label><div style={styles.cellValue}>{family?.surname || '未填寫'}</div></div>
                    <div style={styles.infoCell}><label style={styles.cellLabel}>祖籍</label><div style={styles.cellValue}>{family?.ancestral_home || '未填寫'}</div></div>
                    <div style={styles.infoCell}><label style={styles.cellLabel}>堂號</label><div style={styles.cellValue}>{family?.hall_name || '未填寫'}</div></div>
                    <div style={{...styles.infoCell, gridColumn: 'span 2'}}><label style={styles.cellLabel}>家族描述</label><div style={styles.cellValue}>{family?.description || '無描述'}</div></div>
                    <div style={{...styles.infoCell, gridColumn: 'span 2', backgroundColor: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)'}}>
                      <label style={styles.cellLabel}>家族 ID (對接用)</label>
                      <div style={styles.idRow}>
                        <code style={styles.miniCode}>{family?.id}</code>
                        <button onClick={() => copyToClipboard(family?.id)} style={styles.inlineCopy}><Copy size={14} /></button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'family-merge' && (
            <div style={styles.section}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <GitMerge size={20} color="#3b82f6" />
                  <h2 style={styles.cardTitle}>家族合併流程</h2>
                </div>
                <div style={styles.mergeInstructions}>
                  <div style={styles.mergeStep}>
                    <div style={styles.stepNum}>1</div>
                    <div>生成您家族的<strong>管理邀請碼</strong>並提供給對方</div>
                  </div>
                  <div style={styles.mergeStep}>
                    <div style={styles.stepNum}>2</div>
                    <div>或在下方輸入對方的邀請碼發起<strong>雙向合併請求</strong></div>
                  </div>
                </div>

                <div style={styles.inviteBox}>
                  <div style={styles.boxTitle}>本家族邀請碼</div>
                  <div style={styles.codeActions}>
                    {family?.invite_code ? (
                      <div style={styles.codePillBig}>
                        <code>{family.invite_code.slice(0,3)} {family.invite_code.slice(3)}</code>
                        <button onClick={() => copyToClipboard(family.invite_code)} style={styles.inlineCopy}><Copy size={18} /></button>
                      </div>
                    ) : (
                      <div style={{color: '#94a3b8', fontStyle: 'italic'}}>尚未生成</div>
                    )}
                    <button onClick={generateFamilyInviteCode} style={styles.ghostBtn}>{family?.invite_code ? '刷新' : '生成'}</button>
                  </div>
                </div>

                <div style={styles.divider}><span>或</span></div>

                <div style={styles.searchBoxArea}>
                   <div style={styles.inputWithBtn}>
                      <input 
                        type="text" 
                        placeholder="輸入對方的 6 位邀請碼..." 
                        value={searchCode}
                        onChange={e => setSearchCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        style={styles.proInput}
                      />
                      <button onClick={searchFamilyByCode} style={styles.proButton}><Search size={18} /></button>
                   </div>
                </div>

                {foundFamily && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={styles.foundFamily}>
                    <div style={styles.foundHeader}>找到對應家族: {foundFamily.name}</div>
                    <div style={styles.foundStats}>
                       <span>🔹 成員: {foundFamily.memberCount} 人</span>
                       <span>🔹 管理員: {foundFamily.adminCount} 人</span>
                    </div>
                    <button style={{...styles.proButton, background: '#10b981', marginTop: '16px', width: '100%'}}>發起雙向合併申請</button>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'storage-settings' && (
            <div style={styles.section}>
              <div style={styles.card}>
                <div style={styles.cardHeader}>
                  <HardDrive size={20} color="#3b82f6" />
                  <h2 style={styles.cardTitle}>家族空間與配額調度</h2>
                </div>
                
                <div style={styles.quotaConfigBox}>
                  <div style={styles.configHeader}>
                    <div style={styles.configMain}>
                      <span style={styles.configLabel}>家族總存儲上限 (MB)</span>
                      <div style={styles.inputWithUnit}>
                        <input 
                          type="number" 
                          value={familyStorageLimit} 
                          onChange={(e) => setFamilyStorageLimit(e.target.value)}
                          style={styles.compactInput}
                        />
                        <button 
                          onClick={handleUpdateFamilyLimit}
                          disabled={isUpdatingStorage} 
                          style={styles.miniButton}
                        >
                          {isUpdatingStorage ? '更新中...' : '保存'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p style={styles.miniNote}>* 此上限決定了全體成員上傳檔案的總容量極值。</p>
                </div>

                <div style={styles.userTableWrapper}>
                  <table style={styles.userTable}>
                    <thead>
                      <tr>
                        <th style={styles.th}>用戶 / 關聯成員</th>
                        <th style={styles.th}>角色</th>
                        <th style={styles.th}>已用空間</th>
                        <th style={styles.th}>公平限額 (MB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storageUsers.length === 0 ? (
                        <tr><td colSpan="4" style={styles.tdCenter}>{storageLoading ? '載入中...' : '暫無用戶'}</td></tr>
                      ) : (
                        storageUsers.map(u => (
                          <tr key={u.userId} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={styles.userNameArea}>
                                <div style={styles.userName}>{u.fullName || u.username}</div>
                                <div style={styles.memberSub}>{u.linkedMemberName || '未連結成員'}</div>
                              </div>
                            </td>
                            <td style={styles.td}>
                              <span style={{
                                ...styles.roleBadge,
                                backgroundColor: u.role === 'admin' ? '#fee2e2' : '#f1f5f9',
                                color: u.role === 'admin' ? '#ef4444' : '#64748b'
                              }}>
                                {u.role === 'admin' ? '管理員' : '普通用戶'}
                              </span>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.storageUsage}>
                                {u.usedStorage >= 1024 ? `${(u.usedStorage/1024).toFixed(1)} MB` : `${u.usedStorage} KB`}
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={styles.limitInputBox}>
                                <input 
                                  type="number" 
                                  defaultValue={u.fairUseLimit}
                                  onBlur={(e) => {
                                    if(parseInt(e.target.value) !== u.fairUseLimit) {
                                      handleUpdateUserLimit(u.userId, e.target.value);
                                    }
                                  }}
                                  style={styles.tableInput}
                                />
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'batch-labels' && (
            <div style={styles.section}>
              <BatchFamilyLabels family={family} />
            </div>
          )}
        </motion.main>
      </div>
    </div>
  );
}

const styles = {
  outerContainer: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '40px 20px',
    fontFamily: '"Outfit", "Inter", sans-serif'
  },
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    backgroundColor: 'white',
    borderRadius: '24px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05), 0 10px 10px -5px rgba(0,0,0,0.04)',
    padding: '40px',
    position: 'relative'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid #f1f5f9'
  },
  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  iconCircle: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.1)'
  },
  title: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#0f172a',
    margin: 0,
    letterSpacing: '-0.02em'
  },
  familySwitcher: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#f1f5f9',
    padding: '8px 16px',
    borderRadius: '12px'
  },
  switchLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase'
  },
  switchLabel_selected: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#3b82f6',
    textTransform: 'uppercase'
  },
  switchSelect: {
    border: 'none',
    background: 'none',
    fontSize: '14px',
    fontWeight: 600,
    color: '#334155',
    cursor: 'pointer',
    outline: 'none'
  },
  tabNav: {
    display: 'flex',
    gap: '8px',
    backgroundColor: '#f1f5f9',
    padding: '6px',
    borderRadius: '16px',
    marginBottom: '32px'
  },
  tabButton: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    border: 'none',
    background: 'none',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'color 0.3s'
  },
  activePill: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    zIndex: 0
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '20px',
    padding: '32px',
    border: '1px solid #f1f5f9',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px'
  },
  cardTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
    flexGrow: 1
  },
  cardDesc: {
    color: '#64748b',
    fontSize: '15px',
    lineHeight: 1.6,
    marginBottom: '24px'
  },
  formBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  inputLabel: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#475569',
    marginLeft: '4px'
  },
  proSelect: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1.5px solid #e2e8f0',
    fontSize: '15px',
    backgroundColor: '#fff',
    color: '#334155',
    outline: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    appearance: 'none',
    cursor: 'pointer'
  },
  proInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '14px',
    border: '1.5px solid #e2e8f0',
    fontSize: '15px',
    backgroundColor: '#fff',
    color: '#334155',
    outline: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  proButton: {
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '14px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 10px rgba(59, 130, 246, 0.2)'
  },
  ghostBtn: {
    padding: '12px 24px',
    background: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  editBtn: {
    padding: '6px 16px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    color: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s'
  },
  inviteResult: {
    marginTop: '32px',
    backgroundColor: '#f0fdf4',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid #bbf7d0'
  },
  codeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  inviteTarget: {
    color: '#166534',
    fontWeight: 700,
    fontSize: '16px'
  },
  codePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'white',
    padding: '8px 16px',
    borderRadius: '12px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  codeStyle: {
    fontSize: '20px',
    fontWeight: 800,
    letterSpacing: '2px',
    color: '#15803d',
    fontFamily: '"JetBrains Mono", monospace'
  },
  inlineCopy: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center'
  },
  expiryBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#15803d',
    fontWeight: 500
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px'
  },
  infoCell: {
    padding: '20px',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    border: '1px solid transparent'
  },
  cellLabel: {
    fontSize: '13px',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  cellValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#334155'
  },
  idRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '4px'
  },
  miniCode: {
    fontSize: '14px',
    color: '#3b82f6',
    fontWeight: 600,
    fontFamily: 'monospace'
  },
  mergeInstructions: {
    marginBottom: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  mergeStep: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '15px',
    color: '#475569'
  },
  stepNum: {
    width: '32px',
    height: '32px',
    borderRadius: '10px',
    backgroundColor: '#3b82f6',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '16px',
    flexShrink: 0
  },
  inviteBox: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    padding: '24px',
    borderRadius: '20px',
    border: '1px solid rgba(59, 130, 246, 0.1)'
  },
  boxTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748b',
    marginBottom: '16px',
    textTransform: 'uppercase'
  },
  codeActions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  codePillBig: {
    fontSize: '32px',
    fontWeight: 800,
    color: '#3b82f6',
    letterSpacing: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontFamily: '"JetBrains Mono", monospace'
  },
  divider: {
    textAlign: 'center',
    padding: '32px 0',
    position: 'relative',
    color: '#cbd5e1',
    fontWeight: 700,
    fontSize: '13px',
    textTransform: 'uppercase'
  },
  searchBoxArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputWithBtn: {
    display: 'flex',
    gap: '10px'
  },
  foundFamily: {
    marginTop: '32px',
    padding: '32px',
    backgroundColor: '#f0fdfa',
    borderRadius: '24px',
    border: '1px solid #ccfbf1'
  },
  foundHeader: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#0d9488',
    marginBottom: '12px'
  },
  foundStats: {
    display: 'flex',
    gap: '24px',
    fontSize: '14px',
    color: '#0d9488',
    fontWeight: 600
  },
  message: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 24px',
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
    borderRadius: '16px',
    marginBottom: '32px',
    fontWeight: 700,
    boxShadow: '0 4px 10px rgba(22, 163, 74, 0.1)'
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 24px',
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    borderRadius: '16px',
    marginBottom: '32px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  loadingOverlay: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc'
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  gridForm: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid #f1f5f9'
  },
  quotaConfigBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '32px',
    border: '1px solid #e2e8f0'
  },
  configHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  configMain: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  configLabel: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#334155'
  },
  inputWithUnit: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  compactInput: {
    width: '80px',
    padding: '8px 12px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    fontSize: '14px',
    textAlign: 'center'
  },
  miniButton: {
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  miniNote: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '10px',
    fontStyle: 'italic'
  },
  userTableWrapper: {
    overflowX: 'auto',
    borderRadius: '12px',
    border: '1px solid #f1f5f9',
    marginTop: '20px'
  },
  userTable: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  th: {
    padding: '12px 16px',
    backgroundColor: '#f8fafc',
    borderBottom: '1.5px solid #e2e8f0',
    fontSize: '13px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase'
  },
  tr: {
    borderBottom: '1px solid #f1f5f9'
  },
  td: {
    padding: '16px',
    verticalAlign: 'middle'
  },
  tdCenter: {
    padding: '32px',
    textAlign: 'center',
    color: '#94a3b8',
    fontStyle: 'italic'
  },
  userNameArea: {
    display: 'flex',
    flexDirection: 'column'
  },
  userName: {
    fontSize: '15px',
    fontWeight: 600,
    color: '#1e293b'
  },
  memberSub: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  roleBadge: {
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: 700
  },
  storageUsage: {
    fontSize: '14px',
    color: '#475569',
    fontWeight: 500
  },
  tableInput: {
    width: '70px',
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    fontSize: '14px',
    textAlign: 'center',
    backgroundColor: '#fff'
  }
};

export default FamilyManagement;
