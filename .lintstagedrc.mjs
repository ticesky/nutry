import { relative } from 'node:path';

export default {
  'packages/**/*.{ts,tsx,js,jsx}': (filenames) => {
    const groups = {};
    for (const file of filenames) {
      const match = file.match(/(packages\/[^/]+)\//);
      if (match) {
        const pkgDir = match[1];
        groups[pkgDir] = groups[pkgDir] || [];
        groups[pkgDir].push(file);
      }
    }

    // 为每个包生成独立的命令
    return Object.entries(groups).map(([pkgDir, files]) => {
      // 转换相对路径
      const relativeFiles = files.map(f => relative(pkgDir, f)).join(' ');
      // 关键：先 cd 到子包目录，然后再运行 eslint
      // 这样 ESLint 就能找到子包里的 eslint.config.mjs 了      
      return `sh -c "cd ${pkgDir} && eslint --fix --max-warnings=0 ${relativeFiles}"`;
    });
  },
};