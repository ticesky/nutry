declare module '@soda/friendly-errors-webpack-plugin' {
    import {type WebpackPluginFunction} from 'webpack';

    export default class FriendlyErrorsWebpackPlugin extends WebpackPluginFunction {
        constructor(options: any);
    }
}
