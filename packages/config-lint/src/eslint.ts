import type {Config} from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import hooksPlugin from 'eslint-plugin-react-hooks';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export const baseConfig: Config[] = [
    // --- 1. 全局忽略 ---
    {
        name: "nut-up/ignores",
        ignores: ['dist/**', 'node_modules/**', '**/eslint.config.*', 'build/**', '*.d.ts'],
    },
    // --- 2. JS 基础规则（JS / JSX） ---
    {
        name: 'nut-up/js',
        files: ['**/*.{js,jsx}'],
        rules: {
            ...js.configs.recommended.rules,
        },
    },
    // --- 3. TS 类型安全规则（TS / TSX） ---
    ...tseslint.configs.recommendedTypeChecked.map(cfg => ({
        ...cfg,
        files: ['**/*.{ts,tsx}'],
    })),
    {
        name: "nut-up/ts",
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                warnOnUnsupportedTypeScriptVersion: false,
                // project: ['./tsconfig.json', './packages/*/tsconfig.json'], // 关键：支持 Monorepo
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            'import': importPlugin,
        },
        rules: {
            // 禁止循环依赖（企业项目死穴）
            'import/no-cycle': ['error', { maxDepth: 10 }],
            // 限制单文件复杂度（防止出现千行组件）
            'complexity': ['warn', { max: 20 }],
            // 强制使用 const
            'prefer-const': 'error',
            // 禁用 console（生产环境保持整洁）
            'no-console': ['warn', { allow: ['warn', 'error'] }],
            '@typescript-eslint/no-explicit-any': 'off',
            // TS 严格检查：禁止未使用的变量
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            // 强制 Promise 必须被处理
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/restrict-template-expressions': 'off'
        },
    },
];

export const reactConfig: Config[] =  [
    // --- 4. React 深度优化 ---
    hooksPlugin.configs.flat.recommended,
    {
        name: "nut-up/react",
        files: ['**/*.{jsx,tsx}'],
        plugins: {
            'react': reactPlugin,
            'jsx-a11y': jsxA11y,
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            ...reactPlugin.configs.recommended.rules,
            // 强制 Hooks 依赖完整性（核心）
            'react-hooks/exhaustive-deps': 'warn',
            // 允许在 TSX 中使用解构赋值作为 Props 默认值（ES6 风格）
            'react/react-in-jsx-scope': 'off', // React 17+ 不需要引入 React
            'react/prop-types': 'off',         // 有了 TS 不需要 Prop-types
            'react/display-name': 'off',
            // 增强无障碍检查
            'jsx-a11y/alt-text': 'error',
        },
    }
];

export const styleConfig: Config[] =  [
    // --- 5. 导入顺序约束（保持代码整洁的秘密） ---
    {
        rules: {
            'import/order': ['error', {
                'groups': ['builtin', 'external', 'internal', ['parent', 'sibling'], 'index', 'object', 'type'],
                'pathGroups': [
                    { 'pattern': 'react', 'group': 'external', 'position': 'before' },
                    { 'pattern': '@/components/**', 'group': 'internal' }
                ],
                'pathGroupsExcludedImportTypes': ['react'],
                'newlines-between': 'always',
                'alphabetize': { 'order': 'asc', 'caseInsensitive': true }
            }],
        }
    }
]

export const eslintConfig = [...baseConfig, ...reactConfig];
