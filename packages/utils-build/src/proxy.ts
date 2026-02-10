import {ProxyAgent} from 'proxy-agent';
import type {ProxyConfigArrayItem} from 'webpack-dev-server';

export interface ProxyOptions {
    https: boolean;
    prefixes: string[];
    rewrite: Record<string, string>;
    targetDomain: string;
}

export const constructProxyConfiguration = (options: ProxyOptions): ProxyConfigArrayItem[] => {
    const {https, prefixes, rewrite, targetDomain} = options;
    const agent = new ProxyAgent();
    const rules = [
        ...Object.entries(rewrite),
        ...prefixes.map(path => [path, `${targetDomain}${path}`]),
    ];

    return rules.map(([prefix, target]) => {
        // 假设我们要配置`{'/api': 'example.com/gateway'}，那么`/api/list`要变成`example.com/gateway/list`
        const parsedUrl = new URL(/^https?:\/\//.test(target) ? target : `${https ? 'https' : 'http'}://${target}`);
        // 此处的`pathPrefix`就是`/gateway`
        const pathPrefix = parsedUrl.pathname;

        return {
            context: [prefix],
            target: `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`,
            agent,
            pathRewrite: (path) =>
                path.replace(new RegExp(`^${prefix}`), pathPrefix),
            changeOrigin: true,
        };
    });
};
