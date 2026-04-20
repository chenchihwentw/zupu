import React from 'react';
import { Printer } from 'lucide-react';
import '../Tree.css';

const formatLifeSpan = (member, isTraditional) => {
  let text = '';
  if (member.birth_year) {
    if (member.birth_month && member.birth_day) {
      text += `${member.birth_year}年${member.birth_month}月${member.birth_day}日出生`;
    } else {
      text += `${member.birth_year}年出生`;
    }
  }
  if (member.is_deceased) {
    if (member.death_year) {
      if (member.death_month && member.death_day) {
        text += text ? ` ─ ${member.death_year}年${member.death_month}月${member.death_day}日歿` : `${member.death_year}年歿`;
      } else {
        text += text ? ` ─ ${member.death_year}年歿` : `${member.death_year}年歿`;
      }
    } else {
      text += text ? ` ─ 已歿` : `已歿`;
    }
    if (member.birth_year && member.death_year) {
      const age = member.death_year - member.birth_year;
      text += `，享年 ${age} 歲`;
    }
  }
  return text ? `(${text})` : '';
};

const generateSummary = (member, isTraditional) => {
  const parts = [];
  
  // 1. 諱 / 曾用名 (清理 JSON 殘留與轉義字符)
  if (member.aliases) {
    let cleanAlias = member.aliases;
    // 如果是 JSON 格式的字符串，嘗試解析
    if (typeof cleanAlias === 'string') {
      try {
        if (cleanAlias.startsWith('[') || cleanAlias.startsWith('"')) {
          const parsed = JSON.parse(cleanAlias);
          cleanAlias = Array.isArray(parsed) ? parsed.join('、') : parsed;
        }
      } catch (e) {
        // 解析失敗，手動清理常見的 JSON 轉義字符
        cleanAlias = cleanAlias.replace(/[\\"[\]]/g, '').trim();
      }
    }
    
    // 如果清理後依然有內容，才添加前綴
    if (cleanAlias && cleanAlias !== '[]' && cleanAlias !== '""') {
      parts.push(`${isTraditional ? '諱' : '讳'}${cleanAlias}`);
    }
  }
  
  // 2. 字 / 號
  if (member.courtesy_name) parts.push(`字${member.courtesy_name}`);
  if (member.pseudonym) parts.push(`號${member.pseudonym}`);

  // 3. 國籍 / 出生地
  if (member.nationality) parts.push(`${member.nationality}籍`);
  if (member.birth_place) parts.push(`生於${member.birth_place}`);
  
  // 4. 堂號 / 祖籍
  if (member.clan_name) parts.push(`${member.clan_name}`);
  if (member.ancestral_home) parts.push(`籍${member.ancestral_home}`);
  
  // 5. 學歷 / 曾經任職
  if (member.education) parts.push(`${member.education}${isTraditional ? '學歷' : '学历'}`);
  if (member.occupation) parts.push(`${isTraditional ? '曾任' : '曾任'}${member.occupation}`);
  
  // 5. 重要事蹟 (從 JSON 解析)
  if (member.achievements) {
    try {
      const achs = typeof member.achievements === 'string' ? JSON.parse(member.achievements) : member.achievements;
      if (Array.isArray(achs) && achs.length > 0) {
        const sortedAchs = [...achs].sort((a, b) => {
          if (!a.year) return 1;
          if (!b.year) return -1;
          return a.year.localeCompare(b.year);
        });
        const achText = sortedAchs.map(a => (a.year ? `${a.year}年${a.event}` : a.event)).join('、');
        parts.push(achText);
      }
    } catch (e) {
      console.error('Failed to parse achievements', e);
    }
  }

  return parts.join('，');
};

const FamilyTreeNodeText = ({ node, level, isTraditional }) => {
  const indent = level * 40; // Compact indentation
  const summary = generateSummary(node.member, isTraditional);

  return (
    <div className="family-book-node" style={{ marginBottom: '15px' }}>
      <div style={{ marginLeft: `${indent}px`, padding: '12px 0', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'nowrap', gap: '12px' }}>
          <span style={{ 
            flexShrink: 0,
            display: 'inline-block',
            width: '28px', 
            height: '28px', 
            lineHeight: '28px',
            textAlign: 'center',
            backgroundColor: '#1f2937', 
            color: 'white', 
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 800
          }}>
            {level + 1}
          </span>
          
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontWeight: 800, color: '#000', fontSize: '22px', fontFamily: 'var(--font-heading)' }}>
                {node.member.surname || node.member.given_name ? `${node.member.surname || ''}${node.member.given_name || ''}` : node.member.name}
              </span>
              <span style={{ color: '#64748b', fontSize: '14px', fontFamily: 'var(--font-body)' }}>
                {formatLifeSpan(node.member, isTraditional)}
              </span>
            </div>
            
            {(summary || node.member.remark) && (
              <div style={{ color: '#334155', fontSize: '14px', lineHeight: '1.6', marginTop: '4px' }}>
                {summary && <span>{summary}。</span>}
                {node.member.remark && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}> [{node.member.remark}]</span>}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {node.spouses && node.spouses.length > 0 && node.spouses.map(spouse => {
        const spouseSummary = generateSummary(spouse, isTraditional);
        return (
          <div key={spouse.id} style={{ marginLeft: `${indent}px`, padding: '8px 0', borderBottom: '1px dashed #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingLeft: '40px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, color: '#4b5563', fontSize: '18px' }}>
                    {spouse.surname || spouse.given_name ? `${spouse.surname || ''}${spouse.given_name || ''}` : spouse.name} 
                    <span style={{fontSize: '12px', fontWeight: 500, color: '#94a3b8', marginLeft: '6px'}}>
                      ({isTraditional ? '配偶' : '配偶'})
                    </span>
                  </span>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>
                    {formatLifeSpan(spouse, isTraditional)}
                  </span>
                </div>
                {spouseSummary && (
                  <div style={{ color: '#64748b', fontSize: '13px', marginTop: '2px' }}>
                    {spouseSummary}。
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      
      {node.children && node.children.length > 0 && (
        <div className="family-book-children">
          {node.children.map(childNode => (
            <FamilyTreeNodeText 
              key={childNode.member.id} 
              node={childNode} 
              level={level + 1} 
              isTraditional={isTraditional} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

const PrintableFamilyBook = ({ roots, isTraditional }) => {
  return (
    <div className="printable-family-book" style={{ 
      padding: '50px', 
      backgroundColor: 'white', 
      color: 'black', 
      maxWidth: '1000px', 
      margin: '20px auto', 
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-xl)',
      minHeight: '100vh'
    }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-family-book, .printable-family-book * { visibility: visible; }
          .printable-family-book {
            position: absolute; left: 0; top: 0; width: 100%;
            box-shadow: none !important; padding: 0 !important; margin: 0 !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '60px' }} className="no-print">
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-main)', fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
            {isTraditional ? '傳統族譜 (名錄版)' : '传统族谱 (名录版)'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>用於正式列印與家族存檔的文本格式</p>
        </div>
        <button 
          onClick={() => window.print()}
          className="pill-button"
          style={{ padding: '12px 24px', fontSize: '16px' }}
        >
          <Printer size={18} />
          {isTraditional ? '列印族譜' : '打印族谱'}
        </button>
      </div>

      <div className="print-header" style={{ display: 'none', textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#111', letterSpacing: '8px', fontSize: '32px' }}>{isTraditional ? '家族世代名錄' : '家族世代名录'}</h1>
      </div>

      <div className="book-content" style={{ lineHeight: '1.8' }}>
        {roots.map(rootNode => (
          <div key={rootNode.member.id} style={{ marginBottom: '60px', paddingBottom: '30px', borderBottom: '3px double #eee' }}>
            <FamilyTreeNodeText 
              node={rootNode} 
              level={0} 
              isTraditional={isTraditional} 
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PrintableFamilyBook;
