import { Connector } from '@sre/Core/Connector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { ACLAccessDeniedError, IAccessCandidate, TAccessLevel, TAccessResult, TAccessTicket } from '@sre/types/ACL.types';
import { ACL } from './AccessControl/ACL.class';
import { AccessCandidate } from './AccessControl/AccessCandidate.class';
import { AccessRequest } from './AccessControl/AccessRequest.class';

const console = Logger('SecureConnector');

export abstract class SecureConnector<TRequest = any> extends Connector<TRequest> {
    public abstract name: string;

    //this determines the access rights for the requested resource
    //the connector should check if the resource exists or not
    //if the resource exists we read its ACL and return it
    //if the resource does not exist we return an write access ACL for the candidate
    public abstract getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL>;

    public async start() {
        console.info(`Starting ${this.name} S:Connector ...`);
    }

    public async stop() {
        console.info(`Stopping ${this.name} S:Connector ...`);
    }

    protected async hasAccess(acRequest: AccessRequest) {
        const aclHelper = await this.getResourceACL(acRequest.resourceId, acRequest.candidate).catch((error) => {
            console.error(`Error getting ACL for ${acRequest.resourceId}: ${error}`);
            return null;
        });

        if (!aclHelper) return false;

        //const aclHelper = ACLHelper.from(acl);

        const exactAccess = aclHelper.checkExactAccess(acRequest);
        if (exactAccess) return true;

        // if the exact access is denied, we check if the candidate has a higher access
        const ownerRequest = AccessRequest.clone(acRequest).setLevel(TAccessLevel.Owner);
        const ownerAccess = aclHelper.checkExactAccess(ownerRequest);
        if (ownerAccess) return true;

        // if the exact access is denied, we check if the requested resource has a public access
        const publicRequest = AccessRequest.clone(acRequest).setCandidate(AccessCandidate.public());
        const publicAccess = aclHelper.checkExactAccess(publicRequest);
        if (publicAccess) return true;

        // if the public access is denied, we check if the candidate's team has access
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
        const teamRequest = AccessRequest.clone(acRequest).setCandidate(AccessCandidate.team(teamId));
        const teamAccess = aclHelper.checkExactAccess(teamRequest);
        if (teamAccess) return true;

        // if the team access is denied, we check if the team has a higher access
        const teamOwnerRequest = AccessRequest.clone(teamRequest).setLevel(TAccessLevel.Owner);
        const teamOwnerAccess = aclHelper.checkExactAccess(teamOwnerRequest);
        if (teamOwnerAccess) return true;

        return false;
    }
    public async getAccessTicket(resourceId: string, request: AccessRequest): Promise<TAccessTicket> {
        const sysAcRequest = AccessRequest.clone(request).resource(resourceId);
        const accessTicket = {
            request,
            access: (await this.hasAccess(sysAcRequest)) ? TAccessResult.Granted : TAccessResult.Denied,
        };

        return accessTicket as TAccessTicket;
    }

    //#region [ Decorators ]==========================

    //AccessControl decorator
    //This decorator will inject the access control logic into storage connector methods
    // in order to work properly, the connector expects the resourceId to be the first argument and the access request to be the second argument

    static AccessControl(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        // Store the original method in a variable
        const originalMethod = descriptor.value;

        // Modify the descriptor's value to wrap the original method
        descriptor.value = async function (...args: any[]) {
            // Extract the method arguments
            const [acRequest, resourceId] = args;

            if (resourceId !== undefined) {
                //: getAccessTicket requires a resourceId
                //FIXME: implement different access control for resources listing and methods that do not require a resourceId
                // Inject the access control logic
                const accessTicket = await this.getAccessTicket(resourceId, acRequest);
                if (accessTicket.access !== TAccessResult.Granted) {
                    console.error(`Access denied for ${acRequest.candidate.id} on ${resourceId}`);
                    throw new ACLAccessDeniedError('Access Denied');
                }
            }

            // Call the original method with the original arguments
            return originalMethod.apply(this, args);
        };

        // Return the modified descriptor
        return descriptor;
    }

    //#endregion
}
