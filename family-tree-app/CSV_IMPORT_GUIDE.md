# CSV导入功能使用说明

## 1. CSV文件格式要求

CSV文件应包含以下列标题，支持族谱系统的所有字段：

```csv
id,name,gender,birth_date,birth_year,birth_month,birth_day,birth_calendar,death_date,death_year,death_month,death_day,death_calendar,is_deceased,phone,address,remark,family_tree_id,generation,clan_name,ancestral_home,courtesy_name,pseudonym,education,occupation,spouses,children,parents,aliases,achievements,biography
```

### 字段说明

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| id | 字符串 | 是 | 成员唯一标识符 |
| name | 字符串 | 是 | 成员姓名 |
| gender | 字符串 | 否 | 性别 (male/female) |
| birth_date | 日期 | 否 | 出生日期 (YYYY-MM-DD) |
| birth_year | 数字 | 否 | 出生年份 |
| birth_month | 数字 | 否 | 出生月份 |
| birth_day | 数字 | 否 | 出生日期 |
| birth_calendar | 字符串 | 否 | 历法 (gregorian/lunar) |
| death_date | 日期 | 否 | 死亡日期 (YYYY-MM-DD) |
| death_year | 数字 | 否 | 死亡年份 |
| death_month | 数字 | 否 | 死亡月份 |
| death_day | 数字 | 否 | 死亡日期 |
| death_calendar | 字符串 | 否 | 历法 (gregorian/lunar) |
| is_deceased | 数字 | 否 | 是否已故 (0/1) |
| phone | 字符串 | 否 | 电话号码 |
| address | 字符串 | 否 | 地址 |
| remark | 字符串 | 否 | 备注 |
| family_tree_id | 字符串 | 否 | 家谱ID |
| generation | 数字 | 否 | 世代 |
| clan_name | 字符串 | 否 | 堂号 |
| ancestral_home | 字符串 | 否 | 地望（祖籍） |
| courtesy_name | 字符串 | 否 | 字 |
| pseudonym | 字符串 | 否 | 号 |
| education | 字符串 | 否 | 教育背景 |
| occupation | 字符串 | 否 | 职业 |
| spouses | JSON数组 | 否 | 配偶ID列表 |
| children | JSON数组 | 否 | 子女ID列表 |
| parents | JSON数组 | 否 | 父母ID列表 |
| aliases | JSON数组 | 否 | 曾用名列表 |
| achievements | JSON数组 | 否 | 成就列表 |
| biography | 字符串 | 否 | 传记 |

## 2. 示例CSV文件

```csv
id,name,gender,birth_date,birth_year,birth_month,birth_day,birth_calendar,death_date,death_year,death_month,death_day,death_calendar,is_deceased,phone,address,remark,family_tree_id,generation,clan_name,ancestral_home,courtesy_name,pseudonym,education,occupation,spouses,children,parents,aliases,achievements,biography
1,张三,male,1980-01-01,1980,1,1,gregorian,,,,-1,0,13800138000,北京市朝阳区,,family001,3,清河堂,福建福州,小明,无名氏,大学,软件工程师,"[""2""]","[""3"",""4""]","[""5"",""6""]","[""张小三"",""三娃""]","[""优秀员工奖"",""技术创新奖""]","张三是家族中第一位大学生..."
```

## 3. 导入操作步骤

### 前端导入（推荐方式）

1. 登录系统并进入家谱管理页面
2. 点击"导入CSV"按钮
3. 选择准备好的CSV文件
4. 点击"开始导入"
5. 等待导入完成，查看导入结果

### API接口导入

使用HTTP POST请求发送CSV文件到以下端点：

```
POST /api/import/csv
Content-Type: multipart/form-data
```

请求体应包含名为`csvFile`的文件字段。

## 4. 导入规则

1. **重复数据处理**：如果CSV中的ID已在系统中存在，则会更新该成员的信息而非创建新记录
2. **数据验证**：系统会对必填字段和数据格式进行验证
3. **关系处理**：spouses、children、parents字段应为有效的成员ID数组
4. **批量处理**：支持大量数据的批量导入
5. **错误处理**：单行数据错误不会影响其他行的导入

## 5. 注意事项

1. CSV文件应使用UTF-8编码
2. 日期格式应为 YYYY-MM-DD
3. JSON数组字段应使用双引号包裹，并正确转义内部引号
4. 建议先导入父辈成员，再导入子辈成员，以确保关系引用有效
5. 导入前请备份现有数据

## 6. 错误处理

导入完成后，系统会返回详细的导入结果，包括：
- 总行数
- 成功导入数量
- 错误数量及详细信息

如遇错误，请根据提示信息修正CSV文件后重新导入。