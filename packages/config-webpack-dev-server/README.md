# @nut-up/config-webpack-dev-server

Webpack Dev Server 配置包，提供开发服务器的配置生成和相关插件。

## 概述

`@nut-up/config-webpack-dev-server` 是 nut-up 构建工具的开发服务器配置包，负责生成 `webpack-dev-server` 的配置，并提供热更新、进度条显示、代理配置、Portal 扩展等开发体验增强功能。

## 整体架构

```
@nut-up/config-webpack-dev-server
├─ index.ts                        # 入口，导出核心 API
│   ├─ createWebpackDevServerPartial()   # Webpack 配置片段（插件）
│   ├─ createWebpackDevServerConfig()    # DevServer 配置
│   └─ injectDevElements()               # 开发元素注入
│
├─ portal.ts                       # Express 应用（扩展入口）
│   ├─ createPortal()              # 创建 Portal 应用
│   └─ router                      # Express Router 导出
│
├─ ProgressBarPlugin.ts            # 自定义进度条插件
│
├─ utils.ts                        # 工具函数
│   └─ addHotModuleToEntry()       # HMR 入口注入
│
└─ types/                          # 类型声明
    ├─ launch-editor-middleware.d.ts
    └─ webpack-plugin.d.ts
```

## 执行流程详解

### 1. Webpack 配置片段：createWebpackDevServerPartial()

```typescript
export const createWebpackDevServerPartial = async (context: BuildContext, host = 'localhost') => {
    const {cwd, projectSettings: {devServer: {hot, port, openPage, https}}} = context;
    
    // 1. 创建 HTML 插件实例
    const htmlPlugins = createHtmlPluginInstances({...context, isDefaultTarget: true});
    
    // 2. 配置友好的成功消息
    const messageOptions = {
        compilationSuccessInfo: {
            messages: getDevServerMessages(host, port, !!https?.client, openPage),
            notes: [],
        },
    };
    
    // 3. 组装插件
    const plugins = [
        ...htmlPlugins,
        new FriendlyErrorsWebpackPlugin(messageOptions),  // 友好错误提示
        hot && new ReactRefreshWebpackPlugin({...}),      // React 热更新
        new ProgressBarPlugin(),                          // 进度条
    ];

    // 4. 返回 Webpack 配置片段
    return {
        output: {
            path: path.join(cwd, 'dist'),
            publicPath: '/',
            filename: 'assets/[name].[contenthash].js',
        },
        plugins: compact(plugins),
    };
};
```

**配置的核心插件：**

| 插件 | 功能 |
|------|------|
| `FriendlyErrorsWebpackPlugin` | 友好的编译错误/成功提示 |
| `ReactRefreshWebpackPlugin` | React 组件热更新 |
| `ProgressBarPlugin` | 自定义构建进度条 |
| `HtmlWebpackPlugin` | HTML 生成 |

### 2. DevServer 配置：createWebpackDevServerConfig()

```typescript
export const createWebpackDevServerConfig = async (buildEntry: WebpackBuildEntry, options: Options) => {
    const {targetEntry, proxyDomain, extra = {}} = options;
    const {
        apiPrefixes,
        defaultProxyDomain,
        proxyRewrite,
        https,
        port,
        hot,
        customizeMiddleware,
    } = buildEntry.projectSettings.devServer;
    
    // 1. 构建代理配置
    const proxyOptions = {
        https: https?.proxy ?? false,
        prefixes: apiPrefixes,
        rewrite: proxyRewrite,
        targetDomain: proxyDomain || defaultProxyDomain,
    };
    
    // 2. 创建 Portal 扩展
    const portal = createPortal();
    await buildEntry.projectSettings.portal.setup(portal, {router});
    
    // 3. 基础 DevServer 配置
    const baseConfig: DevServerConfiguration = {
        port,
        proxy: constructProxyConfiguration(proxyOptions),
        allowedHosts: 'all',
        host: '0.0.0.0',
        hot: hot ? 'only' : false,
        client: {overlay: {errors: true, warnings: false}},
        devMiddleware: {publicPath: '/', stats: 'none'},
        headers: {
            'Access-Control-Allow-Origin': '*',           // 微前端跨域
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'X-Requested-With, Content-Type, Authorization',
        },
        historyApiFallback: {
            index: `/${targetEntry}.html`,
            disableDotRule: true,
        },
        server: {
            type: https?.client ? 'https' : 'http',
            options: https?.client ? https.serverOptions : undefined,
        },
        setupMiddlewares: (middlewares, server) => {
            // 注入 Portal 和自定义中间件
            server.app.use('/__skr__', portal);
            // ...
            middlewares.unshift({path: '/__open_in_editor__', middleware: launchInEditor()});
            return middlewares;
        },
    };
    
    // 4. 合并额外配置
    const mergedConfig = merge({devServer: baseConfig}, {devServer: extra});
    
    // 5. 调用用户 finalize 钩子
    const finalized = await buildEntry.projectSettings.devServer.finalize(mergedConfig.devServer, buildEntry);
    
    return finalized;
};
```

**DevServer 配置详解：**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `port` | 用户配置 | 服务器端口 |
| `host` | `'0.0.0.0'` | 允许外部访问 |
| `allowedHosts` | `'all'` | 允许所有主机 |
| `hot` | `'only'` / `false` | 热更新模式 |
| `historyApiFallback` | `{index: '/entry.html'}` | SPA 路由支持 |
| `headers` | CORS 头 | 微前端跨域支持 |

### 3. 开发元素注入：injectDevElements()

```typescript
export const injectDevElements = async (options: InjectOptions) => {
    const {config, devServerConfig, entry, resolveBase, hot} = options;
    
    // 1. 注入 DevServer 配置和日志设置
    const devServerInjected: Configuration = {
        ...config,
        devServer: devServerConfig,
        infrastructureLogging: {level: 'none'},  // 禁用日志
        stats: 'errors-warnings',
    };
    
    // 2. 热更新时注入 HMR 客户端到入口
    const entryInjected: Configuration = hot && typeof config.entry === 'object'
        ? {
            ...devServerInjected,
            entry: {
                [entry]: await addHotModuleToEntry(config.entry[entry], resolveBase),
            },
        }
        : devServerInjected;
    
    return entryInjected;
};
```

**做了什么：**
- 将 `devServerConfig` 注入到 Webpack 配置
- 禁用构建日志，保持控制台整洁
- 在热更新模式下，将 HMR 客户端代码注入到入口文件

## 自定义进度条插件

### ProgressBarPlugin

```typescript
export default class ProgressBarPlugin extends webpack.ProgressPlugin {
    private readonly progressBar = new SingleBar(PROGRESS_BAR_OPTIONS);
    private working = false;
    private lastPercentage = 0;

    apply(compiler: Compiler) {
        // 1. 设置进度处理器
        this.handler = (percentage: number, stage, message) => {
            if (this.working) {
                this.progressBar.update(Math.max(percentage, this.lastPercentage), {stage, message});
            }
        };
        
        // 2. 编译开始时启动进度条
        compiler.hooks.beforeCompile.tap('progress-bar-plugin', () => {
            this.working = true;
            this.progressBar.start(1, 0);
        });
        
        // 3. 编译完成时停止进度条
        compiler.hooks.afterEmit.tap('progress-bar-plugin', () => {
            this.progressBar.update(1);
            this.progressBar.stop();
            this.working = false;
        });
        
        // 4. 处理中断信号
        process.on('SIGINT', () => (this.working = false));
        
        super.apply(compiler);
    }
}
```

**进度条样式：**

```
● @nut-up/dev ████████████████████████████████████████ building (75%) - module transformation
```

- 使用 `cli-progress` 库
- `kolorist` 提供彩色输出
- 显示当前编译阶段和进度百分比

## Portal 扩展系统

### portal.ts

```typescript
export const createPortal = (): Application => {
    const app = express();

    app.use(express.json());
    
    // 健康检查端点
    app.get('/ok', (req, res) => res.end('OK'));
    
    // Portal 首页
    app.get('/', (req, res) => {
        const html = dedent`
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Portal</title>
                </head>
                <body>
                    <h1>Portal</h1>
                    <p>We don't have an UI for portal yet.</p>
                </body>
            </html>
        `;
        res.type('html').end(html);
    });

    return app;
};

// 导出 Express Router 供用户扩展
export const router = express.Router;
```

**Portal 用途：**
- 挂载在 `/__skr__` 路径下
- 提供开发工具扩展入口
- 用户可通过 `projectSettings.portal.setup()` 添加自定义路由

## 内置中间件

### 1. 打开编辑器中间件

```typescript
middlewares.unshift({
    path: '/__open_in_editor__',
    middleware: launchInEditor()
});
```

- 路径：`/__open_in_editor__`
- 功能：允许从浏览器打开源文件到 IDE
- 用于错误堆栈点击跳转等场景

### 2. 自定义中间件钩子

```typescript
setupMiddlewares: (middlewares, server) => {
    const before = createMiddlewareHook();
    const after = createMiddlewareHook();
    customizeMiddleware({before, after});
    
    middlewares.unshift(...before.items());  // 添加到最前面
    middlewares.push(...after.items());      // 添加到最后面
    
    return middlewares;
};
```

用户可通过配置文件的 `devServer.customizeMiddleware` 添加自定义中间件。

## 完整执行示例

用户执行 `nut dev --entry=index --host=localhost`：

```
1. @nut-up/cli-dev 调用 start()
   ↓
2. createWebpackDevServerPartial(context, host)
   ├─ 创建 HTML 插件
   ├─ 配置 FriendlyErrorsWebpackPlugin
   ├─ 配置 ReactRefreshWebpackPlugin（如果 hot=true）
   └─ 配置 ProgressBarPlugin
   ↓
3. createWebpackConfig() 合并 partial
   ↓
4. createWebpackDevServerConfig(buildEntry, options)
   ├─ 构建代理配置
   ├─ 创建 Portal 应用
   ├─ 配置 host、port、https
   ├─ 配置 historyApiFallback
   ├─ 注入中间件（Portal、launchInEditor、自定义）
   └─ 调用 finalize 钩子
   ↓
5. injectDevElements(options)
   ├─ 注入 devServer 配置
   ├─ 禁用日志输出
   └─ 注入 HMR 客户端到入口
   ↓
6. webpack(config) → new WebpackDevServer(config, compiler)
   ↓
7. server.start()
   ↓
8. 浏览器打开 http://localhost:8080/
```

## 类型定义

### Options

```typescript
interface Options {
    targetEntry: string;      // 目标入口名称
    proxyDomain?: string;     // 代理域名
    extra?: DevServerConfiguration;  // 额外配置
}
```

### InjectOptions

```typescript
interface InjectOptions {
    config: Configuration;           // Webpack 配置
    devServerConfig: DevServerConfiguration;  // DevServer 配置
    entry: string;                   // 入口名称
    resolveBase: string;             // 解析基路径
    hot: boolean;                    // 是否启用热更新
}
```

## 导出 API

```typescript
// 主要导出
export { createWebpackDevServerPartial };  // 创建 Webpack 配置片段
export { createWebpackDevServerConfig };   // 创建 DevServer 配置
export { injectDevElements };              // 注入开发元素

// Portal 相关
export { createPortal };                   // 创建 Portal 应用
export { router };                         // Express Router

// 类型导出
export type { PortalApplication };
```

## 依赖关系

```json
{
  "dependencies": {
    "@nut-up/config-webpack": "workspace:*",
    "@nut-up/core": "workspace:*",
    "@nut-up/settings": "workspace:*",
    "@nut-up/utils-build": "workspace:*",
    "@pmmmwh/react-refresh-webpack-plugin": "^0.6.2",
    "@soda/friendly-errors-webpack-plugin": "^1.8.1",
    "cli-progress": "^3.12.0",
    "dedent": "^1.7.1",
    "express": "^4.18.2",
    "kolorist": "^1.8.0",
    "launch-editor-middleware": "^2.12.0"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `@pmmmwh/react-refresh-webpack-plugin` | React 组件热更新 |
| `@soda/friendly-errors-webpack-plugin` | 友好的错误提示 |
| `cli-progress` | 命令行进度条 |
| `kolorist` | 终端颜色输出 |
| `express` | Portal 服务器框架 |
| `launch-editor-middleware` | IDE 打开文件功能 |
| `dedent` | 模板字符串去缩进 |

## 与其他包的关系

```
@nut-up/cli-dev
    │
    │  import { createWebpackDevServerPartial, createWebpackDevServerConfig, injectDevElements }
    ↓
@nut-up/config-webpack-dev-server
    │
    │  import { createHtmlPluginInstances, BuildContext }
    ↓
@nut-up/config-webpack
    │
    │  import { constructProxyConfiguration, createMiddlewareHook }
    ↓
@nut-up/utils-build
```

## 设计优势

1. **模块化设计**：配置生成分为 Webpack 片段、DevServer 配置、元素注入三个独立步骤
2. **可扩展性**：Portal 系统允许用户添加自定义开发工具路由
3. **开发体验**：自定义进度条、友好错误提示、一键打开编辑器
4. **微前端支持**：内置 CORS 头配置，支持微前端开发场景
5. **热更新优化**：React Refresh 提供组件级热更新，保持状态
6. **用户自定义**：通过 `finalize` 钩子和 `customizeMiddleware` 支持深度定制

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

- 发布时只包含编译后的 `dist` 目录
- 提供完整的 TypeScript 类型定义