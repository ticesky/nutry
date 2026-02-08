import type { Config } from 'stylelint';
import standard from 'stylelint-config-standard';
import standardScss from 'stylelint-config-standard-scss';
import standardLess from 'stylelint-config-standard-less';
import postcssLess from 'postcss-less';
import stylelintLess from 'stylelint-less';

export const stylelintConfig: Config = {
  /* ----------------- 全局忽略 ----------------- */
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
  ],

  /* ----------------- 插件 ----------------- */
  //   plugins: [orderPlugin],
  
  /* ----------------- 基础 CSS ----------------- */
  ...standard,
  extends: [],

  rules: {
    ...standard.rules,
    /* ---- 代码质量 ---- */
    'color-no-invalid-hex': true,
    'font-family-no-duplicate-names': true,
    'declaration-block-no-duplicate-properties': true,
    /* ---- 不和 Prettier 冲突 ---- */
    // 'indentation': null,
    // 'max-line-length': null,
  },

  /* ----------------- 按文件类型覆盖 ----------------- */
  overrides: [
    /* ---------- SCSS ---------- */
    {
      files: ['**/*.scss'],
      ...standardScss,
      extends: [],
      rules: {
        ...standardScss.rules,
        'scss/dollar-variable-pattern': null,
      },
    },
    /* ---------- LESS ---------- */
    {
      files: ['**/*.less'],
      ...standardLess,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      customSyntax: postcssLess,
      extends: [],
      plugins: [stylelintLess],
      rules: {
        ...standardLess.rules,
        // LESS 变量 / mixin 容错
        'less/color-no-invalid-hex': null,
      },
    },
  ],
};