import {PluginItem, TransformOptions} from '@babel/core';
import presetEnv from '@babel/preset-env';
import presetTypeScript from '@babel/preset-typescript';
import presetReact from '@babel/preset-react';
import pluginDecorators from '@babel/plugin-proposal-decorators';
import pluginDoExpressions from '@babel/plugin-proposal-do-expressions';
import pluginExportDefaultFrom from '@babel/plugin-proposal-export-default-from';
import pluginThrowExpressions from '@babel/plugin-proposal-throw-expressions';
import {BabelConfigOptionsFilled} from './interface.js';
import {compatPluginTarget, shouldEnable} from './utils.js';

// 因为要转CJS，不能依赖`@nutry/core`提供的`compact`
const hasValue = (value: PluginItem | false): value is PluginItem => !!value;

export default (options: BabelConfigOptionsFilled): TransformOptions => {
    const {polyfill, modules, uses} = options;
    const presets: Array<PluginItem | false> = [
        [
            compatPluginTarget(presetEnv),
            {
                modules,
                bugfixes: true,
                debug: false,
                useBuiltIns: polyfill ? 'usage' : false,
                corejs: polyfill ? {version: polyfill === true ? 3 : polyfill, proposals: true} : undefined,
            },
        ],
        compatPluginTarget(presetTypeScript),
        [
            compatPluginTarget(presetReact),
            {
                runtime: 'automatic',
                importSource: shouldEnable('emotion', uses) ? '@emotion/react' : 'react',
            },
        ],
    ];
    const plugins: PluginItem[] = [
        [compatPluginTarget(pluginDecorators), {legacy: true}],
        // const x = do { if(a) b; }
        compatPluginTarget(pluginDoExpressions),
        // export Foo from './Foo';
        compatPluginTarget(pluginExportDefaultFrom),
        // const valid = input.isValid() || throw new Error('Invalid')
        compatPluginTarget(pluginThrowExpressions),
    ];

    return {
        plugins,
        presets: presets.filter(hasValue),
    };
};
