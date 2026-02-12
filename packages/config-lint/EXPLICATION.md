# @nutry/config-lint

代码检查配置包，提供 ESLint 和 StyleLint 的预设配置。

## 概述

`@nutry/config-lint` 是 nutry 构建工具的代码检查配置层，提供开箱即用的 ESLint 和 StyleLint 配置。它集成了 TypeScript、React、React Hooks、JSX A11y 等规则，以及 Less/SCSS 样式检查规则。

## 整体架构

```
@nutry/config-lint
├─ index.ts              # 入口，统一导出
│   ├─ getScriptLintConfig()      # 获取 ESLint 配置
│   ├─ getStyleLintConfig()       # 获取 StyleLint 配置
│   ├─ getScriptLintBaseConfig()  # 获取基础 ESLint 配置
│   └─ getStyleLintBaseConfig()   # 获取基础 StyleLint 配置
│
├─ eslint.ts             # ESLint 配置
│   └─ eslintConfig              # 完整配置数组
│
└─ stylelint.ts          # StyleLint 配置
    └─ stylelintConfig           # 完整配置对象
```

## 核心功能详解

### 1. ESLint 配置

```typescript
import {eslintConfig} from './eslint.js';

export const getScriptLintConfig = () => [...eslintConfig];

// 检查是否有自定义配置，有则返回 undefined 让 ESLint 使用用户配置
export const getScriptLintBaseConfig = ({cwd}: BaseConfigOptions): ESLintConfig[] | undefined => {
    return hasCustomScriptLintConfig(cwd) ? undefined : getScriptLintConfig();
};
```

**支持的自定义配置文件：**
- `.eslintrc.js`
- `.eslintrc.cjs`
- `.eslintrc.json`
- `eslint.config.js`
- `eslint.config.mjs`
- `eslint.config.cjs`

### 2. StyleLint 配置

```typescript
import {stylelintConfig} from './stylelint.js';

export const getStyleLintConfig = () => stylelintConfig;

// 检查是否有自定义配置
export const getStyleLintBaseConfig = ({cwd}: BaseConfigOptions): StyleLintConfig | undefined => {
    return hasCustomStyleLintConfig(cwd) ? undefined : getStyleLintConfig();
};
```

**支持的自定义配置文件：**
- `stylelint.config.js`
- `stylelint.config.mjs`
- `stylelint.config.cjs`

## ESLint 规则集

### 预设和插件

| 预设/插件 | 用途 |
|----------|------|
| `@eslint/js` | ESLint 核心规则 |
| `typescript-eslint` | TypeScript 支持 |
| `eslint-plugin-react` | React 规则 |
| `eslint-plugin-react-hooks` | React Hooks 规则 |
| `eslint-plugin-jsx-a11y` | 无障碍规则 |
| `eslint-plugin-import` | 导入/导出规则 |

### 检查的文件类型

- `.js`, `.jsx`
- `.ts`, `.tsx`
- `.mjs`, `.cjs`

## StyleLint 规则集

### 预设

| 预设 | 用途 |
|------|------|
| `stylelint-config-standard` | 标准 CSS 规则 |
| `stylelint-config-standard-less` | Less 规则 |
| `stylelint-config-standard-scss` | SCSS 规则 |

### 检查的文件类型

- `.css`
- `.less`
- `.scss`

## 使用方式

### 在项目中直接使用

```javascript
// eslint.config.mjs
import {defineConfig} from 'eslint/config';
import {default as baseConfig} from '@nutry/config-lint/eslint';

export default defineConfig(
    ...baseConfig,
    {
        // 项目自定义规则
        rules: {
            'no-console': 'warn',
        },
    }
);
```

### 在 Webpack 插件中使用

```typescript
import {getScriptLintBaseConfig, getStyleLintBaseConfig} from '@nutry/config-lint';

// ESLint 插件配置
const eslintOptions = {
    baseConfig: getScriptLintBaseConfig({cwd}),
    // ...
};

// StyleLint 插件配置
const stylelintOptions = {
    config: getStyleLintBaseConfig({cwd}),
    // ...
};
```

## 导出 API

```typescript
// 配置获取
export { getScriptLintConfig };       // 获取 ESLint 配置
export { getStyleLintConfig };        // 获取 StyleLint 配置
export { getScriptLintBaseConfig };   // 获取基础 ESLint 配置（检查自定义配置）
export { getStyleLintBaseConfig };    // 获取基础 StyleLint 配置（检查自定义配置）

// 原始配置
export { eslintConfig };              // ESLint 配置数组
export { stylelintConfig };           // StyleLint 配置对象
```

## 依赖关系

```json
{
  "dependencies": {
    "@eslint/js": "^9.39.2",
    "eslint-plugin-import": "^2.32.0",
    "eslint-plugin-jsx-a11y": "^6.10.2",
    "eslint-plugin-react": "^7.37.5",
    "eslint-plugin-react-hooks": "^7.0.1",
    "postcss-less": "^6.0.0",
    "stylelint-config-standard": "^40.0.0",
    "stylelint-config-standard-less": "^4.0.1",
    "stylelint-config-standard-scss": "^17.0.0",
    "stylelint-less": "^4.0.0",
    "typescript-eslint": "^8.54.0"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `@eslint/js` | ESLint 核心规则 |
| `typescript-eslint` | TypeScript ESLint 支持 |
| `eslint-plugin-react` | React 相关规则 |
| `eslint-plugin-react-hooks` | Hooks 规则检查 |
| `eslint-plugin-jsx-a11y` | 无障碍检查 |
| `stylelint-config-standard-less` | Less 样式检查 |

## 配置优先级

当项目中存在自定义配置文件时，`getScriptLintBaseConfig` 和 `getStyleLintBaseConfig` 会返回 `undefined`，让工具使用用户的自定义配置：

```
项目根目录
├─ eslint.config.mjs       ← 存在时使用此配置
├─ stylelint.config.js     ← 存在时使用此配置
└─ src/
```

## 设计优势

1. **开箱即用**：预设合理的默认规则，无需配置即可使用
2. **可扩展**：支持用户自定义配置覆盖
3. **类型安全**：完整的 TypeScript 支持
4. **全面覆盖**：同时支持脚本和样式检查
5. **现代化**：支持 ESLint Flat Config 格式

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