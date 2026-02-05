import {PluginItem, TransformOptions} from '@babel/core';
// import debugReactComponentFileName from '@reskript/babel-plugin-debug-react-component-file-name';
import pluginReactRefresh from 'react-refresh/babel';
import {compact} from '@nut-up/core';
import {compatPluginTarget, fillBabelConfigOptions} from './utils.js';
import getTransformBabelConfigFilled from './transform.js';
import {BabelConfigOptions} from './interface.js';

export type {BabelConfigOptions};

export const getTransformBabelConfig = (input?: BabelConfigOptions): TransformOptions => {
    return getTransformBabelConfigFilled(fillBabelConfigOptions(input));
};

// const requireFileName = (options: BabelConfigOptionsFilled) => {
//     const {mode, hostType} = options;
//     return mode === 'development' && hostType === 'application';
// };

export const getBabelConfig = (input?: BabelConfigOptions): TransformOptions => {
    const options = fillBabelConfigOptions(input);
    // const {mode, hot, hostType, cwd, srcDirectory} = options;
    const {hot} = options;
    const transform = getTransformBabelConfig(options);
    const plugins: Array<PluginItem | false> = [
        // 这东西必须放在最前面，不然其它插件会转义出如`function Wrapper()`这样的函数，这个插件再插入代码就会出问题
        // requireFileName(options) && [
        //     debugReactComponentFileName,
        //     {
        //         srcDirectory: path.resolve(cwd, srcDirectory),
        //         fullPathPrefix: options.openInEditorPrefix,
        //     },
        // ],
        ...transform.plugins || [],
        hot && [compatPluginTarget(pluginReactRefresh), {skipEnvCheck: true}],
    ];

    return {presets: transform.presets, plugins: compact(plugins)};
};