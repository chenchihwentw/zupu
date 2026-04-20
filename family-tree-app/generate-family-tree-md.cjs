const sqlite3 = require('sqlite3');
const fs = require('fs');

const db = new sqlite3.Database('./family.db');

// 以陳致真 (b111) 的視角獲取陳家族譜
db.all(
  `SELECT id, name, father_id, mother_id, spouses, children, generation, gender, birth_year, birth_date, death_year, death_date, is_deceased
   FROM members WHERE family_tree_id = 'chen_family' ORDER BY generation, id`,
  (err, members) => {
    if (err) {
      console.error('查詢失敗:', err);
      db.close();
      return;
    }

    // 構建成員索引
    const memberMap = {};
    members.forEach(m => {
      memberMap[m.id] = {
        ...m,
        spouses: JSON.parse(m.spouses || '[]'),
        children: JSON.parse(m.children || '[]')
      };
    });

    // 生成 Markdown
    let md = '# 陳家族譜 - 陳致真 (b111) 視角\n\n';
    md += '## 基本信息\n\n';
    md += '- **族譜名稱**: 陳氏家族\n';
    md += '- **當前視角**: 陳致真 (b111)\n';
    md += '- **總成員數**: ' + members.length + ' 人\n';
    md += '- **代數**: 5 代\n\n';

    // 按代數組織成員
    const byGeneration = {};
    members.forEach(m => {
      if (!byGeneration[m.generation]) {
        byGeneration[m.generation] = [];
      }
      byGeneration[m.generation].push(m);
    });

    // 代數標題
    const genNames = {
      1: '第一代 (祖先)',
      2: '第二代 (祖父母輩)',
      3: '第三代 (父母輩)',
      4: '第四代 (本人輩)',
      5: '第五代 (兒女輩)',
      6: '第六代 (孫子輩)'
    };

    Object.keys(byGeneration)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach(gen => {
        md += `## ${genNames[gen] || '第' + gen + '代'}\n\n`;
        md += '| 姓名 | ID | 性別 | 出生年 | 過世年 | 父親 | 配偶 | 子女數 |\n';
        md += '|------|-----|------|--------|--------|------|------|----------|\n';

        byGeneration[gen].forEach(m => {
          const member = memberMap[m.id] || m; // 使用 memberMap 中的已解析版本
          const fatherName = m.father_id && memberMap[m.father_id] ? memberMap[m.father_id].name : '-';
          const spouseNames = member.spouses.map(sid => memberMap[sid] ? memberMap[sid].name : '?').join(', ') || '-';
          const childrenCount = member.children.length;
          
          // 處理過世信息
          let deathInfo = '-';
          if (member.is_deceased === 1 || member.death_year) {
            // Debug: 檢查 death_date
            if (m.name === '陳本清' || m.name === '陈兴田') {
              console.log(`Debug ${m.name}: death_date=${m.death_date}, death_year=${m.death_year}, is_deceased=${m.is_deceased}`);
            }
            
            if (m.death_date) {
              // 如果有完整日期，顯示 YYYY-MM-DD
              deathInfo = m.death_date;
            } else if (m.death_year) {
              // 如果只有年份
              deathInfo = m.death_year;
            } else {
              // 已過世但無日期
              deathInfo = '已過世';
            }
          }

          md += `| ${m.name} | ${m.id} | ${m.gender === 'male' ? '男' : '女'} | ${m.birth_year || '-'} | ${deathInfo} | ${fatherName} | ${spouseNames} | ${childrenCount} |\n`;
        });
        md += '\n';
      });

    // 添加家族樹形結構
    md += '## 家族樹形結構\n\n';
    md += '```\n';

    function buildTree(memberId, indent = '', isLast = true) {
      if (!memberMap[memberId]) return '';

      const member = memberMap[memberId];
      const prefix = indent + (isLast ? '└── ' : '├── ');
      let result = prefix + member.name + ' (' + member.id + ')\n';

      // 展示配偶
      if (member.spouses.length > 0) {
        member.spouses.forEach((spouseId, idx) => {
          const spouse = memberMap[spouseId];
          if (spouse) {
            const spousePrefix = indent + (isLast ? '    ' : '│   ') + '├── 配偶: ' + spouse.name;
            result += spousePrefix + ' (' + spouseId + ')\n';
          }
        });
      }

      // 展示子女
      if (member.children.length > 0) {
        member.children.forEach((childId, idx) => {
          const isLastChild = idx === member.children.length - 1;
          const childPrefix = indent + (isLast ? '    ' : '│   ') + (isLastChild ? '└── ' : '├── ');
          const child = memberMap[childId];
          if (child) {
            result += childPrefix + child.name + ' (' + childId + ')\n';
            // 遞迴展示孫子
            const grandchildPrefix = indent + (isLast ? '    ' : '│   ') + (isLastChild ? '    ' : '│   ');
            if (child.children.length > 0) {
              child.children.forEach((grandchildId, gIdx) => {
                const isLastGrandchild = gIdx === child.children.length - 1;
                const gc = memberMap[grandchildId];
                if (gc) {
                  const gcPrefix = grandchildPrefix + (isLastGrandchild ? '└── ' : '├── ');
                  result += gcPrefix + gc.name + ' (' + grandchildId + ')\n';
                }
              });
            }
          }
        });
      }

      return result;
    }

    // 從第一代開始構建樹
    const firstGen = byGeneration[1];
    if (firstGen && firstGen[0]) {
      md += buildTree(firstGen[0].id);
    }
    md += '```\n\n';

    // 添加統計信息
    md += '## 統計信息\n\n';
    md += '| 指標 | 數量 |\n';
    md += '|------|------|\n';
    const maleCount = members.filter(m => m.gender === 'male').length;
    const femaleCount = members.filter(m => m.gender === 'female').length;
    md += `| 男性成員 | ${maleCount} |\n`;
    md += `| 女性成員 | ${femaleCount} |\n`;
    md += `| 已婚成員 | ${members.filter(m => m.spouses.length > 0).length} |\n`;
    md += `| 有子女的成員 | ${members.filter(m => m.children.length > 0).length} |\n`;

    // 寫入文件
    fs.writeFileSync('b111.md', md, 'utf8');
    console.log('✅ 族譜已輸出到 b111.md');
    console.log('   文件大小: ' + fs.statSync('b111.md').size + ' bytes');

    db.close();
  }
);
