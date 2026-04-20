# 族譜系統架構完整分析

## 一、數據庫表關係圖

### 核心表結構

```
┌─────────────────────────────────────────────────────────────┐
│ family_trees (家族定義表)                                    │
│ ─────────────────────────────────────────────────────────── │
│ PK: id (TEXT)         - 家族唯一標識 e.g. 李_family_xxx     │
│    name (TEXT)        - 家族名稱 (NOT NULL)                 │
│    surname (TEXT)     - 姓氏                                 │
│    ancestral_home     - 祖籍                                 │
│    hall_name          - 堂號                                 │
│    description        - 描述                                 │
└──────────────────────────┬────────────────────────────────────┘
                           │ references via family_tree_id
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ members (成員表) - 核心表，用JSON存儲關係                     │
│ ─────────────────────────────────────────────────────────── │
│ PK: id (TEXT)                                               │
│                                                              │
│ 【家族歸屬字段】                                              │
│    family_tree_id (TEXT)    - 成員的原生家族 [必填]          │
│    family_id (TEXT)         - 等同於 primaryFamily           │
│    primaryFamily (TEXT)     - 主要家族                       │
│    families (TEXT-JSON)     - 所有家族ID數組                 │
│                                                              │
│ 【血緣字段】                                                  │
│    father_id (TEXT)         - 父親ID (外鍵)                  │
│    mother_id (TEXT)         - 母親ID (外鍵)                  │
│    spouses (TEXT-JSON)      - 配偶ID數組 [JSON]             │
│    children (TEXT-JSON)     - 子女ID數組 [JSON]             │
│    parents (TEXT-JSON)      - 父母ID數組 [JSON]             │
│                                                              │
│ 【其他字段】                                                  │
│    name, gender, birth_date, death_date, ...                │
│    user_id (TEXT)           - 綁定的用戶 (外鍵)              │
└──────────────┬──────────────────────┬────────────────────────┘
               │                      │
               │ spouses JSON引用     │ marriages/member_spouses使用
               ↓                      ↓
┌──────────────────────────────┐  ┌────────────────────────────┐
│ marriages (婚姻登記表)        │  │ member_spouses (配偶關係表)│
│ ──────────────────────────── │  │ ──────────────────────────│
│ PK: id (TEXT)                │  │ PK: id (TEXT)            │
│    husband_id (TEXT)         │  │    member_id (TEXT) NN   │
│    wife_id (TEXT)            │  │    spouse_member_id NN   │
│    marriage_date (TEXT)      │  │    is_current (INT)      │
│    is_divorced (INT)         │  │    divorce_date (TEXT)   │
│    divorce_date (TEXT)       │  │    created_at (TEXT)     │
└──────────────────────────────┘  └────────────────────────────┘

┌──────────────────────────────┐  ┌────────────────────────────┐
│ users (用戶表)                │  │user_family_trees (授權表) │
│ ──────────────────────────── │  │ ──────────────────────────│
│ PK: id (TEXT)                │  │ PK: user_id + family_... │
│    username (TEXT) NN        │  │    user_id (TEXT)        │
│    email (TEXT)              │  │    family_tree_id (TEXT) │
│    linkedMemberId (TEXT)     │  │    role (TEXT)           │
│    password_hash             │  │    joined_at (TEXT)      │
└──────────────────────────────┘  └────────────────────────────┘
```

## 二、親屬操作完整流程分析

### 2.1 添加父親 (relativeType === 'parent')

#### 前端邏輯 (FamilyTree.jsx: 248-283)

**當前實現（❌ 有問題）:**
```
Step 1: 生成新family_id
  newFamilyId = `family_${baseMember.id}_${Date.now()}`
  ❌ 這是臨時ID，不在family_trees表中

Step 2: POST /api/family
  POST {
    id: newMemberId,
    name: fatherName,
    gender: 'male',
    primaryFamily: newFamilyId,      ❌ 臨時ID
    family_id: newFamilyId,           ❌ 臨時ID
    families: [newFamilyId],          ❌ 臨時ID
    family_tree_id: null              ❌ 缺失！
  }

Step 3: PUT /api/family/{baseMemberId}
  PUT {
    parents: [..., fatherId],
    primaryFamily: newFamilyId,       ❌ 改變了子女的原生家族！
    family_id: newFamilyId,           ❌ 改變了子女的原生家族！
    families: [newFamilyId]           ❌ 破壞了families繼承鏈！
  }
```

**正確實現應該是:**
```
Step 1: 使用子女的原生家族
  parentFamilyId = baseMember.family_tree_id  ✅ 使用子女的家族

Step 2: POST /api/family
  POST {
    id: newMemberId,
    name: fatherName,
    family_tree_id: parentFamilyId,          ✅ 歸屬子女的家族
    primaryFamily: parentFamilyId,           ✅
    family_id: parentFamilyId,               ✅
    families: [parentFamilyId],              ✅
  }

Step 3: PUT /api/family/{baseMemberId}
  PUT {
    father_id: fatherId,                    ✅ 添加此字段
    parents: [..., fatherId],
    # 【重要】不改變原成員的家族歸屬
    # primaryFamily/family_id/families 保持不變
  }
```

---

### 2.2 添加兄弟姐妹 (relativeType === 'sibling')

#### 前端邏輯 (FamilyTree.jsx: 256-260)

**當前實現:**
```javascript
memberWithFamily.primaryFamily = baseMember?.primaryFamily;
memberWithFamily.family_id = baseMember?.family_id;
memberWithFamily.families = [baseMember?.primaryFamily];
❌ 缺少 family_tree_id！
```

**正確實現應該是:**
```javascript
memberWithFamily.family_tree_id = baseMember?.family_tree_id;  ✅ 添加
memberWithFamily.primaryFamily = baseMember?.primaryFamily;
memberWithFamily.family_id = baseMember?.family_id;
memberWithFamily.families = baseMember?.families;  ✅ 繼承整個數組，不只是primaryFamily
```

---

### 2.3 添加配偶 (relativeType === 'spouse')

#### 前端邏輯 (FamilyTree.jsx: 261-266)

**當前實現（❌ 嚴重缺陷）:**
```javascript
// Step 1: 生成臨時spouse family_id
const spouseFamilyId = `family_spouse_${newMember.id}_${Date.now()}`;
memberWithFamily.primaryFamily = spouseFamilyId;      ❌
memberWithFamily.family_id = spouseFamilyId;          ❌
memberWithFamily.families = [spouseFamilyId];         ❌
// ❌ 缺少 family_tree_id（配偶自己的原生家族）

// Step 2: POST /api/family 創建新配偶
await axios.post('/api/family', memberWithFamily);

// Step 3: PUT /api/family/{baseMemberId} 更新原成員
updatedBaseMember.spouses = [..., newSpouse.id];
await axios.put(`/api/family/${baseMember.id}`, updatedBaseMember);

// ❌ 缺失：沒有在 marriages 表中創建婚姻記錄
// ❌ 缺失：沒有在 member_spouses 表中創建配偶關係
// ❌ 缺失：沒有互相添加 families
```

**正確實現應該是:**
```
Step 1: 確定配偶的原生家族ID
  因為系統無法自動判斷，應該：
  - 選項A：要求用戶輸入配偶的原生家族ID
  - 選項B：為配偶創建新的family_tree_id（需在family_trees中創建記錄）
  
  暫時採用選項B的簡化方案：
  spouseNativeFamilyId = `family_${newMember.id}_native`

Step 2: POST /api/family 創建配偶
  POST {
    id: newSpouseId,
    family_tree_id: spouseNativeFamilyId,            ✅ 配偶的原生家族
    primaryFamily: spouseNativeFamilyId,             ✅
    family_id: spouseNativeFamilyId,                 ✅
    families: [spouseNativeFamilyId, baseMember.family_tree_id],  ✅ 雙家族
  }
  
  【同時】創建或確保 family_trees 記錄存在

Step 3: POST /api/marriages 創建婚姻記錄  ✅ 新增
  POST {
    husband_id: baseMember.id (假設baseMember是男性),
    wife_id: newSpouse.id,
    marriage_date: today
  }

Step 4: POST /api/member-spouses 創建配偶關係  ✅ 新增
  POST {
    member_id: baseMember.id,
    spouse_member_id: newSpouse.id,
    is_current: 1
  }
  POST {
    member_id: newSpouse.id,
    spouse_member_id: baseMember.id,
    is_current: 1
  }

Step 5: PUT /api/family/{baseMemberId} 更新原成員
  PUT {
    spouses: [newSpouse.id],
    families: Array.from(new Set([
      ...baseMember.families,
      spouseNativeFamilyId
    ]))  ✅ 添加配偶的原生家族
  }

Step 6: PUT /api/family/{newSpouseId} 確保配偶正確
  PUT {
    spouses: [baseMember.id]
  }
```

---

## 三、後端API分析

### 3.1 POST /api/family (Line 1500-1581)

**功能:** 創建新成員

**接收的字段:**
```javascript
{
  id, family_tree_id, name, gender, 
  spouses, children, parents,
  family_id, primaryFamily, families,
  ... (其他30+個字段)
}
```

**當前問題:**
1. **硬編碼默認值 (Line 1520, 1561-1562):** ✅ 已修復
   ```javascript
   // 修改前（錯誤）
   finalFamilies.push(family_tree_id || 'chen_family');
   family_id: family_tree_id || 'chen_family',
   primaryFamily: family_tree_id || 'chen_family',
   
   // 修改後（正確）
   finalFamilies.push(family_tree_id);  // 不再使用硬編碼 'chen_family'
   family_id: family_id || family_tree_id,
   primaryFamily: primaryFamily || family_tree_id,
   ```
   ✅ 現在會驗證 family_tree_id 非空，而不是賦默認值

2. **沒有驗證 family_tree_id (Line 1527):**
   ```javascript
   const params = [
     family_tree_id,  ❌ 可以是 null
     ...
   ];
   ```

3. **没有检查 family_tree_id 是否在 family_trees 表中:**
   ```javascript
   // 缺失此檢查
   SELECT COUNT(*) FROM family_trees WHERE id = ?
   ```

4. **自動呼叫 inheritFamiliesFromRelatives (Line 1513):**
   ```javascript
   await inheritFamiliesFromRelatives(db, parents, spouses, inheritedFamilies);
   ```
   ✅ 這是好的，但需要驗證

### 3.2 PUT /api/family/{id} (Line 1628-1729)

**功能:** 更新成員

**當前問題:**
1. **使用 COALESCE 只更新提供的字段:**
   ```javascript
   family_tree_id = COALESCE(?,family_tree_id),
   ```
   ✅ 這是好的，避免了NULL覆蓋

2. **沒有級聯更新:**
   ```javascript
   // 缺失此邏輯
   // 如果某成員的 family_tree_id 被更新，其所有子女的 families 應被更新
   ```

3. **沒有同步 marriages/member_spouses:**
   ```javascript
   // 缺失此邏輯
   // 如果 spouses 被更新，應同步更新 marriages/member_spouses 表
   ```

### 3.3 GET /api/marriages (Line 1748-1758)

**功能:** 獲取所有婚姻記錄

**當前狀態:** ✅ 可正常工作，但前端很少使用

### 3.4 POST /api/marriages/divorce (Line 1761-1876)

**功能:** 處理離婚

**流程:**
1. 更新 member_spouses 表（設置 is_current=0, divorce_date）
2. 更新 marriages 表（設置 is_divorced=1）
3. 清除已嫁入成員的 family_tree_id

**當前狀態:** ✅ 邏輯完整

---

## 四、核心缺陷清單

| # | 缺陷 | 影響 | 嚴重度 |
|---|------|------|--------|
| 1 | 添加父親時生成臨時family_id，不在family_trees中 | 父親孤立無法顯示 | 🔴 極高 |
| 2 | 添加父親後改變子女的primaryFamily | 破壞子女的家族歸屬 | 🔴 極高 |
| 3 | 添加兄弟姐妹時缺少family_tree_id | 兄弟姐妹無法正常查詢 | 🟠 中等 |
| 4 | 添加配偶時生成臨時family_id | 配偶孤立無法顯示 | 🔴 極高 |
| 5 | marriages/member_spouses表被忽視 | 無法記錄婚姻狀態 | 🔴 極高 |
| 6 | 沒有驗證family_tree_id非空 | 數據污染 | 🟠 中等 |
| 7 | 沒有檢查family_tree_id在family_trees中存在 | 孤立成員 | 🟠 中等 |
| 8 | 級聯更新缺失 | 成員families不一致 | 🟠 中等 |
| 9 | 硬編碼默認值'chen_family' | 影響非陳姓家族 | 🟠 中等 |

---

## 五、修復方案設計規範

### 5.1 添加父親時的規範

**前端應該做的:**
1. ✅ 獲取 baseMember.family_tree_id
2. ✅ 使用此ID作為父親的 family_tree_id
3. ✅ 不改變 baseMember 的 primaryFamily/family_id/families
4. ✅ 設置 baseMember.father_id
5. ✅ 設置 newParent.father_id = 父親ID (如果有對象可更新)

**後端應該做的:**
1. ✅ 驗證 family_tree_id 非空
2. ✅ 驗證 family_tree_id 在 family_trees 表中存在
3. ✅ INSERT 新成員到 members 表

**調用順序:**
```
1. POST /api/family (創建新父親)
2. PUT /api/family/{baseMemberId} (設置baseMember.father_id)
3. [可選] PUT /api/family/{fatherId} (設置父親的children字段)
```

### 5.2 添加配偶時的規範

**前端應該做的:**
1. ✅ 為配偶創建 family_tree_id
2. ✅ POST /api/family-trees (創建配偶的家族記錄)
3. ✅ POST /api/family (創建配偶成員)
4. ✅ POST /api/marriages (創建婚姻記錄)
5. ✅ POST /api/member-spouses 雙向 (創建配偶關係)
6. ✅ PUT /api/family/{baseMemberId} (更新spouses和families)
7. ✅ PUT /api/family/{spouseId} (確保配偶正確)

**後端應該做的:**
1. ✅ POST /api/family-trees - 創建新家族
2. ✅ POST /api/family - 驗證並創建配偶
3. ✅ POST /api/marriages - 創建婚姻記錄
4. ✅ POST /api/member-spouses - 創建雙向配偶關係
5. ✅ PUT /api/family/{id} - 級聯更新families

**調用順序:**
```
1. POST /api/family-trees (創建配偶的原生家族)
2. POST /api/family (創建配偶成員)
3. POST /api/marriages (創建婚姻記錄)
4. POST /api/member-spouses (雙向，2次調用)
5. PUT /api/family/{baseMemberId} (更新spouses和families)
6. PUT /api/family/{spouseId} (確保正確)
```

### 5.3 添加兄弟姐妹時的規範

**前端應該做的:**
1. ✅ 繼承 baseMember.family_tree_id
2. ✅ 繼承 baseMember.primaryFamily
3. ✅ 繼承 baseMember.family_id
4. ✅ 繼承 baseMember.families (整個數組)

**後端應該做的:**
1. ✅ 驗證 family_tree_id 非空
2. ✅ 驗證 family_tree_id 在 family_trees 表中存在

---

## 六、修復優先級

### Phase 1: 緊急修復
- [ ] 修復添加父親邏輯（影響李萬成無法顯示）
- [ ] 後端驗證 family_tree_id 非空且有效

### Phase 2: 重要修復
- [ ] 修復添加配偶邏輯（需新增marriages/member_spouses API）
- [ ] 級聯更新機制

### Phase 3: 完善修復
- [ ] 修復添加兄弟姐妹邏輯
- [ ] 移除硬編碼默認值

### Phase 4: 優化
- [ ] 前端需要新的 POST /api/family-trees API
- [ ] 前端需要新的 POST /api/member-spouses API

---

## 七、相關代碼行號參考

### 前端 (FamilyTree.jsx)
- 線243-323: `handleSaveRelative` 函數
  - 線248-255: 添加父親邏輯 ❌
  - 線256-260: 添加兄弟姐妹邏輯 ❌
  - 線261-266: 添加配偶邏輯 ❌
  - 線276-283: 更新原成員邏輯 ❌

### 後端 (server.cjs)
- 線1500-1581: `POST /api/family` 
  - 線1520, 1561-1562: 硬編碼默認值 ❌
  - 線1527: 沒有驗證 family_tree_id ❌
- 線1628-1729: `PUT /api/family/{id}`
  - 缺少級聯更新 ❌
- 線1748-1758: `GET /api/marriages` ✅
- 線1761-1876: `POST /api/marriages/divorce` ✅

---

## 八、數據示例

### 李聯旺當前狀態（錯誤）
```json
{
  "id": "1775529335979",
  "name": "李聯旺",
  "father_id": null,                           ❌ 應該 = 1775530689351
  "family_tree_id": "李_family_1775525022539", ✅
  "primaryFamily": "family_1775529335979_1775530689351",  ❌ 應該 = 李_family_1775525022539
  "family_id": "family_1775529335979_1775530689351",      ❌ 應該 = 李_family_1775525022539
  "families": ["family_1775529335979_1775530689351"]      ❌ 應該 = ["李_family_1775525022539"]
}
```

### 李萬成當前狀態（錯誤）
```json
{
  "id": "1775530689351",
  "name": "李萬成",
  "family_tree_id": null,                      ❌ 應該 = 李_family_1775525022539
  "primaryFamily": "family_1775529335979_1775530689351",  ❌ 應該 = 李_family_1775525022539
  "family_id": "family_1775529335979_1775530689351",      ❌ 應該 = 李_family_1775525022539
  "families": ["family_1775529335979_1775530689351"]      ❌ 應該 = ["李_family_1775525022539"]
}
```

### 正確狀態應該是
```json
李聯旺:
{
  "id": "1775529335979",
  "name": "李聯旺",
  "father_id": "1775530689351",                ✅
  "family_tree_id": "李_family_1775525022539", ✅
  "primaryFamily": "李_family_1775525022539",  ✅
  "family_id": "李_family_1775525022539",      ✅
  "families": ["李_family_1775525022539"]      ✅
}

李萬成:
{
  "id": "1775530689351",
  "name": "李萬成",
  "family_tree_id": "李_family_1775525022539", ✅
  "primaryFamily": "李_family_1775525022539",  ✅
  "family_id": "李_family_1775525022539",      ✅
  "families": ["李_family_1775525022539"],     ✅
  "children": ["1775529335979"]                ✅
}
```

---

**文檔版本:** v1.0  
**最後更新:** 2026-04-04  
**狀態:** Phase 1 架構分析完成 → 等待 Phase 2 修復確認
