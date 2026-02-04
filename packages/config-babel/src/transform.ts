import {PluginItem, TransformOptions} from '@babel/core';
import pluginReactConstantElement from '@babel/plugin-transform-react-constant-elements';
import {compact} from '@nut-up/core';
import addReactDisplayName from './plugins/add-react-display-name.js';
import {compatPluginTarget} from './utils.js';
import getTransformMinimalBabelConfig from './transformMinimal.js';
import {BabelConfigOptionsFilled} from './interface.js';

const requireDisplayName = (options: BabelConfigOptionsFilled) => {
    const {displayName, mode} = options;
    return displayName === true || (displayName === 'auto' && mode === 'development');
};

export default (options: BabelConfigOptionsFilled): TransformOptions => {
    const minimal = getTransformMinimalBabelConfig(options);
    const plugins: Array<PluginItem | false> = [
        // 这东西必须放在最前面，不然`export default class`会被其它插件转义掉没机会确认真实的名字
        requireDisplayName(options) && compatPluginTarget(addReactDisplayName),
        ...minimal.plugins || [],
        // https://babeljs.io/docs/en/babel-plugin-transform-react-constant-elements
        // https://github.com/facebook/react/issues/3226
        compatPluginTarget(pluginReactConstantElement),
    ];

    return {
        presets: minimal.presets,
        plugins: compact(plugins),
    };
};
