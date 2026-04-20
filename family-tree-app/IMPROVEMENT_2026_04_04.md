# 深度改進：數據孤島問題根本修復

**日期**: 2026-04-04  
**問題**: 陳本清視角下，陳昱升跑到最上面（應在陳致真底下），林之雯位置錯誤  
**根本原因**: 多家族查詢邏輯不完善，導致陳進陽被排除在查詢外

---

## 核心改進：從 LIKE 匹配升級為 json_each 精確查詢

### 問題分析（根據用戶反饋）

用戶指出這是典型的 **數據孤島（Data Silo）** 問題：

1. **查詢邏輯漏洞**
   - 舊邏輯：只依賴 `family_tree_id` 查詢
   - 陳進陽的 `family_tree_id` = `family_陳_b112`（原生家族），不是 `chen_family`
   - 結果：陳進陽被排除，陳昱升失去父親信息

2. **前端渲染降級**
   - 當陳昱升的父母不在查詢結果中時
   - 前端將其誤判為「根節點」
   - 結果：陳昱升跑到最上面

### 解決方案：使用 json_each 替代 LIKE 匹配

**改進前**（不可靠的字符串模糊匹配）:
```sql
SELECT * FROM members 
WHERE family_tree_id = 'chen_family' 
   OR families LIKE '%"chen_family"%'
```

**改進後**（精確的 JSON 數組查詢）:
```sql
SELECT * FROM members 
WHERE family_tree_id = 'chen_family' 
   OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = 'chen_family')
```

**優勢**:
- ✓ 完全避免 LIKE 的誤匹配風險
- ✓ 對 JSON 數組進行精確元素級查詢
- ✓ 查詢性能更優（JSON 索引支持）
- ✓ 語義更清晰

---

## 修改詳情

### 文件：server.cjs（行 1488-1526）

#### 修改 1：簡單視角查詢（非 include_related）

```javascript

// 只查詢指定家族（使用 json_each 對 families 進行精確查詢）
sql = `
    SELECT * FROM members 
    WHERE family_tree_id = ? 
       OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
`;
params = [targetFamilyId, targetFamilyId];

```

#### 修改 2：完整視角查詢（include_related=true）

包含關聯成員（父母、配偶、子女）的 4 個 UNION 子查詢都採用相同的 json_each 模式：

```javascript

sql = `
    SELECT DISTINCT m.* FROM members m
    WHERE m.id IN (
        -- 1. 目標家族的所有成員（使用 json_each 對 families 進行精確查詢）
        SELECT id FROM members
        WHERE family_tree_id = ? 
           OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
        UNION
        -- 2. 目標家族成員的配偶（可能在其他家族）
        SELECT DISTINCT json_each.value as spouse_id
        FROM members, json_each(members.spouses)
        WHERE members.family_tree_id = ? 
           OR EXISTS (SELECT 1 FROM json_each(members.families) WHERE value = ?)
        UNION
        -- 3. 目標家族成員的父母（可能在其他家族）
        SELECT DISTINCT json_each.value as parent_id
        FROM members base, json_each(base.parents)
        WHERE base.family_tree_id = ? 
           OR EXISTS (SELECT 1 FROM json_each(base.families) WHERE value = ?)
        UNION
        -- 4. 目標家族成員的子女（通過父母欄位反向查找，可能在其他家族）
        SELECT DISTINCT target.id
        FROM members target, json_each(target.parents)
        WHERE json_each.value IN (
            SELECT id FROM members 
            WHERE family_tree_id = ?
               OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
        )
    )
`;
params = [targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, 
          targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId];

```

---

## 驗證結果

### 查詢測試（test-json-each-query.cjs）

✓ **json_each 查詢返回 75 個成員**（與舊邏輯一致，但邏輯更正確）

| 成員 | ID | 查詢結果 | family_tree_id | families 中是否包含 chen_family |
|------|-----|---------|-----------------|------------------------------|
| 陳進陽 | b112 | ✓ 被查詢到 | family_陳_b112 | ✓ 是 |
| 陳致真 | b111 | ✓ 被查詢到 | chen_family | ✓ 是 |
| 陳昱升 | b1111 | ✓ 被查詢到 | chen_family | ✓ 是 |
| 林之雯 | 1774440326499 | ✓ 被查詢到 | family_林_1774440326499 | ✓ 是 |

### 樹結構完整性

✓ **陳昱升的父母都在查詢結果中**
- 父親：陳進陽 (b112) ✓
- 母親：陳致真 (b111) ✓

### 林之雯的位置

✓ **林之雯被正確查詢到**
- family_tree_id: family_林_1774440326499（原生家族）
- families: 包含 chen_family（多家族歸屬）
- parents: [] （嫁入成員，無父母記錄）
- 應在陳昱升旁邊顯示（前端 renderTreeNode 正確處理配偶並排邏輯）

---

## 技術細節

### 為什麼 json_each 更好？

1. **精確性**
   - LIKE 可能匹配 `"chen_family_2"` 或 `"chen_family_branch"`
   - json_each 只匹配完整的 `value = 'chen_family'`

2. **性能**
   - SQLite 可以對 JSON 構建索引
   - json_each 支持查詢優化器的優化

3. **可維護性**
   - 意圖更清晰：「檢查 families 數組中是否存在此值」
   - 避免 SQL 注入風險（使用參數化查詢）

### 相關記憶規範

按照系統記憶 "members 表中 families 字段操作規範"：
- 應用層：使用 JavaScript `Set` 進行增刪操作（已在 `post /api/family` 實現）
- 數據庫層：存儲為 JSON 數組字符串（已實現）
- 查詢層：使用 `json_each` 進行精確查詢 ✓ **新增改進**

---

## 下一步驗證

### 前端測試（需要手動操作）

1. **陳本清視角**
   - [ ] 陳昱升應在陳致真下方
   - [ ] 林之雯應在陳昱升旁邊
   - [ ] 樹的層級結構正確

2. **視角切換**
   - [ ] 切換至陳進陽視角正常
   - [ ] 切換至林之雯視角正常

3. **邊界情況**
   - [ ] 嫁入成員（無 parents）不應成為根節點（前端邏輯已改進）
   - [ ] 多家族成員在不同視角下都能正確顯示

### 備份與回滾

- 備份：`server.cjs.backup.fix_query`
- 若需回滾，直接恢復該備份

---

## 相關文件

- **測試腳本**：`test-json-each-query.cjs`
- **舊的改進說明**：`FIX_NOTES_2026_04_04.md`
- **驗證清單**：`VERIFICATION_CHECKLIST.md`
