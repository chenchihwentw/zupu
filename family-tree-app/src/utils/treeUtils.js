/**
 * Tree Utility Functions
 * 家族樹相關的輔助函數
 */

/**
 * 檢查兩個成員是否已離婚
 * @param {Array} marriages - 婚姻記錄數組
 * @param {string} memberId1 - 成員1 ID
 * @param {string} memberId2 - 成員2 ID
 * @returns {boolean} - 是否已離婚
 */
export const isDivorced = (marriages, memberId1, memberId2) => {
  return marriages.some(m => 
    ((m.husband_id === memberId1 && m.wife_id === memberId2) ||
     (m.husband_id === memberId2 && m.wife_id === memberId1)) &&
    m.is_divorced === 1
  );
};

/**
 * 判斷成員是否為姻親（在當前家族中但非原生）
 * @param {Object} member - 成員對象
 * @param {string} currentFamilyId - 當前家族ID
 * @param {Array} family - 所有成員數組
 * @returns {boolean} - 是否為姻親
 */
export const isInLawMember = (member, currentFamilyId, family) => {
  const memberFamilyId = member.primaryFamily;
  
  // 如果成員屬於當前家族，不是姻親
  if (memberFamilyId === currentFamilyId) {
    return false;
  }
  
  // 檢查是否與當前家族成員有配偶關係
  const hasSpouseInCurrentFamily = member.spouses?.some(spouseId => {
    const spouse = family.find(m => m.id === spouseId);
    if (!spouse) return false;
    const spouseFamilyId = spouse.primaryFamily;
    return spouseFamilyId === currentFamilyId;
  });
  
  return hasSpouseInCurrentFamily;
};

/**
 * 獲取當前家族ID
 * @param {string} viewAsMemberId - 當前視角成員ID
 * @param {string} currentFamilyId - 當前家族ID
 * @param {Array} family - 所有成員數組
 * @returns {string} - 家族ID
 */
export const getCurrentFamilyId = (viewAsMemberId, currentFamilyId, family) => {
  if (!viewAsMemberId) return currentFamilyId;
  const viewMember = family.find(m => m.id === viewAsMemberId);
  if (!viewMember) return currentFamilyId;
  return viewMember.primaryFamily || currentFamilyId;
};

/**
 * 獲取當前家族成員列表
 * @param {Array} family - 所有成員數組
 * @param {string} currentFamilyId - 當前家族ID
 * @param {string} viewAsMemberId - 當前視角成員ID
 * @param {Array} marriages - 婚姻記錄數組
 * @returns {Array} - 當前家族成員列表
 */
export const getCurrentFamilyMembers = (family, currentFamilyId, viewAsMemberId, marriages) => {
  // 如果沒有指定視角，返回當前家族的成員
  if (!viewAsMemberId) {
    return family.filter(m => {
      const mFamilyId = m.primaryFamily;
      return mFamilyId === currentFamilyId;
    });
  }
  
  // 找到當前視角的成員
  const viewMember = family.find(m => m.id === viewAsMemberId);
  if (!viewMember) return family;
  
  // 獲取該成員的家族歸屬
  const memberFamilyId = viewMember.primaryFamily || 'default';
  
  // 獲取視角成員的父母和子女ID列表
  const viewMemberParents = viewMember.parents || [];
  const viewMemberChildren = family.filter(m => m.parents?.includes(viewMember.id)).map(m => m.id);
  const relatedIds = [...viewMemberParents, ...viewMemberChildren];
  
  // 返回同一家族的所有成員，以及與該家族成員有聯姻關係的成員
  return family.filter(m => {
    const mFamilyId = m.primaryFamily || 'default';
    
    // 同一家族的成員
    if (mFamilyId === memberFamilyId) return true;
    
    // 或者是視角成員的父母或子女
    if (relatedIds.includes(m.id)) return true;
    
    // 或者是姻親（配偶是當前家族成員，且未離婚）
    const hasSpouseInCurrentFamily = m.spouses?.some(spouseId => {
      const spouse = family.find(s => s.id === spouseId);
      if (!spouse) return false;
      const spouseFamilyId = spouse.primaryFamily || 'default';
      // 檢查是否已離婚
      if (isDivorced(marriages, m.id, spouseId)) {
        return false;
      }
      return spouseFamilyId === memberFamilyId;
    });
    
    return hasSpouseInCurrentFamily;
  });
};

/**
 * 構建家族樹
 * @param {Array} family - 所有成員數組
 * @param {Array} currentFamilyMembers - 當前家族成員列表
 * @param {string} currentFamilyId - 當前家族ID
 * @param {string} viewAsMemberId - 當前視角成員ID
 * @param {Array} marriages - 婚姻記錄數組
 * @returns {Array} - 家族樹森林（根節點數組）
 */
export const buildTree = (family, currentFamilyMembers, currentFamilyId, viewAsMemberId, marriages) => {
  const visited = new Set();
  const forest = [];

  const processNode = (memberId) => {
    if (visited.has(memberId)) return null;
    visited.add(memberId);
    
    // 優先從當前家族成員中查找
    let member = currentFamilyMembers.find(m => m.id === memberId);
    
    // 如果不在當前家族，但可能是姻親
    if (!member) {
      member = family.find(m => m.id === memberId);
      if (!member) return null;
    }

    const node = {
      member: member,
      spouses: [],
      children: []
    };

    // 處理配偶
    if (member.spouses && member.spouses.length > 0) {
      member.spouses.forEach(spouseId => {
        // 檢查是否已離婚
        if (isDivorced(marriages, member.id, spouseId)) {
          return;
        }
        if (!visited.has(spouseId)) {
          visited.add(spouseId);
          let spouse = currentFamilyMembers.find(m => m.id === spouseId);
          if (!spouse) {
            spouse = family.find(m => m.id === spouseId);
          }
          if (spouse) node.spouses.push(spouse);
        }
      });
    }

    // 查找子女
    const children = family.filter(m => {
      if (!m.parents || m.parents.length === 0) return false;
      return m.parents.includes(member.id);
    });
    
    // 按出生年份排序子女
    children.sort((a, b) => (a.birth_year || 0) - (b.birth_year || 0));

    children.forEach(child => {
      const childNode = processNode(child.id);
      if (childNode) node.children.push(childNode);
    });

    return node;
  };

  // 找到當前家族的根節點（排除姻親）
  const roots = currentFamilyMembers.filter(member => {
    // 姻親不能作為根節點
    if (isInLawMember(member, currentFamilyId, family)) return false;
    
    if (!member.parents || member.parents.length === 0) return true;
    
    // 檢查父母是否在当前家族中
    const hasParentInCurrentFamily = member.parents.some(pid => 
      currentFamilyMembers.some(m => m.id === pid)
    );
    
    return !hasParentInCurrentFamily;
  });

  // 如果指定了視角成員
  if (viewAsMemberId) {
    const viewMember = currentFamilyMembers.find(m => m.id === viewAsMemberId);
    if (viewMember) {
      const hasParentInCurrentFamily = viewMember.parents?.some(pid => 
        currentFamilyMembers.some(m => m.id === pid)
      );
      
      if (!hasParentInCurrentFamily) {
        const node = processNode(viewMember.id);
        if (node) forest.push(node);
      } else {
        roots.forEach(root => {
          const node = processNode(root.id);
          if (node) forest.push(node);
        });
      }
    }
  } else {
    roots.sort((a, b) => (a.birth_year || 0) - (b.birth_year || 0));
    roots.forEach(root => {
      const node = processNode(root.id);
      if (node) forest.push(node);
    });
  }

  return forest;
};
