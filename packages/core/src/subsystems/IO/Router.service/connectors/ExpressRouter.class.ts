import { Router } from 'express';
import { RouterConnector, GenericRequestHandler } from '../RouterConnector';

export class ExpressRouter extends RouterConnector {
    private router: Router;
    public baseUrl: string;

    constructor(config: { router: Router; baseUrl: string }) {
        super(config);
        this.name = 'ExpressRouter';
        this.router = config.router;
        this.baseUrl = config.baseUrl;
    }

    get(path: string, ...handlers: GenericRequestHandler[]): this {
        this.router.get(path, ...handlers);
        return this;
    }

    post(path: string, ...handlers: GenericRequestHandler[]): this {
        this.router.post(path, ...handlers);
        return this;
    }

    put(path: string, ...handlers: GenericRequestHandler[]): this {
        this.router.put(path, ...handlers);
        return this;
    }

    delete(path: string, ...handlers: GenericRequestHandler[]): this {
        this.router.delete(path, ...handlers);
        return this;
    }

    useFn(...handlers: GenericRequestHandler[]): this {
        this.router.use(...handlers);
        return this;
    }

    use(path: string, ...handlers: GenericRequestHandler[]): this {
        this.router.use(path, ...handlers);
        return this;
    }

    getRouter(): Router {
        return this.router;
    }
}
