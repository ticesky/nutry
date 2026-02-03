# @nut-up/cli

命令行工具包，提供 `nut` 命令的核心框架和命令注册系统。

## 概述

`@nut-up/cli` 是 nut-up 构建工具的命令行入口，使用 [clipanion](https://github.com/arcanis/clipanion) 框架实现。它采用**动态导入**设计，将具体的构建逻辑延迟到运行时加载，保持 CLI 包本身的轻量级。

## 整体架构

```
nut.mjs (bin)
    ↓
index.ts (run函数)
    ↓
Cli 实例 (clipanion)
    ├→ BuildCommand
    ├→ DevCommand  
    ├→ HelpCommand
    └→ VersionCommand
    ↓
DynamicImportCommand (基类)
    ↓
动态导入命令包
    ├→ @nut-up/cli-build (build命令)
    └→ @nut-up/cli-dev (dev命令)
```

## 执行流程详解

### 1. 入口点：bin/nut.mjs

```javascript
#! /usr/bin/env node
import { run } from '../dist/index.js';

run();
```

- 这是一个 Node.js shebang 脚本
- 直接调用编译后的 `index.js` 中的 `run()` 函数
- 当用户执行 `nut` 命令时启动

### 2. CLI 框架初始化：index.ts

```typescript
const cli = new Cli({
    binaryLabel: 'nut-up',
    binaryName: 'nut',
    binaryVersion: version  // 从 package.json 读取
});

cli.register(BuildCommand);
cli.register(DevCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

export const run = async () => {
    process.on('unhandledRejection', (e: any) => {
        logger.error(e.toString());
        process.exit(99);
    });

    try {
        await cli.runExit(process.argv.slice(2), Cli.defaultContext);
    }
    catch (ex) {
        console.error(ex);
    }
};
```

**做了什么：**
- 使用 **clipanion** 框架创建 CLI 实例
- 注册 4 个命令类
- 建立全局错误捕获
- 调用 `cli.runExit()` 解析并执行命令

### 3. 命令注册：BuildCommand 和 DevCommand

两个命令都继承自 `DynamicImportCommand`，定义了丰富的命令行选项。

**BuildCommand** (`nut build`)：
- 实现包：`@nut-up/cli-build`
- 默认 mode：`production`
- 特殊选项：`--watch`, `--analyze`, `--profile`, `--strict`
- 共 17 个命令行选项

**DevCommand** (`nut dev`)：
- 实现包：`@nut-up/cli-dev`
- 默认 mode：`development`
- 特殊选项：`--host`, `--entry`, `--open`, `--strict`
- 共 11 个命令行选项

**命令行选项示例：**

```typescript
cwd = Option.String('--cwd', process.cwd(), {
    description: 'override current working directory'
});

mode = Option.String<WorkMode>('--mode', 'production', {
    validator: isEnum(['development', 'production']),
    description: 'set build mode, default to "production"',
});

configFile = Option.String(
    '--config',
    {description: 'specify a custom configuration file, default to "reskript.config.{ts|mjs}"'}
);
```

### 4. 核心逻辑：DynamicImportCommand

这是整个流程的关键基类。它实现了：

#### 执行步骤：

```
1. execute() 被调用
     ↓
2. 验证 packageName 是否存在
     ↓
3. 尝试 importCommandPackage()
     ├─ 使用 resolveFrom(process.cwd()) 解析包
     ├─ 动态导入包：import(pathToFileURL(packageEntry))
     └─ 获取 { run } 函数
     ↓
4. 如果 MODULE_NOT_FOUND 错误：
     ├─ 检查是否能自动安装 (canAutoInstall)
     │   ├─ @nut-up/cli 版本是否精确
     │   ├─ 项目有没有 git 初始化
     │   └─ git root 有没有 lock 文件
     │
     ├─ 如果能自动安装：
     │   ├─ 询问用户是否继续
     │   ├─ 检测包管理器 (pnpm/npm/yarn)
     │   ├─ 执行 installPackage() 安装
     │   └─ 重新导入包
     │
     └─ 如果不能自动安装：
         └─ 提示用户手动安装
     ↓
5. 调用 run(args, restArgs)
     ├─ args: 命令行参数对象
     └─ restArgs: 剩余参数 (通常为 undefined)
```

#### 关键方法：

**importCommandPackage()**
```typescript
private async importCommandPackage() {
    const resolve = resolveFrom(process.cwd());

    const dynamicImport = async () => {
        const packageEntry = await resolve(this.packageName);
        const {run} = await import(pathToFileURL(packageEntry).toString()) 
            as CommandDefinition<A>;
        return run;
    };

    try {
        const run = await dynamicImport();
        return run;
    }
    catch (ex) {
        if (!isErrorWithCode(ex) || ex.code !== 'MODULE_NOT_FOUND') {
            logger.error(`Failed to run command: ${ex instanceof Error ? ex.message : ex}`);
            process.exit(99);
        }
        
        // 如果包不存在，尝试自动安装
        const canAutoInstall = await this.canAutoInstall();
        // ... 自动安装逻辑
    }
}
```

## 完整执行示例

用户执行：
```bash
nut build --cwd=/path/to/project --mode=development --clean
```

**执行流程：**

```
1. bin/nut.mjs 启动
   ↓
2. run() 函数执行，创建 CLI 实例
   ↓
3. CLI 框架解析命令行参数
   - 识别出是 'build' 命令
   - 匹配到 BuildCommand 类
   ↓
4. BuildCommand.execute() 执行
   ↓
5. DynamicImportCommand.execute() 执行
   - packageName = '@nut-up/cli-build'
   - buildCommandLineArgs() 收集参数：
     {
       cwd: '/path/to/project',
       mode: 'development',
       clean: true,
       // ... 其他默认参数
     }
   ↓
6. importCommandPackage() 动态导入
   - 尝试 resolve('@nut-up/cli-build')
   - 如果找不到，自动安装（如果条件允许）
   - 导入包的默认导出的 run 函数
   ↓
7. 调用 run(commandLineArgs, undefined)
   - 执行实际的构建逻辑 (在 @nut-up/cli-build 包中)
   - 返回构建结果
   ↓
8. 过程结束或错误处理
```

## 自动安装机制

这是一个很有创意的设计。如果用户缺少构建命令包，CLI 会自动安装。

### 自动安装的条件

```typescript
private async canAutoInstall() {
    // 1. 项目本身需要有 package.json
    const packageRoot = await packageDirectory();
    if (!packageRoot) {
        return false;
    }

    // 2. @nut-up/cli 版本必须精确匹配
    const packageConfig = await readPackageConfig(packageRoot);
    const dependencies = {...packageConfig.dependencies, ...packageConfig.devDependencies};
    return dependencies['@nut-up/cli'] === this.cli.binaryVersion;
    
    // 3. 项目需要 git 初始化 + 有 lock 文件
    const gitRoot = await findGitRoot();
    if (existsSync(path.join(gitRoot, 'pnpm-lock.yaml'))) {
        return 'pnpm';
    }
}
```

### 交互流程

```
缺少包 → 
  询问用户 "是否安装？" → 
  检测包管理器 (pnpm/npm/yarn) → 
  执行 installPackage() → 
  重新导入包 → 
  执行命令
```

### 安装结果类型

```typescript
type InstallResult = 'installed' | 'canceled' | 'noPackageManager' | 'failed';
```

- `installed`：成功安装并重新导入
- `canceled`：用户取消安装
- `noPackageManager`：无法检测到包管理器
- `failed`：安装过程失败

## 命令行参数系统

使用 **clipanion** 和 **typanion** 的强大类型系统：

```typescript
// BuildCommand 定义的参数示例
export default class BuildCommand extends DynamicImportCommand<BuildCommandLineArgs> {
    static paths = [['build']];
    
    cwd = Option.String('--cwd', process.cwd(), {
        description: 'override current working directory'
    });

    mode = Option.String<WorkMode>('--mode', 'production', {
        validator: isEnum(['development', 'production']),
        description: 'set build mode, default to "production"',
    });

    configFile = Option.String('--config', {
        description: 'specify a custom configuration file'
    });

    sourceMaps = Option.Boolean('--source-maps', true, {
        description: 'enable or disable generation of source maps'
    });

    // 自动收集成对象
    buildCommandLineArgs() {
        return {
            cwd: this.cwd,
            mode: this.mode,
            configFile: this.configFile,
            sourceMaps: this.sourceMaps,
            // ... 所有参数
        };
    }
}
```

**特点：**
- ✅ 完整的 TypeScript 类型检查
- ✅ 参数验证 (validator)
- ✅ 默认值支持
- ✅ 自动生成帮助信息

## 设计优势

1. **动态加载**：只在运行时加载需要的命令包，减少 CLI 本身的体积
2. **自动安装**：用户不需要手动安装 build/dev 包，提升开发体验
3. **灵活扩展**：添加新命令只需添加新的 Command 类继承 DynamicImportCommand
4. **完整类型**：TypeScript 全程支持，编译时和运行时都有验证
5. **优雅降级**：如果自动安装失败，有清晰的错误提示和手动安装说明
6. **错误处理**：全局错误捕获和详细的调试信息

## 类关系图

```
Command (clipanion)
   ↑
   │ extends
   │
DynamicImportCommand
   ↑
   ├─ BuildCommand (nut build)
   └─ DevCommand (nut dev)
   
DynamicImportCommand 的职责：
├─ 验证 packageName
├─ 动态导入命令包
├─ 处理 MODULE_NOT_FOUND 错误
├─ 检查自动安装条件
├─ 自动安装缺失的包
├─ 收集和传递命令行参数
└─ 错误处理和重试
```

## 依赖关系

```json
{
  "dependencies": {
    "@antfu/install-pkg": "^1.1.0",
    "@nut-up/cli-dev": "workspace:*",
    "@nut-up/core": "workspace:*",
    "@nut-up/settings": "workspace:*",
    "clipanion": "4.0.0-rc.4",
    "enquirer": "^2.4.1",
    "pkg-dir": "^9.0.0",
    "typanion": "^3.14.0"
  }
}
```

**关键依赖说明：**
- **clipanion**：CLI 框架，提供命令和参数解析
- **typanion**：参数验证库
- **enquirer**：交互式命令行工具，用于自动安装确认
- **@antfu/install-pkg**：自动安装包工具
- **pkg-dir**：查找项目根目录
- **@nut-up/core**：核心工具库（日志、包配置读取等）
- **@nut-up/settings**：项目配置管理

## 命令列表

### nut build

编译构建应用。

```bash
nut build [options]
```

**主要选项：**
- `--cwd`：工作目录
- `--mode`：构建模式（development | production）
- `--config`：配置文件
- `--src-dir`：源代码目录
- `--entries-dir`：入口目录
- `--build-target`：构建目标
- `--feature-only`：仅构建指定的特性
- `--strict`：严格模式
- `--analyze`：分析 bundle
- `--clean`：清理产物目录
- `--watch`：监听变化重新构建

### nut dev

启动开发服务器。

```bash
nut dev [options]
```

**主要选项：**
- `--cwd`：工作目录
- `--mode`：构建模式
- `--config`：配置文件
- `--src-dir`：源代码目录
- `--entries-dir`：入口目录
- `--build-target`：构建目标（默认为 dev）
- `--host`：服务器地址
- `--entry`：默认入口（默认为 index）
- `--open`：是否自动打开浏览器（默认 true）
- `--strict`：严格模式

## 发布配置

```json
{
  "files": ["dist", "bin"],
  "publishConfig": {
    "access": "public"
  },
  "bin": {
    "nut": "./bin/nut.mjs"
  }
}
```

- 发布时包含 `dist` 和 `bin` 目录
- 注册全局 `nut` 命令
- 作为公开 npm 包发布
