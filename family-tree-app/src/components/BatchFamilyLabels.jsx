import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function BatchFamilyLabels({ family: familyProp }) {
  const { user } = useAuth();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  
  // 选择状态
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // 树形结构状态
  const [treeData, setTreeData] = useState([]);
  
  // 操作状态
  const [operation, setOperation] = useState('add'); // add, remove, replace
  const [targetFamilyId, setTargetFamilyId] = useState('');
  const [previewResult, setPreviewResult] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // 获取家族信息
  useEffect(() => {
    // ✅ 監聽URL的family_id參數變化
    const handleFamilyChange = (event) => {
      const newFamilyId = event.detail.familyId;
      console.log('[BatchLabels] 家族切換事件:', newFamilyId);
      if (newFamilyId) {
        fetchFamilyAndMembers(newFamilyId);
      }
    };
    
    window.addEventListener('familyChange', handleFamilyChange);
    
    // ✅ 初始加載時從URL讀取family_id
    const urlParams = new URLSearchParams(window.location.search);
    const initialFamilyId = urlParams.get('family_id');
    console.log('[BatchLabels] 初始加載, URL中的family_id:', initialFamilyId);
    
    fetchFamilyAndMembers(initialFamilyId);  // 從URL讀取
    
    return () => {
      window.removeEventListener('familyChange', handleFamilyChange);
    };
  }, []);
  
  // ✅ 監聽 family prop 的變化(當 FamilyManagement 切換家族時)
  useEffect(() => {
    if (familyProp && familyProp.id) {
      console.log('[BatchLabels] family prop 變化:', familyProp.id);
      fetchFamilyAndMembers(familyProp.id);
    }
  }, [familyProp?.id]);
  
  const fetchFamilyAndMembers = async (familyIdFromUrl = null) => {
    try {
      console.log('[BatchLabels] fetchFamilyAndMembers 被調用, familyIdFromUrl:', familyIdFromUrl);
      const token = localStorage.getItem('token');
      const userResponse = await axios.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const familyTrees = userResponse.data.familyTrees || [];  // ✅ 现在是对象数组
      const familyRoles = userResponse.data.familyRoles || {};
      
      // ✅ 優先使用URL傳遞的familyId
      let familyId = familyIdFromUrl;
      
      console.log('[BatchLabels] URL傳入的familyId:', familyIdFromUrl);
      console.log('[BatchLabels] 用戶的家族列表:', familyTrees);
      
      if (!familyId) {
        // 如果URL沒有,優先選擇有管理權限的家族
        const adminFamily = familyTrees.find(ft => {
          return ft.role === 'admin' || ft.role === 'family_admin';
        });
        
        if (adminFamily) {
          familyId = adminFamily.id;
        } else if (familyTrees.length > 0) {
          familyId = familyTrees[0].id;
        }
      }
      
      console.log('[BatchLabels] 最終選擇的familyId:', familyId);
      
      if (familyId) {
        const response = await axios.get(`/api/family/${familyId}/manage`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFamily(response.data);
        fetchMembers(familyId);
      } else {
        setError('您尚未加入任何家族');
      }
    } catch (err) {
      setError('獲取家族信息失敗: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
  
  const fetchMembers = async (familyId) => {
    try {
      setMembersLoading(true);
      const token = localStorage.getItem('token');
      
      // 使用my-family-tree API获取已构建好的树形数据
      const response = await axios.get(`http://localhost:3001/api/my-family-tree?include_related=true&family_id=${familyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { members, family_info } = response.data;
      console.log('[BatchLabels] 获取到成员数据:', members?.length || 0, '个成员');
      console.log('[BatchLabels] 家族信息:', family_info);
      
      setMembers(members || []);
      
      // 获取婚姻数据(用于检查离婚状态)
      const marriagesResponse = await axios.get(`/api/marriages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const marriages = marriagesResponse.data || [];
      console.log('[BatchLabels] 获取到婚姻数据:', marriages.length, '条');
      
      // ✅ 直接使用API返回的members,不依赖异步状态
      if (members && members.length > 0) {
        buildTreeStructure(members, familyId, marriages);
      } else {
        console.log('[BatchLabels] 没有成员数据,清空树形结构');
        setTreeData([]);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
      // 如果API失败,使用备用方案
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`/api/family?family_tree_id=${familyId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const allMembers = response.data;
        console.log('[BatchLabels] 备用方案获取成员:', allMembers.length, '个成员');
        setMembers(allMembers);
        
        // 备用方案也获取婚姻数据
        const marriagesResponse = await axios.get(`/api/marriages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const marriages = marriagesResponse.data || [];
        
        // ✅ 直接使用allMembers,不依赖异步状态
        buildTreeStructure(allMembers, familyId, marriages);
      } catch (err2) {
        console.error('备用方案也失败:', err2);
        setError('获取成员数据失败');
      }
    } finally {
      setMembersLoading(false);
    }
  };
  
  // 构建树形结构(与FamilyTree.jsx相同的逻辑)
  const buildTreeStructure = (allMembers, familyId, marriages = []) => {
    console.log('[BatchLabels] 开始构建树形结构...');
    console.log('[BatchLabels] 当前家族ID:', familyId);
    console.log('[BatchLabels] 婚姻数据:', marriages.length, '条');
    
    if (!familyId) {
      console.error('[BatchLabels] 家族ID为空,无法构建树形结构');
      // 如果家族ID为空,直接显示所有成员
      setTreeData(allMembers.map(m => ({...m, children: [], spouses: []})));
      return;
    }
    
    // 判断是否为姻亲(与FamilyTree.jsx相同的逻辑)
    const isInLawMember = (member) => {
      const memberFamilyId = member.primaryFamily;
      
      // 如果成員的 primaryFamily 等於當前家族,不是姻親
      if (memberFamilyId === familyId) {
        return false;
      }
      
      // 检查是否与当前家族成员有配偶关系
      const hasSpouseInCurrentFamily = member.spouses?.some(spouseId => {
        const spouse = allMembers.find(s => s.id === spouseId);
        if (!spouse) return false;
        const spouseFamilyId = spouse.primaryFamily;
        return spouseFamilyId === familyId;
      });
      
      return hasSpouseInCurrentFamily;
    };
    
    // 检查成员是否已离婚(从marriages表查询)
    const isDivorcedFromCurrentFamily = (member) => {
      if (!marriages || marriages.length === 0) return false;
      
      // 检查是否有与当前家族成员的离婚记录
      return marriages.some(marriage => {
        const isMemberInvolved = marriage.husband_id === member.id || marriage.wife_id === member.id;
        if (!isMemberInvolved) return false;
        
        // 检查配偶是否在当前家族
        const spouseId = marriage.husband_id === member.id ? marriage.wife_id : marriage.husband_id;
        const spouse = allMembers.find(m => m.id === spouseId);
        if (!spouse) return false;
        
        const spouseFamilies = spouse.families ? 
          (typeof spouse.families === 'string' ? JSON.parse(spouse.families) : spouse.families) : [];
        const spouseInCurrentFamily = spouse.primaryFamily === familyId || 
                                      spouseFamilies.includes(familyId);
        
        return spouseInCurrentFamily && marriage.is_divorced === 1;
      });
    };
    
    // 获取当前家族的成员(严格过滤:只包含真正属于当前家族的成员)
    const currentFamilyMembers = allMembers.filter(m => {
      // 1. 首先检查families数组(最可靠)
      let families = [];
      if (m.families) {
        try {
          families = typeof m.families === 'string' ? JSON.parse(m.families) : m.families;
          if (!Array.isArray(families)) families = [];
        } catch (e) {
          families = [];
        }
      }
      
      // 如果families包含当前家族ID,则包含
      if (families.includes(familyId)) {
        // 2. 关键: 检查是否已离婚
        if (isDivorcedFromCurrentFamily(m)) {
          console.log(`[BatchLabels] 排除(已离婚): ${m.name}`);
          return false;
        }
        return true;
      }
      
      // 3. 否则检查 primaryFamily
      const mFamilyId = m.primaryFamily;
      if (mFamilyId === familyId) {
        return true;
      }
      
      // 4. 都不匹配,排除
      return false;
    });
    
    console.log('[BatchLabels] 当前家族成员数:', currentFamilyMembers.length);
    
    // 去重: 根据ID去重,防止同一成员被多次加载
    const uniqueMembersMap = new Map();
    currentFamilyMembers.forEach(m => {
      if (!uniqueMembersMap.has(m.id)) {
        uniqueMembersMap.set(m.id, m);
      } else {
        console.warn(`[BatchLabels] ⚠️ 发现重复成员ID ${m.id}: ${m.name}, 将使用第一条记录`);
      }
    });
    const deduplicatedMembers = Array.from(uniqueMembersMap.values());
    
    if (deduplicatedMembers.length < currentFamilyMembers.length) {
      console.log(`[BatchLabels] 去重后: ${currentFamilyMembers.length} → ${deduplicatedMembers.length} 个成员`);
    }
    
    // 创建allMembers的Map,用于快速查找
    const allMembersMap = new Map();
    allMembers.forEach(m => {
      allMembersMap.set(m.id, m);
    });
    
    // 找到根节点(正确的逻辑:只有真正的第一代始祖)
    const rootMembers = deduplicatedMembers.filter(member => {
      // 姻親不能作为根节点(关键!)
      if (isInLawMember(member)) {
        console.log('[BatchLabels] ❌ 排除(姻亲):', member.name);
        return false;
      }
      
      // 解析parents字段(可能是null、字符串或数组)
      let parents = [];
      if (member.parents) {
        try {
          parents = typeof member.parents === 'string' ? JSON.parse(member.parents) : member.parents;
          if (!Array.isArray(parents)) parents = [];
        } catch (e) {
          parents = [];
        }
      }
      
      console.log(`[BatchLabels] 检查根节点候选: ${member.name}, parents:`, parents, ', spouses:', member.spouses);
      
      // 关键: 检查成员是否有父母ID
      if (parents.length > 0) {
        // 有父母ID,不是根节点(无论父母是否在当前家族)
        console.log('[BatchLabels] ❌ 排除(有父母ID):', member.name);
        return false;
      }
      
      // 没有父母ID,检查配偶
      if (member.spouses && member.spouses.length > 0) {
        for (const spouseId of member.spouses) {
          const spouse = allMembersMap.get(spouseId);
          if (spouse) {
            // 解析配偶的parents
            let spouseParents = [];
            if (spouse.parents) {
              try {
                spouseParents = typeof spouse.parents === 'string' ? JSON.parse(spouse.parents) : spouse.parents;
                if (!Array.isArray(spouseParents)) spouseParents = [];
              } catch (e) {
                spouseParents = [];
              }
            }
            
            if (spouseParents.length > 0) {
              // 配偶有父母ID,该成员不是根节点
              console.log('[BatchLabels] ❌ 排除(配偶有父母ID):', member.name);
              return false;
            }
          }
        }
      }
      
      // 没有父母 且 (没有配偶 或 配偶也没有父母)
      console.log('[BatchLabels] ✅ 根节点(始祖):', member.name);
      return true;
    });
    
    console.log('[BatchLabels] 根节点数:', rootMembers.length, rootMembers.map(m => m.name));
    
    // 已访问的成员(避免重复)
    const visited = new Set();
    
    // 递归构建树(与FamilyTree.jsx相同)
    const buildNode = (memberId) => {
      if (visited.has(memberId)) {
        console.warn('[BatchLabels] 重复访问成员:', memberId, allMembersMap.get(memberId)?.name);
        return null;
      }
      visited.add(memberId);
      
      const member = allMembersMap.get(memberId);
      if (!member) {
        console.warn('[BatchLabels] 找不到成员:', memberId);
        return null;
      }
      
      const node = {
        member: member,
        spouses: [],
        children: [],
        selected: selectedMembers.includes(member.id)
      };
      
      // 添加配偶(也标记为visited,避免重复)
      if (member.spouses) {
        member.spouses.forEach(spouseId => {
          const spouse = allMembersMap.get(spouseId);
          if (spouse) {
            // 关键: 检查配偶是否在当前家族(已离婚的配偶会被currentFamilyMembers过滤掉)
            const isSpouseInCurrentFamily = currentFamilyMembers.some(m => m.id === spouseId);
            if (isSpouseInCurrentFamily) {
              node.spouses.push(spouse);
              // 标记配偶为已访问,防止配偶被当作独立节点处理
              if (!visited.has(spouseId)) {
                visited.add(spouseId);
              }
            }
          }
        });
      }
      
      // 查找子女(从allMembers中查找,而不是deduplicatedMembers)
      const children = allMembers.filter(m => 
        m.parents && m.parents.includes(memberId)
      );
      
      // 按出生年份排序子女
      children.sort((a, b) => (a.birth_year || 0) - (b.birth_year || 0));
      
      children.forEach(child => {
        const childNode = buildNode(child.id);
        if (childNode) {
          node.children.push(childNode);
        }
      });
      
      return node;
    };
    
    // 构建树
    const tree = [];
    rootMembers.sort((a, b) => (a.birth_year || 0) - (b.birth_year || 0));
    rootMembers.forEach(root => {
      const node = buildNode(root.id);
      if (node) {
        tree.push(node);
      }
    });
    
    console.log('[BatchLabels] 树形结构构建完成,根节点数:', tree.length);
    console.log('[BatchLabels] 总节点数:', visited.size);
    setTreeData(tree);
  };
  
  // 切换单个成员选择
  const toggleMemberSelection = (memberId) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };
  
  // 递归选择/取消选择节点及其所有子节点
  const toggleNodeSelection = (node, select, selectedIds) => {
    if (select) {
      selectedIds.add(node.id);
    } else {
      selectedIds.delete(node.id);
    }
    
    if (node.children && node.children.length > 0) {
      node.children.forEach(child => {
        toggleNodeSelection(child, select, selectedIds);
      });
    }
  };
  
  // 处理节点选择
  const handleNodeToggle = (node) => {
    const newSelected = new Set(selectedMembers);
    const isCurrentlySelected = selectedMembers.includes(node.id);
    toggleNodeSelection(node, !isCurrentlySelected, newSelected);
    setSelectedMembers(Array.from(newSelected));
  };
  
  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedMembers([]);
    } else {
      const allIds = new Set();
      const collectIds = (nodes) => {
        nodes.forEach(node => {
          allIds.add(node.id);
          if (node.children) collectIds(node.children);
        });
      };
      collectIds(treeData);
      setSelectedMembers(Array.from(allIds));
    }
    setSelectAll(!selectAll);
  };
  
  // 预览变更
  const previewChanges = async () => {
    if (selectedMembers.length === 0) {
      setError('請至少選擇一個成員');
      return;
    }
    
    if (!targetFamilyId.trim()) {
      setError('請輸入目標家族ID');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/family/batch-labels/preview', {
        memberIds: selectedMembers,
        operation,
        targetFamilyId: targetFamilyId.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setPreviewResult(response.data);
      setShowPreview(true);
      setError('');
    } catch (err) {
      setError('預覽失敗: ' + (err.response?.data?.error || err.message));
    }
  };
  
  // 执行批量更新
  const executeBatchUpdate = async () => {
    console.log('[BatchLabels] executeBatchUpdate 被調用');
    console.log('[BatchLabels] previewResult:', previewResult);
    console.log('[BatchLabels] selectedMembers:', selectedMembers);
    console.log('[BatchLabels] operation:', operation);
    console.log('[BatchLabels] targetFamilyId:', targetFamilyId);
    
    if (!previewResult) {
      console.error('[BatchLabels] ❌ 沒有 previewResult, 請先預覽變更');
      setError('請先預覽變更');
      return;
    }
    
    try {
      console.log('[BatchLabels] 準備調用 API /api/family/batch-labels/execute');
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/family/batch-labels/execute', {
        memberIds: selectedMembers,
        operation,
        targetFamilyId: targetFamilyId.trim()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('[BatchLabels] ✅ API 調用成功:', response.data);
      setMessage(response.data.message || '批量更新成功！');
      setTimeout(() => setMessage(''), 5000);
      
      // 重置状态
      setSelectedMembers([]);
      setSelectAll(false);
      setTargetFamilyId('');
      setPreviewResult(null);
      setShowPreview(false);
      
      // 刷新成员列表
      fetchFamilyAndMembers();
    } catch (err) {
      console.error('[BatchLabels] ❌ API 調用失敗:', err);
      console.error('[BatchLabels] 錯誤詳情:', err.response?.data);
      setError('批量更新失敗: ' + (err.response?.data?.error || err.message));
    }
  };
  
  if (loading) return <div style={styles.container}><p>加載中...</p></div>;
  
  // 递归渲染树节点(与FamilyTree.jsx相同的结构)
  const renderTreeNode = (node, depth = 0) => {
    if (!node || !node.member) {
      console.error('[BatchLabels] 无效的节点:', node);
      return null;
    }
    
    const isSelected = selectedMembers.includes(node.member.id);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.member.id}>
        {/* 主成员和配偶在同一行显示 */}
        <div style={styles.nodeRow}>
          {/* 主成员 */}
          <div 
            style={{
              ...styles.treeNode,
              paddingLeft: `${depth * 30 + 10}px`,
              backgroundColor: isSelected ? '#e6f7ff' : '#fff',
            }}
            className="tree-node-hover"
          >
            <label style={styles.treeNodeLabel}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleNodeToggle(node.member)}
                style={styles.treeCheckbox}
              />
              <div style={styles.treeNodeInfo}>
                <span style={styles.treeNodeName}>
                  {node.member.gender === 'male' ? '👨' : '👩'} {node.member.name}
                </span>
                {node.member.generation && (
                  <span style={styles.treeGeneration}>(第{node.member.generation}代)</span>
                )}
                <span style={styles.treeNodeId}>ID: {node.member.id}</span>
              </div>
            </label>
          </div>
          
          {/* 配偶(同样高度,不内缩) */}
          {node.spouses.map(spouse => {
            const isSpouseSelected = selectedMembers.includes(spouse.id);
            return (
              <div 
                key={spouse.id}
                style={{
                  ...styles.spouseNode,
                  paddingLeft: '10px', // 不内缩,与主成员同样的padding
                  backgroundColor: isSpouseSelected ? '#e6f7ff' : '#fff',
                }}
                className="tree-node-hover"
              >
                <label style={styles.treeNodeLabel}>
                  <input
                    type="checkbox"
                    checked={isSpouseSelected}
                    onChange={() => handleNodeToggle(spouse)}
                    style={styles.treeCheckbox}
                  />
                  <div style={styles.treeNodeInfo}>
                    <span style={styles.treeNodeName}>
                      {spouse.gender === 'male' ? '👨' : '👩'} {spouse.name}
                    </span>
                    {spouse.generation && (
                      <span style={styles.treeGeneration}>(第{spouse.generation}代)</span>
                    )}
                    <span style={styles.treeNodeId}>ID: {spouse.id}</span>
                  </div>
                </label>
              </div>
            );
          })}
        </div>
        
        {/* 子女 */}
        {hasChildren && (
          <div style={styles.treeChildren}>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };
  
  // 只使用树形数据
  const displayData = treeData;
  
  return (
    <div style={styles.container}>
      {/* 功能说明 */}
      <div style={styles.infoCard}>
        <h2 style={styles.infoTitle}>🏷️ 批量管理家族標籤功能說明</h2>
        <p style={styles.infoText}>
          此功能用於批量添加、移除或替換成員的家族標籤（families字段），適用於以下場景：
        </p>
        <ul style={styles.infoList}>
          <li>📌 <strong>跨家族關聯</strong> - 為成員添加其他家族的標籤（如姻親、過繼等）</li>
          <li>🔄 <strong>家族合併</strong> - 批量添加目標家族ID到多個成員</li>
          <li>🧹 <strong>數據清理</strong> - 移除錯誤或過期的家族標籤</li>
        </ul>
        <div style={styles.highlightBox}>
          <strong>💡 操作提示：</strong>
          <p>1. 從「家族信息」標籤頁複製目標家族ID</p>
          <p>2. 選擇要操作的成員</p>
          <p>3. 選擇操作類型（添加/移除/替換）</p>
          <p>4. 貼上目標家族ID並預覽變更</p>
          <p>5. 確認無誤後執行批量更新</p>
        </div>
      </div>
      
      {/* 消息提示 */}
      {message && <div style={styles.success}>{message}</div>}
      {error && <div style={styles.error} onClick={() => setError('')}>{error}</div>}
      
      {/* 树形成员选择 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>👥 選擇要操作的成員（樹形視圖）</h2>
        <p style={styles.description}>
          點擊成員前的複選框進行選擇，選擇父節點將自動選擇所有子節點
        </p>
        
        <div style={styles.selectHeader}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={selectAll}
              onChange={handleSelectAll}
              style={styles.checkbox}
            />
            全選 ({selectedMembers.length} 人已選擇)
          </label>
        </div>
        
        {membersLoading ? (
          <p style={styles.loading}>正在加載族譜樹...</p>
        ) : displayData.length === 0 ? (
          <p style={styles.empty}>暫無成員，請先添加家族成員或切換到其他家族</p>
        ) : (
          <div style={styles.treeContainer}>
            {displayData.map(node => renderTreeNode(node))}
          </div>
        )}
      </div>
      
      {/* 操作选择 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>⚙️ 選擇操作類型</h2>
        
        <div style={styles.operationGroup}>
          <label style={styles.operationLabel}>
            <input
              type="radio"
              name="operation"
              value="add"
              checked={operation === 'add'}
              onChange={(e) => setOperation(e.target.value)}
              style={styles.radio}
            />
            <div>
              <strong style={styles.operationTitle}>➕ 添加家族標籤</strong>
              <p style={styles.operationDesc}>將目標家族ID添加到成員的families數組中（不會移除現有標籤）</p>
            </div>
          </label>
          
          <label style={styles.operationLabel}>
            <input
              type="radio"
              name="operation"
              value="remove"
              checked={operation === 'remove'}
              onChange={(e) => setOperation(e.target.value)}
              style={styles.radio}
            />
            <div>
              <strong style={styles.operationTitle}>➖ 移除家族標籤</strong>
              <p style={styles.operationDesc}>從成員的families數組中移除目標家族ID（保留其他標籤）</p>
            </div>
          </label>
          
          <label style={styles.operationLabel}>
            <input
              type="radio"
              name="operation"
              value="replace"
              checked={operation === 'replace'}
              onChange={(e) => setOperation(e.target.value)}
              style={styles.radio}
            />
            <div>
              <strong style={styles.operationTitle}>🔄 替換家族標籤</strong>
              <p style={styles.operationDesc}>清空成員的所有家族標籤，僅保留目標家族ID</p>
            </div>
          </label>
        </div>
      </div>
      
      {/* 目标家族ID输入 */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>🎯 輸入目標家族ID</h2>
        <p style={styles.description}>
          請貼上要操作的家族ID（可從「家族信息」頁面複製）
        </p>
        
        <div style={styles.inputGroup}>
          <input
            type="text"
            value={targetFamilyId}
            onChange={(e) => setTargetFamilyId(e.target.value)}
            placeholder="例如：李_family_1775525022539"
            style={styles.input}
          />
          {targetFamilyId && (
            <div style={styles.inputPreview}>
              <span style={styles.previewLabel}>已輸入：</span>
              <code style={styles.previewCode}>{targetFamilyId}</code>
            </div>
          )}
        </div>
      </div>
      
      {/* 预览和执行 */}
      <div style={styles.actionButtons}>
        <button
          onClick={previewChanges}
          disabled={selectedMembers.length === 0 || !targetFamilyId.trim()}
          style={{
            ...styles.previewButton,
            ...(selectedMembers.length === 0 || !targetFamilyId.trim() ? styles.disabledButton : {})
          }}
        >
          👁️ 預覽變更
        </button>
        
        <button
          onClick={executeBatchUpdate}
          disabled={!showPreview || !previewResult}
          style={{
            ...styles.executeButton,
            ...(!showPreview || !previewResult ? styles.disabledButton : {})
          }}
        >
          ✅ 執行批量更新
        </button>
      </div>
      
      {/* 预览结果 */}
      {showPreview && previewResult && (
        <div style={styles.previewCard}>
          <h2 style={styles.previewTitle}>📋 預覽變更結果</h2>
          
          <div style={styles.previewSummary}>
            <p><strong>操作類型：</strong>
              {operation === 'add' && '➕ 添加家族標籤'}
              {operation === 'remove' && '➖ 移除家族標籤'}
              {operation === 'replace' && '🔄 替換家族標籤'}
            </p>
            <p><strong>目標家族ID：</strong><code style={styles.code}>{targetFamilyId}</code></p>
            <p><strong>影響成員數量：</strong>{previewResult.affectedCount} 人</p>
          </div>
          
          <div style={styles.previewList}>
            <h3 style={styles.previewListTitle}>變更詳情：</h3>
            {previewResult.changes.map((change, index) => (
              <div key={index} style={styles.changeItem}>
                <div style={styles.changeHeader}>
                  <strong>{change.memberName}</strong>
                  <span style={styles.changeMemberId}>({change.memberId})</span>
                </div>
                <div style={styles.changeDetails}>
                  {change.before && (
                    <p style={styles.beforeChange}>
                      <strong>变更前：</strong>
                      <code>{change.before}</code>
                    </p>
                  )}
                  <div style={styles.changeArrow}>↓</div>
                  {change.after && (
                    <p style={styles.afterChange}>
                      <strong>变更后：</strong>
                      <code>{change.after}</code>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          <div style={styles.previewWarning}>
            ⚠️ 請仔細檢查上述變更，確認無誤後點擊「執行批量更新」
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
  },
  infoCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px',
    color: '#fff',
  },
  infoTitle: {
    fontSize: '20px',
    marginBottom: '12px',
  },
  infoText: {
    fontSize: '15px',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  infoList: {
    paddingLeft: '20px',
    marginBottom: '16px',
  },
  infoList: {
    paddingLeft: '20px',
    marginBottom: '12px',
    lineHeight: '1.8',
  },
  highlightBox: {
    background: 'rgba(255,255,255,0.2)',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '14px',
    lineHeight: '1.6',
  },
  success: {
    background: '#d4edda',
    color: '#155724',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    cursor: 'pointer',
  },
  error: {
    background: '#f8d7da',
    color: '#721c24',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    cursor: 'pointer',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    fontSize: '18px',
    marginBottom: '16px',
    color: '#333',
  },
  description: {
    color: '#666',
    marginBottom: '16px',
    fontSize: '14px',
  },
  selectHeader: {
    marginBottom: '16px',
    padding: '12px',
    background: '#f0f7ff',
    borderRadius: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: '600',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    color: '#999',
    padding: '20px',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    padding: '20px',
    fontStyle: 'italic',
  },
  treeContainer: {
    maxHeight: '600px',
    overflowY: 'auto',
    border: '1px solid #e8e8e8',
    borderRadius: '8px',
    backgroundColor: '#fafafa',
    padding: '10px',
  },
  nodeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    marginBottom: '5px',
    flexWrap: 'wrap',
  },
  treeNode: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 10px',
    borderRadius: '6px',
    border: '1px solid #e8e8e8',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  spouseNode: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 10px',
    borderRadius: '6px',
    border: '1px solid #d6e4ff',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  treeNodeLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    flex: 1,
  },
  treeCheckbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    flexShrink: 0,
  },
  treeNodeInfo: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  treeNodeName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#333',
  },
  treeGeneration: {
    fontSize: '12px',
    color: '#666',
  },
  treeNodeId: {
    fontSize: '11px',
    color: '#999',
    fontFamily: 'monospace',
  },
  treeChildren: {
    marginLeft: '0',
    paddingLeft: '0',
  },
  operationGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  operationLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: '#f8f9fa',
    borderRadius: '8px',
    border: '2px solid #e8e8e8',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  radio: {
    width: '20px',
    height: '20px',
    marginTop: '2px',
    cursor: 'pointer',
  },
  operationTitle: {
    fontSize: '15px',
    color: '#333',
    marginBottom: '4px',
  },
  operationDesc: {
    fontSize: '13px',
    color: '#666',
    lineHeight: '1.5',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    fontFamily: 'monospace',
  },
  inputPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    background: '#f0f7ff',
    borderRadius: '6px',
  },
  previewLabel: {
    fontSize: '13px',
    color: '#666',
  },
  previewCode: {
    fontSize: '14px',
    color: '#1890ff',
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  previewButton: {
    flex: 1,
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  executeButton: {
    flex: 1,
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  previewCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  previewTitle: {
    fontSize: '18px',
    marginBottom: '16px',
    color: '#333',
  },
  previewSummary: {
    padding: '16px',
    background: '#f0f7ff',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '14px',
    color: '#1890ff',
    background: '#f5f5f5',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  previewList: {
    marginBottom: '16px',
  },
  previewListTitle: {
    fontSize: '15px',
    marginBottom: '12px',
    color: '#333',
  },
  changeItem: {
    padding: '12px',
    background: '#f8f9fa',
    borderRadius: '8px',
    marginBottom: '8px',
  },
  changeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  changeMemberId: {
    fontSize: '12px',
    color: '#999',
    fontFamily: 'monospace',
  },
  changeDetails: {
    paddingLeft: '16px',
  },
  beforeChange: {
    fontSize: '13px',
    color: '#666',
    marginBottom: '4px',
  },
  changeArrow: {
    textAlign: 'center',
    color: '#999',
    fontSize: '18px',
    padding: '4px 0',
  },
  afterChange: {
    fontSize: '13px',
    color: '#11998e',
    marginBottom: '4px',
  },
  previewWarning: {
    padding: '16px',
    background: '#fff3cd',
    borderRadius: '8px',
    color: '#856404',
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '600',
  },
};

// 添加hover样式
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .tree-node-hover:hover {
    background-color: #f0f7ff !important;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transform: translateX(2px);
  }
`;
document.head.appendChild(styleSheet);

export default BatchFamilyLabels;
