import path from 'node:path';
import fs from 'node:fs';
import type {Config} from 'eslint/config';
import {eslintConfig} from './eslint.js';
import stylelint from './stylelint.js';
export * from './eslint.js';

export const getScriptLintConfig = () => ([...eslintConfig]);

export const getStyleLintConfig = (): Record<string, any> => ({...stylelint});

interface BaseConfigOptions {
    cwd: string;
}

const CUSTOM_SCRIPT_LINT_CONFIG_FILES = [
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs'
];

const hasCustomScriptLintConfig = (cwd: string) => {
    const exists = (file: string) => fs.existsSync(path.join(cwd, file));
    return CUSTOM_SCRIPT_LINT_CONFIG_FILES.some(exists);
};

export const getScriptLintBaseConfig = ({cwd}: BaseConfigOptions): Config[] | undefined => {
    return hasCustomScriptLintConfig(cwd) ? undefined : getScriptLintConfig();
};

const CUSTOM_STYLE_LINT_CONFIG_FILES = [
    'stylelint.config.js',
    'stylelint.config.cjs',
];

const hasCustomStyleLintConfig = (cwd: string) => {
    const exists = (file: string) => fs.existsSync(path.join(cwd, file));
    return CUSTOM_STYLE_LINT_CONFIG_FILES.some(exists);
};

interface BaseConfigOptions {
    cwd: string;
}

export const getStyleLintBaseConfig = ({cwd}: BaseConfigOptions): Record<string, any> | undefined => {
    return hasCustomStyleLintConfig(cwd) ? undefined : getStyleLintConfig();
};
