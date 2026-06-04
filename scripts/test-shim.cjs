// 测试通过 tsx/cjs shim 加载时 import.meta.url
require('tsx/cjs');
const mod = require('./test-meta');
console.log('module loaded');
