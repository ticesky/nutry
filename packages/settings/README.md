# @nut-up/settings

项目配置管理包，负责读取、校验、合并和监听用户配置文件。

## 概述

`@nut-up/settings` 是 nut-up 构建工具的配置管理层，负责处理 `nut.config.ts` 配置文件。它提供配置读取、Schema 校验、默认值填充、插件应用、文件监听等完整的配置生命周期管理。

## 整体架构

```
@nut-up/settings
├─ index.ts              # 入口，核心 API
│   ├─ readProjectSettings()      # 读取项目配置
│   ├─ watchProjectSettings()     # 监听配置变化
│   ├─ configure()                # 配置辅助函数
│   └─ warnAndExitOnInvalidFinalizeReturn()
│
├─ defaults.ts           # 默认配置
│   └─ fillProjectSettings()      # 填充默认值
│
├─ validate.ts           # 配置校验
│   └─ validate()                 # Schema 校验
│
├─ plugins.ts            # 插件系统
│   └─ applyPlugins()             # 应用插件
│
└─ interface/            # 类型定义
    ├─ project.ts        # 项目配置类型
    ├─ build.ts          # 构建配置类型
    ├─ devServer.ts      # 开发服务器配置类型
    ├─ command.ts        # 命令行参数类型
    ├─ webpack.ts        # Webpack 相关类型
    └─ ...
```

## 执行流程详解

### 1. 配置读取：readProjectSettings()

```typescript
export const readProjectSettings = async (options: ResolveProjectSettingsOptions): Promise<ProjectSettings> => {
    // 1. 检查指定的配置文件是否存在
    checkSettingsExists(options.specifiedFile);

    // 2. 使用缓存避免重复读取
    if (cache.initialized) {
        return cache.settings;
    }

    // 3. 导入并处理配置
    const settings = await importSettings(options);

    // 4. 缓存配置
    cache.initialized = true;
    cache.settings = settings;

    return settings;
};
```

### 2. 配置导入：importSettings()

```typescript
const importSettings = async (options: ResolveProjectSettingsOptions): Promise<ProjectSettings> => {
    const {specifiedFile, ...cmd} = options;
    
    // 1. 动态导入用户配置文件
    const {resolved, value: {default: userSettings}} = await importUserModule<{default: UserSettings}>(
        specifiedFile 
            ? [specifiedFile] 
            : SETTINGS_EXTENSIONS.map(v => path.join(cmd.cwd, 'nut.config' + v)),
        {default: {driver: 'webpack'}}
    );

    // 2. Schema 校验
    try {
        validate(userSettings);
    }
    catch (ex) {
        logger.error(ex instanceof Error ? ex.message : `${ex}`);
        process.exit(21);
    }

    // 3. 分离插件和配置
    const {plugins = [], ...clientSettings} = userSettings;
    
    // 4. 填充默认值
    const rawSettings: ProjectSettings = {...fillProjectSettings(clientSettings), from: resolved};
    
    // 5. 应用插件
    return applyPlugins(rawSettings, plugins, cmd);
};
```

### 3. 配置监听：watchProjectSettings()

```typescript
export const watchProjectSettings = async (options: ResolveProjectSettingsOptions): Promise<Observe> => {
    checkSettingsExists(options.specifiedFile);

    if (cache.listen) {
        return cache.listen;
    }

    const settingsLocation = options.specifiedFile ?? locateSettings(options.cwd);

    // 没有配置文件，返回空的监听器
    if (!settingsLocation) {
        return () => () => {};
    }

    const listeners = new Set<Listener>();
    const watcher = chokidar.watch(settingsLocation);
    
    const notify = async (): Promise<void> => {
        // 使用 hash 比对避免重复触发
        const newSettingsHash = await hashFile(settingsLocation);
        if (newSettingsHash === cache.hash) {
            return;
        }
        cache.hash = newSettingsHash;
        listeners.forEach(f => f());
    };
    
    watcher.on('all', notify);
    cache.hash = await hashFile(settingsLocation);
    
    // 返回订阅函数
    cache.listen = (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };

    return cache.listen;
};
```

### 4. 默认值填充：fillProjectSettings()

```typescript
export const fillProjectSettings = (settings: PartialProjectSettings): ProjectSettings => {
    return {
        driver: settings.driver,
        cwd: settings.cwd ?? process.cwd(),
        featureMatrix: settings.featureMatrix ?? {stable: {}, dev: {}},
        build: fillWebpackBuildSettings(settings.build),
        devServer: fillWebpackDevServerSettings(settings.devServer),
        play: fillPlaySettings(settings.play),
        portal: fillPortalSettings(settings.portal),
    };
};

// 构建配置默认值
const fillWebpackBuildSettings = (settings?): WebpackBuildSettings => {
    return {
        uses: ['lodash'],
        thirdParty: false,
        reportLintErrors: true,
        largeAssetSize: 8 * 1024,
        appTitle: 'App',
        transformEntryHtml: (html: string) => html,
        excludeFeatures: ['dev'],
        finalize: config => config,
        ...settings,
        script: fillScriptSettings(settings?.script),
        style: fillWebpackStyleSettings(settings?.style),
        inspect: fillInspectSettings(settings?.inspect),
    };
};

// DevServer 配置默认值
const fillWebpackDevServerSettings = (settings?): WebpackDevServerSettings => {
    return {
        port: 8788,
        apiPrefixes: [],
        defaultProxyDomain: '',
        proxyRewrite: {},
        hot: true,
        openPage: '',
        customizeMiddleware: hook => hook,
        finalize: config => config,
        ...settings,
    };
};
```

## 配置文件结构

### nut.config.ts

```typescript
import {configure} from '@nut-up/settings';

export default configure('webpack', {
    build: {
        appTitle: 'My App',
        script: {
            polyfill: true,
            babel: true,
        },
        style: {
            extract: true,
            modules: true,
        },
        finalize: (config, context, internals) => {
            // 自定义 Webpack 配置
            return config;
        },
    },
    devServer: {
        port: 3000,
        hot: true,
        apiPrefixes: ['/api'],
        defaultProxyDomain: 'api.example.com',
    },
    featureMatrix: {
        stable: {
            enableNewFeature: false,
        },
        dev: {
            enableNewFeature: true,
        },
    },
    plugins: [
        // 插件列表
    ],
});
```

## 类型定义

### ProjectSettings

```typescript
interface ProjectSettings {
    driver: 'webpack';
    cwd: string;
    from?: string;                    // 配置文件路径
    featureMatrix: FeatureMatrix;
    build: WebpackBuildSettings;
    devServer: WebpackDevServerSettings;
    play: PlaySettings;
    portal: PortalSettings;
}
```

### WebpackBuildSettings

```typescript
interface WebpackBuildSettings {
    uses: ThirdPartyUse[];
    thirdParty: boolean;
    reportLintErrors: boolean;
    largeAssetSize: number;
    appTitle: string;
    favicon?: string;
    appContainerId?: string;
    publicPath?: string;
    transformEntryHtml: (html: string) => string;
    excludeFeatures: string[];
    script: BuildScriptSettings;
    style: WebpackBuildStyleSettings;
    inspect: BuildInspectSettings;
    finalize: WebpackFinalize;
}
```

### WebpackDevServerSettings

```typescript
interface WebpackDevServerSettings {
    port: number;
    apiPrefixes: string[];
    defaultProxyDomain: string;
    proxyRewrite: Record<string, string>;
    hot: boolean;
    openPage: string;
    https?: DevServerHttps;
    customizeMiddleware: CustomizeMiddleware;
    finalize: (config: DevServerConfiguration, entry: WebpackBuildEntry) => DevServerConfiguration;
}
```

### 命令行参数类型

```typescript
interface BuildCommandLineArgs {
    cwd: string;
    mode: WorkMode;
    configFile?: string;
    envFiles?: string[];
    srcDirectory: string;
    entriesDirectory: string;
    buildTarget?: string;
    featureOnly?: string;
    entriesOnly?: string[];
    strict: boolean;
    analyze: boolean;
    profile: boolean;
    sourceMaps: boolean;
    clean: boolean;
    cacheDirectory?: string;
    watch: boolean;
}

interface DevCommandLineArgs {
    cwd: string;
    mode: WorkMode;
    configFile?: string;
    envFiles?: string[];
    srcDirectory: string;
    entriesDirectory: string;
    buildTarget: string;
    proxyDomain?: string;
    host?: HostType;
    entry: string;
    strict: boolean;
    open: boolean;
}
```

## 导出 API

```typescript
// 核心函数
export { readProjectSettings };           // 读取配置
export { watchProjectSettings };          // 监听配置
export { configure };                     // 配置辅助函数
export { fillProjectSettings };           // 填充默认值
export { warnAndExitOnInvalidFinalizeReturn };
export { strictCheckRequiredDependency };

// 所有类型定义
export * from './interface/index.js';
```

### 子路径导出

```typescript
// @nut-up/settings/client
// 提供客户端类型定义，用于业务代码中访问 skr.features 等
```

## 依赖关系

```json
{
  "dependencies": {
    "@nut-up/core": "workspace:*",
    "chokidar": "^5.0.0",
    "hasha": "^7.0.0",
    "schema-utils": "^4.3.3"
  }
}
```

**关键依赖说明：**

| 依赖 | 用途 |
|------|------|
| `@nut-up/core` | 日志、模块导入等基础功能 |
| `chokidar` | 文件监听 |
| `hasha` | 文件 hash 计算（用于变更检测） |
| `schema-utils` | 配置 Schema 校验 |

## 配置文件搜索顺序

1. 命令行指定的 `--config` 文件
2. `nut.config.ts`
3. `nut.config.mjs`

## 设计优势

1. **单例缓存**：配置只读取一次，后续调用返回缓存
2. **变更检测**：使用文件 hash 避免重复通知
3. **插件系统**：支持通过插件扩展配置
4. **类型安全**：完整的 TypeScript 类型定义
5. **默认值合理**：开箱即用的默认配置
6. **finalize 钩子**：允许用户完全自定义最终配置

## 发布配置

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./client": "./client.d.ts"
  }
}
```