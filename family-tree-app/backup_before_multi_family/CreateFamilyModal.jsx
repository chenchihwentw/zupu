import React from 'react';

const CreateFamilyModal = ({
  memberName,
  familyName,
  setFamilyName,
  surname,
  setSurname,
  ancestralHome,
  setAncestralHome,
  hallName,
  setHallName,
  onSubmit,
  onCancel
}) => {
  const isValid = familyName.trim() && surname.trim();

  return (
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
        padding: '30px', 
        borderRadius: '12px', 
        maxWidth: '450px', 
        width: '90%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px', color: '#1890ff' }}>
          🏠 為 {memberName} 創建家族
        </h2>
        
        <div style={{ 
          backgroundColor: '#e6f7ff', 
          border: '1px solid #91d5ff', 
          borderRadius: '8px', 
          padding: '15px', 
          marginBottom: '20px' 
        }}>
          <p style={{ margin: 0, color: '#096dd9', fontSize: '14px' }}>
            💡 創建家族後，您就可以為 <strong>{memberName}</strong> 添加父母了。
          </p>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
            家族名稱 *
          </label>
          <input
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="如：陳氏家族"
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #d9d9d9', 
              borderRadius: '6px',
              fontSize: '14px'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
            家族姓氏 *
          </label>
          <input
            type="text"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="如：陳"
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #d9d9d9', 
              borderRadius: '6px',
              fontSize: '14px'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
            祖籍位置
          </label>
          <input
            type="text"
            value={ancestralHome}
            onChange={(e) => setAncestralHome(e.target.value)}
            placeholder="如：福建泉州"
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #d9d9d9', 
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', color: '#333' }}>
            家族堂號
          </label>
          <input
            type="text"
            value={hallName}
            onChange={(e) => setHallName(e.target.value)}
            placeholder="如：潁川堂"
            style={{ 
              width: '100%', 
              padding: '10px', 
              border: '1px solid #d9d9d9', 
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: '#f5f5f5',
              color: '#666',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={!isValid}
            style={{
              padding: '10px 20px',
              backgroundColor: !isValid ? '#d9d9d9' : '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: !isValid ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            創建家族並繼續
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFamilyModal;
