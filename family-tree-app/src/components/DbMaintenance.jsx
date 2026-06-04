import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = '/api';

const DbMaintenance = () => {
  const [activeTab, setActiveTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [families, setFamilies] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({
    id: '',
    name: '',
    gender: 'male',
    family_tree_id: 'a1001',
    parents: '[]',
    spouses: '[]',
    children: '[]'
  });

  // 獲取成員數據
  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/family`);
      setMembers(response.data);
      setError(null);
    } catch (err) {
      setError('獲取成員失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 獲取全局家族配額數據
  const fetchFamilies = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/families-usage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFamilies(response.data);
      setError(null);
    } catch (err) {
      setError('獲取家族配額失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 獲取全域用戶配額數據
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/admin/users-usage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
      setError(null);
    } catch (err) {
      setError('獲取用戶配額失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'members') fetchMembers();
    if (activeTab === 'families') fetchFamilies();
    if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  // 開始編輯
  const handleEdit = (member) => {
    setEditingId(member.id);
    setEditData({
      ...member,
      parents: JSON.stringify(member.parents || []),
      spouses: JSON.stringify(member.spouses || []),
      children: JSON.stringify(member.children || [])
    });
  };

  // 保存編輯
  const handleSave = async (id) => {
    try {
      const dataToSave = {
        ...editData,
        parents: JSON.parse(editData.parents || '[]'),
        spouses: JSON.parse(editData.spouses || '[]'),
        children: JSON.parse(editData.children || '[]')
      };
      
      await axios.put(`${API_URL}/family/${id}`, dataToSave);
      setEditingId(null);
      fetchMembers();
      alert('保存成功！');
    } catch (err) {
      alert('保存失敗: ' + err.message);
    }
  };

  // 取消編輯
  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  // 刪除成員
  const handleDelete = async (id) => {
    if (!window.confirm('確定要刪除這個成員嗎？')) return;
    
    try {
      await axios.delete(`${API_URL}/family/${id}`);
      fetchMembers();
      alert('刪除成功！');
    } catch (err) {
      alert('刪除失敗: ' + err.message);
    }
  };

  // 添加新成員
  const handleAdd = async () => {
    try {
      const dataToAdd = {
        ...newMember,
        parents: JSON.parse(newMember.parents || '[]'),
        spouses: JSON.parse(newMember.spouses || '[]'),
        children: JSON.parse(newMember.children || '[]')
      };
      
      await axios.post(`${API_URL}/family`, dataToAdd);
      setShowAddModal(false);
      setNewMember({
        id: '',
        name: '',
        gender: 'male',
        family_tree_id: 'a1001',
        parents: '[]',
        spouses: '[]',
        children: '[]'
      });
      fetchMembers();
      alert('添加成功！');
    } catch (err) {
      alert('添加失敗: ' + err.message);
    }
  };

  // 處理輸入變化
  const handleInputChange = (field, value) => {
    setEditData({ ...editData, [field]: value });
  };

  // 過濾成員
  const filteredMembers = members.filter(member => 
    member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 修改家族配額
  const handleUpdateFamilyQuota = async (familyId, newLimit) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/family/${familyId}/storage-limit`, 
        { limit_mb: parseInt(newLimit) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchFamilies();
      alert('家族配額更新成功！');
    } catch (err) {
      alert('更新失敗: ' + err.message);
    }
  };

  // 修改用戶公平使用限額
  const handleUpdateUserQuota = async (targetUserId, newLimit) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/user/${targetUserId}/fair-use-limit`, 
        { limit_mb: parseInt(newLimit) },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
      alert('用戶限額更新成功！');
    } catch (err) {
      alert('更新失敗: ' + err.message);
    }
  };

  // 簡化顯示 JSON 數組
  const formatArray = (arr) => {
    if (!arr || arr.length === 0) return '-';
    // 確保處理字串格式的 JSON
    const data = typeof arr === 'string' ? JSON.parse(arr) : arr;
    return Array.isArray(data) ? data.join(', ') : data;
  };

  if (loading) return <div style={{ padding: '20px' }}>加載中...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ marginBottom: '20px', color: '#1a1a1a' }}>⚙️ 系統維護管理系統</h2>
      
      {/* 標籤導航 */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '2px solid #f0f0f0', 
        marginBottom: '20px',
        gap: '20px'
      }}>
        {[
          { id: 'members', label: '👥 成員管理' },
          { id: 'families', label: '🏘️ 家族配額' },
          { id: 'users', label: '👤 用戶限額' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setEditingId(null); }}
            style={{
              padding: '12px 20px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '3px solid #1890ff' : '3px solid transparent',
              color: activeTab === tab.id ? '#1890ff' : '#666',
              fontWeight: activeTab === tab.id ? '600' : '400',
              cursor: 'pointer',
              fontSize: '15px',
              transition: 'all 0.3s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 錯誤提示 */}
      {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

      {/* 分頁內容渲染 */}
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        {activeTab === 'members' && renderMembersTable()}
        {activeTab === 'families' && renderFamiliesTable()}
        {activeTab === 'users' && renderUsersTable()}
      </div>

      {/* 彈窗 */}
      {showAddModal && renderAddModal()}
    </div>
  );

  function renderMembersTable() {
    return (
      <div>
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="搜尋姓名或ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ padding: '10px', width: '250px', borderRadius: '6px', border: '1px solid #ddd' }}
          />
          <button 
            onClick={() => setShowAddModal(true)}
            style={{ padding: '10px 20px', backgroundColor: '#52c41a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            + 添加成員
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>ID</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>姓名</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>家族ID</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>關係鏈</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map((member) => (
                <tr key={member.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px', color: '#999', fontSize: '11px' }}>{member.id}</td>
                  <td style={{ padding: '12px', fontWeight: '500' }}>{member.name}</td>
                  <td style={{ padding: '12px' }}>{member.family_tree_id}</td>
                  <td style={{ padding: '12px', fontSize: '11px', color: '#666' }}>
                    P: {formatArray(member.parents)} | S: {formatArray(member.spouses)} | C: {formatArray(member.children)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button onClick={() => handleDelete(member.id)} style={{ color: '#ff4d4f', border: 'none', background: 'none', cursor: 'pointer' }}>刪除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderFamiliesTable() {
    return (
      <div>
        <h4 style={{ marginBottom: '15px' }}>🏘️ 家族系統配額管理</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#fafafa' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left' }}>家族名稱/ID</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>成員數</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>總占用 (KB)</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>當前上限 (MB)</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>調整</th>
            </tr>
          </thead>
          <tbody>
            {families.map(f => (
              <tr key={f.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px' }}><strong>{f.name}</strong><br/><small>{f.id}</small></td>
                <td style={{ padding: '12px' }}>{f.memberCount}</td>
                <td style={{ padding: '12px' }}>{(f.totalUsedKb || 0).toLocaleString()} KB</td>
                <td style={{ padding: '12px' }}>{f.storage_limit_mb} MB</td>
                <td style={{ padding: '12px', textAlign: 'center' }}>
                  <select 
                    onChange={(e) => handleUpdateFamilyQuota(f.id, e.target.value)}
                    value={f.storage_limit_mb}
                    style={{ padding: '5px' }}
                  >
                    {[100, 200, 500, 1000, 2000, 5000].map(v => (
                      <option key={v} value={v}>{v} MB</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderUsersTable() {
    return (
      <div>
        <h4 style={{ marginBottom: '15px' }}>👤 用戶個人公平使用限額</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#fafafa' }}>
            <tr>
              <th style={{ padding: '12px', textAlign: 'left' }}>用戶</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>已用空間</th>
              <th style={{ padding: '12px', textAlign: 'left' }}>配額 (MB)</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '12px' }}><strong>{u.full_name || u.username}</strong><br/><small>{u.email}</small></td>
                <td style={{ padding: '12px' }}>{(u.used_storage_kb || 0).toLocaleString()} KB</td>
                <td style={{ padding: '12px' }}>
                  <input 
                    type="number" 
                    defaultValue={u.fair_use_limit_mb} 
                    onBlur={(e) => handleUpdateUserQuota(u.id, e.target.value)}
                    style={{ width: '80px', padding: '5px' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderAddModal() {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
      }}>
        <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '400px' }}>
          <h3>添加新成員</h3>
          <input type="text" placeholder="ID" value={newMember.id} onChange={(e) => setNewMember({...newMember, id: e.target.value})} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
          <input type="text" placeholder="姓名" value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} style={{ width: '100%', marginBottom: '10px', padding: '8px' }} />
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleAdd} style={{ flex: 1, padding: '10px', backgroundColor: '#52c41a', color: 'white', border: 'none', borderRadius: '4px' }}>添加</button>
            <button onClick={() => setShowAddModal(false)} style={{ flex: 1, padding: '10px', backgroundColor: '#999', color: 'white', border: 'none', borderRadius: '4px' }}>取消</button>
          </div>
        </div>
      </div>
    );
  }
};

export default DbMaintenance;
