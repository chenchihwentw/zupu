# 家族树显示逻辑需求文档

## 1. 需求概述

实现符合汉文化父系社会传统的家族树显示逻辑，以用户Member的父系家族为显示基准。

---

## 2. 核心原则

**登录用户显示的家族 = 该用户Member的父系家族**

- 汉文化为父系社会，家族传承以父姓为基准
- 每个Member只属于一个父系家族
- 家族树数据基于当前登录用户的Member记录动态推导

---

## 3. 家族确定逻辑

### 3.1 正常流程（父系家族存在）

```
用户登录
    ↓
查找用户的Member记录
    ↓
查找该Member的父亲
    ↓
查找父亲的家族
    ↓
显示该家族树
```

### 3.2 自动回退机制（父系家族不存在）

```
用户登录
    ↓
查找用户的Member记录
    ↓
查找该Member的父亲
    ↓
父亲未关联家族
    ↓
检查该Member是否有配偶
    ↓
配偶存在且有关联家族
    ↓
自动切换视角到配偶 + 显示配偶的父系家族 + 提示"当前显示配偶家族，您可以创建自己的家族"
```

### 3.3 示例场景

| 用户 | 父亲 | 父亲家族 | 配偶 | 配偶家族 | 登录显示 |
|------|------|---------|------|---------|---------|
| 陈小明 | 陈大伟 | 陈氏家族 | 王雅婷 | 王氏家族 | **陈氏家族** |
| 王雅婷 | 王建国 | 王氏家族 | 陈小明 | 陈氏家族 | **王氏家族** |
| 王雅婷 | 王建国 | 无 | 陈小明 | 陈氏家族 | **陈氏家族**（视角自动切至陈小明）+ 提示可创建王氏家族 |
| 林美华 | 林国栋 | 无 | 无 | - | 提示创建林氏家族 |

---

## 4. 视角切换机制

### 4.1 视角切换目的
- 查看其他Member的家族关系
- 在配偶家族间快速切换

### 4.2 视角切换规则

切换至目标Member后，按**第3章家族确定逻辑**重新计算显示：

```
切换视角至目标Member
    ↓
查找目标Member的父亲
    ↓
查找父亲的家族
    ↓
显示该家族树
```

### 4.3 视角切换示例

| 当前视角 | 操作 | 新视角 | 显示家族 | 说明 |
|---------|------|--------|---------|------|
| 王雅婷 | 切换至配偶陈小明 | 陈小明 | 陈氏家族 | 嫁入后查看丈夫家族 |
| 陈小明 | 切换至配偶王雅婷 | 王雅婷 | 王氏家族 | 查看妻子家族 |
| 陈小明 | 切换至父亲陈大伟 | 陈大伟 | 陈氏家族 | 同家族，视角上移 |
| 王雅婷 | 切换至母亲林美华 | 林美华 | 林氏家族 | 查看母亲娘家 |

---

## 5. 数据加载流程

### 5.1 流程图

```
┌─────────────────┐
│    用户登录      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 查找用户Member   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  查找Member父亲  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌────────┐
│父亲存在 │  │父亲不存在│
└───┬────┘  └────┬───┘
    │            │
    ▼            ▼
┌────────┐  ┌────────┐
│查找家族 │  │检查配偶 │
└───┬────┘  └────┬───┘
    │            │
    ▼            ▼
┌────────┐  ┌────────┐
│家族存在 │  │配偶存在 │
└───┬────┘  └───┬────┘
    │            │
    ▼            ▼
┌────────┐  ┌────────┐
│显示家族 │  │显示配偶家族│
└────────┘  │+提示创建  │
            └─────────┘
```

### 5.2 详细步骤

**步骤1：获取当前用户Member**
```javascript
const userMember = await getMemberByUserId(currentUser.id);
```

**步骤2：查找父系家族**
```javascript
const father = await getMemberById(userMember.father_id);
let targetFamilyId = father?.family_tree_id;
```

**步骤3：父系不存在时回退到配偶家族**
```javascript
if (!targetFamilyId && userMember.spouse_id) {
  const spouse = await getMemberById(userMember.spouse_id);
  const spouseFather = await getMemberById(spouse?.father_id);
  targetFamilyId = spouseFather?.family_tree_id;
  
  if (targetFamilyId) {
    showNotice("当前显示配偶家族，您可创建自己的家族");
  }
}
```

**步骤4：拉取家族数据**
```javascript
const familyData = await fetchFamilyData({
  family_tree_id: targetFamilyId,
  include_related: true
});
```

**步骤5：显示家族信息**
- 家族树图形
- 家族信息卡片（姓氏、祖籍、堂号）

---

## 6. 家族信息卡片

### 6.1 显示内容

在家族树页面顶部显示家族基本信息卡片：

```
┌─────────────────────────────────────┐
│  🏛️ 陈氏家族                        │
│  📍 祖籍：福建省泉州市 | 堂號：潁川堂  │
└─────────────────────────────────────┘
```

### 6.2 字段映射

| 显示字段 | 数据来源 | 说明 |
|----------|----------|------|
| 家族名称 | `familyInfo.name` | 如未设置，显示"{姓氏}氏家族" |
| 祖籍 | `familyInfo.ancestral_home` | 地理位置 |
| 堂号 | `familyInfo.hall_name` | 可选显示 |
| 姓氏 | 基准父亲的姓氏 | 从成员数据中提取 |

---

## 7. UI 交互设计

### 7.1 家族信息展示

在视角切换区域显示当前家族信息：

```
┌─────────────────────────────────────────────────────────┐
│  🏛️ 陈氏家族  📍 祖籍：福建省泉州市 | 堂號：潁川堂        │
├─────────────────────────────────────────────────────────┤
│  👤 当前视角：陈小明  [切换视角 ▼]  [创建我的家族]        │
└─────────────────────────────────────────────────────────┘
```

### 7.2 创建家族入口

当用户父系家族不存在时，显示创建按钮：

```
┌─────────────────────────────────────────────────────────┐
│  ⚠️ 您当前查看的是配偶陈氏家族                            │
│  您还没有创建自己的家族                                   │
│  [创建我的家族]                                          │
└─────────────────────────────────────────────────────────┘
```

### 7.3 创建家族流程

用户点击"创建我的家族"后：

```
弹出创建表单
    ↓
填写家族信息：
  - 家族名称（默认：{用户姓氏}氏家族）
  - 祖籍位置
  - 堂号（可选）
    ↓
确认创建
    ↓
自动关联到用户父亲
    ↓
重新加载显示新家族
```

---

## 8. 新用户初始化流程

### 8.1 首次登录自动创建Member

新用户注册/首次登录时：

```
用户完成注册
    ↓
系统自动创建Member记录
    ↓
Member信息：
  - name: 用户姓名（注册时填写）
  - surname: 姓氏（从姓名提取）
  - gender: 性别（注册时选择）
  - user_id: 关联用户ID
  - father_id: null（待填写）
  - mother_id: null（待填写）
  - spouse_id: null（待填写）
    ↓
显示"完善家族信息"引导
```

### 8.2 家族扩展操作

用户可以在自己的Member上执行：

| 操作 | 功能 | 创建关系 |
|------|------|---------|
| 添加父亲 | 创建父亲Member并关联 | father_id |
| 添加母亲 | 创建母亲Member并关联 | mother_id |
| 添加配偶 | 创建配偶Member并双向关联 | spouse_id |
| 添加子女 | 创建子女Member并关联 | 子女的father_id/mother_id |
| 添加兄弟姐妹 | 创建兄弟/姐妹Member，共享父母 | 同father_id/mother_id |

### 8.3 创建父亲时同时创建家族

当用户添加父亲且父亲无家族时：

```
用户点击"添加父亲"
    ↓
填写父亲信息
    ↓
检测到父亲无家族
    ↓
提示"是否为父亲创建家族？"
    ↓
用户确认
    ↓
创建家族 + 关联父亲 + 显示家族树
```

---

## 9. 离婚处理机制

### 9.1 离婚后的家族归属

当配偶双方离婚后，需要处理家族归属问题：

#### 9.1.1 离婚时的数据处理

```
离婚操作
    ↓
解除配偶关系（member_spouses表标记离婚）
    ↓
清除双方当前配偶关联
    ↓
嫁入方：删除家族属性（family_tree_id）
    ↓
更新相关成员的家族显示逻辑
```

#### 9.1.2 离婚后家族显示规则

| 用户 | 原配偶 | 离婚后显示 |
|------|--------|-----------|
| 王雅婷（嫁入陈家） | 陈小明 | **自动切回自己的父系家族**（如果有） |
| 王雅婷（父系未建立） | 陈小明 | 删除其家族属性 + 提示"请创建自己的家族" |

### 9.2 数据库设计

#### 9.2.1 配偶关系表（建议新增）

将 `spouse_id` 单字段改为配偶关系表，支持历史记录：

```sql
CREATE TABLE member_spouses (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,          -- 成员A
  spouse_member_id TEXT NOT NULL,   -- 成员B（配偶）
  marriage_date TEXT,               -- 结婚日期
  divorce_date TEXT,                -- 离婚日期（NULL表示未离婚）
  is_current INTEGER DEFAULT 1,     -- 是否为当前配偶
  children_ids TEXT,                -- 共同子女ID列表
  created_at TEXT
);
```

#### 9.2.2 离婚后数据处理

```javascript
// 离婚操作
async function divorce(memberAId, memberBId) {
  // 1. 更新配偶关系表
  await db.run(
    `UPDATE member_spouses 
     SET divorce_date = ?, is_current = 0 
     WHERE member_id = ? AND spouse_member_id = ?`,
    [new Date().toISOString(), memberAId, memberBId]
  );
  
  // 2. 清除双方的 spouse_id
  await db.run(`UPDATE members SET spouse_id = NULL WHERE id = ?`, [memberAId]);
  await db.run(`UPDATE members SET spouse_id = NULL WHERE id = ?`, [memberBId]);
  
  // 3. 对于嫁入方，重新计算其家族显示
  await recalculateFamilyView(memberAId);
  await recalculateFamilyView(memberBId);
}
```

### 9.3 特殊关系处理

#### 9.3.1 子女血缘关系
离婚后子女保持原有血缘关系，无需调整归属：
- 子女仍归属其父亲的家族（父系社会传统）
- 母亲可通过视角切换查看子女

#### 9.3.2 收养关系
对于收养、入赘、继子女等特殊关系：

```sql
-- 扩展关系类型表
CREATE TABLE member_relations (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  related_member_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,      -- 'adopted'收养, 'step'继亲, 'son_in_law'女婿, 'daughter_in_law'媳妇
  relation_direction TEXT,          -- 'to'指向对方, 'from'来自对方
  is_legal INTEGER DEFAULT 1,       -- 是否法律关系
  notes TEXT,
  created_at TEXT
);
```

**关系类型说明：**

| 类型 | 说明 | 家族归属 |
|------|------|---------|
| `adopted` | 收养关系 | 归属养父家族 |
| `step` | 继父母/继子女 | 保持原血缘家族 |
| `son_in_law` | 女婿（入赘） | 归属妻家家族 |
| `daughter_in_law` | 媳妇（嫁入） | 归属夫家家族 |

---

## 10. 边界情况处理

### 10.1 数据缺失情况

| 场景 | 处理方式 |
|------|----------|
| 用户无Member记录 | 自动创建（见8.1） |
| 父亲未设置 | 提示"添加父亲以创建家族" |
| 父亲存在但无家族 | 提示"为父亲创建家族" |
| 配偶未设置 | 不显示配偶家族回退 |
| 配偶家族不存在 | 提示"配偶也未创建家族" |
| 已离婚 | 显示自己的父系家族，不再回退到前配偶家族 |

### 10.2 循环引用防护

- 防止因数据错误导致的无限循环查找
- 设置最大查找深度（如5层）
- 记录已访问成员ID，避免重复访问

---

## 11. API 接口需求

### 11.1 新增/修改接口

**GET /api/my-family-tree**

获取当前登录用户的家族树数据（自动推导父系/配偶家族）。

**请求参数：**
```json
{
  "view_member_id": "string",      // 视角人员ID（可选，默认当前用户Member）
  "include_members": true,         // 是否包含成员详情
  "include_relations": true        // 是否包含关系数据
}
```

**响应数据：**
```json
{
  "family_info": {
    "id": "chen_family",
    "name": "陈氏家族",
    "surname": "陈",
    "ancestral_home": "福建省泉州市",
    "hall_name": "潁川堂"
  },
  "view_context": {
    "view_member_id": "member_002",
    "view_member_name": "陈小明",
    "is_spouse_family": false,       // 是否显示的是配偶家族
    "can_create_family": true        // 是否可以创建自己的家族
  },
  "members": [...],
  "relations": [...]
}
```

**POST /api/family-trees**

创建新家族（同时关联到指定Member的父亲）。

**请求参数：**
```json
{
  "name": "王氏家族",
  "surname": "王",
  "ancestral_home": "福建省福州市",
  "hall_name": "三槐堂",
  "for_member_id": "member_003"    // 为哪个Member的父亲创建家族
}
```

**响应数据：**
```json
{
  "id": "wang_family",
  "name": "王氏家族",
  "surname": "王",
  "message": "家族创建成功并已关联"
}
```

---

## 12. 数据库依赖

### 12.1 需要的字段

**members 表：**
- `id` - Member唯一标识
- `name` - 姓名
- `surname` - 姓氏
- `gender` - 性别
- `father_id` - 父亲ID
- `mother_id` - 母亲ID
- `spouse_id` - 配偶ID
- `family_tree_id` - 所属家族ID（主要用于父亲）
- `user_id` - 关联用户ID（可为空）

**family_trees 表：**
- `id` - 家族唯一标识
- `name` - 家族名称
- `surname` - 家族姓氏
- `ancestral_home` - 祖籍
- `hall_name` - 堂号
- `created_by` - 创建者

---

## 13. 实现优先级

1. **P0** - 父系家族自动推导显示
2. **P0** - 配偶家族回退机制
3. **P1** - 新用户自动创建Member
4. **P1** - 创建家族功能
5. **P2** - 视角切换功能
6. **P2** - 添加父亲/母亲/配偶/子女功能
7. **P3** - 家族信息卡片UI优化

---

*文档版本：v2.0*  
*创建日期：2026-04-04*  
*最后更新：2026-04-04*  
*状态：待实现*
