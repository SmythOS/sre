import { Connector } from '@sre/Core/Connector.class';
import { SmythFS } from '../Storage.service/SmythFS.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

export type GenericRequestHandler = (...args: any[]) => void | Promise<void>;

/*
This Connector is highly discouraged to be used because by design, SRE should not handle any kind of HTTP requests
Currently it is only used to serve the temp files for external services to retrieve them.
*/

export abstract class RouterConnector extends Connector {
    public abstract baseUrl: string;

    abstract get(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract post(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract put(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract delete(path: string, ...handlers: GenericRequestHandler[]): this;
    abstract useFn(...handlers: GenericRequestHandler[]): this;
    abstract use(path: string, ...handlers: GenericRequestHandler[]): this;
}
