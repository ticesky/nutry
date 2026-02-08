declare module 'eslint-plugin-jsx-a11y' {
  import type { Linter } from 'eslint';

  const plugin: {
    rules: Record<string, Linter.RuleModule>;
    configs?: Record<string, Linter.Config>;
  };

  export = plugin;
}

declare module 'stylelint-config-standard' {
  import type { Config } from 'stylelint';
  const config: Config;
  export default config;
}

declare module 'stylelint-config-standard-scss' {
  import type { Config } from 'stylelint';
  const config: Config;
  export default config;
}

declare module 'stylelint-config-standard-less' {
  import type { Config } from 'stylelint';
  const config: Config;
  export default config;
}

declare module 'postcss-less' {
  import { Syntax } from 'postcss';
  
  // postcss-less 导出的实际上是一个包含 parse 和 stringify 的 Syntax 对象
  const syntax: Syntax;
  
  export default syntax;
}