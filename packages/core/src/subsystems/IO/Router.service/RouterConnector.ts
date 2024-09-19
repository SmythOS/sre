import { Connector } from '@sre/Core/Connector.class';
import { SmythFS } from '../Storage.service/SmythFS.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export type GenericRequestHandler = (...args: any[]) => void | Promise<void>;

export abstract class RouterConnector extends Connector {
    public abstract baseUrl: string;

    abstract get(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract post(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract put(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract delete(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract useFn(...handlers: GenericRequestHandler[]): this;
    abstract use(path: string, ...handlers: GenericRequestHandler[]): this;
}
