import {watchProjectSettings, DevCommandLineArgs, readProjectSettings, ProjectSettings} from '@nutry/settings';
import {prepareEnvironment} from '@nutry/core';
import {EntryLocation} from '@nutry/utils-build';
import {createBuildContext, prepareServerContext, restartable} from './utils.js';

process.env.OPEN_MATCH_HOST_ONLY = 'true';

const createStartFn = async (cmd: DevCommandLineArgs, projectSettings: ProjectSettings) => {
    const entryLocation: EntryLocation = {
        cwd: cmd.cwd,
        srcDirectory: cmd.srcDirectory,
        entryDirectory: cmd.entriesDirectory,
        only: [cmd.entry],
    };

    const importing = [import('@nutry/config-webpack'), import('./webpack.js')] as const;
    const [{collectEntries}, {start}] = await Promise.all(importing);
    const entries = await collectEntries(entryLocation);
    const buildContext = await createBuildContext({cmd, projectSettings, entries});
    const serverContext = await prepareServerContext({cmd, buildContext});
    return () => start(cmd, serverContext);
};

export const run = async (cmd: DevCommandLineArgs): Promise<void> => {
    process.env.NODE_ENV = cmd.mode;
    await prepareEnvironment(cmd.cwd, cmd.mode, cmd.envFiles);

    const projectSettings = await readProjectSettings({commandName: 'dev', specifiedFile: cmd.configFile, ...cmd});
    const startFn = await createStartFn(cmd, projectSettings);
    const restart = restartable(startFn);
    const listen = await watchProjectSettings({commandName: 'dev', specifiedFile: cmd.configFile, ...cmd});
    listen(restart);
};