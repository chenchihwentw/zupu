# 家族樹應用 - 多家族歸屬架構設計文檔

## 技術棧

| 層級 | 技術 | 說明 |
|------|------|------|
| 前端 | React 18 | 使用 Vite 構建工具 |
| 前端路由 | React Router | 單頁應用路由管理 |
| 後端 | Node.js 20 | 運行環境 |
| 後端框架 | Express.js | RESTful API 框架 |
| 數據庫 | SQLite3 | 本地文件數據庫 |
| 數據庫驅動 | sqlite3 (npm) | Node.js SQLite 驅動 |
| 認證 | JWT | JSON Web Token 用戶認證 |
| 構建工具 | Vite | 前端開發服務與打包 |

## 一、項目目的

建立一個支持多家族歸屬的家族樹系統，解決傳統家譜中「嫁入/入贅」後家族歸屬的問題。允許每個人同時屬於多個家族（原生家族 + 姻親家族），並能從不同視角查看家族關係。

## 二、核心問題與解決方案

### 2.1 傳統家譜的問題
- 女性嫁入後，在原家族中「消失」
- 無法同時展示一個人在多個家族中的關係
- 第三代（外孫/外孫女）無法正確顯示

### 2.2 解決方案 - 多家族歸屬
- 每個人可同時屬於多個家族
- 通過 `families` 數組記錄所有家族歸屬
- 查詢時根據家族ID匹配所有相關成員

## 三、數據模型

### 3.1 members 表結構

| 字段 | 類型 | 說明 |
|------|------|------|
| id | TEXT | 成員唯一標識 |
| name | TEXT | 姓名 |
| family_tree_id | TEXT | **主要家族ID**（原生家庭） |
| families | JSON | **所有歸屬家族數組** [家族A, 家族B, ...] |
| parents | JSON | 父母ID數組 |
| spouses | JSON | 配偶ID數組 |
| children | JSON | 子女ID數組（可選，可通過parents反查） |

### 3.2 數據示例

| 成員 | family_tree_id | families | parents | spouses | 歸屬說明 |
|------|---------------|----------|---------|---------|---------|
| 李瑞春 | 李家 | [李家, 陳家] | [父, 母] | [陳本清] | 原生李家，嫁入陳家 |
| 陳致彣 | 陳家 | [陳家, 李家, 孫家] | [陳本清, 李瑞春] | [孫亞男] | 原生陳家，母親李家，妻子孫家 |
| 陳恩 | 陳家 | [陳家, 李家, 孫家] | [陳致彣, 孫亞男] | [] | 原生陳家，祖母李家，母親孫家 |
| 孫亞男 | 孫家 | [孫家, 陳家] | [父, 母] | [陳致彣] | 原生孫家，嫁入陳家 |

## 四、家族歸屬規則

### 4.1 歸屬來源

| 類型 | 規則 | 示例 |
|------|------|------|
| **原生歸屬** | 出生時繼承父親的 family_tree_id | 陳致彣出生時 family_tree_id = 陳家 |
| **母系繼承** | 同時繼承母親的 families 數組 | 陳致彣的 families 包含母親李瑞春的家族 |
| **婚姻歸屬** | 結婚後互相添加對方家族到 families | 陳致彣與孫亞男結婚後，雙方 families 添加對方家族 |
| **子女繼承** | 子女繼承父母雙方的 families | 陳恩的 families = [陳家, 李家, 孫家] |

### 4.2 families 數組維護時機

1. **創建成員時**：繼承父母的 families + 設置自己的 family_tree_id
2. **結婚時**：雙方互相添加對方家族到 families
3. **創建新家族時**：創始人設置 family_tree_id 為新家族

## 五、Tree 展示邏輯

### 5.1 視角切換

**核心原則：用戶可以切換到任意成員的視角，查看該成員的「主要家族」**

```
用戶操作：點擊「切換到李瑞春視角」
系統處理：
1. 獲取李瑞春的 family_tree_id = 李家
2. 查詢所有 families 包含「李家」的成員
3. 渲染家族樹
```

### 5.2 查詢 SQL

```sql
-- 查詢「李家」的所有成員
SELECT DISTINCT m.* FROM members m
WHERE m.family_tree_id = '李家'
   OR EXISTS (
       SELECT 1 FROM json_each(m.families) 
       WHERE json_each.value = '李家'
   )
```

### 5.3 Tree 渲染邏輯

**獲取數據後，前端根據關係構建樹結構：**

1. **找到根節點**：沒有父母或父母不在查詢結果中的成員
2. **構建層級**：根據 parents/children 關係連接節點
3. **顯示關係線**：夫妻關係、父子關係

**示例 - 李瑞春視角（李家）：**

```
李家樹
├── 李瑞春（視角成員）
│   ├── 配偶：陳本清
│   │   └── 子女：陳致彣
│   │       ├── 配偶：孫亞男
│   │       └── 子女：陳恩、陳惠、陳瑄
│   └── ...
└── ...
```

## 六、API 設計

### 6.1 獲取家族樹數據

```
GET /api/my-family-tree?view_as_member_id={成員ID}&include_related=true

響應：
{
    family_info: {
        id: "李家",
        name: "李氏家族",
        surname: "李",
        ...
    },
    view_context: {
        view_member_id: "b12",
        view_member_name: "李瑞春",
        is_native_family: true  // 是否為視角成員的原生家族
    },
    members: [所有 families 包含李家的成員],
    notice: null  // 提示信息，如「當前顯示配偶家族」
}
```

### 6.2 創建成員

```
POST /api/family

請求體：
{
    id: "新成員ID",
    name: "姓名",
    family_tree_id: "當前家族ID",
    parents: ["父親ID", "母親ID"],
    spouses: ["配偶ID"],
    ...
}

後端處理：
1. 繼承父母的 families 數組
2. 添加當前 family_tree_id 到 families
3. 如有配偶，添加配偶的 family_tree_id 到 families
```

## 七、前端交互

### 7.1 視角切換組件

```
當前視角：李瑞春的家族（李家）
[切換視角] 下拉選單：
├── 陳致彣（陳家）← 丈夫
├── 陳恩（陳家）← 兒子
├── 孫亞男（孫家）← 媳婦
└── ...
```

### 7.2 家族標識

每個成員卡片顯示：
- 姓名
- 主要家族標籤（family_tree_id）
- 關係標籤（父、母、配偶、子女等）

## 八、數據遷移策略

### 8.1 遷移步驟

1. **備份數據庫**
2. **運行遷移腳本**：
   - 遍歷所有成員
   - 根據 parents 字段找到父母
   - 將父母的 family_tree_id 添加到子女的 families 數組
   - 將配偶的 family_tree_id 添加到雙方的 families 數組
3. **驗證數據完整性**

### 8.2 遷移腳本邏輯

```javascript
// 為每個成員填充 families 字段
for (const member of members) {
    const families = new Set();
    
    // 添加自己的 family_tree_id
    if (member.family_tree_id) {
        families.add(member.family_tree_id);
    }
    
    // 繼承父母的家族
    if (member.parents) {
        for (const parentId of member.parents) {
            const parent = findMember(parentId);
            if (parent.family_tree_id) {
                families.add(parent.family_tree_id);
            }
            if (parent.families) {
                parent.families.forEach(fid => families.add(fid));
            }
        }
    }
    
    // 更新數據庫
    member.families = Array.from(families);
}
```

## 九、實施階段

### Phase 1: 數據遷移
- 備份數據庫
- 運行遷移腳本填充 families 字段

### Phase 2: 後端 API 修改
- 修改 `/api/my-family-tree` - 使用 families 字段查詢
- 修改創建成員 API - 自動繼承父母家族
- 修改結婚 API - 互相添加對方家族

### Phase 3: 前端修改
- 修改 FamilyTree.jsx - 支持視角切換
- 修改創建家族流程 - 級聯更新子女 families

## 十、項目結構

```
family-tree-app/
├── src/
│   ├── components/          # React 組件
│   │   ├── FamilyTree.jsx   # 家族樹主組件
│   │   ├── FamilyMember.jsx # 成員卡片組件
│   │   ├── AddRelativeModal.jsx  # 添加親屬對話框
│   │   ├── CreateFamilyModal.jsx # 創建家族對話框
│   │   └── ...
│   ├── utils/               # 工具函數
│   │   ├── familyMembership.js   # 家族歸屬管理
│   │   └── treeUtils.js          # 樹結構處理
│   ├── App.jsx              # 應用主入口
│   └── main.jsx             # 渲染入口
├── server.cjs               # Express 後端服務
├── family.db                # SQLite 數據庫文件
├── package.json             # 項目依賴配置
└── vite.config.js           # Vite 構建配置
```

## 十一、注意事項

1. **family_tree_id vs families**：
   - `family_tree_id` 是「主要家族」，用於視角切換時的默認展示
   - `families` 是「所有歸屬家族」，用於查詢匹配

2. **查詢性能**：
   - 使用 JSON 函數查詢 families 數組時注意索引優化
   - 大數據量時考慮添加家族ID的獨立索引表

3. **數據一致性**：
   - 創建/更新/刪除成員時同步維護 families 數組
   - 結婚/離婚時更新雙方的 families

4. **Windows 環境注意**：
   - 數據庫備份避免使用 `%date%` 變量，使用固定命名
   - 腳本文件使用 `.cjs` 後綴以兼容 CommonJS 模塊
