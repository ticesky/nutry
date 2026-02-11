# @nut-up/cli-build

构建命令包，提供 `nut build` 命令的具体实现。

## 概述

`@nut-up/cli-build` 是 `nut build` 命令的实现包，由 `@nut-up/cli` 动态导入调用。它负责执行 Webpack 生产构建，支持多特性矩阵构建、增量构建、Bundle 分析等功能。

## 整体架构

```
@nut-up/cli (nut build 命令)
    ↓ 动态导入
@nut-up/cli-build
    ├→ index.ts (入口，run 函数)
    │     ├→ 环境准备
    │     ├→ 读取项目配置
    │     ├→ 特性矩阵处理
    │     └→ 调用 build 或 watch
    │
    ├→ utils.ts (工具函数)
    │     ├→ drawFeatureMatrix()
    │     ├→ createBuildContextWith()
    │     └→ validateFeatureNames()
    │
    └→ webpack/
          ├→ index.ts (Webpack 构建入口)
          ├→ build.ts (生产构建)
          ├→ watch.ts (监听构建)
          └→ inspect/ (构建检查)
```

## 执行流程详解

### 1. 入口函数：run()

```typescript
export const run = async (cmd: BuildCommandLineArgs): Promise<void> => {
    const {cwd, mode, configFile} = cmd;
    
    // 1. 设置 Node 环境变量
    process.env.NODE_ENV = mode;
    
    // 2. 准备环境（加载 .env 文件）
    await prepareEnvironment(cwd, mode, cmd.envFiles);

    // 3. 校验参数
    if (cmd.analyze && !cmd.buildTarget) {
        logger.error('--analyze must be used with --build-target');
        process.exit(21);
    }

    // 4. 读取项目配置
    const projectSettings = await readProjectSettings({...});

    // 5. 校验配置和依赖
    validateProjectSettings(projectSettings);
    await strictCheckRequiredDependency(projectSettings, cwd);

    // 6. 执行构建或监听
    if (cmd.watch) {
        void watch(cmd, projectSettings);
    }
    else {
        void build(cmd, projectSettings);
    }
};
```

### 2. 生产构建：build()

```typescript
const build = async (cmd: BuildCommandLineArgs, projectSettings: ProjectSettings): Promise<void> => {
    // 1. 获取特性名称列表（排除 excludeFeatures）
    const featureNames = difference(
        Object.keys(projectSettings.featureMatrix), 
        projectSettings.build.excludeFeatures
    );

    // 2. 校验特性名称
    validateFeatureNames(featureNames, cmd.featureOnly);
    
    // 3. 打印特性矩阵
    drawFeatureMatrix(projectSettings, cmd.featureOnly);

    // 4. 清理 dist 目录（如果指定 --clean）
    if (clean) {
        await fs.rm(path.join(cwd, 'dist'), {recursive: true, force: true});
    }

    // 5. 收集入口文件
    const entries = await collectEntries(entryLocation);
    
    // 6. 创建构建上下文
    const createBuildContext = await createBuildContextWith({cmd, projectSettings, entries});
    
    // 7. 执行构建（为每个特性创建构建上下文）
    await build({
        cmd, 
        projectSettings, 
        buildContextList: featureNamesToUse.map(createBuildContext)
    });
};
```

### 3. 监听构建：watch()

```typescript
const watch = async (cmd: BuildCommandLineArgs, projectSettings: ProjectSettings): Promise<void> => {
    const buildTarget = cmd.buildTarget ?? 'dev';
    
    // 收集入口和创建上下文
    const entries = await collectEntries(entryLocation);
    const createBuildContext = await createBuildContextWith({cmd, projectSettings, entries});
    
    // 执行监听构建
    await watch({
        cmd, 
        projectSettings, 
        buildContext: createBuildContext(buildTarget)
    });
};
```

## 特性矩阵

特性矩阵允许为不同的构建目标定义不同的特性开关：

```typescript
// nut.config.ts
export default configure('webpack', {
    featureMatrix: {
        stable: {
            enableNewFeature: false,
            apiEndpoint: 'https://api.example.com',
        },
        dev: {
            enableNewFeature: true,
            apiEndpoint: 'https://dev-api.example.com',
        },
        beta: {
            enableNewFeature: true,
            apiEndpoint: 'https://beta-api.example.com',
        },
    },
    build: {
        excludeFeatures: ['dev'],  // 构建时排除 dev 特性
    },
});
```

**构建时：**
- 默认构建所有特性（除 excludeFeatures 外）
- 使用 `--feature-only=stable` 只构建指定特性
- 使用 `--build-target=dev` 指定构建目标

## 命令行参数

```typescript
interface BuildCommandLineArgs {
    cwd: string;                    // 工作目录
    mode: WorkMode;                 // 构建模式
    configFile?: string;            // 配置文件路径
    envFiles?: string[];            // 环境文件列表
    srcDirectory: string;           // 源码目录
    entriesDirectory: string;       // 入口目录
    buildTarget?: string;           // 构建目标
    featureOnly?: string;           // 仅构建指定特性
    entriesOnly?: string[];         // 仅构建指定入口
    strict: boolean;                // 严格模式
    analyze: boolean;               // Bundle 分析
    profile: boolean;               // React 性能分析
    sourceMaps: boolean;            // 是否生成 SourceMap
    clean: boolean;                 // 构建前清理
    cacheDirectory?: string;        // 缓存目录
    watch: boolean;                 // 监听模式
}
```

## 功能特性

| 特性 | 说明 |
|------|------|
| **多特性构建** | 一次构建多个特性版本 |
| **增量构建** | 支持文件系统缓存 |
| **Bundle 分析** | `--analyze` 生成分析报告 |
| **监听模式** | `--watch` 文件变化自动重建 |
| **严格检查** | `--strict` 启用额外检查 |
| **入口过滤** | `--entries-only` 只构建指定入口 |

## 依赖关系

```json
{
  "dependencies": {
    "@nut-up/config-lint": "workspace:*",
    "@nut-up/config-webpack": "workspace:*",
    "@nut-up/core": "workspace:*",
    "@nut-up/settings": "workspace:*",
    "@nut-up/utils-build": "workspace:*",
    "kolorist": "^1.8.0",
    "matcher": "^6.0.0",
    "pretty-bytes": "^7.1.0",
    "tty-table": "^5.0.0",
    "webpack-bundle-analyzer": "^5.2.0"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `@nut-up/config-webpack` | Webpack 配置生成 |
| `webpack-bundle-analyzer` | Bundle 分析 |
| `tty-table` | 终端表格输出 |
| `pretty-bytes` | 文件大小格式化 |

## 与 @nut-up/cli 的关系

```
@nut-up/cli
    │
    │  BuildCommand.execute()
    │      ↓
    │  DynamicImportCommand.importCommandPackage()
    │      ↓
    │  resolve('@nut-up/cli-build')
    │      ↓
    └─→ { run } ← @nut-up/cli-build 导出
            ↓
        run(commandLineArgs)
```

## 发布配置

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```