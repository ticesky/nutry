declare module 'webpack-bundle-analyzer' {
    import type {WebpackPluginInstance} from 'webpack';

    export class BundleAnalyzerPlugin implements WebpackPluginInstance {
        constructor(options: Record<string, unknown>);
        apply: WebpackPluginInstance['apply'];
    }
}
