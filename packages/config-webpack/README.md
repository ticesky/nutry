# @nut-up/config-webpack

Webpack 配置核心包，提供完整的 Webpack 配置生成能力。

## 概述

`@nut-up/config-webpack` 是 nut-up 构建工具的核心配置包，负责生成完整的 Webpack 配置。它采用**模块化配置片段（Partials）** 设计，通过组合不同的配置片段来构建最终配置，支持开发和生产两种模式，并提供丰富的 Loader 和 Rule 预设。

## 整体架构

```
@nut-up/config-webpack
├─ index.ts                    # 入口，导出核心 API
│   ├─ createWebpackConfig()   # 创建 Webpack 配置
│   └─ collectEntries()        # 收集入口文件
│
├─ partials/                   # 配置片段
│   ├─ base.ts                 # 基础配置
│   ├─ development.ts          # 开发模式配置
│   ├─ production.ts           # 生产模式配置
│   ├─ external.ts             # 第三方库配置
│   ├─ serviceWorker.ts        # Service Worker 配置
│   └─ strict.ts               # 严格模式配置
│
├─ loaders/                    # Loader 配置工厂
│   ├─ babel.ts, css.ts, less.ts, postcss.ts
│   ├─ style.ts, cssModules.ts, cssExtract.ts
│   ├─ classNames.ts, svgToComponent.ts
│   └─ ...
│
├─ rules/                      # Webpack Rules
│   └─ index.ts                # script, less, css, image, svg, file 等
│
├─ utils/                      # 工具函数
│   ├─ loader.ts               # Loader 引入工具
│   ├─ html.ts                 # HTML 插件工具
│   ├─ entry.ts                # 入口转换工具
│   └─ merge.ts                # 配置合并工具
│
└─ assets/
    └─ default-html.ejs        # 默认 HTML 模板
```

## 执行流程详解

### 1. 核心函数：createWebpackConfig()

```typescript
export const createWebpackConfig = async (context: BuildContext, options: Options = {}) => {
    const {strict, extras = []} = options;
    
    // 1. 确定需要加载的配置片段
    const partialNames: Array<keyof typeof partials | false> = [
        'base',                                                    // 始终加载
        context.mode,                                              // development 或 production
        context.usage === 'build' && hasServiceWorker(context) && 'serviceWorker',
        context.projectSettings.build.thirdParty && 'external',
    ];
    
    // 2. 并行加载所有配置片段
    const configurations = await pMap(partialNames.filter(excludeFalse), createPartialWith(context));
    
    // 3. 组合所有配置
    const internalPartials: Configuration[] = [
        ...configurations,
        strictPartial(strict, context.cwd),
        ...extras,
    ];
    const internalCreated = mergeBuiltin(internalPartials);
    
    // 4. 提供扩展接口
    const internals: BuildInternals = {
        rules,
        loader: introduceLoader,
        loaders: introduceLoaders,
    };
    
    // 5. 调用用户的 finalize 钩子
    const finalized = await context.projectSettings.build.finalize(internalCreated, context, internals);
    
    return finalized;
};
```

**配置组合流程：**

```
partials/base.ts        →  基础配置（entry, output, module, resolve, cache, plugins）
        ↓
partials/development.ts →  开发配置（devtool: 'eval-cheap-module-source-map'）
   或                       或
partials/production.ts  →  生产配置（devtool: 'source-map', optimization, performance）
        ↓
partials/serviceWorker.ts → Service Worker 支持（可选）
        ↓
partials/external.ts    →  第三方库配置（可选）
        ↓
partials/strict.ts      →  严格模式配置（可选）
        ↓
extras                  →  用户额外配置
        ↓
webpack-merge           →  合并所有配置
        ↓
finalize()              →  用户最终自定义
        ↓
最终 Webpack 配置
```

### 2. 基础配置：partials/base.ts

这是最核心的配置片段，包含：

```typescript
const factory: ConfigurationFactory = async entry => {
    // 1. 计算缓存 Key（基于项目信息、配置文件、lock 文件等）
    const cacheKey = await computeCacheKey(entry);
    
    // 2. 生成所有 module rules
    const moduleRules = await Promise.all(Object.values(rules).map(rule => rule(entry)));
    
    // 3. 构造环境变量定义
    const defines: DefineContext = {
        features,
        mode,
        buildVersion,
        buildTarget,
        buildTime,
        env: process.env,
    };
    
    // 4. 配置插件
    const plugins = [
        ...htmlPlugins,                                    // HTML 生成
        new MiniCssExtractPlugin({...}),                   // CSS 提取
        new ContextReplacementPlugin(/moment/, ...),       // moment.js 优化
        new DefinePlugin(constructDynamicDefines(defines)),// 环境变量注入
        new ESLintPlugin(eslintOptions),                   // ESLint 检查
        new StyleLintPlugin(styleLintOptions),             // StyleLint 检查
    ];
    
    return {
        mode,
        context: cwd,
        entry: {...},           // 入口配置
        output: {...},          // 输出配置
        module: {rules},        // 模块规则
        resolve: {...},         // 解析配置
        cache: {...},           // 缓存配置
        snapshot: {...},        // 快照配置
        plugins,
        optimization: {},
    };
};
```

**关键配置项：**

| 配置项 | 说明 |
|--------|------|
| `entry` | 从 `entries` 数组转换为 Webpack 入口对象 |
| `output.path` | 输出到 `dist` 目录 |
| `output.filename` | `assets/[name].[chunkhash].js` |
| `resolve.alias` | `@` → `src/`，支持包名别名 |
| `resolve.extensions` | `.js`, `.jsx`, `.ts`, `.tsx` |
| `cache` | 支持 `persist`（文件系统）、`memory`、`off` 三种模式 |

### 3. Rules 规则系统

`rules/index.ts` 定义了各种资源的处理规则：

```typescript
// 脚本文件规则
export const script = async (entry): Promise<RuleSetRule> => {
    return {
        test: /\.[jt]sx?$/,
        oneOf: [
            {
                resource: normalizeRuleMatch(cwd, babel),  // 需要 babel 的文件
                oneOf: [
                    {resource: isProjectSource, use: ['babel']},
                    {use: ['babel']},
                ],
            },
            {...},  // 不需要 babel 的文件
        ],
    };
};

// Less 规则
export const less = async (entry): Promise<RuleSetRule> => {
    return {
        test: /\.less$/,
        oneOf: [
            {test: /\.global\.less$/, use: [final, 'css', 'postcss', 'less']},
            {resource: modules, use: ['classNames', final, 'cssModules', 'postcss', 'less']},
            {use: [final, 'css', 'postcss', 'less']},
        ],
    };
};
```

**支持的资源类型：**

| Rule | 匹配文件 | 处理方式 |
|------|----------|----------|
| `script` | `.js`, `.jsx`, `.ts`, `.tsx` | Babel 转译 |
| `less` | `.less` | Less → PostCSS → CSS |
| `css` | `.css` | PostCSS → CSS |
| `image` | `.jpg`, `.png`, `.gif` | Asset Resource |
| `svg` | `.svg` | Asset 或 React 组件 |
| `file` | `.eot`, `.ttf`, `.woff`, `.woff2` | Asset |
| `url` | `?url` 查询 | Asset Resource |
| `raw` | `?raw` 查询 | Asset Source |

### 4. Loader 工厂系统

`loaders/` 目录提供了各种 Loader 的配置工厂：

```typescript
// loaders/index.ts 导出的 Loader
export {default as babel} from './babel.js';
export {default as style} from './style.js';
export {default as css} from './css.js';
export {default as cssModules} from './cssModules.js';
export {default as postcss} from './postcss.js';
export {default as less} from './less.js';
export {default as classNames} from './classNames.js';
export {default as cssExtract} from './cssExtract.js';
export {default as svgToComponent} from './svgToComponent.js';
// ...
```

**Loader 引入工具：**

```typescript
// utils/loader.ts
export const introduceLoader = (name: LoaderType, entry: WebpackBuildEntry): Promise<RuleSetUseItem | null> => {
    const factory = loaders[name];
    return factory(entry);
};

export const introduceLoaders = async (names: MayBeLoader[], entry: WebpackBuildEntry): Promise<RuleSetUseItem[]> => {
    const items = await Promise.all(compact(names).map(v => introduceLoader(v, entry)));
    return compact(items);
};
```

### 5. 入口收集：collectEntries()

```typescript
export const collectEntries = async (location: EntryLocation): Promise<Array<AppEntry<EntryConfig>>> => {
    const options: EntryOptions<EntryConfig> = {
        ...location,
        templateExtension: '.ejs',
        defaultTemplate: DEFAULT_HTML_TEMPLATE,
        transformConfig: (imported, resolved) => {
            const value = imported ?? {};
            validateEntryConfig(value, resolved ?? '[unknown-file]');
            return value;
        },
    };

    return collectAppEntries(options);
};
```

**入口配置结构：**

```typescript
interface EntryConfig {
    entry?: Omit<EntryDescriptor, 'import'>;  // Webpack entry 配置
    html?: Record<string, any>;                // HTML 模板变量
}

// 允许的配置键
const ALLOWED_ENTRY_KEYS = new Set(['entry', 'html', 'templateData']);
```

## 配置片段详解

### development.ts（开发模式）

```typescript
const factory: ConfigurationFactory = () => {
    return {
        devtool: 'eval-cheap-module-source-map',  // 快速 sourcemap
    };
};
```

### production.ts（生产模式）

```typescript
const factory: ConfigurationFactory = async entry => {
    return {
        devtool: 'source-map',                    // 完整 sourcemap
        resolve: {
            alias: {
                // 使用 UMD 生产版本
                react$: 'react/umd/react.production.min.js',
                'react-dom$': 'react-dom/umd/react-dom.production.min.js',
                // ...
            },
        },
        performance: {
            maxEntrypointSize: Infinity,
            maxAssetSize: 1.5 * 1024 * 1024,      // 最大 1.5MB
        },
        optimization: {
            removeEmptyChunks: true,
            sideEffects: true,
        },
    };
};
```

### strict.ts（严格模式）

```typescript
interface StrictOptions {
    disableRequireExtension?: boolean;    // 禁用 require.ensure/include/context
    caseSensitiveModuleSource?: boolean;  // 大小写敏感
    typeCheck?: boolean;                  // TypeScript 类型检查
}
```

## 样式处理流程

### Less 文件处理链

```
.less 文件
    ↓
less-loader          # Less → CSS
    ↓
postcss-loader       # CSS 转换（autoprefixer 等）
    ↓
css-loader           # 处理 @import 和 url()
    ↓
style-loader         # 开发模式：注入 <style>
   或
MiniCssExtractPlugin # 生产模式：提取到 .css 文件
```

### CSS Modules 支持

```
*.global.less  →  全局样式，不启用 CSS Modules
*.less         →  根据配置决定是否启用 CSS Modules
                  启用时：classNames-loader → css-loader(modules) → ...
```

## 缓存策略

```typescript
cache: cache === 'off'
    ? false
    : (
        cache === 'persist'
            ? {
                type: 'filesystem',
                version: cacheKey,                              // 基于项目信息计算
                cacheDirectory: cacheDirectory,
                name: `${usage}-${mode}`,                       // dev-server-development
            }
            : {type: 'memory'}
    ),
```

**缓存 Key 计算因素：**
- `usage`（build / devServer）
- `mode`（development / production）
- `hostPackageName`
- `cwd`
- 配置文件内容
- `pnpm-lock.yaml`
- `package.json`
- `.browserslistrc`

## 导出 API

```typescript
// 主要导出
export { createWebpackConfig };           // 创建 Webpack 配置
export { collectEntries };                // 收集入口文件
export { createHtmlPluginInstances };     // 创建 HTML 插件
export { createTransformHtmlPluginInstance };

// 子路径导出
// @nut-up/config-webpack/loaders
export * from './loaders/index.js';

// @nut-up/config-webpack/rules
export * from './rules/index.js';
```

## 类型定义

### BuildContext

```typescript
type BuildContext = BuildContextGeneric<EntryConfig, WebpackProjectSettings>;

// 包含的属性
interface BuildContext {
    usage: 'build' | 'devServer';
    cwd: string;
    srcDirectory: string;
    mode: 'development' | 'production';
    hostPackageName: string;
    features: Record<string, any>;
    buildTarget: string;
    buildVersion: string;
    buildTime: string;
    entries: Array<AppEntry<EntryConfig>>;
    cache: 'persist' | 'memory' | 'off';
    cacheDirectory?: string;
    projectSettings: WebpackProjectSettings;
}
```

### StrictOptions

```typescript
interface StrictOptions {
    disableRequireExtension?: boolean;   // 禁止使用 require.ensure 等
    caseSensitiveModuleSource?: boolean; // 模块路径大小写敏感
    typeCheck?: boolean;                 // 开启类型检查
}
```

## 依赖关系

```json
{
  "dependencies": {
    "@nut-up/config-babel": "workspace:*",
    "@nut-up/core": "workspace:*",
    "@nut-up/settings": "workspace:*",
    "@nut-up/utils-build": "workspace:*",
    "babel-loader": "^10.0.0",
    "css-loader": "^7.1.2",
    "less-loader": "^12.3.0",
    "postcss-loader": "^8.2.0",
    "style-loader": "^4.0.0",
    "mini-css-extract-plugin": "^2.10.0",
    "html-webpack-plugin": "^5.6.6",
    "eslint-webpack-plugin": "^5.0.2",
    "stylelint-webpack-plugin": "^5.0.1",
    "@svgr/webpack": "^8.1.0",
    "workbox-webpack-plugin": "^7.4.0",
    // ...
  },
  "peerDependencies": {
    "typescript": "5.x",
    "webpack": "^5.74.0"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `@nut-up/config-babel` | Babel 配置 |
| `babel-loader` | JS/TS 转译 |
| `css-loader` / `less-loader` / `postcss-loader` | 样式处理 |
| `mini-css-extract-plugin` | CSS 提取 |
| `html-webpack-plugin` | HTML 生成 |
| `eslint-webpack-plugin` / `stylelint-webpack-plugin` | 代码检查 |
| `@svgr/webpack` | SVG 转 React 组件 |
| `workbox-webpack-plugin` | Service Worker 支持 |

## 设计优势

1. **模块化配置**：通过 Partials 分离不同场景的配置，便于维护和扩展
2. **按需加载**：根据项目配置动态加载所需的配置片段
3. **智能缓存**：基于多因素计算缓存 Key，确保配置变化时自动失效
4. **类型安全**：完整的 TypeScript 类型定义，编译时检查配置正确性
5. **可扩展**：通过 `finalize` 钩子支持用户自定义配置
6. **多导出**：提供 `loaders` 和 `rules` 子路径导出，便于高级用户复用

## 使用示例

### 基本使用

```typescript
import { createWebpackConfig, collectEntries } from '@nut-up/config-webpack';

const entries = await collectEntries({
    cwd: process.cwd(),
    srcDirectory: 'src',
    entryDirectory: 'entries',
});

const config = await createWebpackConfig(buildContext, {
    strict: {
        typeCheck: true,
        caseSensitiveModuleSource: true,
    },
    extras: [customConfig],
});
```

### 使用内置 Rules

```typescript
import * as rules from '@nut-up/config-webpack/rules';

const scriptRule = await rules.script(entry);
const lessRule = await rules.less(entry);
```

### 使用内置 Loaders

```typescript
import { introduceLoaders } from '@nut-up/config-webpack';

const loaders = await introduceLoaders(['babel', 'css', 'postcss'], entry);
```

## 发布配置

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./loaders": "./dist/loaders/index.js",
    "./rules": "./dist/rules/index.js"
  },
  "files": ["dist"]
}
```

- 主入口：完整的配置生成 API
- `./loaders`：独立的 Loader 配置工厂
- `./rules`：独立的 Rule 配置工厂