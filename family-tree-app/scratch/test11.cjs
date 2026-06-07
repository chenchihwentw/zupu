const fs = require('fs'); 
const content = fs.readFileSync('I:/proj/zupu/family-tree-app/server.cjs', 'utf-8'); 
const start = content.indexOf("app.get('/api/family', (req, res)"); 
console.log(start > -1 ? content.slice(Math.max(0, start), start + 800) : 'Not found');
