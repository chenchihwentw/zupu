import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AncestorTablet from './AncestorTablet';

/**
 * 祭祀牌位生成器主組件
 * 功能：
 * 1. 自動提取已故直系祖先
 * 2. 支持多信仰選擇（傳統/佛教/基督教/天主教）
 * 3. 批量導出
 */
const TabletGenerator = () => {
  const { user } = useAuth();
  const [currentMember, setCurrentMember] = useState(null);
  const [allMembers, setAllMembers] = useState([]);
  const [deceasedAncestors, setDeceasedAncestors] = useState([]);
  const [selectedReligion, setSelectedReligion] = useState('TRADITIONAL');
  const [loading, setLoading] = useState(true);
  const [memberId, setMemberId] = useState(null);
  const [viewMemberName, setViewMemberName] = useState(''); // 視角成員名稱

  // 加載家族數據
  useEffect(() => {
    const fetchCurrentMember = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // 優先使用 localStorage 中保存的視角信息
        const savedViewMemberId = localStorage.getItem('currentViewMemberId');
        const savedViewMemberName = localStorage.getItem('currentViewMemberName');
        
        console.log('💾 localStorage 視角:', savedViewMemberId, savedViewMemberName);
        
        // 獲取當前用戶的家族樹數據
        const params = { 
          t: Date.now(),
          include_related: true 
        };
        
        if (savedViewMemberId) {
          params.view_member_id = savedViewMemberId;
        }
        
        const res = await axios.get('/api/my-family-tree', {
          params,
          headers: { Authorization: `Bearer ${token}` }
        });
        
        console.log('📋 API 返回數據:', res.data);
        const membersData = res.data.members || [];
        setAllMembers(membersData);
        
        let targetMemberId = null;
        let targetMemberName = '未知';
        let targetMemberObj = null;

        // 優先順序 1：如果 localStorage 記憶了某個視角人員，且該人員存在於本次取得的家族中，直接使用他
        if (savedViewMemberId && membersData.some(m => m.id === savedViewMemberId)) {
          targetMemberId = savedViewMemberId;
          targetMemberName = savedViewMemberName || '未知';
          targetMemberObj = membersData.find(m => m.id === targetMemberId);
          console.log('✅ 使用已保存的 localStorage 視角成員:', targetMemberId);
        }
        // 優先順序 2：如果 API 回傳了特定的視角上下文
        else if (res.data.view_context && res.data.view_context.view_member_id) {
          targetMemberId = res.data.view_context.view_member_id;
          targetMemberName = res.data.view_context.view_member_name || savedViewMemberName || '未知';
          if (res.data.view_context.view_member) {
            targetMemberObj = res.data.view_context.view_member;
          } else {
            targetMemberObj = membersData.find(m => m.id === targetMemberId);
          }
          console.log('✅ 使用 API 視角成員 ID:', targetMemberId);
        } 
        // 優先順序 3：如果都沒有，尋找當前登入者關聯的卡片
        else {
          console.warn('❌ 無法獲取視角上下文，使用登入用戶預設視角');
          
          // 如果沒有視角，尋找登入用戶關聯的成員
          const loggedInMember = user ? membersData.find(m => m.user_id === user.id) : null;
          if (loggedInMember) {
            targetMemberId = loggedInMember.id;
            targetMemberName = loggedInMember.name;
            targetMemberObj = loggedInMember;
            console.log('🔄 使用登入者關聯成員:', targetMemberId);
          } else if (membersData.length > 0) {
            // 最差情況：隨便抓一個沒有後代的成員當起點
            const youngest = membersData.find(m => !membersData.some(child => child.parents?.includes(m.id))) || membersData[0];
            targetMemberId = youngest.id;
            targetMemberName = youngest.name;
            targetMemberObj = youngest;
            console.log('🔄 使用無後代成員預設:', targetMemberId);
          }
        }

        if (targetMemberId && targetMemberObj) {
          setMemberId(targetMemberId);
          setViewMemberName(targetMemberName);
          setCurrentMember(targetMemberObj);
          
          // 提取已故祖先
          console.log('開始提取已故祖先...');
          const ancestors = extractDeceasedAncestors(targetMemberId, membersData);
          console.log('找到已故祖先數量:', ancestors.length);
          
          // 排序祖先
          const sortedAncestors = sortAncestorsWithSpouses(ancestors);
          setDeceasedAncestors(sortedAncestors);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('❌ 獲取家族數據失敗:', error);
        setLoading(false);
      }
    };

    if (user) {
      fetchCurrentMember();
    }
  }, [user]);

  /**
   * 遞歸提取已故直系祖先
   */
  const extractDeceasedAncestors = (memberId, members, visited = new Set(), generation = 0) => {
    if (visited.has(memberId)) return [];
    visited.add(memberId);

    const member = members.find(m => m.id === memberId);
    if (!member) {
      console.log(`⚠️ 找不到成員 ${memberId}`);
      return [];
    }

    const ancestors = [];
    const ancestorIds = new Set(); // 用於去重

    // 遍歷父母
    if (member.parents && member.parents.length > 0) {
      member.parents.forEach(parentId => {
        const parent = members.find(m => m.id === parentId);
        if (parent) {
          const parentGen = generation + 1;
          
          // 如果父母已過世，加入列表
          if (parent.is_deceased === 1 || parent.is_deceased === true) {
            if (!ancestorIds.has(parent.id)) {
              ancestorIds.add(parent.id);
              ancestors.push({
                ...parent,
                generation: parentGen
              });
            }
          }

          // 遞歸往上找
          const grandparents = extractDeceasedAncestors(parentId, members, new Set(visited), parentGen);
          grandparents.forEach(gp => {
            if (!ancestorIds.has(gp.id)) {
              ancestorIds.add(gp.id);
              ancestors.push(gp);
            }
          });
          
          // 包含父母的配偶（例如母親的配偶是父親）
          if (parent.spouses && parent.spouses.length > 0) {
            parent.spouses.forEach(spouseId => {
              // 只添加尚未包含的配偶（避免重複）
              const spouse = members.find(m => m.id === spouseId);
              if (spouse && 
                  (spouse.is_deceased === 1 || spouse.is_deceased === true) && 
                  !ancestorIds.has(spouseId) &&
                  spouseId !== parentId) { // 確保不是同一個人
                ancestorIds.add(spouseId);
                ancestors.push({
                  ...spouse,
                  generation: parentGen // 與父母同輩
                });
              }
            });
          }
        }
      });
    }

    return ancestors;
  };

  /**
   * 排序祖先：按輩分分組，配偶在一起，男右女左，最大輩分在最右邊
   */
  const sortAncestorsWithSpouses = (ancestors) => {
    // 按輩分分組
    const generationGroups = {};
    ancestors.forEach(ancestor => {
      const gen = ancestor.generation;
      if (!generationGroups[gen]) generationGroups[gen] = [];
      generationGroups[gen].push(ancestor);
    });

    // 對每個輩分進行配對（配偶在一起）
    const sortedAncestors = [];
    // 從小到大排序輩分（輩分高的在後面/右邊）
    // [1(低), 2, 3(高)] -> 渲染出來時 3 在最右邊
    Object.keys(generationGroups).sort((a, b) => a - b).forEach(gen => {
      const group = generationGroups[gen];
      const paired = [];
      const used = new Set();

      group.forEach(member => {
        if (used.has(member.id)) return;
        
        // 尋找配偶
        let spouse = null;
        if (member.spouses) {
          spouse = group.find(m => member.spouses.includes(m.id) && !used.has(m.id));
        }

        if (spouse) {
          used.add(member.id);
          used.add(spouse.id);
          // 男右女左：數組順序為 [女, 男]，渲染時女在左，男在右
          if (member.gender === 'male') {
            paired.push(spouse, member);
          } else {
            paired.push(member, spouse);
          }
        } else {
          used.add(member.id);
          paired.push(member);
        }
      });

      sortedAncestors.push(...paired);
    });

    return sortedAncestors;
  };

  // 導出所有牌位為圖片
  const exportAllTablets = async () => {
    setLoading(true);
    try {
      // 獲取頁面上所有的牌位容器
      const tabletElements = document.querySelectorAll('.tablet-box');
      if (tabletElements.length === 0) {
        alert('找不到可導出的牌位');
        setLoading(false);
        return;
      }

      alert(`準備導出 ${tabletElements.length} 個牌位圖片，請稍候並允許瀏覽器連續下載。`);
      
      const html2canvas = (await import('html2canvas')).default;

      // 創建臨時隔離容器以解決 iframe 找不到元素的問題
      const captureArea = document.createElement('div');
      captureArea.id = 'temp-capture-area';
      captureArea.style.cssText = 'position: fixed; top: 0; left: 0; width: 1000px; height: 1000px; z-index: -9999; opacity: 0; pointer-events: none; overflow: visible;';
      document.body.appendChild(captureArea);
      
      for (let i = 0; i < tabletElements.length; i++) {
        const originalEl = tabletElements[i];
        const ancestor = deceasedAncestors[i];

        // 1. 克隆元素到隔離容器
        const clone = originalEl.cloneNode(true);
        // 確保克隆後的 ID 與原始 ID 一致，方便內部引用，或移除 ID 避免衝突
        clone.id = `tablet-clone-${ancestor.id}`;
        // 強制設置樣式以確保在截圖時正確顯示
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '0';
        clone.style.margin = '0';
        clone.style.display = 'flex'; // 修正可能丟失的佈局
        clone.style.height = '800px';
        clone.style.width = originalEl.style.width || '140px';
        
        captureArea.appendChild(clone);

        // 稍微等待渲染穩定
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 2. 進行截圖
        const canvas = await html2canvas(clone, {
          scale: 3,
          useCORS: true,
          logging: false,
          backgroundColor: null,
          width: clone.offsetWidth,
          height: clone.offsetHeight,
          onclone: (clonedDoc) => {
            // 在克隆的文檔中，尋找克隆出來的那個對象
            const target = clonedDoc.getElementById(clone.id);
            if (target) {
              target.style.opacity = '1';
              // 補丁：html2canvas 對 writing-mode 支持較差，有時需要手動觸發層疊
              target.style.transform = 'translateZ(0)'; 
            }
          }
        });
        
        // 3. 下載圖片
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${i+1}_${ancestor.name}_${selectedReligion}_牌位.png`;
        link.href = image;
        link.click();
        
        // 4. 清理當前克隆
        captureArea.removeChild(clone);
        
        // 稍微延遲避免瀏覽器崩潰
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // 最後清理隔離容器
      document.body.removeChild(captureArea);
      alert('所有牌位導出完成！');
    } catch (error) {
      console.error('導出失敗:', error);
      alert('導出過程中發生錯誤: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">加載祖先數據中... memberId: {memberId || '未設置'}</div>;
  }

  if (!currentMember) {
    return (
      <div className="tablet-generator">
        <div className="no-ancestors">
          <h3>無法加載數據</h3>
          <p>請確認您已登入並且有家族數據</p>
          <button onClick={() => window.location.reload}>重新載入</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tablet-generator">
      {/* 標題區 */}
      <div className="generator-header">
        <h2>祭祀牌位生成器</h2>
        <p className="current-member">
          當前視角：{viewMemberName || currentMember?.name || '[隱藏]'} | 已找到 {deceasedAncestors.length} 位已故祖先
        </p>
      </div>

      {/* 信仰選擇 */}
      <div className="religion-selector">
        <h3>選擇信仰類型</h3>
        <div className="religion-options">
          <button 
            className={selectedReligion === 'TRADITIONAL' ? 'active' : ''}
            onClick={() => setSelectedReligion('TRADITIONAL')}
          >
            🏛️ 傳統儒家
          </button>
          <button 
            className={selectedReligion === 'BUDDHISM' ? 'active' : ''}
            onClick={() => setSelectedReligion('BUDDHISM')}
          >
            🪷 佛教
          </button>
          <button 
            className={selectedReligion === 'CHRISTIANITY' ? 'active' : ''}
            onClick={() => setSelectedReligion('CHRISTIANITY')}
          >
            ✝️ 基督教
          </button>
          <button 
            className={selectedReligion === 'CATHOLICISM' ? 'active' : ''}
            onClick={() => setSelectedReligion('CATHOLICISM')}
          >
            ✝️ 天主教
          </button>
        </div>
      </div>

      {/* 批量操作 */}
      <div className="batch-actions">
        <button onClick={exportAllTablets} className="btn-batch-export">
          📦 批量導出所有牌位
        </button>
        <button onClick={() => window.print()} className="btn-print-all">
          🖨️ 打印全部
        </button>
      </div>

      {/* 祖先牌位列表 */}
      <div className="ancestors-list" style={styles.ancestorsList}>
        {deceasedAncestors.length === 0 ? (
          <div className="no-ancestors">
            暫未找到已故祖先數據
          </div>
        ) : (
          <div className="tablets-row" style={styles.tabletsRow}>
            {deceasedAncestors.map((ancestor, index) => (
              <div key={ancestor.id} className="tablet-wrapper" style={styles.tabletWrapper}>
                <div className="ancestor-label" style={styles.ancestorLabel}>
                  {ancestor.name} ({ancestor.generation === 1 ? '父母輩' : 
                                   ancestor.generation === 2 ? '祖父母輩' : 
                                   ancestor.generation === 3 ? '曾祖父母輩' : '遠祖'})
                </div>
                <div className="tablet-component-wrapper" style={styles.tabletComponentWrapper}>
                  <AncestorTablet 
                    id={`tablet-${ancestor.id}`}
                    member={ancestor}
                    religion={selectedReligion}
                    generation={ancestor.generation}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .tablet-generator {
          padding: 40px;
          background-color: #fcfcfc;
          min-height: 100vh;
        }
        .generator-header {
          text-align: center;
          margin-bottom: 30px;
        }
        .religion-selector {
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          margin-bottom: 30px;
          text-align: center;
        }
        .religion-options {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-top: 15px;
        }
        .religion-options button {
          padding: 10px 20px;
          border-radius: 8px;
          border: 1px solid #e0e0e0;
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        .religion-options button.active {
          background: #8b4513;
          color: white;
          border-color: #8b4513;
          box-shadow: 0 4px 10px rgba(139, 69, 19, 0.2);
        }
        .batch-actions {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 40px;
        }
        .btn-batch-export, .btn-print-all {
          padding: 12px 24px;
          border-radius: 30px;
          border: none;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }
        .btn-batch-export {
          background: #1890ff;
          color: white;
        }
        .btn-print-all {
          background: #52c41a;
          color: white;
        }
        .tablet-box {
           /* Ensure consistent height inside AncestorTablet */
           height: 800px !important;
        }
      `}</style>
    </div>
  );
};

const styles = {
  ancestorsList: {
    padding: '20px 0',
    overflowX: 'auto',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.05)',
    minHeight: '900px'
  },
  tabletsRow: {
    display: 'flex',
    flexDirection: 'row',
    gap: '40px',
    padding: '40px',
    alignItems: 'flex-start',
    width: 'fit-content'
  },
  tabletWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0
  },
  ancestorLabel: {
    marginBottom: '15px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#666',
    backgroundColor: '#f0f0f0',
    padding: '4px 12px',
    borderRadius: '20px'
  },
  tabletComponentWrapper: {
    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    borderRadius: '4px',
    transition: 'transform 0.3s ease'
  }
};

export default TabletGenerator;
