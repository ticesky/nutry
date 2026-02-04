import {defineConfig} from 'eslint/config';
import {eslintConfig as baseConfig} from '@nut-up/config-lint';

export default defineConfig(
    ...baseConfig,
    {
        files: ['**/*.{js,ts}'],
        rules: {
            'new-cap': 'off',
        },
    }
);