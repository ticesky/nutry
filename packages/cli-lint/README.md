# @nut-up/cli-lint

代码检查命令包，提供 `nut lint` 命令的具体实现。

## 概述

`@nut-up/cli-lint` 是 `nut lint` 命令的实现包，由 `@nut-up/cli` 动态导入调用。它负责执行 ESLint（脚本检查）和 StyleLint（样式检查），支持 Git 暂存区文件检查、自动修复等功能。

## 整体架构

```
@nut-up/cli (nut lint 命令)
    ↓ 动态导入
@nut-up/cli-lint
    ├→ index.ts (入口，run 函数)
    │     ├→ 获取 Git 状态
    │     ├→ 并行执行脚本和样式检查
    │     ├→ 过滤不需要的报告
    │     └→ 输出检查结果
    │
    ├→ script.ts (脚本检查)
    │     └→ ESLint 执行
    │
    ├→ style.ts (样式检查)
    │     └→ StyleLint 执行
    │
    └→ interface.ts (类型定义)
```

## 执行流程详解

### 1. 入口函数：run()

```typescript
export const run = async (cmd: LintCommandLineArgs, files: string[]): Promise<void> => {
    // 1. 获取 Git 根目录和状态
    const gitRoot = await findGitRoot() || process.cwd();
    const status = await gitStatus(process.cwd());
    
    // 2. 构建检查选项
    const options: ResolveOptions = {...cmd, gitRoot, gitStatus: status};
    
    // 3. 并行执行脚本和样式检查
    const [scriptResults, styleResults] = await Promise.all([
        lintScripts(files, options), 
        lintStyles(files, options)
    ]);
    
    // 4. 过滤不需要的报告（如 UNSAFE_ 方法警告）
    const lintResults = filterUnwantedReports([...scriptResults, ...styleResults], cmd);

    // 5. 判断检查是否失败
    const hasError = lintResults.some(v => v.errorCount > 0);
    const hasWarn = lintResults.some(v => v.warningCount > 0);
    const isLintFailed = cmd.strict ? hasError || hasWarn : hasError;

    // 6. 自动暂存（如果指定）
    if (cmd.autoStage) {
        await execa('git', ['add', ...status.stagedOnly], {cwd: gitRoot});
    }

    // 7. 输出结果
    if (hasError || hasWarn) {
        const output = eslintTableFormatter(lintResults);
        logger.log(output);
    }

    // 8. 根据结果退出
    if (isLintFailed) {
        process.exit(25);
    }

    // 9. 友好提示
    if (hasWarn) {
        logger.log.yellow('(；′⌒`) Nice work, still looking forward to see all warnings fixed!');
    }
    else {
        logger.log.green('(๑ơ ₃ ơ)♥ Great! This is a clean lint over hundreds of rules!');
    }
};
```

### 2. 报告过滤

```typescript
const filterUnwantedReports = (report: LintResult[], cmd: LintCommandLineArgs): LintResult[] => {
    // 如果允许 UNSAFE_ 方法，过滤相关警告
    const omitReactUnsafe = cmd.allowUnsafeReactMethod
        ? ({ruleId, message}: LintMessage) => 
            ruleId !== 'camelcase' || !message.startsWith('Identifier \'UNSAFE')
        : () => true;

    const filterMessage = (report: LintResult): LintResult => {
        const messages = report.messages.filter(omitReactUnsafe);
        return {...report, messages};
    };

    return report.map(filterMessage);
};
```

## 命令行参数

```typescript
interface LintCommandLineArgs {
    cwd: string;                    // 工作目录
    fix?: boolean;                  // 自动修复
    strict?: boolean;               // 严格模式（警告也算失败）
    autoStage?: boolean;            // 自动暂存修复后的文件
    allowUnsafeReactMethod?: boolean;  // 允许 UNSAFE_ 方法
}
```

## 检查类型

| 类型 | 工具 | 文件类型 |
|------|------|----------|
| 脚本检查 | ESLint | `.js`, `.jsx`, `.ts`, `.tsx` |
| 样式检查 | StyleLint | `.css`, `.less`, `.scss` |

## 输出示例

**有错误时：**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ src/components/App.tsx                                                        │
├──────┬──────┬─────────────────────────────────────────────────────────────────┤
│ Line │ Type │ Message                                                         │
├──────┼──────┼─────────────────────────────────────────────────────────────────┤
│ 10   │ err  │ 'useState' is defined but never used. (no-unused-vars)          │
│ 25   │ warn │ Unexpected console statement. (no-console)                      │
└──────┴──────┴─────────────────────────────────────────────────────────────────┘
```

**全部通过时：**
```
(๑ơ ₃ ơ)♥ Great! This is a clean lint over hundreds of rules!
```

**有警告时：**
```
(；′⌒`) Nice work, still looking forward to see all warnings fixed!
```

## Git 集成

支持与 Git 暂存区集成，常用于 pre-commit 钩子：

```javascript
// .lintstagedrc.mjs
export default {
    '*.{js,jsx,ts,tsx}': 'nut lint --fix --auto-stage',
    '*.{css,less}': 'nut lint --fix --auto-stage',
};
```

## 依赖关系

```json
{
  "dependencies": {
    "@nut-up/config-lint": "workspace:*",
    "@nut-up/core": "workspace:*",
    "eslint-formatter-pretty": "^7.0.0",
    "eslint-formatter-table": "^7.32.1",
    "execa": "^9.6.1",
    "globby": "^16.1.0"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `@nut-up/config-lint` | ESLint/StyleLint 配置 |
| `eslint-formatter-table` | 表格格式输出 |
| `eslint-formatter-pretty` | 美化输出 |
| `execa` | 执行 Git 命令 |
| `globby` | 文件匹配 |

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 检查通过 |
| 25 | 检查失败（有错误，或严格模式下有警告） |

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