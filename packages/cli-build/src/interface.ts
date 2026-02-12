import {BuildCommandLineArgs, ProjectSettings} from '@nutry/settings';
import {BuildContext} from '@nutry/utils-build';

export interface BuildRunOptions<C, S extends ProjectSettings> {
    cmd: BuildCommandLineArgs;
    projectSettings: S;
    buildContextList: Array<BuildContext<C, S>>;
}

export interface WatchRunOptions<C, S extends ProjectSettings> {
    cmd: BuildCommandLineArgs;
    projectSettings: S;
    buildContext: BuildContext<C, S>;
}
