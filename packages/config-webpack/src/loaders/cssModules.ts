import path from 'node:path';
import {resolve} from '@nutry/core';
import {hashSync} from 'hasha';
import {kebabCase} from 'change-case';
import {LoaderFactory} from '../interface.js';

const generateScopedStyleName = (name: string, filename: string): string => {
    const hash = hashSync(filename + name, {algorithm: 'md5'});
    const basename = path.basename(filename, path.extname(filename));
    const componentName = basename === 'index' ? path.basename(path.dirname(filename)) : basename;
    return `${kebabCase(componentName)}-${name}-${hash.slice(0, 5)}`;
};


const factory: LoaderFactory = async entry => {
    return {
        loader: await resolve('css-loader'),
        options: {
            sourceMap: entry.projectSettings.build.style.extract,
            importLoaders: true,
            modules: {
                mode: 'local',
                exportLocalsConvention: 'dashes',
                getLocalIdent({resourcePath}: {resourcePath: string}, _localIdentName: string, localName: string): string {
                    return generateScopedStyleName(localName, resourcePath);
                },
            },
        },
    };
};

export default factory;
