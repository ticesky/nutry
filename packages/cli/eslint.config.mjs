import {defineConfig} from 'eslint/config';
import {baseConfig} from '@nutry/config-lint';

export default defineConfig(
    ...baseConfig,
    {
        files: ['**/*.{js,ts}'],
        rules: {
            'new-cap': 'off',
        },
    }
);