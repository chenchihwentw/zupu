# 家族树应用开发规范

## 1. 禁止硬编码家族ID

### ❌ 错误示例
```javascript
const userFamilyId = 'chen_family';
const familyId = user?.familyTrees?.[0] || 'chen_family';
const defaultFamily = 'chen_family';
```

### ✅ 正确做法
```javascript
// 从用户数据动态获取
const userFamilyId = user?.familyTrees?.[0];
if (!userFamilyId) {
  // 报错或要求用户选择/创建家族
  throw new Error('用户未关联任何家族');
}

// 或者使用当前视角的家族ID
const targetFamilyId = viewAsMemberId 
  ? viewMember?.family_id || viewMember?.family_tree_id
  : user?.familyTrees?.[0];
```

### 检查清单
- [ ] 搜索代码中所有 `'chen_family'` 字符串
- [ ] 检查 `|| 'chen_family'`  fallback 逻辑
- [ ] 检查默认参数中的家族ID

---

## 2. 数据库变更流程

修改数据库字段或结构时，必须按顺序执行：

### 步骤1：修改数据库
- 更新表结构（ALTER TABLE / CREATE TABLE）
- 迁移现有数据（如需）

### 步骤2：重启服务
```bash
taskkill /F /IM node.exe
npm run server
```

### 步骤3：验证表结构
```sql
-- 检查表结构
PRAGMA table_info(members);
PRAGMA table_info(family_trees);

-- 检查数据
SELECT COUNT(*) FROM members;
SELECT DISTINCT family_tree_id FROM members;
```

### 步骤4：检查API接口
- 验证新增字段是否正确返回
- 验证字段类型是否正确
- 验证关联查询是否正常

### 步骤5：前端验证
- 检查字段传输是否完整
- 检查组件显示是否正确
- 检查编辑/保存功能是否正常

---

## 3. 视角切换数据加载规范

### 切换到成员视角
```javascript
// 必须传入该成员所属家族ID，并包含关联家族
const memberFamilyId = member.family_id || member.family_tree_id;
fetchFamilyData(true, memberFamilyId);
```

### 重置视角
```javascript
// 使用登录用户默认家族ID，不包含关联家族
const userFamilyId = user?.familyTrees?.[0];
fetchFamilyData(false, userFamilyId);
```

---

## 4. 家族成员过滤规范

### getCurrentFamilyMembers() 必须包含
1. 同一家族的成员
2. **视角成员的 parents（直系血亲）**
3. **视角成员的 children（直系血亲）**
4. 姻亲（配偶是当前家族成员，且未离婚）

### 下拉列表过滤（父母/配偶选择）
```javascript
const memberFamilyId = member.family_id || member.family_tree_id;
const potentialMothers = allMembers.filter(m => 
  m.id !== member.id && 
  m.gender === 'female' &&
  (m.family_id || m.family_tree_id) === memberFamilyId  // 同家族
);
```

---

## 5. API 参数传递规范

### /api/family 接口
```javascript
// 必须显式指定家族ID
const url = `/api/family?family_tree_id=${familyId}&include_related=${includeRelated}`;

// 禁止省略 family_tree_id（默认使用用户首个家族ID是错误的）
```

---

## 6. 数据一致性检查

### 成员家族字段（三字段必须一致）
- `family_tree_id`
- `family_id`
- `primaryFamily`

修改时必须同时更新三个字段：
```javascript
UPDATE members SET 
  family_tree_id = 'new_family',
  family_id = 'new_family',
  primaryFamily = 'new_family'
WHERE id = 'member_id';
```

---

## 7. 调试检查清单

出现家族数据问题时，按顺序检查：

1. **数据库层面**
   ```sql
   SELECT id, name, family_tree_id, family_id, primaryFamily 
   FROM members 
   WHERE id = '问题成员ID';
   ```

2. **API层面**
   - 检查 `/api/family` 返回数据
   - 验证 `family_tree_id` 参数是否正确传递
   - 验证 `include_related` 是否按需启用

3. **前端层面**
   - 检查 `fetchFamilyData()` 调用参数
   - 检查 `getCurrentFamilyMembers()` 过滤逻辑
   - 检查 `visibleMemberIds` 是否包含关联成员

4. **视图层面**
   - 检查视角切换是否正确触发数据重载
   - 检查连线是否因成员不在 visibleMemberIds 中被跳过

---

## 8. 常见错误模式

### 错误1：硬编码家族ID
```javascript
// ❌ 错误
const familyId = 'chen_family';

// ✅ 正确
const familyId = user?.familyTrees?.[0];
```

### 错误2：视角切换未传家族ID
```javascript
// ❌ 错误
fetchFamilyData(true);  // 使用默认家族ID

// ✅ 正确
fetchFamilyData(true, memberFamilyId);  // 使用视角成员家族ID
```

### 错误3：未包含直系血亲
```javascript
// ❌ 错误 - 只过滤同家族和姻亲
const result = family.filter(m => {
  if (mFamilyId === memberFamilyId) return true;  // 同家族
  if (isInLaw(m)) return true;  // 姻亲
  return false;
});

// ✅ 正确 - 额外包含父母子女
const relatedIds = [...viewMemberParents, ...viewMemberChildren];
const result = family.filter(m => {
  if (mFamilyId === memberFamilyId) return true;
  if (relatedIds.includes(m.id)) return true;  // 直系血亲
  if (isInLaw(m)) return true;
  return false;
});
```

---

## 9. 数据操作安全规范

### ⚠️ 禁止删除或清空数据（未经用户确认）

**在未获得用户明确确认前，禁止执行以下操作：**

- ❌ 禁止 `DELETE FROM` 删除表记录
- ❌ 禁止 `UPDATE ... SET field = NULL` 清空字段
- ❌ 禁止 `DROP TABLE` 删除表
- ❌ 禁止批量更新可能影响多条记录的字段

### ✅ 正确的数据修复流程

1. **先查询确认**：
   ```sql
   SELECT id, name, field_name FROM members WHERE condition;
   ```

2. **备份受影响数据**：
   ```javascript
   // 导出受影响记录到备份文件
   db.all("SELECT * FROM members WHERE ...", [], (err, rows) => {
     fs.writeFileSync('backup_xxx.json', JSON.stringify(rows, null, 2));
   });
   ```

3. **获得用户确认**：向用户展示将要修改的数据，等待明确确认

4. **执行更新并验证**：
   ```sql
   UPDATE members SET field = 'value' WHERE id = 'specific_id';
   ```

5. **验证修复结果**：
   ```sql
   SELECT id, name, field_name FROM members WHERE id = 'specific_id';
   ```

---

## 10. 代码审查要点

提交代码前，自查以下项目：

- [ ] 没有硬编码 `'chen_family'`
- [ ] 数据库变更已验证表结构
- [ ] API 参数 `family_tree_id` 显式传递
- [ ] 视角切换使用正确的家族ID
- [ ] 直系血亲（parents/children）包含在过滤逻辑中
- [ ] 三字段（family_tree_id/family_id/primaryFamily）同步更新
- [ ] **数据操作前已获得用户确认**
- [ ] **UPDATE/DELETE 操作有 WHERE 条件限制**
- [ ] **批量操作前已备份数据**

---

*最后更新：2026-04-04*
