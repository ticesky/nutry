declare module 'eslint-formatter-table' {
  import type { ESLint } from 'eslint';

  const formatter: (
    results: ESLint.LintResult[],
    data?: unknown
  ) => string;

  export = formatter;
}