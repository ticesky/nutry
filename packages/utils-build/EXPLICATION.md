# @nutry/utils-build

构建工具集，提供入口收集、代理配置、环境变量定义、样式配置等构建相关的工具函数。

## 概述

`@nutry/utils-build` 是 nutry 构建工具的工具集合层，为 `@nutry/config-webpack` 和 `@nutry/cli-dev` 等包提供构建相关的通用功能。它包含入口文件收集、代理配置构建、环境变量定义、Less/PostCSS 配置、HTML 处理等核心能力。

## 整体架构

```
@nutry/utils-build
├─ index.ts              # 入口，统一导出所有功能
│
├─ entry/                # 入口处理
│   ├─ index.ts          # 入口收集
│   ├─ resolve.ts        # 入口解析
│   └─ interface.ts      # 类型定义
│
├─ config/               # 配置工厂
│   ├─ less.ts           # Less 配置
│   └─ postcss.ts        # PostCSS 配置
│
├─ define.ts             # 环境变量定义
├─ proxy.ts              # 代理配置
├─ host.ts               # Host 解析
├─ html.ts               # HTML 处理
├─ info.ts               # 构建信息
├─ validate.ts           # 配置校验
└─ devServer.ts          # DevServer 工具
```

## 核心功能详解

### 1. 入口收集：entry/

```typescript
// 收集应用入口
export const collectAppEntries = async <C>(options: EntryOptions<C>): Promise<Array<AppEntry<C>>> => {
    const {cwd, srcDirectory, entryDirectory, only, templateExtension, defaultTemplate, transformConfig} = options;
    const directory = path.join(cwd, srcDirectory, entryDirectory);

    if (!existsSync(directory)) {
        logger.error(`No ${srcDirectory}/${entryDirectory} directory found`);
        process.exit(24);
    }

    const files = await fs.readdir(directory);
    const resolveOptions = {
        templateExtension,
        defaultTemplate,
        transformConfig,
        shouldInclude: (name: string) => (only ? only.includes(name) : true),
    };
    const mayBeEntries = await pMap(files, f => resolveEntry<C>(path.resolve(directory, f), resolveOptions));
    return compact(mayBeEntries);
};

// 构造入口模板数据
export const constructEntryTemplateData = (context: BuildEntry, entry: AppEntry<unknown>): Record<string, unknown> => {
    return {
        favicon: settings.build.favicon,
        appContainerId: settings.build.appContainerId,
        mode: context.mode,
        buildVersion: context.buildVersion,
        buildTime: context.buildTime,
        buildTarget: context.buildTarget,
        buildIdentifier: `${context.buildVersion}/${context.buildTarget}@${context.buildTime}`,
        title: settings.build.appTitle,
        ...entry.config.templateData,
    };
};

// HTML 内容插值
export const interpolateEntryContent = (html: string, replacements: Record<string, string | undefined>) => {
    return Object.entries(replacements).reduce(
        (html, [key, value]) => (
            value === undefined
                ? html
                : html.replace(new RegExp(`%${escapeRegExp(key)}%`, 'g'), value)
        ),
        html
    );
};
```

**入口文件结构示例：**
```
src/
└─ entries/
    ├─ index.tsx           # 入口脚本
    ├─ index.ejs           # HTML 模板（可选）
    ├─ index.config.mjs    # 入口配置（可选）
    ├─ admin.tsx
    └─ admin.ejs
```

### 2. 环境变量定义：define.ts

```typescript
export interface DefineContext {
    env: Record<string, string | undefined>;
    features: Record<string, any>;
    mode: WorkMode;
    buildVersion: string;
    buildTarget: string;
    buildTime: string;
}

export const constructDefines = ({env, features, mode, buildVersion, buildTarget, buildTime}: DefineContext) => {
    const buildInfo = {
        mode,
        version: buildVersion,
        target: buildTarget,
        time: buildTime,
    };

    return {
        ...toDefines(env, 'process.env'),        // process.env.XXX
        ...toDefines(features, 'skr.features'),  // skr.features.XXX
        ...toDefines(buildInfo, 'skr.build'),    // skr.build.XXX
    };
};
```

**生成的全局变量：**
```typescript
// 在业务代码中可用
process.env.NODE_ENV        // 'development' | 'production'
process.env.API_URL         // 从 .env 文件读取

skr.features.enableNewFeature  // 从 featureMatrix 读取
skr.build.mode                 // 'development' | 'production'
skr.build.version              // 构建版本
skr.build.target               // 构建目标
skr.build.time                 // 构建时间
```

### 3. 代理配置：proxy.ts

```typescript
export interface ProxyOptions {
    https: boolean;
    prefixes: string[];
    rewrite: Record<string, string>;
    targetDomain: string;
}

export const constructProxyConfiguration = (options: ProxyOptions) => {
    const {https, prefixes, rewrite, targetDomain} = options;
    
    if (!targetDomain || !prefixes.length) {
        return undefined;
    }

    const protocol = https ? 'https' : 'http';
    const target = `${protocol}://${targetDomain}`;
    
    return prefixes.reduce((config, prefix) => {
        config[prefix] = {
            target,
            changeOrigin: true,
            pathRewrite: rewrite,
            // ...
        };
        return config;
    }, {});
};
```

### 4. Host 解析：host.ts

```typescript
export const resolveDevHost = async (hostType?: HostType): Promise<string> => {
    switch (hostType) {
        case 'localhost':
            return 'localhost';
        case 'loopback':
            return '127.0.0.1';
        case 'ip':
            const ip = await internalIp.v4();
            return ip ?? 'localhost';
        default:
            return hostType ?? 'localhost';
    }
};
```

### 5. Less 配置：config/less.ts

```typescript
export default (options: LessOptions): Less.Options => {
    return {
        math: 'always',
        javascriptEnabled: true,
        modifyVars: options.lessVariables,
        plugins: [
            new NpmImportPlugin({prefix: '~'}),
        ],
    };
};
```

### 6. PostCSS 配置：config/postcss.ts

```typescript
export default (options: PostCSSOptions) => {
    const {cwd, mode} = options;
    
    return {
        plugins: [
            postcssPresetEnv({
                autoprefixer: {
                    flexbox: 'no-2009',
                },
            }),
            mode === 'production' && cssnano({
                preset: ['default', {discardComments: {removeAll: true}}],
            }),
        ].filter(Boolean),
    };
};
```

### 7. HTML 处理：html.ts

```typescript
// 注入内容到 HTML
export const injectIntoHtml = (html: string, injection: string, position: 'head' | 'body' = 'body'): string => {
    const tag = position === 'head' ? '</head>' : '</body>';
    return html.replace(tag, `${injection}${tag}`);
};

// Service Worker 注册脚本
export const serviceWorkerRegistryScript = (options: ServiceWorkerOptions): string => {
    return `
        <script>
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/service-worker.js');
                });
            }
        </script>
    `;
};
```

### 8. 构建信息：info.ts

```typescript
// 检查是否有 Service Worker
export const hasServiceWorker = (context: BuildContext): boolean => {
    return existsSync(path.join(context.cwd, context.srcDirectory, 'service-worker.js'));
};

// 创建运行时构建环境
export const createRuntimeBuildEnv = async (env: BuildEnv): Promise<RuntimeBuildEnv> => {
    return {
        ...env,
        buildVersion: await computeBuildVersion(env.cwd),
        buildTime: new Date().toISOString(),
    };
};
```

### 9. DevServer 工具：devServer.ts

```typescript
// 创建中间件钩子
export const createMiddlewareHook = (): MiddlewareHook => {
    const middlewares: Middleware[] = [];
    
    return {
        use: (path: string | Middleware, middleware?: Middleware) => {
            if (typeof path === 'string') {
                middlewares.push({path, middleware: middleware!});
            } else {
                middlewares.push(path);
            }
        },
        items: () => middlewares,
    };
};
```

## 类型定义

### EntryLocation

```typescript
interface EntryLocation {
    cwd: string;
    srcDirectory: string;
    entryDirectory: string;
    only?: string[];
}
```

### AppEntry

```typescript
interface AppEntry<C> {
    name: string;           // 入口名称
    file: string;           // 入口脚本路径
    template: string;       // HTML 模板路径
    config: C;              // 入口配置
}
```

### BuildContext

```typescript
interface BuildContext<C, S extends ProjectSettings> {
    usage: 'build' | 'devServer';
    cwd: string;
    srcDirectory: string;
    mode: WorkMode;
    hostPackageName: string;
    buildVersion: string;
    buildTime: string;
    buildTarget: string;
    isDefaultTarget: boolean;
    features: Record<string, any>;
    entries: Array<AppEntry<C>>;
    cache?: 'persist' | 'memory' | 'off';
    cacheDirectory?: string;
    projectSettings: S;
}
```

## 导出 API

```typescript
// 配置工厂
export { lessConfig };
export { postcssConfig };

// 入口处理
export { collectAppEntries, constructEntryTemplateData, interpolateEntryContent };
export type { EntryLocation, EntryOptions, AppEntry, BuildContext };

// 构建信息
export { hasServiceWorker, createRuntimeBuildEnv };

// 配置校验
export { validateProjectSettings };

// 代理配置
export type { ProxyOptions };
export { constructProxyConfiguration };

// Host 解析
export { resolveDevHost };

// 环境变量
export { constructDefines };
export type { DefineContext };

// DevServer
export { createMiddlewareHook };

// HTML 处理
export { injectIntoHtml, serviceWorkerRegistryScript };
```

## 依赖关系

```json
{
  "dependencies": {
    "@nutry/core": "workspace:*",
    "@nutry/settings": "workspace:*",
    "change-case": "^5.4.4",
    "cssnano": "^7.1.2",
    "escape-string-regexp": "^5.0.0",
    "globby": "^16.1.0",
    "internal-ip": "^8.0.1",
    "less-plugin-npm-import": "^2.1.0",
    "postcss-preset-env": "^11.1.2",
    "proxy-agent": "^6.5.0",
    "xml2js": "^0.6.2"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `cssnano` | CSS 压缩 |
| `postcss-preset-env` | PostCSS 预设（autoprefixer 等） |
| `less-plugin-npm-import` | Less 中 `~` 导入支持 |
| `internal-ip` | 获取本机 IP |
| `proxy-agent` | HTTP 代理 |

## 与其他包的关系

```
@nutry/config-webpack
    │
    │  import { collectAppEntries, constructDefines, lessConfig, postcssConfig }
    ↓
@nutry/utils-build
    │
    │  import { logger, pMap, compact }
    ↓
@nutry/core
```

## 设计优势

1. **功能聚合**：将构建相关的工具函数集中管理
2. **可复用性**：被多个上层包使用，避免重复代码
3. **配置标准化**：提供统一的 Less、PostCSS 等配置
4. **类型完备**：完整的 TypeScript 类型定义
5. **关注点分离**：每个模块专注单一职责

## 发布配置

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```