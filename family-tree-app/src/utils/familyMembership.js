/**
 * Family Membership Management Utilities
 * 多家族歸屬管理工具
 */

/**
 * 當創建子女時，自動將子女添加到父母的家族
 * @param {Object} child - 新創建的子女
 * @param {Array} parents - 父母成員數組
 * @returns {Object} - 更新後的子女對象
 */
export const inheritFamilyFromParents = (child, parents) => {
  const updatedChild = { ...child };
  const families = new Set(child.families || []);
  
  parents.forEach(parent => {
    if (parent.primaryFamily) {
      families.add(parent.primaryFamily);
    }
    if (parent.families) {
      try {
        const parentFamilies = JSON.parse(parent.families);
        parentFamilies.forEach(fid => families.add(fid));
      } catch (e) {}
    }
  });
  
  updatedChild.families = Array.from(families);
  // 設置主要家族為第一個父母的家族
  if (!updatedChild.primaryFamily && parents.length > 0) {
    updatedChild.primaryFamily = parents[0].primaryFamily;
  }
  
  return updatedChild;
};

/**
 * 當結婚時，將雙方添加到對方的家族
 * @param {Object} member1 - 成員1
 * @param {Object} member2 - 成員2
 * @returns {Array} - [更新後的成員1, 更新後的成員2]
 */
export const addSpouseFamily = (member1, member2) => {
  const updated1 = { ...member1 };
  const updated2 = { ...member2 };
  
  const families1 = new Set(updated1.families || []);
  const families2 = new Set(updated2.families || []);
  
  // 互相添加對方的家族
  if (updated2.primaryFamily) {
    families1.add(updated2.primaryFamily);
  }
  if (updated1.primaryFamily) {
    families2.add(updated1.primaryFamily);
  }
  
  updated1.families = Array.from(families1);
  updated2.families = Array.from(families2);
  
  return [updated1, updated2];
};

/**
 * 當離婚時，可選移除對方家族
 * @param {Object} member - 當事人
 * @param {Object} exSpouse - 前配偶
 * @param {boolean} removeFamily - 是否移除家族歸屬
 * @returns {Object} - 更新後的成員
 */
export const removeSpouseFamily = (member, exSpouse, removeFamily = false) => {
  if (!removeFamily) return member;
  
  const updated = { ...member };
  const families = new Set(updated.families || []);
  
  // 移除前配偶的家族
  if (exSpouse.primaryFamily) {
    families.delete(exSpouse.primaryFamily);
  }
  
  updated.families = Array.from(families);
  return updated;
};

/**
 * 獲取成員的所有家族ID（包括 family_tree_id 和 families 數組）
 * @param {Object} member - 成員對象
 * @returns {Array} - 所有家族ID數組
 */
export const getAllFamilyIds = (member) => {
  const families = new Set();
  
  if (member.primaryFamily) {
    families.add(member.primaryFamily);
  }
  if (member.families) {
    try {
      const familyArray = typeof member.families === 'string' 
        ? JSON.parse(member.families) 
        : member.families;
      familyArray.forEach(fid => families.add(fid));
    } catch (e) {}
  }
  
  return Array.from(families);
};

/**
 * SQL 查詢：根據家族ID列表獲取所有相關成員
 * @param {Array} familyIds - 家族ID數組
 * @returns {string} - SQL 查詢語句
 */
export const buildFamilyQuery = (familyIds) => {
  if (!familyIds || familyIds.length === 0) {
    return "SELECT * FROM members WHERE 1=0"; // 返回空結果
  }
  
  const placeholders = familyIds.map(() => '?').join(',');
  return `
    SELECT DISTINCT m.* FROM members m
    WHERE m.primaryFamily IN (${placeholders})
    OR EXISTS (
      SELECT 1 FROM json_each(m.families) 
      WHERE json_each.value IN (${placeholders})
    )
  `;
};
