import {defineConfig} from 'eslint/config';
import {baseConfig} from './dist/index.js';

export default defineConfig(
    ...baseConfig,
);