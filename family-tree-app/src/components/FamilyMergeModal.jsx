import React, { useState, useEffect } from 'react';
import axios from 'axios';

const FamilyMergeModal = ({ isOpen, onClose, currentFamilyId, onMergeSuccess }) => {
  const [families, setFamilies] = useState([]);
  const [selectedFamily, setSelectedFamily] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchFamilies();
    }
  }, [isOpen]);

  const fetchFamilies = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3001/api/families/search', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // 過濾掉當前家族
      setFamilies(res.data.filter(f => f.family_uid !== currentFamilyId));
    } catch (err) {
      console.error('Failed to fetch families:', err);
      setError('獲取家族列表失敗');
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      fetchFamilies();
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:3001/api/families/search?keyword=${searchKeyword}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFamilies(res.data.filter(f => f.family_uid !== currentFamilyId));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleMerge = async () => {
    if (!selectedFamily) return;
    
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:3001/api/families/merge', {
        sourceFamilyId: selectedFamily,
        targetFamilyId: currentFamilyId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setLoading(false);
      onMergeSuccess();
      onClose();
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || '合併失敗');
    }
  };

  if (!isOpen) return null;

  const selectedFamilyInfo = families.find(f => f.family_uid === selectedFamily);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        width: '500px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2>家族合併</h2>
        
        {error && (
          <div style={{ color: 'red', marginBottom: '16px', padding: '8px', backgroundColor: '#fff1f0', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        {!confirmStep ? (
          <>
            <p style={{ marginBottom: '16px', color: '#666' }}>
              選擇一個家族合併到當前家族。合併後，被選擇家族的成員將歸屬到當前家族。
            </p>

            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="搜索家族名稱或姓氏..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                style={{
                  width: '70%',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  marginRight: '8px'
                }}
              />
              <button
                onClick={handleSearch}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                搜索
              </button>
            </div>

            <div style={{ marginBottom: '16px', maxHeight: '300px', overflow: 'auto' }}>
              {families.length === 0 ? (
                <p style={{ color: '#999', textAlign: 'center' }}>暫無其他家族</p>
              ) : (
                families.map(family => (
                  <div
                    key={family.family_uid}
                    onClick={() => setSelectedFamily(family.family_uid)}
                    style={{
                      padding: '12px',
                      border: `2px solid ${selectedFamily === family.family_uid ? '#1890ff' : '#e8e8e8'}`,
                      borderRadius: '4px',
                      marginBottom: '8px',
                      cursor: 'pointer',
                      backgroundColor: selectedFamily === family.family_uid ? '#e6f7ff' : 'white'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{family.name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      姓氏: {family.surname} | ID: {family.family_uid}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              padding: '16px',
              backgroundColor: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: '4px',
              marginBottom: '16px'
            }}>
              <h4 style={{ marginTop: 0, color: '#d48806' }}>⚠️ 確認合併</h4>
              <p>您即將將以下家族合併到當前家族：</p>
              <div style={{ fontWeight: 'bold', margin: '8px 0' }}>
                {selectedFamilyInfo?.name} ({selectedFamilyInfo?.surname})
              </div>
              <p style={{ fontSize: '12px', color: '#666' }}>
                此操作不可撤銷。合併後，原家族的成員將全部歸屬到當前家族。
              </p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          {confirmStep && (
            <button
              onClick={() => setConfirmStep(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              返回
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={handleMerge}
            disabled={!selectedFamily || loading}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedFamily ? '#ff4d4f' : '#d9d9d9',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: selectedFamily ? 'pointer' : 'not-allowed'
            }}
          >
            {loading ? '處理中...' : (confirmStep ? '確認合併' : '下一步')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FamilyMergeModal;
