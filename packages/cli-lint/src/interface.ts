import {GitStatusResult} from '@nutry/core';
import {LintCommandLineArgs} from '@nutry/settings';

export interface ResolveOptions extends LintCommandLineArgs {
    gitStatus: GitStatusResult;
    gitRoot: string;
}
