# @nut-up/core

核心工具库，提供项目操作、日志、模块解析、环境变量等基础功能。

## 概述

`@nut-up/core` 是 nut-up 构建工具的基础设施层，为其他所有包提供通用的工具函数。它包含项目结构探测、日志系统、模块解析、环境变量加载、Git 操作等核心能力，是整个工具链的底层支撑。

## 整体架构

```
@nut-up/core
├─ index.ts          # 入口，统一导出所有功能
│
├─ project.ts        # 项目相关
│   ├─ readPackageConfig()        # 读取 package.json
│   ├─ findGitRoot()              # 查找 Git 根目录
│   ├─ isMonorepo()               # 判断是否 monorepo
│   ├─ findMonorepoRoot()         # 查找 monorepo 根目录
│   ├─ isProjectSourceIn()        # 项目源码判断
│   └─ normalizeRuleMatch()       # 规则匹配标准化
│
├─ resolve.ts        # 模块解析
│   ├─ resolve()                  # 基于调用者位置解析
│   ├─ resolveFrom()              # 基于指定位置解析
│   ├─ importUserModule()         # 动态导入用户模块
│   ├─ dirFromImportMeta()        # 从 import.meta.url 获取目录
│   └─ resolveDependencyVersion() # 解析依赖版本
│
├─ logger.ts         # 日志系统
│   ├─ log / warn / error         # 基础日志
│   ├─ debug                      # 调试日志
│   └─ infoHighlight              # 高亮信息
│
├─ env.ts            # 环境变量
│   └─ prepareEnvironment()       # 加载 .env 文件
│
├─ async.ts          # 异步工具
│   ├─ pMap()                     # 并行 map
│   ├─ pFilter()                  # 并行 filter
│   └─ pReduce()                  # 串行 reduce
│
├─ git/              # Git 操作
│   └─ gitStatus()                # 获取 Git 状态
│
├─ lang.ts           # 语言工具
│   └─ compact()                  # 过滤 falsy 值
│
├─ flag.ts           # 标志检测
│   └─ isInDebugMode()            # 判断调试模式
│
├─ user.ts           # 用户信息
│   └─ currentUserName()          # 当前用户名
│
└─ interface.ts      # 类型定义
```

## 核心功能详解

### 1. 项目探测：project.ts

```typescript
// 读取 package.json
export const readPackageConfig = async (cwd: string): Promise<PackageInfo> => {
    const content = await fs.readFile(path.join(cwd, 'package.json'), 'utf-8');
    return JSON.parse(content);
};

// 查找 Git 根目录
export const findGitRoot = async (cwd?: string): Promise<string | undefined> => {
    const gitDirectory = await findUp('.git', {cwd, type: 'directory'});
    return gitDirectory && path.dirname(gitDirectory);
};

// 判断是否 monorepo
export const isMonorepo = async (cwd: string): Promise<boolean> => {
    const root = await findGitRoot() || cwd;
    return isMonorepoRoot(root);
};

// 判断资源是否为项目源码
export const isProjectSourceIn = (cwd: string) => {
    const projectDirectory = cwd.endsWith(path.sep) ? cwd : cwd + path.sep;
    return (resource: string) => (
        resource.includes(projectDirectory)
            && !resource.includes(projectDirectory + 'externals')
            && !resource.includes(`${path.sep}node_modules${path.sep}`)
    );
};
```

### 2. 模块解析：resolve.ts

```typescript
// 基于指定位置解析模块
export function resolveFrom(base: string) {
    return (id: string) => {
        return new Promise((resolve, reject) => {
            resolveCore(id, {basedir: base}, (err, resolved) => {
                if (err) return reject(err);
                resolve(resolved);
            });
        });
    };
}

// 动态导入用户模块（支持 TS 文件）
export async function importUserModule<T>(tries: string[], defaultValue?: T): Promise<UserModuleResult<T>> {
    const target = tries.find(existsSync);

    if (target) {
        const {mod} = await bundleRequire({filepath: target});
        return {resolved: target, value: mod};
    }

    if (defaultValue) {
        return {value: defaultValue};
    }

    throw new Error(`Unable to find module ${tries.join(', ')}`);
}

// 从 import.meta.url 获取当前文件目录
export const dirFromImportMeta = (importMetaUrl: string) => 
    path.dirname(fileURLToPath(importMetaUrl));
```

### 3. 日志系统：logger.ts

```typescript
export default {
    // 基础日志（支持颜色）
    log: createLogWith('log'),
    warn: createLogWith('warn', 'yellow'),
    error: createLogWith('error', 'red'),
    
    // 高亮信息
    infoHighlight: (message: any) => {
        console.log(`${kolorist.bgBlue(kolorist.white(' I '))} ${message}`);
    },
    
    // 调试日志（仅在调试模式下输出）
    debug: (message: any) => {
        if (isInDebugMode()) {
            console.log(message);
        }
    },
    
    // 换行
    lineBreak: () => console.log(''),
};
```

**使用示例：**
```typescript
import {logger} from '@nut-up/core';

logger.log('Normal message');
logger.warn('Warning message');      // 黄色
logger.error('Error message');       // 红色
logger.log.green('Success!');        // 绿色
logger.infoHighlight('Important');   // 带蓝色背景
```

### 4. 环境变量：env.ts

```typescript
export const prepareEnvironment = async (cwd: string, mode: WorkMode, custom: string[] | undefined) => {
    // 加载顺序（后加载的覆盖先加载的）
    const files = [
        path.join(cwd, `.env.${mode}.local`),  // 最高优先级
        path.join(cwd, '.env.local'),
        path.join(cwd, `.env.${mode}`),
        path.join(cwd, '.env'),                 // 最低优先级
    ];

    // monorepo 支持：也加载根目录的 .env 文件
    if (await isMonorepo(cwd)) {
        const root = await findMonorepoRoot(cwd);
        files.unshift(
            path.join(root, '.env'),
            path.join(root, `.env.${mode}`),
            // ...
        );
    }

    // 自定义文件优先级最高
    if (custom) {
        files.unshift(...custom.slice().reverse().map(v => path.resolve(cwd, v)));
    }

    // 按顺序加载
    for (const file of files) {
        if (existsSync(file)) {
            expand(env.config({path: file}));
        }
    }
};
```

**加载优先级（从低到高）：**
1. `.env`
2. `.env.{mode}`
3. `.env.local`
4. `.env.{mode}.local`
5. 自定义文件

### 5. 异步工具：async.ts

```typescript
// 并行 map
export const pMap = async <T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]>

// 并行 filter
export const pFilter = async <T>(items: T[], fn: (item: T) => Promise<boolean>): Promise<T[]>

// 串行 reduce
export const pReduce = async <T, R>(items: T[], fn: (acc: R, item: T) => Promise<R>, initial: R): Promise<R>
```

## 类型定义

### PackageInfo

```typescript
interface PackageInfo {
    name: string;
    version: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    workspaces?: string[] | {packages: string[]};
}
```

### WorkMode

```typescript
type WorkMode = 'development' | 'production';
```

### CommandDefinition

```typescript
interface CommandDefinition<A> {
    run(args: A, rest?: string | string[]): Promise<void>;
}
```

## 导出 API

```typescript
// 项目相关
export { findGitRoot, findMonorepoRoot, isMonorepo, isMonorepoRoot };
export { isProjectSourceIn, normalizeRuleMatch };
export { readPackageConfig, resolveCacheLocation, resolveMonorepoPackageDirectories };

// 模块解析
export { resolve, resolveFrom, importUserModule, dirFromImportMeta };
export { resolveDependencyVersion, resolveCoreJsVersion };

// 日志
export { logger };

// 环境
export { prepareEnvironment };

// 异步工具
export { pMap, pFilter, pReduce };

// Git
export { gitStatus, GitStatusResult };

// 工具
export { compact, currentUserName, isInDebugMode };

// 类型
export { CommandDefinition, PackageInfo, ProjectAware, WorkMode, WorkModeAware };
```

## 依赖关系

```json
{
  "dependencies": {
    "bundle-require": "^5.1.0",
    "caller": "^1.1.0",
    "dedent": "^1.7.1",
    "dotenv": "^17.2.3",
    "dotenv-expand": "^12.0.3",
    "find-up": "^8.0.0",
    "g-status": "^2.0.2",
    "globby": "^16.1.0",
    "kolorist": "^1.8.0",
    "pkg-dir": "^9.0.0",
    "resolve": "^1.22.11",
    "unixify": "^1.0.0"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `bundle-require` | 动态导入 TS 文件 |
| `dotenv` / `dotenv-expand` | 环境变量加载 |
| `find-up` | 向上查找文件 |
| `globby` | 文件 glob 匹配 |
| `kolorist` | 终端颜色输出 |
| `resolve` | Node.js 模块解析 |

## 设计优势

1. **无依赖循环**：作为底层包，不依赖其他 @nut-up 包
2. **通用性强**：提供的工具函数可被任何包使用
3. **Monorepo 支持**：环境变量、项目探测等都支持 monorepo 场景
4. **类型完备**：完整的 TypeScript 类型定义
5. **ESM + CJS**：提供内部 CJS 导出以兼容特殊场景

## 发布配置

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./willBreakingInternalUseOnly": {
      "types": "./dist/internal.d.cts",
      "default": "./dist/internal.cjs"
    }
  }
}
```