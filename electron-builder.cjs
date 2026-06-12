// Koder electron-builder 配置
// 构建命令：pnpm build && pnpm package

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.koder.app',
  productName: 'Koder',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  icon: 'build/icon.png',
  files: [
    'dist/**/*',
    'package.json',
    'build/icon.png',
    'skills/**/*',
    'src/main/**/*',
    'src/preload/**/*',
    'electron-shim.cjs',
  ],
  extraResources: [
    { from: 'skills', to: 'skills', filter: ['**/*'] },
  ],
  // 主进程通过 tsx 启动，所以保留 .ts 入口
  extraMetadata: {
    main: 'src/main/index.ts',
  },
  win: {
    icon: 'build/icon.png',
    target: [{ target: 'nsis', arch: ['x64'] }],
    signAndEditExecutable: false,
    forceCodeSigning: false,
  },
  mac: {
    icon: 'build/icon.png',
    target: 'dmg',
    category: 'public.app-category.developer-tools',
  },
  linux: {
    icon: 'resources/icon.svg',
    target: 'AppImage',
    category: 'Development',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
