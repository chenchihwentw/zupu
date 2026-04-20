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
      backgroundColor: 'rgba(0,0,0,0.3)', 
      backdropFilter: 'blur(8px)',
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        padding: '32px', 
        borderRadius: 'var(--radius-lg)', 
        maxWidth: '500px', 
        width: '100%',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--glass-border)',
        fontFamily: 'var(--font-body)'
      }}>
        <h2 style={{ 
          marginTop: 0, 
          marginBottom: '24px', 
          color: 'var(--text-main)',
          fontFamily: 'var(--font-heading)',
          fontSize: '24px',
          textAlign: 'center'
        }}>
          🏠 為 {memberName} 創建家族
        </h2>
        
        <div style={{ 
          backgroundColor: '#eef2ff', 
          border: '1px solid #e0e7ff', 
          borderRadius: 'var(--radius-md)', 
          padding: '16px', 
          marginBottom: '24px' 
        }}>
          <p style={{ margin: 0, color: 'var(--primary-color)', fontSize: '14px', lineHeight: '1.6' }}>
            💡 創建家族後，您就可以為 <strong>{memberName}</strong> 添加父母了。
          </p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>
            家族名稱 *
          </label>
          <input
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="如：陳氏家族"
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '1px solid #e5e7eb', 
              borderRadius: 'var(--radius-md)',
              fontSize: '15px',
              outline: 'none',
              transition: 'var(--transition)'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>
            家族姓氏 *
          </label>
          <input
            type="text"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="如：陳"
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '1px solid #e5e7eb', 
              borderRadius: 'var(--radius-md)',
              fontSize: '15px',
              outline: 'none'
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>
            祖籍位置
          </label>
          <input
            type="text"
            value={ancestralHome}
            onChange={(e) => setAncestralHome(e.target.value)}
            placeholder="如：福建泉州"
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '1px solid #e5e7eb', 
              borderRadius: 'var(--radius-md)',
              fontSize: '15px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text-main)', fontSize: '14px' }}>
            家族堂號
          </label>
          <input
            type="text"
            value={hallName}
            onChange={(e) => setHallName(e.target.value)}
            placeholder="如：潁川堂"
            style={{ 
              width: '100%', 
              padding: '12px 16px', 
              border: '1px solid #e5e7eb', 
              borderRadius: 'var(--radius-md)',
              fontSize: '15px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '20px', borderTop: '1px solid #f3f4f6' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 24px',
              backgroundColor: '#f3f4f6',
              color: 'var(--text-main)',
              border: '1px solid #e5e7eb',
              borderRadius: 'var(--radius-full)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            取消
          </button>
          <button
            onClick={onSubmit}
            disabled={!isValid}
            style={{
              padding: '10px 24px',
              backgroundColor: !isValid ? '#e5e7eb' : 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-full)',
              cursor: !isValid ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: !isValid ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.2)'
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
