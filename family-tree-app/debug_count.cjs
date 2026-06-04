const fs = require('fs');
const content = fs.readFileSync('i:/proj/zupu/family-tree-app/server.cjs', 'utf8');

const sqlMatch = content.match(/const sql = `UPDATE members SET([\s\S]+?)WHERE id = \?`;/);
if (sqlMatch) {
    const sql = sqlMatch[0];
    const placeholders = (sql.match(/\?/g) || []).length;
    console.log('SQL Placeholders:', placeholders);
} else {
    console.log('SQL not found');
}

const paramsMatch = content.match(/const params = \[([\s\S]+?)req\.params\.id\s+?\];/);
if (paramsMatch) {
    const paramsStr = paramsMatch[0];
    // This is naive but let's count commas and the last element
    const commaCount = (paramsStr.match(/,/g) || []).length;
    console.log('Params Count (approx by commas):', commaCount + 1);
} else {
    console.log('Params not found');
}
