import {defineConfig} from 'eslint/config';
import {eslintConfig} from '@nutry/config-lint';

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
    },
    {
        name: "nutry/ts",
        files: ['**/__tests__/**/*.test.{js,jsx,ts,tsx}'],
        rules: {
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off'
        }
    }
);