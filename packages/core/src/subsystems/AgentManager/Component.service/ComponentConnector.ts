import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, IACL } from '@sre/types/ACL.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';

export interface IComponentRequest {
    register(componentName: string, componentInstance: any): Promise<void>;
    get(componentName: string): Promise<any>;
    getAll(): Promise<any>;
}

export abstract class ComponentConnector extends SecureConnector {
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;
    protected abstract register(acRequest: AccessRequest, componentName: string, componentInstance: any): Promise<void>;
    protected abstract get(acRequest: AccessRequest, componentName: string): Promise<any>;
    protected abstract getAll(acRequest: AccessRequest): Promise<any>;

    public requester(candidate: AccessCandidate): IComponentRequest {
        return {
            register: async (componentName: string, componentInstance: any) => {
                return await this.register(candidate.readRequest, componentName, componentInstance);
            },
            get: async (componentName: string) => {
                return await this.get(candidate.readRequest, componentName);
            },
            getAll: async () => {
                return await this.getAll(candidate.readRequest);
            },
        } as IComponentRequest;
    }
}
