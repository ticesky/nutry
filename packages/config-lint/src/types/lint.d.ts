declare module 'eslint-plugin-jsx-a11y' {
  import type { Linter } from 'eslint';

  const plugin: {
    rules: Record<string, Linter.RuleModule>;
    configs?: Record<string, Linter.Config>;
  };

  export = plugin;
}