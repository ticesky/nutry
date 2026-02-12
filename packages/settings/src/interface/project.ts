import {ProjectAware} from '@nutry/core';
import {WebpackBuildSettings} from './build.js';
import {WebpackDevServerSettings} from './devServer.js';
import {FeatureMatrix} from './featureMatrix.js';
import {PlaySettings} from './play.js';
import {SettingsPlugin} from './plugin.js';
import {CommandName} from './shared.js';
import {PortalSettings} from './portal.js';

export interface ProjectSettingsBase extends ProjectAware {
    // 从哪里来的配置
    readonly from?: string;
    readonly featureMatrix: FeatureMatrix;
    readonly play: PlaySettings;
    readonly portal: PortalSettings;
}

export interface WebpackProjectSettings extends ProjectSettingsBase {
    readonly driver: 'webpack';
    readonly build: WebpackBuildSettings;
    readonly devServer: WebpackDevServerSettings;
}

export type ProjectSettings = WebpackProjectSettings;

type PluginsSetting = SettingsPlugin[] | ((commandName: CommandName) => SettingsPlugin[]);

export type ClientProjectSettings = ProjectSettings & {plugins: PluginsSetting};
