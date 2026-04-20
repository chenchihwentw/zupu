import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';

const DbMaintenance = () => {
  const [members, setMembers] = useState([]);
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

  // 獲取所有成員
  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/family`);
      setMembers(response.data);
      setError(null);
    } catch (err) {
      setError('獲取數據失敗: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

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

  // 簡化顯示 JSON 數組
  const formatArray = (arr) => {
    if (!arr || arr.length === 0) return '-';
    return arr.join(', ');
  };

  if (loading) return <div style={{ padding: '20px' }}>加載中...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>{error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>數據庫維護 - Members 表</h2>
      
      {/* 工具欄 */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="搜索姓名或ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ padding: '8px', width: '200px' }}
        />
        <button 
          onClick={() => setShowAddModal(true)}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#52c41a', 
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          + 添加成員
        </button>
        <button 
          onClick={fetchMembers}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#1890ff', 
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          刷新
        </button>
      </div>

      {/* 統計信息 */}
      <div style={{ marginBottom: '10px', color: '#666' }}>
        總共 {members.length} 條記錄，顯示 {filteredMembers.length} 條
      </div>

      {/* 表格 */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>ID</th>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>姓名</th>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>性別</th>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>家族ID</th>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>父母</th>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>配偶</th>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>子女</th>
              <th style={{ padding: '8px', border: '1px solid #ddd' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((member) => (
              <tr key={member.id} style={{ borderBottom: '1px solid #ddd' }}>
                {editingId === member.id ? (
                  // 編輯模式
                  <>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {member.id}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="text"
                        value={editData.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        style={{ width: '100px', padding: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <select
                        value={editData.gender || 'male'}
                        onChange={(e) => handleInputChange('gender', e.target.value)}
                        style={{ padding: '4px' }}
                      >
                        <option value="male">男</option>
                        <option value="female">女</option>
                      </select>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="text"
                        value={editData.family_tree_id || ''}
                        onChange={(e) => handleInputChange('family_tree_id', e.target.value)}
                        style={{ width: '80px', padding: '4px' }}
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="text"
                        value={editData.parents || '[]'}
                        onChange={(e) => handleInputChange('parents', e.target.value)}
                        style={{ width: '100px', padding: '4px', fontSize: '10px' }}
                        placeholder='["id1", "id2"]'
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="text"
                        value={editData.spouses || '[]'}
                        onChange={(e) => handleInputChange('spouses', e.target.value)}
                        style={{ width: '100px', padding: '4px', fontSize: '10px' }}
                        placeholder='["id1", "id2"]'
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <input
                        type="text"
                        value={editData.children || '[]'}
                        onChange={(e) => handleInputChange('children', e.target.value)}
                        style={{ width: '100px', padding: '4px', fontSize: '10px' }}
                        placeholder='["id1", "id2"]'
                      />
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <button 
                        onClick={() => handleSave(member.id)}
                        style={{ 
                          padding: '4px 8px', 
                          backgroundColor: '#52c41a', 
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '5px'
                        }}
                      >
                        保存
                      </button>
                      <button 
                        onClick={handleCancel}
                        style={{ 
                          padding: '4px 8px', 
                          backgroundColor: '#999', 
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        取消
                      </button>
                    </td>
                  </>
                ) : (
                  // 顯示模式
                  <>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '10px' }}>
                      {member.id}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>{member.name}</td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      {member.gender === 'male' ? '男' : '女'}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '10px' }}>
                      {member.family_tree_id}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '10px' }}>
                      {formatArray(member.parents)}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '10px' }}>
                      {formatArray(member.spouses)}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd', fontSize: '10px' }}>
                      {formatArray(member.children)}
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>
                      <button 
                        onClick={() => handleEdit(member)}
                        style={{ 
                          padding: '4px 8px', 
                          backgroundColor: '#1890ff', 
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginRight: '5px'
                        }}
                      >
                        編輯
                      </button>
                      <button 
                        onClick={() => handleDelete(member.id)}
                        style={{ 
                          padding: '4px 8px', 
                          backgroundColor: '#ff4d4f', 
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        刪除
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 添加成員彈窗 */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '400px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3>添加新成員</h3>
            
            <div style={{ marginBottom: '10px' }}>
              <label>ID:</label>
              <input
                type="text"
                value={newMember.id}
                onChange={(e) => setNewMember({ ...newMember, id: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder="例如: b123"
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>姓名:</label>
              <input
                type="text"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>性別:</label>
              <select
                value={newMember.gender}
                onChange={(e) => setNewMember({ ...newMember, gender: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              >
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>家族ID:</label>
              <input
                type="text"
                value={newMember.family_tree_id}
                onChange={(e) => setNewMember({ ...newMember, family_tree_id: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>父母 (JSON 數組):</label>
              <input
                type="text"
                value={newMember.parents}
                onChange={(e) => setNewMember({ ...newMember, parents: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder='["parent_id1", "parent_id2"]'
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>配偶 (JSON 數組):</label>
              <input
                type="text"
                value={newMember.spouses}
                onChange={(e) => setNewMember({ ...newMember, spouses: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder='["spouse_id1"]'
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label>子女 (JSON 數組):</label>
              <input
                type="text"
                value={newMember.children}
                onChange={(e) => setNewMember({ ...newMember, children: e.target.value })}
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                placeholder='["child_id1", "child_id2"]'
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={handleAdd}
                style={{ 
                  flex: 1,
                  padding: '10px', 
                  backgroundColor: '#52c41a', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                添加
              </button>
              <button 
                onClick={() => setShowAddModal(false)}
                style={{ 
                  flex: 1,
                  padding: '10px', 
                  backgroundColor: '#999', 
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DbMaintenance;
