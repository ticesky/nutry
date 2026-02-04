import path from 'node:path';
import fs from 'node:fs';
import {Cli, Builtins} from 'clipanion';
import {logger, dirFromImportMeta} from '@nut-up/core';
import BuildCommand from './BuildCommand.js';
import DevCommand from './DevCommand.js';

const packageJsonContent = fs.readFileSync(
    path.join(dirFromImportMeta(import.meta.url), '..', 'package.json'),
    'utf-8'
);
const {version} = JSON.parse(packageJsonContent) as {version: string};

const cli = new Cli({binaryLabel: 'nut-up', binaryName: 'nut', binaryVersion: version});

cli.register(BuildCommand);
cli.register(DevCommand);
cli.register(Builtins.HelpCommand);
cli.register(Builtins.VersionCommand);

export const run = async () => {
    process.on(
        'unhandledRejection',
        (e: unknown) => {
            const message = e instanceof Error ? e.message : String(e);
            logger.error(message);
            process.exit(99);
        }
    );

    try {
        await cli.runExit(process.argv.slice(2), Cli.defaultContext);
    }
    catch (ex) {
        console.error(ex);
    }
};
