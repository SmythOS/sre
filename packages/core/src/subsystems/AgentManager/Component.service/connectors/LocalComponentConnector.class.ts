import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';

import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

import { ComponentConnector } from '../ComponentConnector';

const console = Logger('LocalComponentConnector');
export class LocalComponentConnector extends ComponentConnector {
    public name: string = 'LocalComponentConnector';
    private components: any = {};

    constructor() {
        super();
    }

    @SecureConnector.AccessControl
    protected async register(acRequest: AccessRequest, componentName: string, componentInstance: any) {
        this.components[componentName] = componentInstance;
    }

    @SecureConnector.AccessControl
    protected async get(acRequest: AccessRequest, componentName: string) {
        return this.components[componentName];
    }

    @SecureConnector.AccessControl
    protected async getAll(acRequest: AccessRequest) {
        return this.components;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();

        const teamId = await accountConnector.getCandidateTeam(candidate);

        const acl = new ACL();

        //Grant read access by default
        acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Read).addAccess(candidate.role, candidate.id, TAccessLevel.Read);

        return acl;
    }
}
