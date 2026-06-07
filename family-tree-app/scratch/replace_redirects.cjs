const fs = require('fs');
const path = require('path');
const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.vue') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
};
const files = walk('I:/proj/zupu/familia-mobile/src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes('/pages/index/index')) {
    const newContent = content.replace(/{[\s]*url:\s*['"]\/pages\/index\/index['"][\s]*}/g, "{ url: '/pages/tree/index' }");
    if (newContent !== content) {
      fs.writeFileSync(file, newContent);
      console.log('Updated: ' + file);
    }
  }
});
