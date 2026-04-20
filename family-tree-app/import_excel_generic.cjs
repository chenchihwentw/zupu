// 获取命令行参数
const args = process.argv.slice(2);
let filePath = args[0];

// 如果没有提供文件路径，则使用默认路径
if (!filePath) {
    filePath = path.join(__dirname, '..', '祖谱sample.csv');
}