import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * HelpLink - 全局上下文幫助組件
 * @param {string} section - 錨點 ID (如 'photo-ai', 'storage-quota')
 * @param {object} style - 自定義樣式
 * @param {boolean} showText - 是否顯示「幫助」文字
 */
const HelpLink = ({ section = 'getting-started', style = {}, showText = false }) => {
  const navigate = useNavigate();

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 使用路由導航到手冊頁面，並附加 Hash
    navigate(`/manual#${section}`);
    // 強制滾動（路由導航可能不會自動處理 hash 變化後的滾動）
    setTimeout(() => {
      const element = document.getElementById(section);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <button
      onClick={handleClick}
      title="查看操作手冊"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 12px',
        backgroundColor: 'rgba(79, 70, 229, 0.08)',
        color: 'var(--primary-color)',
        border: '1px solid rgba(79, 70, 229, 0.15)',
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        fontSize: '12px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        ...style
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.15)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(79, 70, 229, 0.08)'}
    >
      <HelpCircle size={14} />
      {showText && <span>操作指引</span>}
    </button>
  );
};

export default HelpLink;
