import { describe, expect, it } from 'vitest';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessRequest, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
//import SRE, { AgentRequest } from '../../dist';
describe('SRE ACL Tests', () => {
    it('Create an ACL', async () => {
        const acl: ACL = new ACL();
        expect(acl).toBeInstanceOf(ACL);
    });
    it('Create an ACL with access rights and get the ACL object', async () => {
        // prettier-ignore
        const acl = new ACL()
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Read)
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Write)
            .addAccess(TAccessRole.Team, 'team1', TAccessLevel.Read)
            .ACL;

        expect(acl).toBeTypeOf('object');
    });
    it('Creates Compressed ACL', async () => {
        const aclObj = new ACL()
            .addAccess(TAccessRole.User, 'user1', TAccessLevel.Owner)
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Read)
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Write)
            .addAccess(TAccessRole.Agent, 'agent2', TAccessLevel.Read)
            .addAccess(TAccessRole.Team, 'team1', TAccessLevel.Read);

        const sACL = aclObj.serializedACL;

        expect(sACL).toBeTypeOf('string');

        const acl2 = new ACL(sACL).ACL;

        expect(acl2).toEqual(aclObj.ACL);
    });

    it('Check Access Rights Granted', async () => {
        // prettier-ignore
        const acl = new ACL()
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Read)
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Write)
            .addAccess(TAccessRole.Team, 'team1', TAccessLevel.Read)
            .ACL

        const hasAccess = new ACL(acl).checkExactAccess({
            resourceId: 'resource1',
            candidate: {
                role: TAccessRole.Agent,
                id: 'agent1',
            },
            level: TAccessLevel.Write,
        } as IAccessRequest);

        expect(hasAccess).toBeTruthy();
    });
    it('Check Access Rights Refused', async () => {
        // prettier-ignore
        const acl = new ACL()
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Read)
            .addAccess(TAccessRole.Agent, 'agent1', TAccessLevel.Write)
            .addAccess(TAccessRole.Team, 'team1', TAccessLevel.Read)
            .ACL

        const hasAccess = new ACL(acl).checkExactAccess({
            resourceId: 'resource1',
            candidate: {
                role: TAccessRole.Agent,
                id: 'agent2',
            },
            level: TAccessLevel.Write,
        } as IAccessRequest);

        expect(hasAccess).toBeFalsy();
    });
});
