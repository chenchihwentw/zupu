import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import FamilyMember from './FamilyMember';
import EditMemberPanel from './EditMemberPanel';
import AddMemberModal from './AddMemberModal';
import AddRelativeModal from './AddRelativeModal';
import CreateFamilyModal from './CreateFamilyModal';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layout, 
  Book, 
  Bell, 
  Settings2, 
  RotateCcw, 
  ChevronRight, 
  Layers,
  LayoutGrid,
  CreditCard
} from 'lucide-react';
import PrintableFamilyBook from './PrintableFamilyBook';
import RemindersPanel from './RemindersPanel';
import HelpLink from './HelpLink';
import '../Tree.css';

const FamilyTree = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, user, currentFamilyId, switchFamily } = useAuth();
  const { isTraditional, setIsTraditional } = useLanguage();
  const [family, setFamily] = useState([]);
  const [marriages, setMarriages] = useState([]);
  const [editingMember, setEditingMember] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddRelativeModal, setShowAddRelativeModal] = useState(false);
  const [baseMember, setBaseMember] = useState(null);
  const [relativeType, setRelativeType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [familyInfo, setFamilyInfo] = useState(null);
  const [viewAsMemberId, setViewAsMemberId] = useState(null);
  const [highlightedMemberId, setHighlightedMemberId] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');
  const [viewContext, setViewContext] = useState(null);
  const [canCreateFamily, setCanCreateFamily] = useState(false);
  const [viewMember, setViewMember] = useState(null);
  const [canEditFamily, setCanEditFamily] = useState(false);
  
  const [activeTab, setActiveTab] = useState('graph');
  const [cardOrientation, setCardOrientation] = useState('vertical');
  
  const [showCreateFamilyModal, setShowCreateFamilyModal] = useState(false);
  const [pendingRelativeType, setPendingRelativeType] = useState(null);
  const [pendingBaseMember, setPendingBaseMember] = useState(null);
  const [newFamilySurname, setNewFamilySurname] = useState('');
  const [newFamilyAncestralHome, setNewFamilyAncestralHome] = useState('');
  const [newFamilyHallName, setNewFamilyHallName] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  
  const fetchFamilyData = async (includeRelated = false, viewMemberId = null, familyId = null) => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem('token');
    const url = `http://localhost:3001/api/my-family-tree?t=${Date.now()}${includeRelated ? '&include_related=true' : ''}${viewMemberId ? `&view_member_id=${encodeURIComponent(viewMemberId)}` : ''}${familyId ? `&family_id=${encodeURIComponent(familyId)}` : ''}`;
    
    try {
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { family_info, members, view_context, notice } = res.data;
      
      // 統一解析所有成員的 JSON 陣列欄位，防止 .some/.filter 崩潰
      const parseArr = (val) => {
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; }
          catch(e) { return []; }
        }
        return [];
      };
      const normalizedMembers = (members || []).map(m => ({
        ...m,
        parents:  parseArr(m.parents),
        spouses:  parseArr(m.spouses),
        children: parseArr(m.children),
        families: parseArr(m.families),
      }));
      setFamily(normalizedMembers);
      setFamilyInfo(family_info);
      setViewContext(view_context);
      switchFamily(family_info?.id);
      setCanEditFamily(hasPermission('family_admin', family_info?.id));
      setCanCreateFamily(view_context?.can_create_family || false);
      
      if (notice) {
        setTransitionMessage(notice);
        setIsTransitioning(true);
        setTimeout(() => setIsTransitioning(false), 5000);
      }
      
      setLoading(false);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.canCreateFamily || errorData?.canCreateMember) {
        setCanCreateFamily(true);
        setError(errorData.error || '請創建您的家族');
        if (errorData?.view_context?.view_member_id) {
          setViewMember({
            id: errorData.view_context.view_member_id,
            name: errorData.view_context.view_member_name,
            canCreateFamily: true
          });
        }
      } else {
        setError("Failed to load family data: " + (err.message || 'Unknown error'));
      }
      setFamily([]);
      setLoading(false);
    }
  };

  const fetchMarriages = () => {
    axios.get('/api/marriages')
      .then(res => {
        setMarriages(res.data || []);
      })
      .catch(err => {
        console.error('Failed to load marriages:', err);
      });
  };

  useEffect(() => {
    fetchFamilyData(true, viewAsMemberId, currentFamilyId);
  }, [currentFamilyId]);

  useEffect(() => {
    const handleFamilyChange = (event) => {
      // 這裡如果 global 切換了，上面的 useEffect 會處理
    };
    
    window.addEventListener('familyChange', handleFamilyChange);
    fetchMarriages();
    
    return () => {
      window.removeEventListener('familyChange', handleFamilyChange);
    };
  }, []);

  const handleAddMemberFromModal = async (newMember) => {
    try {
      const memberWithFamily = {
        ...newMember,
        primaryFamily: newMember.primaryFamily || currentFamilyId,
        families: newMember.families || [currentFamilyId]
      };
      
      await axios.post('/api/family', memberWithFamily);
      
      const spouseId = newMember.spouses && newMember.spouses.length > 0 ? newMember.spouses[0] : null;
      if (spouseId) {
        const spouse = family.find(m => m.id === spouseId);
        if (spouse) {
          const updatedSpouse = {
            ...spouse,
            spouses: [...(spouse.spouses || []), newMember.id]
          };
          await axios.put(`/api/family/${spouse.id}`, updatedSpouse);
        }
      }
      
      setShowAddModal(false);
      fetchFamilyData(true);
    } catch (err) {
      console.error("Add failed:", err);
      alert("Add failed: " + err.message);
    }
  };

  const handleAddRelative = (member, type) => {
    const memberHasFamily = !!member.primaryFamily;
    
    if (type === 'parent' && !memberHasFamily) {
      setPendingBaseMember(member);
      setPendingRelativeType(type);
      setNewFamilySurname(member.name?.charAt(0) || '');
      setNewFamilyName(member.name + '家族');
      setShowCreateFamilyModal(true);
      return;
    }
    
    setBaseMember(member);
    setRelativeType(type);
    setShowAddRelativeModal(true);
  };
  
  const handleCreateFamilyAndContinue = async () => {
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const familyData = {
        id: `family_${pendingBaseMember.id}_${Date.now()}`,
        name: newFamilyName,
        surname: newFamilySurname,
        ancestral_home: newFamilyAncestralHome,
        hall_name: newFamilyHallName,
        created_by: currentUser.id || user?.id,
        description: `${newFamilyName}，${newFamilySurname}氏宗族`,
        is_public: false
      };
      
      await axios.post('/api/family-trees', familyData);
      
      const response = await axios.post('/api/family', {
        primaryFamily: familyData.id,
        families: [familyData.id]
      });
      
      const updatedMember = {
        ...pendingBaseMember,
        primaryFamily: familyData.id,
        families: [familyData.id]
      };
      await axios.put(`/api/family/${pendingBaseMember.id}`, updatedMember);
      
      setShowCreateFamilyModal(false);
      setBaseMember(updatedMember);
      setRelativeType(pendingRelativeType);
      setShowAddRelativeModal(true);
      
      setPendingBaseMember(null);
      setPendingRelativeType(null);
      
      fetchFamilyData(true);
    } catch (err) {
      console.error("Create family failed:", err);
      alert("創建家族失敗: " + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveRelative = async (newMemberData) => {
    try {
      // ✨ 確保具備姓名字段
      let memberWithFamily = { 
        ...newMemberData,
        surname: newMemberData.surname || '',
        given_name: newMemberData.given_name || ''
      };
      
      const treeFamilyId = currentFamilyId || localStorage.getItem('currentFamilyId');
      
      if (!treeFamilyId) {
        console.warn("Missing currentFamilyId in handleSaveRelative fallback used");
      }

      if (relativeType === 'parent') {
        const isMother = memberWithFamily.gender === 'female';
        const isInLaw = isMother;
        
        if (isInLaw) {
          const nativeId = `family_${memberWithFamily.id}_native`;
          memberWithFamily.primaryFamily = nativeId;
          memberWithFamily.families = [nativeId, treeFamilyId];
        } else {
          memberWithFamily.primaryFamily = treeFamilyId;
          memberWithFamily.families = [treeFamilyId];
        }

      } else if (relativeType === 'child' || relativeType === 'sibling') {
        const lineageFamilyId = baseMember?.primaryFamily || treeFamilyId;
        memberWithFamily.primaryFamily = lineageFamilyId;
        
        if (relativeType === 'sibling') {
          let inheritedFamilies = baseMember?.families || [lineageFamilyId];
          
          const spouseNativeIds = (baseMember.spouses || []).map(sid => {
            const s = family.find(m => m.id === sid);
            return s?.primaryFamily;
          }).filter(id => id && id.endsWith('_native'));
          
          memberWithFamily.families = inheritedFamilies.filter(fid => !spouseNativeIds.includes(fid));
        } else {
          memberWithFamily.families = baseMember?.families || [lineageFamilyId];
        }

      } else if (relativeType === 'spouse') {
        const spouseNativeId = `family_${memberWithFamily.id}_native`;
        memberWithFamily.primaryFamily = spouseNativeId;
        memberWithFamily.families = [spouseNativeId, treeFamilyId];
      }
      
      await axios.post('/api/family', memberWithFamily);
      
      if (baseMember) {
        const updatedBaseMember = { ...baseMember };
        
        switch (relativeType) {
          case 'parent': {
            // 1. 基准成員添加父母
            updatedBaseMember.parents = Array.from(new Set([...(updatedBaseMember.parents || []), memberWithFamily.id]));
            if (memberWithFamily.gender === 'male') updatedBaseMember.father_id = memberWithFamily.id;
            else updatedBaseMember.mother_id = memberWithFamily.id;
            await axios.put(`/api/family/${baseMember.id}`, updatedBaseMember);
            
            // 2. 新父母添加基准成員為子女
            memberWithFamily.children = Array.from(new Set([...(memberWithFamily.children || []), baseMember.id]));
            await axios.put(`/api/family/${memberWithFamily.id}`, memberWithFamily);
            break;
          }
            
          case 'child': {
            // 1. 父母（基准成員及其配偶）添加子女
            updatedBaseMember.children = Array.from(new Set([...(updatedBaseMember.children || []), memberWithFamily.id]));
            await axios.put(`/api/family/${baseMember.id}`, updatedBaseMember);
            
            // 如果基准成員有配偶，且該配偶也是新成員的父母之一，則也更新配偶
            if (memberWithFamily.parents?.length > 1) {
              const spouseId = memberWithFamily.parents.find(pid => pid !== baseMember.id);
              const spouse = family.find(m => m.id === spouseId);
              if (spouse) {
                const updatedSpouse = { ...spouse, children: Array.from(new Set([...(spouse.children || []), memberWithFamily.id])) };
                await axios.put(`/api/family/${spouse.id}`, updatedSpouse);
              }
            }
            break;
          }

          case 'sibling': {
            // 1. 共同父母添加新子女
            if (memberWithFamily.parents?.length > 0) {
              for (const pid of memberWithFamily.parents) {
                const p = family.find(m => m.id === pid);
                if (p) {
                  const updatedP = { ...p, children: Array.from(new Set([...(p.children || []), memberWithFamily.id])) };
                  await axios.put(`/api/family/${p.id}`, updatedP);
                }
              }
            }
            break;
          }
            
          case 'spouse': {
            // 1. 基准成員添加配偶
            updatedBaseMember.spouses = Array.from(new Set([...(updatedBaseMember.spouses || []), memberWithFamily.id]));
            const spouseNativeFamilyId = memberWithFamily.primaryFamily;
            if (spouseNativeFamilyId && !updatedBaseMember.families?.includes(spouseNativeFamilyId)) {
              updatedBaseMember.families = Array.from(new Set([...(updatedBaseMember.families || []), spouseNativeFamilyId]));
            }
            await axios.put(`/api/family/${baseMember.id}`, updatedBaseMember);
            
            // 2. 新配偶添加基准成員
            memberWithFamily.spouses = Array.from(new Set([...(memberWithFamily.spouses || []), baseMember.id]));
            await axios.put(`/api/family/${memberWithFamily.id}`, memberWithFamily);

            // 3. 記錄婚姻狀況
            const husbandId = baseMember.gender === 'male' ? baseMember.id : memberWithFamily.id;
            const wifeId = baseMember.gender === 'female' ? baseMember.id : memberWithFamily.id;
            const marriageId = `m_${husbandId}_${wifeId}_${Date.now()}`;

            await axios.post('/api/marriages', {
              id: marriageId,
              husband_id: husbandId,
              wife_id: wifeId,
              marriage_date: memberWithFamily.marriage_date || null
            });
            break;
          }
          default:
            break;
        }
      }
      
      setShowAddRelativeModal(false);
      setBaseMember(null);
      setRelativeType(null);
      fetchFamilyData(true);
    } catch (err) {
      console.error("Add relative failed:", err);
      const errorMsg = err.response?.data?.error || err.message;
      alert("Add relative failed: " + errorMsg);
    }
  };

  const handleViewPerspective = async (member) => {
    localStorage.setItem('currentViewMemberId', member.id);
    localStorage.setItem('currentViewMemberName', member.name);
    
    setIsTransitioning(true);
    setTransitionMessage(`正在切換至${member.name}的家族視角...`);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    // 關鍵：傳遞 currentFamilyId 以保持家族上下文穩定
    await fetchFamilyData(true, member.id, currentFamilyId);
    
    setViewAsMemberId(member.id);
    setHighlightedMemberId(member.id);
    
    setTimeout(() => {
      setIsTransitioning(false);
      setTransitionMessage(`已切換至${member.name}的家族視角`);
      setTimeout(() => {
        setTransitionMessage('');
      }, 2000);
    }, 300);
  };

  const handleResetPerspective = () => {
    fetchFamilyData(false, null);
    setViewAsMemberId(null);
    setHighlightedMemberId(null);
    setTransitionMessage('已返回我的家族視角');
    setTimeout(() => setTransitionMessage(''), 2000);
  };

  const isDivorced = (memberId1, memberId2) => {
    return marriages.some(m => 
      ((m.husband_id === memberId1 && m.wife_id === memberId2) ||
       (m.husband_id === memberId2 && m.wife_id === memberId1)) &&
      m.is_divorced === 1
    );
  };

  const getCurrentFamilyMembers = () => {
    if (!viewAsMemberId) {
      const baseList = family.filter(m => {
        const mFamilies = m.families || [];
        const mFamilyId = m.primaryFamily || currentFamilyId;
        const matchByFamilies = mFamilies.length > 0 && mFamilies.includes(currentFamilyId);
        const matchByFamilyId = mFamilyId === currentFamilyId;
        return mFamilies.length > 0 ? matchByFamilies : matchByFamilyId;
      });

      // ✨ 連線感知補全 (全局視圖)
      const currentMemberIds = new Set(baseList.map(m => m.id));
      const connectingParents = [];
      baseList.forEach(m => {
        if (m.parents && m.parents.length > 0) {
          m.parents.forEach(pid => {
            if (!currentMemberIds.has(pid)) {
              const p = family.find(f => f.id === pid);
              if (p) {
                connectingParents.push(p);
                currentMemberIds.add(pid);
              }
            }
          });
        }
      });
      return [...baseList, ...connectingParents];
    }
    
    const viewMember = family.find(m => m.id === viewAsMemberId);
    if (!viewMember) return family;
    
    const viewMemberFamilies = viewMember.families || [];
    const primaryFamilyId = viewMemberFamilies.length > 0 ? viewMemberFamilies[0] : (viewMember.primaryFamily || 'default');
    
    const viewMemberParents = viewMember.parents || [];
    const viewMemberChildren = family.filter(m => m.parents?.includes(viewMember.id)).map(m => m.id);
    const relatedIds = [...viewMemberParents, ...viewMemberChildren];
    
    const baseList = family.filter(m => {
      const mFamilies = m.families || [];
      const mFamilyId = m.primaryFamily || 'default';
      
      if (mFamilies.length > 0) {
        if (mFamilies.includes(primaryFamilyId)) return true;
      } else if (mFamilyId === primaryFamilyId) {
        return true;
      }
      
      if (relatedIds.includes(m.id)) return true;
      
      const hasSpouseInCurrentFamily = m.spouses?.some(spouseId => {
        const spouse = family.find(s => s.id === spouseId);
        if (!spouse) return false;
        const spouseFamilies = spouse.families || [];
        const spouseFamilyId = spouse.primaryFamily || 'default';
        if (isDivorced(m.id, spouseId)) return false;
        if (spouseFamilies.length > 0) return spouseFamilies.includes(primaryFamilyId);
        return spouseFamilyId === primaryFamilyId;
      });
      
      return hasSpouseInCurrentFamily;
    });

    // ✨ 連線感知補全：確保列表中的每個成員，其父母 ID 也都在列表中，否則連線會斷開
    const currentMemberIds = new Set(baseList.map(m => m.id));
    const connectingParents = [];
    baseList.forEach(m => {
      if (m.parents && m.parents.length > 0) {
        m.parents.forEach(pid => {
          if (!currentMemberIds.has(pid)) {
            const p = family.find(f => f.id === pid);
            if (p) {
              connectingParents.push(p);
              currentMemberIds.add(pid);
            }
          }
        });
      }
    });

    return [...baseList, ...connectingParents];
  };

  const isInLawMember = (member) => {
    const currentFamilyId = getCurrentFamilyId();
    const memberFamilies = member.families || [];
    if (memberFamilies.length > 0) {
      if (memberFamilies.includes(currentFamilyId)) return false;
    } else {
      const memberFamilyId = member.primaryFamily;
      if (memberFamilyId === currentFamilyId) return false;
    }
    
    return member.spouses?.some(spouseId => {
      const spouse = family.find(m => m.id === spouseId);
      if (!spouse) return false;
      const spouseFamilies = spouse.families || [];
      const spouseFamilyId = spouse.primaryFamily;
      if (spouseFamilies.length > 0) return spouseFamilies.includes(currentFamilyId);
      return spouseFamilyId === currentFamilyId;
    });
  };

  const getCurrentFamilyId = () => {
    // 優先返回當前選擇的家族 ID，視角切換不應改變家族主權限上下文
    return currentFamilyId;
  };

  const handleFocusMember = (member) => {
    // 如果點擊的是非當前中心成員，先切換視角（聚焦此人）
    if (viewAsMemberId !== member.id) {
      handleViewPerspective(member);
      return;
    }

    // 如果點擊的是已聚焦的中心成員，則根據權限進入編輯或生平頁
    const hasBio = member.has_biography || (member.biography_md && member.biography_md.trim().length > 0);
    const canEdit = canEditFamily;

    if (canEdit) {
      if (hasBio) {
        navigate(`/member/${member.id}/biography/edit`);
      } else {
        setEditingMember(member);
      }
    } else {
      navigate(`/member/${member.id}`);
    }
  };

  const handleUpdateMember = (updatedMember) => {
    const token = localStorage.getItem('token');
    axios.put(`/api/family/${updatedMember.id}`, updatedMember, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async () => {
        setEditingMember(null);
        fetchFamilyData(true);
      })
      .catch(err => {
        console.error("Update failed:", err);
        alert("Update failed: " + (err.response?.data?.error || err.message));
      });
  };

  const handleDeleteMember = (memberId) => {
    if (!window.confirm(isTraditional ? '確定要刪除此成員嗎？' : '确定要删除此成员吗？')) return;
    const token = localStorage.getItem('token');
    axios.delete(`/api/family/${memberId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(() => {
        fetchFamilyData(true);
        setEditingMember(null);
      })
      .catch(err => {
        console.error("Delete failed:", err);
        alert("Delete failed: " + (err.response?.data?.error || err.message));
      });
  };

  const buildTree = () => {
    const currentFamilyMembers = getCurrentFamilyMembers();
    const visited = new Set();
    const forest = [];

    // 🚀 O(N) 優化：預先建立索引
    const memberMap = new Map();
    family.forEach(m => memberMap.set(m.id, m));
    
    // 建立父母到子女的索引
    const parentToChildren = new Map();
    family.forEach(m => {
      if (m.parents) {
        m.parents.forEach(pid => {
          if (!parentToChildren.has(pid)) parentToChildren.set(pid, []);
          parentToChildren.get(pid).push(m);
        });
      }
    });

    const processNode = (memberId) => {
      if (visited.has(memberId)) return null;
      visited.add(memberId);
      
      let member = currentFamilyMembers.find(m => m.id === memberId) || memberMap.get(memberId);
      if (!member) return null;

      const node = { member, spouses: [], children: [] };
      if (member.spouses) {
        member.spouses.forEach(spouseId => {
          if (isDivorced(member.id, spouseId)) return;
          if (!visited.has(spouseId)) {
            visited.add(spouseId);
            let spouse = currentFamilyMembers.find(m => m.id === spouseId) || memberMap.get(spouseId);
            if (spouse) node.spouses.push(spouse);
          }
        });
      }

      // 使用索引快速獲取子女
      const spouseIds = node.spouses.map(s => s.id);
      const parentIds = [member.id, ...spouseIds];
      const childrenSet = new Set();
      
      parentIds.forEach(pid => {
        const pChildren = parentToChildren.get(pid) || [];
        pChildren.forEach(c => {
          // 只有當父母雙方都在 parentIds 中時（或其中一方不在列表，但另一方是主 parental node）
          // 這裡簡化為只要是其中一方的子女就顯示
          childrenSet.add(c);
        });
      });

      const children = Array.from(childrenSet);
      children.sort((a, b) => (a.birth_year || 0) - (b.birth_year || 0));
      children.forEach(child => {
        const childNode = processNode(child.id);
        if (childNode) node.children.push(childNode);
      });
      return node;
    };

    const roots = currentFamilyMembers.filter(member => {
      if (isInLawMember(member)) return false;
      if (!member.parents || member.parents.length === 0) return true;
      return !member.parents.some(pid => currentFamilyMembers.some(m => m.id === pid));
    });

    roots.sort((a, b) => (a.birth_year || 0) - (b.birth_year || 0));
    roots.forEach(root => {
      const node = processNode(root.id);
      if (node) forest.push(node);
    });
    return forest;
  };

  const renderTreeNode = (node) => {
    const canEdit = canEditFamily;
    return (
      <div key={node.member.id} className="tree-node-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: cardOrientation === 'horizontal' ? '20px' : '4px' }}>
          <FamilyMember 
            id={node.member.id}
            member={node.member} 
            onEdit={setEditingMember}
            onAddRelative={handleAddRelative}
            isInLaw={false}
            isExternal={node.member.primaryFamily && node.member.primaryFamily !== currentFamilyId}
            onFocus={handleFocusMember}
            onViewPerspective={handleViewPerspective}
            isHighlighted={viewAsMemberId === node.member.id}
            isTraditional={isTraditional}
            canEdit={canEdit}
            orientation={cardOrientation}
          />
          {node.spouses && node.spouses.length > 0 && node.spouses.map(spouse => {
            const divorced = isDivorced(node.member.id, spouse.id);
            return (
              <div key={spouse.id} style={{ position: 'relative' }}>
                <FamilyMember 
                  id={spouse.id}
                  member={spouse} 
                  onEdit={setEditingMember}
                  onAddRelative={handleAddRelative}
                  isInLaw={true}
                  isExternal={spouse.primaryFamily && spouse.primaryFamily !== currentFamilyId}
                  onFocus={handleFocusMember}
                  onViewPerspective={handleViewPerspective}
                  isHighlighted={viewAsMemberId === spouse.id}
                  isTraditional={isTraditional}
                  canEdit={canEdit}
                  orientation={cardOrientation}
                />
                {divorced && (
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    right: '-10px',
                    backgroundColor: '#fee2e2',
                    color: '#ef4444',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    border: '1px solid #fca5a5',
                    zIndex: 20,
                    pointerEvents: 'none'
                  }}>
                    離
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {node.children && node.children.length > 0 && (
          <ul style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            listStyle: 'none', 
            padding: '40px 0 0 0', 
            margin: 0,
            gap: cardOrientation === 'horizontal' ? '40px' : '10px'
          }}>
            {node.children.map(childNode => (
              <li key={childNode.member.id} style={{ padding: '0 10px' }}>
                {renderTreeNode(childNode)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  const forest = useMemo(() => buildTree(), [family, currentFamilyId, viewAsMemberId, cardOrientation]);

  // 🚀 連線渲染優化：手動計算 SVG 坐標而非使用 Xarrow
  const treeContainerRef = useRef(null);
  const [linePaths, setLinePaths] = useState([]);

  const calculateLines = () => {
    if (!treeContainerRef.current || activeTab !== 'graph' || family.length === 0) return;

    const containerRect = treeContainerRef.current.getBoundingClientRect();
    const paths = [];
    const processed = new Set();
    const currentFamilyMembers = getCurrentFamilyMembers();
    
    const getAllVisibleMemberIds = (nodes) => {
      const ids = new Set();
      nodes.forEach(node => {
        ids.add(node.member.id);
        node.spouses.forEach(s => ids.add(s.id));
        node.children.forEach(c => getAllVisibleMemberIds([c]).forEach(id => ids.add(id)));
      });
      return ids;
    };
    const visibleMemberIds = getAllVisibleMemberIds(forest);

    // 輔助函數：獲取元素相對於容器中心的坐標
    const getPos = (id, anchor = 'center') => {
      const el = document.getElementById(id);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const x = rect.left - containerRect.left;
      const y = rect.top - containerRect.top;
      
      if (anchor === 'bottom') return { x: x + rect.width / 2, y: y + rect.height };
      if (anchor === 'top') return { x: x + rect.width / 2, y: y };
      if (anchor === 'left') return { x: x, y: y + rect.height / 2 };
      if (anchor === 'right') return { x: x + rect.width, y: y + rect.height / 2 };
      if (anchor === 'spouse-left') return { x: x, y: y + 40 }; // 固定在頭像高度
      if (anchor === 'spouse-right') return { x: x + rect.width, y: y + 40 };
      return { x: x + rect.width / 2, y: y + rect.height / 2 };
    };

    // 1. 父子連線 (直角佈局)
    family.forEach(member => {
      if (!visibleMemberIds.has(member.id) || !member.parents) return;
      member.parents.forEach(pid => {
        if (!visibleMemberIds.has(pid)) return;
        const start = getPos(pid, 'bottom');
        const end = getPos(member.id, 'top');
        if (start && end) {
          const midY = start.y + (end.y - start.y) / 2;
          // 生成直角路徑
          const d = `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
          paths.push({ d, color: '#cbd5e1', width: 1.5 });
        }
      });
    });

    // 2. 夫妻連線 (平滑曲線)
    family.forEach(member => {
      if (!visibleMemberIds.has(member.id) || !member.spouses) return;
      member.spouses.forEach(sid => {
        if (!visibleMemberIds.has(sid) || isDivorced(member.id, sid)) return;
        const key = [member.id, sid].sort().join('-');
        if (processed.has(key)) return;
        processed.add(key);

        const start = getPos(member.id, 'spouse-right');
        const end = getPos(sid, 'spouse-left');
        if (start && end) {
          const cpX1 = start.x + 20;
          const cpX2 = end.x - 20;
          const d = `M ${start.x} ${start.y} C ${cpX1} ${start.y}, ${cpX2} ${end.y}, ${end.x} ${end.y}`;
          paths.push({ d, color: '#e2e8f0', width: 2, dashed: true });
        }
      });
    });

    setLinePaths(paths);
  };

  // 監聽變動以重繪連線
  useLayoutEffect(() => {
    const timer = setTimeout(calculateLines, 100); // 略微延遲待 DOM 穩定
    window.addEventListener('resize', calculateLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculateLines);
    };
  }, [forest, activeTab, cardOrientation]);

  // 處理滾動重繪
  const handleScroll = (e) => {
    calculateLines();
  };

  return (
    <div className="family-tree-container" style={{ 
      minHeight: '100vh',
      backgroundColor: 'var(--bg-porcelain)',
      paddingTop: '20px'
    }}>
      {/* Background Decor */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: window.innerWidth < 768 ? '150px' : '400px',
        background: 'radial-gradient(circle at 10% 20%, rgba(79, 70, 229, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.05) 0%, transparent 40%)',
        pointerEvents: 'none',
        zIndex: 0
      }} />

      {/* Perspective Indicator */}
      <AnimatePresence>
        {viewAsMemberId && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            style={{
              position: 'fixed',
              bottom: window.innerWidth < 768 ? '20px' : '40px',
              left: window.innerWidth < 768 ? '15px' : '50%',
              right: window.innerWidth < 768 ? '15px' : 'auto',
              transform: window.innerWidth < 768 ? 'none' : 'translateX(-50%)',
              zIndex: 1010,
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              padding: window.innerWidth < 768 ? '10px 16px' : '10px 24px',
              borderRadius: 'var(--radius-full)',
              boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              fontSize: window.innerWidth < 768 ? '14px' : '15px',
              fontWeight: 600,
              border: '2px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(12px)',
              maxWidth: window.innerWidth < 768 ? 'calc(100% - 30px)' : '600px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <Layers size={window.innerWidth < 768 ? 16 : 18} style={{ flexShrink: 0 }} />
              <span style={{ 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis' 
              }}>
                {window.innerWidth < 768 ? `視角：${localStorage.getItem('currentViewMemberName')}` : `正在查看：${localStorage.getItem('currentViewMemberName')} 的家族視角`}
              </span>
            </div>
            <button
              onClick={handleResetPerspective}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                color: 'white',
                padding: '5px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.35)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
              }}
            >
              重置視角
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Controls */}
      <div style={{ 
        position: 'sticky', 
        top: window.innerWidth < 768 ? '60px' : '85px', 
        zIndex: 1000, 
        padding: window.innerWidth < 768 ? '5px 8px' : '10px 20px',
        display: 'flex',
        flexDirection: window.innerWidth < 768 ? 'row' : 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: window.innerWidth < 768 ? '6px' : '20px',
        backgroundColor: window.innerWidth < 768 ? 'rgba(249, 250, 251, 0.9)' : 'transparent',
        backdropFilter: window.innerWidth < 768 ? 'blur(10px)' : 'none'
      }}>
        {/* Tab Switcher */}
        <div className="glass-panel" style={{ 
          display: 'flex', 
          padding: '2px', 
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-md)',
          maxWidth: '100%',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          flex: window.innerWidth < 768 ? 1 : 'none'
        }}>
          {[
            { id: 'graph', label: '圖形樹', icon: LayoutGrid },
            { id: 'text', label: '族譜', icon: Book },
            { id: 'reminders', label: '提醒', icon: Bell },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative',
                padding: window.innerWidth < 768 ? '8px 16px' : '10px 24px',
                borderRadius: 'var(--radius-full)',
                background: 'transparent',
                color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-muted)',
                border: 'none',
                fontSize: window.innerWidth < 768 ? '13px' : '15px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'white',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: 'var(--shadow-sm)',
                    zIndex: -1
                  }}
                />
              )}
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orientation Toggle */}
        <div className="glass-panel" style={{ 
          display: 'flex',
          padding: '4px',
          borderRadius: 'var(--radius-full)',
          boxShadow: 'var(--shadow-md)'
        }}>
          <button
            onClick={() => setCardOrientation(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-full)',
              background: 'white',
              color: 'var(--text-main)',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            {cardOrientation === 'vertical' ? <CreditCard size={14} /> : <Layers size={14} />}
            模式：{cardOrientation === 'vertical' ? '豎向緊湊' : '橫向專業'}
          </button>
        </div>

        {/* ✨ Context Help for Tree */}
        <div style={{ marginLeft: 'auto' }}>
          <HelpLink section="tree-navigation" showText={window.innerWidth >= 1024} />
        </div>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '20px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '100px' }}>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              style={{ display: 'inline-block' }}
            >
              <RotateCcw size={32} color="var(--primary-color)" />
            </motion.div>
            <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>尋根溯源中...</p>
          </div>
        )}

        {error && (
          <div style={{ maxWidth: '400px', margin: '40px auto', padding: '20px', borderRadius: 'var(--radius-md)', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {/* Graph Tab */}
        {!loading && !error && family.length > 0 && activeTab === 'graph' && (
          <div 
            onScroll={handleScroll}
            style={{ 
            backgroundColor: 'white', 
            borderRadius: 'var(--radius-lg)', 
            padding: '40px',
            boxShadow: 'var(--shadow-md)',
            minHeight: '600px',
            overflow: 'auto',
            border: '1px solid #f3f4f6',
            position: 'relative'
          }}>
            <div 
              ref={treeContainerRef}
              className="tree" 
              style={{ 
                display: 'inline-flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                minWidth: '100%',
                padding: '40px',
                position: 'relative'
              }}
            >
              {/* ✨ SVG 連線圖層 */}
              <svg 
                style={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  width: '100%', 
                  height: '100%', 
                  pointerEvents: 'none',
                  zIndex: 0
                }}
              >
                {linePaths.map((path, idx) => (
                  <path
                    key={idx}
                    d={path.d}
                    stroke={path.color}
                    strokeWidth={path.width}
                    strokeDasharray={path.dashed ? "4 4" : "none"}
                    fill="none"
                  />
                ))}
              </svg>

              <div style={{ margin: '0 auto', position: 'relative', zIndex: 1 }}>
                {forest.map(rootNode => renderTreeNode(rootNode))}
              </div>
            </div>
          </div>
        )}

        {/* Text Tab */}
        {!loading && !error && family.length > 0 && activeTab === 'text' && (
          <PrintableFamilyBook 
            family={family} 
            roots={forest} 
            isTraditional={isTraditional} 
          />
        )}

        {/* Reminders Tab */}
        {!loading && !error && family.length > 0 && activeTab === 'reminders' && (
          <RemindersPanel 
            family={family} 
            viewAsMemberId={viewAsMemberId} 
            isTraditional={isTraditional} 
            user={user}
          />
        )}

        {/* Empty State */}
        {!loading && !error && family.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>暫無族譜數據，請先導入CSV文件</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {editingMember && (
        <EditMemberPanel
          member={editingMember}
          allMembers={family}
          onSave={handleUpdateMember}
          onDelete={handleDeleteMember}
          onCancel={() => setEditingMember(null)}
          currentFamilyId={currentFamilyId}
        />
      )}

      {showAddModal && (
        <AddMemberModal
          allMembers={family}
          onSave={handleAddMemberFromModal}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {showCreateFamilyModal && pendingBaseMember && (
        <CreateFamilyModal
          memberName={pendingBaseMember.name}
          familyName={newFamilyName}
          setFamilyName={setNewFamilyName}
          surname={newFamilySurname}
          setSurname={setNewFamilySurname}
          ancestralHome={newFamilyAncestralHome}
          setAncestralHome={setNewFamilyAncestralHome}
          hallName={newFamilyHallName}
          setHallName={setNewFamilyHallName}
          onSubmit={handleCreateFamilyAndContinue}
          onCancel={() => {
            setShowCreateFamilyModal(false);
            setPendingBaseMember(null);
            setPendingRelativeType(null);
          }}
        />
      )}

      {showAddRelativeModal && baseMember && (
        <AddRelativeModal
          baseMember={baseMember}
          relativeType={relativeType}
          allMembers={family}
          onSave={handleSaveRelative}
          onCancel={() => {
            setShowAddRelativeModal(false);
            setBaseMember(null);
            setRelativeType(null);
          }}
        />
      )}
    </div>
  );
};

export default FamilyTree;