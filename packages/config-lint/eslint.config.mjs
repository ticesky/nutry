import {defineConfig} from 'eslint/config';
import {eslintConfig as baseConfig} from './dist/index.js';

export default defineConfig(
    ...baseConfig,
);