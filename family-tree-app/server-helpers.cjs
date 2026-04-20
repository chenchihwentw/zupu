/**
 * Server Helper Functions
 * 提取 server.cjs 中的共同邏輯，支持多家族查詢
 */

/**
 * 將 SQLite 行數據轉換為前端格式
 * @param {object} row - SQLite 行數據
 * @returns {object} 轉換後的成員對象
 */
function parseMemberRow(row) {
    if (!row) return null;
    
    return {
        ...row,
        spouses: JSON.parse(row.spouses || "[]"),
        children: JSON.parse(row.children || "[]"),
        parents: JSON.parse(row.parents || "[]"),
        aliases: JSON.parse(row.aliases || "[]"),
        achievements: JSON.parse(row.achievements || "[]"),
        is_deceased: !!row.is_deceased,
        email: row.email || null,
        avatar_url: row.avatar_url || null,
        has_biography: !!row.biography_md,
        tags: JSON.parse(row.biography_tags || '[]'),
        family_id: row.family_id || 'chen_family',
        primaryFamily: row.primaryFamily || 'chen_family',
        families: JSON.parse(row.families || '["chen_family"]')
    };
}

/**
 * 構建多家族查詢的 SQL 和參數
 * @param {string} targetFamilyId - 目標家族ID
 * @param {boolean} includeRelated - 是否包含關聯成員
 * @returns {object} { sql: string, params: array }
 */
function buildFamilyMembersQuery(targetFamilyId, includeRelated = false) {
    let sql, params;
    
    if (includeRelated) {
        // 包含關聯家族：返回目標家族成員 + 與他們有直接關係的其他家族成員
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
        params = [targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId, targetFamilyId];
    } else {
        // 只查詢指定家族（使用 json_each 對 families 進行精確查詢）
        sql = `
            SELECT * FROM members 
            WHERE family_tree_id = ? 
               OR EXISTS (SELECT 1 FROM json_each(families) WHERE value = ?)
        `;
        params = [targetFamilyId, targetFamilyId];
    }
    
    return { sql, params };
}

/**
 * 非同步查詢成員並解析結果
 * @param {object} db - SQLite 數據庫連接
 * @param {string} sql - SQL 查詢語句
 * @param {array} params - SQL 參數
 * @returns {Promise<array>} 解析後的成員列表
 */
function queryMembers(db, sql, params) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const members = rows.map(row => parseMemberRow(row));
                resolve(members);
            }
        });
    });
}

/**
 * 從父母和配偶繼承家族ID
 * @param {object} db - SQLite 數據庫連接
 * @param {array} parents - 父母ID列表
 * @param {array} spouses - 配偶ID列表
 * @param {Set} inheritedFamilies - 已有的家族ID集合（會被修改）
 * @returns {Promise<void>}
 */
async function inheritFamiliesFromRelatives(db, parents = [], spouses = [], inheritedFamilies = new Set()) {
    // 從父母繼承
    if (parents && parents.length > 0) {
        for (const parentId of parents) {
            const parent = await new Promise((resolve, reject) => {
                db.get(`SELECT family_tree_id, families FROM members WHERE id = ?`, [parentId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (parent) {
                if (parent.family_tree_id) {
                    inheritedFamilies.add(parent.family_tree_id);
                }
                if (parent.families) {
                    try {
                        const parentFamilies = JSON.parse(parent.families);
                        if (Array.isArray(parentFamilies)) {
                            parentFamilies.forEach(fid => inheritedFamilies.add(fid));
                        }
                    } catch (e) {}
                }
            }
        }
    }
    
    // 從配偶繼承
    if (spouses && spouses.length > 0) {
        for (const spouseId of spouses) {
            const spouse = await new Promise((resolve, reject) => {
                db.get(`SELECT family_tree_id, families FROM members WHERE id = ?`, [spouseId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (spouse) {
                if (spouse.family_tree_id) {
                    inheritedFamilies.add(spouse.family_tree_id);
                }
                if (spouse.families) {
                    try {
                        const spouseFamilies = JSON.parse(spouse.families);
                        if (Array.isArray(spouseFamilies)) {
                            spouseFamilies.forEach(fid => inheritedFamilies.add(fid));
                        }
                    } catch (e) {}
                }
            }
        }
    }
}

module.exports = {
    parseMemberRow,
    buildFamilyMembersQuery,
    queryMembers,
    inheritFamiliesFromRelatives
};
