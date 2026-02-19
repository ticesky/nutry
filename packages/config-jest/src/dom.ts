import {TextEncoder} from 'util';
import JSDOMEnvironment from 'jest-environment-jsdom';

export default class DomEnvironment extends JSDOMEnvironment {
    async setup() {
        await super.setup();
        if (typeof this.global.TextEncoder === 'undefined') {
            this.global.TextEncoder = TextEncoder;
        }
    }
}
