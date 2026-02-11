# @nut-up/cli-dev

开发服务器命令包，提供 `nut dev` 命令的具体实现。

## 概述

`@nut-up/cli-dev` 是 `nut dev` 命令的实现包，由 `@nut-up/cli` 动态导入调用。它负责启动 Webpack Dev Server，提供本地开发环境，支持热更新、代理配置、自动打开浏览器等功能。

## 整体架构

```
@nut-up/cli (nut dev 命令)
    ↓ 动态导入
@nut-up/cli-dev
    ├→ index.ts (入口，run 函数)
    │     ├→ 环境准备
    │     ├→ 读取项目配置
    │     ├→ 创建构建上下文
    │     └→ 监听配置变化
    │
    ├→ utils.ts (工具函数)
    │     ├→ createBuildContext
    │     ├→ prepareServerContext
    │     └→ restartable
    │
    └→ webpack.ts (Webpack 实现)
          ├→ 创建 Webpack 配置
          ├→ 创建 DevServer 配置
          ├→ 启动 WebpackDevServer
          └→ 自动打开浏览器
```

## 执行流程详解

### 1. 入口函数：run()

```typescript
export const run = async (cmd: DevCommandLineArgs): Promise<void> => {
    // 1. 设置 Node 环境变量
    process.env.NODE_ENV = cmd.mode;
    
    // 2. 准备环境（加载 .env 文件等）
    await prepareEnvironment(cmd.cwd, cmd.mode, cmd.envFiles);

    // 3. 读取项目配置 (nut.config.ts)
    const projectSettings = await readProjectSettings({
        commandName: 'dev',
        specifiedFile: cmd.configFile,
        ...cmd
    });
    
    // 4. 创建启动函数
    const start = await createStart(cmd, projectSettings);
    
    // 5. 包装成可重启函数
    const restart = restartable(start!);
    
    // 6. 监听配置变化，自动重启
    const listen = await watchProjectSettings({...});
    listen(restart);
};
```

**做了什么：**
- 设置 `NODE_ENV` 环境变量
- 加载 `.env` 文件和用户自定义环境文件
- 读取并解析项目配置文件
- 创建并启动开发服务器
- 监听配置文件变化，支持热重启

### 2. 创建启动函数：createStart()

```typescript
const createStart = async (cmd: DevCommandLineArgs, projectSettings: ProjectSettings) => {
    // 1. 定义入口位置
    const entryLocation: EntryLocation = {
        cwd: cmd.cwd,
        srcDirectory: cmd.srcDirectory,
        entryDirectory: cmd.entriesDirectory,
        only: [cmd.entry],  // 只加载指定入口
    };

    // 2. 根据驱动类型创建启动函数
    if (projectSettings.driver === 'webpack') {
        const [{collectEntries}, {start}] = await Promise.all([
            import('@nut-up/config-webpack'),
            import('./webpack.js')
        ]);
        return create({collectEntries, projectSettings, start});
    }
};
```

**做了什么：**
- 解析入口文件位置
- 根据配置的驱动类型（目前仅支持 webpack）动态导入对应实现
- 返回启动函数

### 3. 构建上下文创建：createBuildContext()

```typescript
export const createBuildContext = async <C, S extends ProjectSettings>(options) => {
    const {cmd, projectSettings, entries} = options;
    
    // 1. 验证入口存在
    if (!entries.length) {
        logger.error(`You have specified a missing entry ${entry}`);
        process.exit(21);
    }

    // 2. 构建环境对象
    const buildEnv: BuildEnv<S> = {
        hostPackageName,
        cwd,
        usage: 'devServer',
        mode: mode ?? 'development',
        srcDirectory,
        projectSettings: {
            ...projectSettings,
            devServer: {
                ...projectSettings.devServer,
                // production 模式禁用热更新
                hot: mode === 'production' ? false : projectSettings.devServer.hot,
            },
        },
    };

    // 3. 创建运行时构建环境
    const runtimeBuildEnv = await createRuntimeBuildEnv(buildEnv);
    
    // 4. 返回完整构建上下文
    const buildContext: BuildContext<C, S> = {
        ...runtimeBuildEnv,
        entries,
        features: projectSettings.featureMatrix[buildTarget],
        buildTarget: buildTarget || 'dev',
        isDefaultTarget: true,
    };
    return buildContext;
};
```

**特殊处理：**
- 在 `production` 模式下自动禁用热更新（react-refresh 不支持）
- 从 `featureMatrix` 中提取当前构建目标的特性配置

### 4. Webpack 服务器启动：start()

```typescript
export const start = async (cmd: DevCommandLineArgs, serverContext) => {
    const {buildContext, host, publicPath} = serverContext;
    
    // 1. 创建 Webpack DevServer 部分配置
    const extra = await createWebpackDevServerPartial(buildContext, host);
    
    // 2. 创建完整 Webpack 配置
    const config = await createWebpackConfig(buildContext, {
        strict: {
            disableRequireExtension: cmd.strict,
            caseSensitiveModuleSource: cmd.strict,
            typeCheck: false,
        },
        extras: [extra, {output: {publicPath}}],
    });
    
    // 3. 创建 DevServer 配置
    const devServerConfig = await createWebpackDevServerConfig(buildContext, {
        targetEntry: cmd.entry,
        proxyDomain: cmd.proxyDomain
    });
    
    // 4. 注入开发元素（HMR client 等）
    const devInjected = await injectDevElements({...});
    
    // 5. 创建 Webpack compiler
    const compiler = webpack(devInjected);
    
    // 6. 创建并启动 DevServer
    const server = new WebpackDevServer(devServerConfig, compiler);
    await startServer(server);

    // 7. 自动打开浏览器
    if (cmd.open) {
        const openURL = `${protocol}://${host}:${port}/${openPage}`;
        open(openURL);
    }

    // 8. 返回停止函数
    return () => server.stop();
};
```

## 可重启机制

`restartable()` 函数实现了优雅的服务器重启逻辑：

```typescript
export const restartable = (start: () => Promise<() => Promise<void>>) => {
    const context: RestartContext = {
        inProgress: start(),    // 当前运行的服务器
        nextStart: null,        // 待执行的重启
    };
    
    return async () => {
        logger.log('Detected nut-up config change, restarting dev server...');

        // 防止重复触发
        if (context.nextStart) {
            return;
        }

        // 设置下一次启动
        context.nextStart = () => {
            context.inProgress = start();
            context.nextStart = null;
        };
        
        // 等待当前服务器停止
        const stop = await context.inProgress;
        await stop();
        
        // 启动新服务器
        if (context.nextStart) {
            context.nextStart();
        }
    };
};
```

**设计要点：**
- 防抖处理：避免配置快速变化时频繁重启
- 优雅停止：等待当前服务器完全停止后再启动新服务器
- 配置监听：通过 `chokidar` 监听 `nut.config.ts` 变化

## 完整执行示例

用户执行：
```bash
nut dev --entry=index --host=localhost --open
```

**执行流程：**

```
1. @nut-up/cli 解析命令行，匹配 DevCommand
   ↓
2. DynamicImportCommand 动态导入 @nut-up/cli-dev
   ↓
3. run(cmd) 被调用
   ├─ cmd.entry = 'index'
   ├─ cmd.host = 'localhost'
   └─ cmd.open = true
   ↓
4. 设置 NODE_ENV = 'development'
   ↓
5. prepareEnvironment() 加载 .env 文件
   ↓
6. readProjectSettings() 读取 nut.config.ts
   ↓
7. createStart() 创建启动函数
   ├─ 收集入口文件 (src/entries/index.tsx)
   ├─ 创建构建上下文
   └─ 准备服务器上下文
   ↓
8. start() 启动 Webpack Dev Server
   ├─ 创建 Webpack 配置
   ├─ 创建 DevServer 配置
   ├─ 注入 HMR 相关代码
   ├─ webpack(config) 创建 compiler
   ├─ new WebpackDevServer() 创建服务器
   └─ server.start() 启动服务
   ↓
9. open('http://localhost:8080/') 打开浏览器
   ↓
10. watchProjectSettings() 开始监听配置变化
    └─ 配置变化时调用 restart()
```

## 核心类型定义

### DevCommandLineArgs

```typescript
interface DevCommandLineArgs {
    cwd: string;                    // 工作目录
    mode: 'development' | 'production';
    configFile?: string;            // 配置文件路径
    envFiles?: string[];            // 环境文件列表
    srcDirectory: string;           // 源码目录
    entriesDirectory: string;       // 入口目录
    buildTarget: string;            // 构建目标
    proxyDomain?: string;           // 代理域名
    host?: HostType;                // 服务器 host
    entry: string;                  // 入口名称
    strict: boolean;                // 严格模式
    open: boolean;                  // 是否打开浏览器
}
```

### ServerStartContext

```typescript
interface ServerStartContext<C, S extends ProjectSettings> {
    buildContext: BuildContext<C, S>;   // 构建上下文
    host: string;                        // 解析后的 host
    publicPath: string | undefined;      // 公共路径
}
```

### BuildContext

```typescript
interface BuildContext<C, S> {
    hostPackageName: string;
    cwd: string;
    usage: 'devServer';
    mode: 'development' | 'production';
    srcDirectory: string;
    projectSettings: S;
    entries: Array<AppEntry<C>>;
    features: Record<string, any>;
    buildTarget: string;
    isDefaultTarget: boolean;
}
```

## 设计优势

1. **驱动可扩展**：通过 `projectSettings.driver` 判断，预留了支持其他构建工具的能力
2. **配置热重载**：监听配置文件变化，自动重启服务器，无需手动操作
3. **优雅重启**：防抖 + 等待停止，避免端口冲突和资源泄漏
4. **模式适配**：自动根据 mode 禁用不兼容的功能（如 production 下禁用 HMR）
5. **类型安全**：完整的 TypeScript 泛型支持，确保配置类型正确

## 依赖关系

```json
{
  "dependencies": {
    "@nut-up/config-webpack": "workspace:*",
    "@nut-up/config-webpack-dev-server": "workspace:*",
    "@nut-up/core": "workspace:*",
    "@nut-up/settings": "workspace:*",
    "@nut-up/utils-build": "workspace:*",
    "better-opn": "^3.0.2",
    "proxy-agent": "^6.5.0"
  }
}
```

**关键依赖说明：**
- **@nut-up/config-webpack**：Webpack 配置核心，提供 `createWebpackConfig`
- **@nut-up/config-webpack-dev-server**：DevServer 配置，提供 `createWebpackDevServerConfig`
- **@nut-up/core**：核心工具库（日志、环境准备等）
- **@nut-up/settings**：项目配置读取和监听
- **@nut-up/utils-build**：构建工具集（入口收集、环境创建等）
- **better-opn**：跨平台打开浏览器
- **proxy-agent**：HTTP 代理支持

## 与 @nut-up/cli 的关系

```
@nut-up/cli
    │
    │  DevCommand.execute()
    │      ↓
    │  DynamicImportCommand.importCommandPackage()
    │      ↓
    │  resolve('@nut-up/cli-dev')
    │      ↓
    │  import('./dist/index.js')
    │      ↓
    └─→ { run } ← @nut-up/cli-dev 导出
            ↓
        run(commandLineArgs)
```

- `@nut-up/cli` 负责命令行解析和参数收集
- `@nut-up/cli-dev` 负责实际的开发服务器启动逻辑
- 通过动态导入实现按需加载，减少 CLI 包体积

## 模块职责图

```
┌──────────────────────────────────────────────────────────────┐
│                      @nut-up/cli-dev                         │
├──────────────────────────────────────────────────────────────┤
│  index.ts                                                    │
│  ├─ run()              命令入口，协调各模块                     │
│  └─ createStart()      根据 driver 创建启动函数                │
├──────────────────────────────────────────────────────────────┤
│  utils.ts                                                    │
│  ├─ createBuildContext()    创建构建上下文                     │
│  ├─ prepareServerContext()  准备服务器启动参数                  │
│  ├─ restartable()           可重启包装器                       │
│  └─ resolvePublicPath()     解析公共路径                       │
├──────────────────────────────────────────────────────────────┤
│  webpack.ts                                                  │
│  ├─ start()            Webpack DevServer 启动逻辑             │
│  └─ startServer()      启动服务器并处理错误                     │
└──────────────────────────────────────────────────────────────┘
```

## 发布配置

```json
{
  "files": ["dist"],
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  }
}
```

- 发布时只包含编译后的 `dist` 目录
- 提供 ES Module 和 TypeScript 类型定义
- 作为内部依赖被 `@nut-up/cli` 动态导入