import {RuleSetRule} from 'webpack';
import {isProjectSourceIn, normalizeRuleMatch} from '@nut-up/core';
import {WebpackBuildEntry} from '@nut-up/settings';
import * as loaders from '../loaders/index.js';
import {introduceLoaders} from '../utils/loader.js';

type LoaderType = keyof typeof loaders;

const createUseWith = (entry: WebpackBuildEntry) => {
    return (...names: Array<LoaderType | false>) => introduceLoaders(names, entry);
};

const assetModuleConfig = (entry: WebpackBuildEntry) => {
    return {
        type: 'asset',
        parser: {
            dataUrlCondition: {
                maxSize: entry.projectSettings.build.largeAssetSize,
            },
        },
    };
};

export const url = (): RuleSetRule => {
    return {
        resourceQuery: /^\?url$/,
        type: 'asset/resource',
        generator: {
            filename: 'assets/[hash][ext]',
        },
    };
};

export const raw = (): RuleSetRule => {
    return {
        resourceQuery: /^\?raw$/,
        type: 'asset/source',
    };
};

// 在第三方代码与项目代码的处理上，使用的策略是“非`cwd`下的全部算第三方代码”，而不是“包含`node_modules`的算第三方”。
// 这一逻辑取决于在使用monorepo时的形式，当前monorepo下我们要求被引用的包是构建后的。

export const script = async (entry: WebpackBuildEntry): Promise<RuleSetRule> => {
    const {cwd, projectSettings: {build: {script: {babel}}}} = entry;
    const use = createUseWith(entry);
    const isProjectSource = isProjectSourceIn(cwd);
    const rulesWithBabelRequirement = async (requireBabel: boolean) => {
        return {
            oneOf: [
                // 项目源码内的其它文件，需要`eslint`检查
                {
                    resource: isProjectSource,
                    use: await use(requireBabel && 'babel'),
                },
                // 第三方代码，按需过`babel`
                {
                    use: await use(requireBabel && 'babel'),
                },
            ],
        };
    };
    const [hasBabel, noBabel] = await Promise.all([rulesWithBabelRequirement(true), rulesWithBabelRequirement(false)]);

    return {
        test: /\.[jt]sx?$/,
        resourceQuery: {
            not: /^\?raw|url$/,
        },
        oneOf: [
            {
                resource: normalizeRuleMatch(cwd, babel),
                ...hasBabel,
            },
            noBabel,
        ],
    };
};

export const less = async (entry: WebpackBuildEntry): Promise<RuleSetRule> => {
    const {cwd, usage, projectSettings: {build: {style: {modules, extract}}}} = entry;
    const use = createUseWith(entry);
    const final = (usage === 'build' && extract) ? 'cssExtract' : 'style';
    const uses = [
        use(final, 'css', 'postcss', 'less'),
        use('classNames', final, 'cssModules', 'postcss', 'less'),
    ] as const;
    const [globalLess, less] = await Promise.all(uses);

    return {
        test: /\.less$/,
        resourceQuery: {
            not: /^\?raw|url$/,
        },
        oneOf: [
            {
                test: /\.global\.less$/,
                use: globalLess,
            },
            {
                resource: normalizeRuleMatch(cwd, modules),
                use: less,
            },
            {
                use: globalLess,
            },
        ],
    };
};

export const css = async (entry: WebpackBuildEntry): Promise<RuleSetRule> => {
    const {cwd, usage, projectSettings: {build: {style: {modules, extract}}}} = entry;
    const use = createUseWith(entry);
    const final = (usage === 'build' && extract) ? 'cssExtract' : 'style';
    const uses = [
        use(final, 'css', 'postcss'),
        use('classNames', final, 'cssModules', 'postcss'),
    ] as const;
    const [globalCss, css] = await Promise.all(uses);

    return {
        test: /\.css$/,
        resourceQuery: {
            not: /^\?raw|url$/,
        },
        oneOf: [
            {
                test: /\.global\.css$/,
                use: globalCss,
            },
            {
                resource: normalizeRuleMatch(cwd, modules),
                use: css,
            },
            {
                use: globalCss,
            },
        ],
    };
};

export const image = (): RuleSetRule => {
    return {
        test: /\.(jpe?g|png|gif)$/i,
        resourceQuery: {
            not: /^\?raw|url$/,
        },
        type: 'asset/resource',
        generator: {
            filename: 'assets/[hash][ext]',
        },
    };
};

export const svg = async (entry: WebpackBuildEntry): Promise<RuleSetRule> => {
    const use = createUseWith(entry);

    return {
        test: /\.svg$/,
        resourceQuery: {
            not: /^\?raw|url$/,
        },
        oneOf: [
            {
                // 如果挂了`?react`的，就直接转成组件返回
                resourceQuery: /^\?react$/,
                use: await use('svgToComponent'),
            },
            {
                resourceQuery: {
                    not: /^\?react$/,
                },
                ...assetModuleConfig(entry),
            },
        ],
    };
};

export const file = (entry: WebpackBuildEntry): RuleSetRule => {
    return {
        test: /\.(eot|ttf|woff|woff2)(\?.+)?$/,
        resourceQuery: {
            not: /^\?raw|url$/,
        },
        ...assetModuleConfig(entry),
    };
};
