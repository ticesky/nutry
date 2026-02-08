import {stylelintConfig} from '@nut-up/config-lint';

/** @type {import('stylelint').Config} */
export default {
    ...stylelintConfig,
    rules: {
        ...stylelintConfig.rules,
        'shorthand-property-no-redundant-values': null,
    },
};