import {defineConfig} from 'eslint/config';
import {eslintConfig} from '@nut-up/config-lint';

export default defineConfig(
    {
        name: "ignores",
        ignores: ['**/service-worker.js'],
    },
    ...eslintConfig,
    {
        rules: {
            'no-sparse-arrays': 'off',
            '@typescript-eslint/no-floating-promises': 'off',
            '@typescript-eslint/no-misused-promises': 'off',
        }
    }
);