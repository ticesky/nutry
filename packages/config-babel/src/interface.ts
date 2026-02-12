import {WorkMode} from '@nutry/core';
import {ThirdPartyUse} from '@nutry/settings';

export interface BabelConfigOptions {
    readonly uses?: ThirdPartyUse[];
    readonly mode?: WorkMode;
    readonly hot?: boolean;
    readonly hostType?: 'application' | 'library';
    readonly polyfill?: boolean | string | number;
    readonly modules?: false | 'commonjs';
    readonly displayName?: boolean | 'auto';
    readonly cwd?: string;
    readonly srcDirectory?: string;
    readonly openInEditorPrefix?: string;
}

export type BabelConfigOptionsFilled = Required<BabelConfigOptions>;
