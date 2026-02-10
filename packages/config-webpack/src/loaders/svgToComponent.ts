import {resolve} from '@nut-up/core';
import {LoaderFactory} from '../interface.js';

const factory: LoaderFactory = async _entry => {
    return {
        loader: await resolve('@svgr/webpack'),
    };
};

export default factory;
