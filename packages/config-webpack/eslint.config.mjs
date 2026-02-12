import {defineConfig} from 'eslint/config';
import {baseConfig} from '@nutry/config-lint';

export default defineConfig(
    ...baseConfig,
    {
        name: 'local/no-react-plugins',
        files: ['src/**/*'],
            rules: {
            // react
            'react/jsx-uses-react': 'off',
            'react/jsx-uses-vars': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/display-name': 'off',
            'react/prop-types': 'off',
            // hooks
            'react-hooks/rules-of-hooks': 'off',
            'react-hooks/exhaustive-deps': 'off',
            // a11y
            'jsx-a11y/alt-text': 'off',
        }
    }
);