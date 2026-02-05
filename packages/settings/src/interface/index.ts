export {ClientProjectSettings, ProjectSettings, WebpackProjectSettings} from './project.js';
export {
    BuildEntry,
    BuildEnv,
    CommandName,
    ReskriptDriver,
    RuntimeBuildEnv,
    WebpackBuildEntry,
} from './shared.js';
export {FeatureMatrix} from './featureMatrix.js';
export {
    BuildInspectInitialResource,
    BuildInspectSettings,
    BuildScriptSettings,
    BuildSettings,
    WebpackBuildStyleSettings,
    OptionalRuleConfig,
    RuleConfig,
    Severity,
    SourceFilter,
    ThirdPartyUse,
    WebpackBuildSettings,
} from './build.js';
export {
    CommandInput,
    HostType,
    TestTarget,
    BabelCommandLineArgs,
    BuildCommandLineArgs,
    DevCommandLineArgs,
    LintCommandLineArgs,
    PlayCommandLineArgs,
    TestCommandLineArgs,
} from './command.js';
export {
    DevServerHttps,
    DevServerSettings,
    WebpackDevServerSettings,
    Middleware,
    MiddlewareHook,
    MiddlewareCustomization,
    CustomizeMiddleware,
} from './devServer.js';
export {PlaySettings} from './play.js';
export {SettingsPluginItem, SettingsPlugin} from './plugin.js';
export {
    BuildInternals,
    FinalizableWebpackConfiguration,
    InternalRules,
    LoaderFactory,
    LoaderType,
    RuleFactory,
    WebpackFinalize,
} from './webpack.js';
export {PortalSettings, SetupPortal, PortalHelper} from './portal.js';

export type Listener = () => void | Promise<void>;

export type Observe = (listener: Listener) => () => void;
