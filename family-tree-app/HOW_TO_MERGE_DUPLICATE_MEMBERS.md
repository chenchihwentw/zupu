# 合併重複成員的標準操作步驟

## 📋 問題描述

**場景**: 同一個人在系統中有兩個獨立的記錄

**實際案例**: 李瑞春
- **記錄1**: `b12`
  - 家族: `family_b12_1774453775611` (李家)
  - 配偶: `b11` (陳家成員)
  - families: `["family_b12_1774453775611","chen_family"]`
  - 狀態: ✅ 正確,已關聯兩個家族

- **記錄2**: `1775537295267`
  - 家族: `李_family_1775525022539` (李家)
  - 父母: `["1775530689351"]`
  - 配偶: 無
  - families: `["李_family_1775525022539"]`
  - 狀態: ❌ 重複記錄

---

## 🎯 解決方案選擇

### 方案A: 保留一個,刪除另一個 (推薦用於完全重複)

**適用情況**: 兩個記錄實際上是同一個人,只需保留一個

**步驟**:
1. 確認哪個記錄更完整
2. 確認哪個記錄有正確的關聯(配偶、父母等)
3. 刪除重複的記錄
4. 保留的記錄通過 `families` 字段關聯兩個家族

---

### 方案B: 合併兩個記錄的數據 (推薦用於各有部分數據)

**適用情況**: 兩個記錄各有不同的數據需要保留

**步驟**:
1. 比較兩個記錄的數據
2. 手動將需要的數據合併到一個記錄
3. 刪除另一個記錄

---

## 🔧 實際操作步驟

### 第一步: 查詢重複記錄

使用 Node.js 腳本查詢所有同名記錄:

```javascript
// 查詢李瑞春的所有記錄
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./family.db');

db.all(`
  SELECT id, name, gender, family_tree_id, parents, spouses, children, families 
  FROM members 
  WHERE name LIKE '%李瑞春%'
`, [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  
  console.log('找到以下李瑞春的記錄:\n');
  rows.forEach((row, index) => {
    console.log(`${index + 1}. ID: ${row.id}`);
    console.log(`   家族: ${row.family_tree_id}`);
    console.log(`   性別: ${row.gender}`);
    console.log(`   父母: ${row.parents}`);
    console.log(`   配偶: ${row.spouses}`);
    console.log(`   子女: ${row.children}`);
    console.log(`   families: ${row.families}`);
    console.log('');
  });
  
  db.close();
});
```

**保存為**: `query-duplicate-liruichun.cjs`

**執行**:
```bash
cd i:\proj\zupu\family-tree-app
node query-duplicate-liruichun.cjs
```

---

### 第二步: 分析記錄差異

比較各個記錄:

| 字段 | b12 | 1775537295267 |
|---|---|---|
| 性別 | female ✅ | female |
| 父母 | 無 | 有 (`1775530689351`) |
| 配偶 | 有 (`b11`) ✅ | 無 |
| 關聯家族 | 兩個 ✅ | 一個 ❌ |
| 數據完整性 | **高** ✅ | 低 |

**結論**: 
- ✅ 保留 `b12` (數據更完整,已正確關聯兩個家族)
- ❌ 刪除 `1775537295267` (重複記錄)

---

### 第三步: 確認依賴關係

在刪除前,檢查是否有其他成員引用了要刪除的記錄:

```javascript
// 檢查依賴關係
const memberId = '1775537295267';

db.all('SELECT id, name, parents, spouses, children FROM members', [], (err, allMembers) => {
  if (err) {
    console.error(err);
    return;
  }
  
  const referencedBy = allMembers.filter(m => {
    const parents = JSON.parse(m.parents || '[]');
    const spouses = JSON.parse(m.spouses || '[]');
    const children = JSON.parse(m.children || '[]');
    
    return parents.includes(memberId) || 
           spouses.includes(memberId) || 
           children.includes(memberId);
  });
  
  if (referencedBy.length > 0) {
    console.log(`⚠️  成員 ${memberId} 被以下成員引用:`);
    referencedBy.forEach(ref => {
      console.log(`   - ${ref.name} (${ref.id})`);
    });
    console.log('\n刪除前需要先處理這些關聯!');
  } else {
    console.log(`✅ 成員 ${memberId} 沒有被其他成員引用,可以安全刪除`);
  }
  
  db.close();
});
```

---

### 第四步: 刪除重複記錄

**⚠️ 重要**: 刪除前必須先備份數據庫!

```bash
# 備份數據庫
cp family.db family.db.backup.before_merge_$(date +%Y%m%d_%H%M%S)
```

**執行刪除**:

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./family.db');

const duplicateId = '1775537295267';
const keepId = 'b12';

console.log(`🗑️  準備刪除重複記錄: ${duplicateId}`);
console.log(`✅ 保留記錄: ${keepId}`);

db.run('DELETE FROM members WHERE id = ?', [duplicateId], function(err) {
  if (err) {
    console.error('❌ 刪除失敗:', err.message);
    db.close();
    return;
  }
  
  if (this.changes > 0) {
    console.log(`✅ 成功刪除 ${this.changes} 條記錄`);
    
    // 驗證結果
    db.all('SELECT id, name, family_tree_id, families FROM members WHERE name LIKE "%李瑞春%"', [], (err, rows) => {
      console.log('\n📋 剩餘的李瑞春記錄:');
      rows.forEach(row => {
        console.log(`  ID: ${row.id}, 家族: ${row.family_tree_id}, families: ${row.families}`);
      });
      
      db.close();
    });
  } else {
    console.log('⚠️  記錄不存在');
    db.close();
  }
});
```

**保存為**: `delete-duplicate-liruichun.cjs`

**執行**:
```bash
node delete-duplicate-liruichun.cjs
```

---

### 第五步: 驗證結果

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./family.db');

db.all('SELECT id, name, family_tree_id, spouses, families FROM members WHERE name LIKE "%李瑞春%"', [], (err, rows) => {
  if (err) {
    console.error(err);
    return;
  }
  
  console.log('\n✅ 驗證結果:');
  if (rows.length === 1 && rows[0].id === 'b12') {
    console.log('✅ 成功!只保留了一條正確的記錄');
    console.log('\n保留的記錄:');
    console.log(`  ID: ${rows[0].id}`);
    console.log(`  姓名: ${rows[0].name}`);
    console.log(`  家族: ${rows[0].family_tree_id}`);
    console.log(`  配偶: ${rows[0].spouses}`);
    console.log(`  families: ${rows[0].families}`);
    
    const families = JSON.parse(rows[0].families || '[]');
    if (families.length >= 2) {
      console.log('\n✅ 該記錄已正確關聯兩個家族!');
    }
  } else {
    console.log(`⚠️  結果不符合預期:剩餘 ${rows.length} 條記錄`);
  }
  
  db.close();
});
```

**保存為**: `verify-liruichun.cjs`

**執行**:
```bash
node verify-liruichun.cjs
```

---

## 📝 完整腳本 (一鍵執行)

已創建: `fix-duplicate-liruichun.cjs`

**使用方法**:
```bash
cd i:\proj\zupu\family-tree-app
node fix-duplicate-liruichun.cjs
```

**功能**:
1. ✅ 驗證要保留的記錄
2. ✅ 檢查依賴關係
3. ✅ 刪除重複記錄
4. ✅ 驗證結果

---

## 🔄 如果要恢復已刪除的記錄

**情況1**: 剛纔刪除,還沒關閉程序
- 使用數據庫備份恢復

**情況2**: 手動恢復
```javascript
db.run(`
  INSERT INTO members (id, name, gender, family_tree_id, parents, spouses, children, families) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`, ['1775537295267', '李瑞春', 'female', '李_family_1775525022539', '["1775530689351"]', '[]', '[]', '["李_family_1775525022539"]']);
```

---

## ⚠️ 注意事項

### 刪除前必須確認:
1. ✅ 備份數據庫
2. ✅ 檢查依賴關係(父母、配偶、子女)
3. ✅ 確認要保留的記錄
4. ✅ 確認要刪除的記錄沒有被引用

### 合併後的驗證:
1. ✅ 保留的記錄 `families` 字段包含兩個家族
2. ✅ 前端能看到合併後的成員
3. ✅ 切換家族視角時能正確顯示

---

## 📊 李瑞春案例的最終狀態

```
✅ 保留: b12
   - 家族: family_b12_1774453775611 (李家原生)
   - families: ["family_b12_1774453775611","chen_family"] (同時屬於兩個家族)
   - 配偶: b11 (陳家成員)
   
❌ 刪除: 1775537295267 (重複記錄)
❌ 刪除: m_1775523932730 (空記錄)

✅ 結果: 李瑞春同時屬於陳家和李家
```

---

## 🎯 通用流程 (適用於任何重複成員)

```
1. 查詢所有同名記錄
   ↓
2. 比較各個記錄的數據
   ↓
3. 檢查依賴關係
   ↓
4. 備份數據庫
   ↓
5. 刪除重複記錄
   ↓
6. 驗證結果
   ↓
7. 前端刷新確認
```

按照這個流程操作,確保數據安全! 🙏
