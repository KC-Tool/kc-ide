// Koder Electron 主进程启动 shim
// Electron 主进程必须是 CJS 才能 require。我们用 tsx 把 .ts 源文件当 CJS 加载进来。
// 注意：这里的 require('tsx/cjs') 只在 Electron 主进程上下文中跑一次。

require('tsx/cjs');

// 加载 TS 源码主进程
module.exports = require('./src/main/index.ts');
