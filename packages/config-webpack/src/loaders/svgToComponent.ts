import {resolve} from '@nut-up/core';
import {LoaderFactory} from '../interface.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const factory: LoaderFactory = async entry => {
    return {
        loader: await resolve('@svgr/webpack'),
    };
};

export default factory;
