# @nut-up/config-babel

Babel 配置包，提供完整的 Babel 预设和插件配置。

## 概述

`@nut-up/config-babel` 是 nut-up 构建工具的 Babel 配置层，负责生成用于 JavaScript/TypeScript 转译的 Babel 配置。它支持 React、TypeScript、装饰器、可选链等现代语法特性，并根据不同的构建模式（开发/生产）和使用场景（应用/库）提供优化配置。

## 整体架构

```
@nut-up/config-babel
├─ index.ts              # 入口，核心 API
│   ├─ getBabelConfig()           # 完整 Babel 配置
│   ├─ getTransformBabelConfig()  # 转换配置
│   └─ getParseOnlyBabelConfig()  # 仅解析配置
│
├─ transform.ts          # 转换配置
│   └─ 包含 lodash 优化、React 优化等
│
├─ transformMinimal.ts   # 最小转换配置
│   └─ presets 和基础 plugins
│
├─ parseOnly.ts          # 仅解析配置
│   └─ 用于 ESLint 等工具
│
├─ utils.ts              # 工具函数
│   ├─ fillBabelConfigOptions()   # 填充默认选项
│   ├─ shouldEnable()             # 判断功能是否启用
│   └─ compatPluginTarget()       # 插件兼容处理
│
└─ interface.ts          # 类型定义
```

## 执行流程详解

### 1. 完整配置：getBabelConfig()

```typescript
export const getBabelConfig = (input?: BabelConfigOptions): TransformOptions => {
    const options = fillBabelConfigOptions(input);
    const {mode, hot, hostType, cwd, srcDirectory} = options;
    
    // 获取转换配置
    const transform = getTransformBabelConfig(options);
    
    // 是否需要 React 生产优化
    const requireReactOptimization = mode === 'production' && hostType === 'application';
    
    const plugins: Array<PluginItem | false> = [
        // 调试时显示组件文件名（开发模式 + 应用场景）
        // requireFileName(options) && [debugReactComponentFileName, {...}],
        
        ...transform.plugins || [],
        
        // 生产模式移除 PropTypes
        requireReactOptimization && compatPluginTarget(pluginRemovePropTypes),
        
        // 热更新支持
        hot && [compatPluginTarget(pluginReactRefresh), {skipEnvCheck: true}],
    ];

    return {presets: transform.presets, plugins: compact(plugins)};
};
```

### 2. 转换配置：getTransformBabelConfig()

```typescript
export default (options: BabelConfigOptionsFilled): TransformOptions => {
    const minimal = getTransformMinimalBabelConfig(options);
    
    const plugins: Array<PluginItem | false> = [
        // 显示组件 displayName（开发模式）
        // requireDisplayName(options) && compatPluginTarget(addReactDisplayName),
        
        ...minimal.plugins || [],
        
        // Lodash 按需导入优化（生产模式）
        requireLodashOptimization(options) && [
            compatPluginTarget(pluginLodash),
            {id: ['lodash', 'lodash-decorators']},
        ],
        
        // React 常量元素提升
        compatPluginTarget(pluginReactConstantElement),
        
        // React 内联元素优化
        compatPluginTarget(pluginReactInlineElement),
    ];

    return {
        presets: minimal.presets,
        plugins: compact(plugins),
    };
};
```

### 3. 最小转换配置

包含 presets 和基础 plugins：

**Presets:**
- `@babel/preset-env` - 环境适配
- `@babel/preset-react` - React JSX 转换
- `@babel/preset-typescript` - TypeScript 支持

**基础 Plugins:**
- `@babel/plugin-proposal-decorators` - 装饰器
- `@babel/plugin-proposal-class-properties` - 类属性
- `@babel/plugin-proposal-do-expressions` - do 表达式
- `@babel/plugin-proposal-export-default-from` - export default from
- `@babel/plugin-proposal-export-namespace-from` - export * as
- `@babel/plugin-proposal-throw-expressions` - throw 表达式
- `@babel/plugin-syntax-dynamic-import` - 动态导入
- `@babel/plugin-syntax-import-meta` - import.meta
- `babel-plugin-styled-components` - styled-components 支持
- `@emotion/babel-plugin` - Emotion CSS-in-JS 支持

### 4. 仅解析配置：getParseOnlyBabelConfig()

```typescript
// 用于 ESLint 等只需要解析语法的场景
export const getParseOnlyBabelConfig = (options?: BabelConfigOptions): TransformOptions => {
    return getParseOnlyBabelConfigFilled(fillBabelConfigOptions(options));
};
```

## 配置选项

### BabelConfigOptions

```typescript
interface BabelConfigOptions {
    readonly uses?: ThirdPartyUse[];        // 使用的第三方库 ['lodash', ...]
    readonly mode?: WorkMode;               // 'development' | 'production'
    readonly hot?: boolean;                 // 是否启用热更新
    readonly hostType?: 'application' | 'library';  // 宿主类型
    readonly polyfill?: boolean | string | number;  // polyfill 配置
    readonly modules?: false | 'commonjs';  // 模块格式
    readonly displayName?: boolean | 'auto';// 是否显示组件名
    readonly cwd?: string;                  // 工作目录
    readonly srcDirectory?: string;         // 源码目录
    readonly openInEditorPrefix?: string;   // 编辑器打开前缀
}
```

### 默认值

```typescript
const DEFAULT_OPTIONS: BabelConfigOptionsFilled = {
    uses: ['lodash'],
    mode: 'development',
    hot: false,
    hostType: 'application',
    polyfill: true,
    modules: false,
    displayName: 'auto',
    cwd: process.cwd(),
    srcDirectory: 'src',
    openInEditorPrefix: '',
};
```

## 插件列表

### 语法支持插件

| 插件 | 功能 |
|------|------|
| `@babel/plugin-proposal-decorators` | 装饰器语法 |
| `@babel/plugin-proposal-class-properties` | 类属性 |
| `@babel/plugin-proposal-do-expressions` | do 表达式 |
| `@babel/plugin-proposal-export-default-from` | `export v from 'mod'` |
| `@babel/plugin-proposal-export-namespace-from` | `export * as ns from 'mod'` |
| `@babel/plugin-proposal-throw-expressions` | throw 表达式 |
| `@babel/plugin-syntax-dynamic-import` | `import()` 动态导入 |
| `@babel/plugin-syntax-import-meta` | `import.meta` |

### 优化插件

| 插件 | 条件 | 功能 |
|------|------|------|
| `babel-plugin-lodash` | production + uses lodash | Lodash 按需导入 |
| `@babel/plugin-transform-react-constant-elements` | 始终 | React 常量提升 |
| `@babel/plugin-transform-react-inline-elements` | 始终 | React 内联优化 |
| `babel-plugin-transform-react-remove-prop-types` | production + application | 移除 PropTypes |

### 开发插件

| 插件 | 条件 | 功能 |
|------|------|------|
| `react-refresh/babel` | hot === true | React 热更新 |
| `@reskript/babel-plugin-add-react-display-name` | displayName | 添加组件名 |
| `@reskript/babel-plugin-debug-react-component-file-name` | development + application | 调试文件名 |

### CSS-in-JS 插件

| 插件 | 功能 |
|------|------|
| `babel-plugin-styled-components` | styled-components 支持 |
| `@emotion/babel-plugin` | Emotion 支持 |

## 使用示例

### 基本使用

```typescript
import {getBabelConfig} from '@nut-up/config-babel';

const config = getBabelConfig({
    mode: 'production',
    hot: false,
    hostType: 'application',
});

// 在 webpack 中使用
module.exports = {
    module: {
        rules: [
            {
                test: /\.[jt]sx?$/,
                use: {
                    loader: 'babel-loader',
                    options: config,
                },
            },
        ],
    },
};
```

### 开发模式 + 热更新

```typescript
const config = getBabelConfig({
    mode: 'development',
    hot: true,
    displayName: true,
});
```

### 库模式

```typescript
const config = getBabelConfig({
    mode: 'production',
    hostType: 'library',
    modules: 'commonjs',  // 输出 CommonJS
});
```

## 导出 API

```typescript
// 核心函数
export { getBabelConfig };           // 完整配置（推荐）
export { getTransformBabelConfig };  // 转换配置
export { getParseOnlyBabelConfig };  // 仅解析配置

// 类型
export type { BabelConfigOptions };
```

## 依赖关系

```json
{
  "dependencies": {
    "@babel/plugin-proposal-class-properties": "^7.18.6",
    "@babel/plugin-proposal-decorators": "^7.28.6",
    "@babel/plugin-proposal-do-expressions": "^7.28.6",
    "@babel/plugin-proposal-export-default-from": "^7.27.1",
    "@babel/plugin-proposal-export-namespace-from": "^7.18.9",
    "@babel/plugin-proposal-nullish-coalescing-operator": "^7.18.6",
    "@babel/plugin-proposal-numeric-separator": "^7.18.6",
    "@babel/plugin-proposal-optional-chaining": "^7.21.0",
    "@babel/plugin-proposal-throw-expressions": "^7.27.1",
    "@babel/plugin-syntax-dynamic-import": "^7.8.3",
    "@babel/plugin-syntax-import-meta": "^7.10.4",
    "@babel/plugin-transform-react-constant-elements": "^7.27.1",
    "@babel/plugin-transform-react-inline-elements": "^7.27.1",
    "@babel/preset-env": "^7.28.6",
    "@babel/preset-react": "^7.28.5",
    "@babel/preset-typescript": "^7.28.5",
    "@emotion/babel-plugin": "^11.13.5",
    "@nut-up/core": "workspace:*",
    "@nut-up/settings": "workspace:*",
    "@reskript/babel-plugin-add-react-display-name": "^6.2.1",
    "@reskript/babel-plugin-debug-react-component-file-name": "^6.2.1",
    "babel-plugin-import": "^1.13.8",
    "babel-plugin-lodash": "^3.3.4",
    "babel-plugin-styled-components": "^2.1.4",
    "babel-plugin-transform-react-remove-prop-types": "^0.4.24",
    "babel-plugin-transform-typescript-metadata": "^0.4.0",
    "react-refresh": "^0.18.0"
  }
}
```

## 配置层次

```
getBabelConfig()
    │
    ├─ getTransformBabelConfig()
    │       │
    │       └─ getTransformMinimalBabelConfig()
    │               │
    │               └─ presets + 基础 plugins
    │
    └─ 额外插件
        ├─ React 热更新
        └─ PropTypes 移除
```

## 模式对比

| 特性 | development | production |
|------|-------------|------------|
| Source Map | 详细 | 压缩 |
| displayName | 自动启用 | 禁用 |
| PropTypes | 保留 | 移除 |
| Lodash 优化 | 禁用 | 启用 |
| 热更新 | 可选 | 禁用 |

## 设计优势

1. **分层配置**：从 minimal 到 full，按需组合
2. **条件加载**：根据 mode、hostType 等自动启用/禁用插件
3. **CSS-in-JS**：内置 styled-components 和 Emotion 支持
4. **TypeScript**：开箱即用的 TS 支持
5. **现代语法**：支持装饰器、可选链等最新语法
6. **生产优化**：自动应用 Lodash、React 等优化

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

- 主入口：完整的配置生成 API
- 内部入口：供特殊场景使用的 CJS 格式