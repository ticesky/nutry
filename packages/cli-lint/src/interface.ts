import {GitStatusResult} from '@nut-up/core';
import {LintCommandLineArgs} from '@nut-up/settings';

export interface ResolveOptions extends LintCommandLineArgs {
    gitStatus: GitStatusResult;
    gitRoot: string;
}
