import { Logger } from '@sre/helpers/Log.helper';
import { RouterConnector, GenericRequestHandler } from '../RouterConnector';

const console = Logger('NullRouter');
export class NullRouter extends RouterConnector {
    public baseUrl: string;
    constructor(protected _settings?: any) {
        super(_settings);
        this.baseUrl = 'http://nullrouter.local';
    }

    get(path: string, ...handlers: GenericRequestHandler[]): this {
        console.debug(`Ignored operation:NullRouter.get: ${path}`);
        return this;
    }

    post(path: string, ...handlers: GenericRequestHandler[]): this {
        console.debug(`Ignored operation:NullRouter.post: ${path}`);
        return this;
    }

    put(path: string, ...handlers: GenericRequestHandler[]): this {
        console.debug(`Ignored operation:NullRouter.put: ${path}`);
        return this;
    }

    delete(path: string, ...handlers: GenericRequestHandler[]): this {
        console.debug(`Ignored operation:NullRouter.delete: ${path}`);
        return this;
    }

    useFn(...handlers: GenericRequestHandler[]): this {
        console.debug(`Ignored operation:NullRouter.useFn`);
        return this;
    }

    use(path: string, ...handlers: GenericRequestHandler[]): this {
        return this;
    }
}
