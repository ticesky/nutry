import {describe, test, expect} from 'vitest';
import {constructProxyConfiguration} from '../proxy.js';

describe('constructProxyConfiguration', () => {
    test('multiple prefixes', () => {
        const options = {
            https: false,
            prefixes: ['/foo', '/bar'],
            rewrite: {},
            targetDomain: 'app.me',
        };
        const proxy = constructProxyConfiguration(options);
        const fooProxy = proxy.find(item => Array.isArray(item.context) && item.context.includes('/foo'));
        if (fooProxy?.pathRewrite && typeof fooProxy.pathRewrite === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            expect(fooProxy.pathRewrite('/foo/test', {} as any)).toBe('/foo/test');
        }
        const barProxy = proxy.find(item => Array.isArray(item.context) && item.context.includes('/bar'));
        
        expect(fooProxy).toBeTruthy();
        expect(fooProxy?.target).toBe('http://app.me');
        expect(fooProxy?.changeOrigin).toBe(true);
        expect(fooProxy?.pathRewrite).toBeDefined();
        expect(typeof fooProxy?.pathRewrite).toBe('function');
        
        expect(barProxy).toBeTruthy();
    });

    test('rewrite', () => {
        const options = {
            https: false,
            prefixes: [],
            rewrite: {
                '/foo': 'app.me:8888/bar',
            },
            targetDomain: 'app.me',
        };
        const proxy = constructProxyConfiguration(options);
        const fooProxy = proxy.find(item => Array.isArray(item.context) && item.context.includes('/foo'));
        
        expect(fooProxy).toBeTruthy();
        expect(fooProxy?.target).toBe('http://app.me:8888');
        expect(fooProxy?.pathRewrite).toBeDefined();
        expect(typeof fooProxy?.pathRewrite).toBe('function');
        if (fooProxy?.pathRewrite && typeof fooProxy.pathRewrite === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            expect(fooProxy.pathRewrite('/foo', {} as any)).toBe('/bar');
        }
    });

    test('rewrite with protocol', () => {
        const options = {
            https: false,
            prefixes: [],
            rewrite: {
                '/foo': 'https://app.me:8888/bar',
            },
            targetDomain: 'app.me',
        };
        const proxy = constructProxyConfiguration(options);
        const fooProxy = proxy.find(item => Array.isArray(item.context) && item.context.includes('/foo'));
        expect(fooProxy?.target).toBe('https://app.me:8888');
    });

    test('agent', () => {
        const httpProxy = process.env.http_proxy;
        process.env.http_proxy = 'http://localhost:8888';
        const options = {
            https: false,
            prefixes: ['/foo'],
            rewrite: {},
            targetDomain: 'app.me',
        };
        const proxy = constructProxyConfiguration(options);
        const fooProxy = proxy.find(item => Array.isArray(item.context) && item.context.includes('/foo'));
        expect(fooProxy?.agent).toBeTruthy();
        process.env.http_proxy = httpProxy;
    });

    test('https', () => {
        const options = {
            https: true,
            prefixes: ['/foo'],
            rewrite: {},
            targetDomain: 'app.me',
        };
        const proxy = constructProxyConfiguration(options);
        const fooProxy = proxy.find(item => Array.isArray(item.context) && item.context.includes('/foo'));
        expect(fooProxy?.target).toBe('https://app.me');
    });
});
