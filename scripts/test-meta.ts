// 测试 tsx 加载 .ts 时 import.meta.url 的行为
console.log('import.meta.url =', JSON.stringify(import.meta.url));
console.log('import.meta.dirname =', JSON.stringify(import.meta.dirname));
console.log('process.cwd() =', JSON.stringify(process.cwd()));
