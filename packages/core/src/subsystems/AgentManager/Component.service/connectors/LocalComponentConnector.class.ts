import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';

import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

import { ComponentConnector } from '../ComponentConnector';
import { ComponentInstances } from '@sre/Components/index';

const console = Logger('LocalComponentConnector');

//TODO : future : Candidate specific components access : we can rely on the ACL to isolate the components per user/agent/team
export class LocalComponentConnector extends ComponentConnector {
    public name: string = 'LocalComponentConnector';
    private components: any = {};

    constructor() {
        super();

        this.init();
    }

    async init() {
        for (const component in ComponentInstances) {
            this.components[component] = ComponentInstances[component];
        }
        console.debug('Registering Components :', Object.keys(this.components).join(', '));
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
