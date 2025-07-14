import { describe, it, expect, beforeAll } from 'vitest';
import { newDb } from 'pg-mem';
import { NeonAccount } from '@sre/Security/Account.service/connectors/NeonAccount.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TAccessRole, TAccessLevel } from '@sre/types/ACL.types';

let account: NeonAccount;
let candidate: AccessCandidate;

beforeAll(async () => {
    const db = newDb();
    const adapter = db.adapters.createPg();

    await db.public.none(`CREATE TABLE TeamSettings (key text, value text);`);
    await db.public.none(`CREATE TABLE UserSettings (account_id text, key text, value text);`);
    await db.public.none(`CREATE TABLE AgentSettings (agent_id text, key text, value text);`);
    await db.public.none(`CREATE TABLE ResourceACL (resource_id text, acl text);`);

    await db.public.none(`INSERT INTO UserSettings VALUES ('user1', 'setting1', 'uvalue1');`);
    await db.public.none(`INSERT INTO AgentSettings VALUES ('agent1', 'setting1', 'avalue1');`);

    const aclText = new ACL().addAccess(TAccessRole.User, 'user1', TAccessLevel.Read).serializedACL;
    await db.public.none(
        'INSERT INTO ResourceACL (resource_id, acl) VALUES ($1, $2)',
        ['res1', aclText],
    );

    account = new NeonAccount({ host: 'localhost' });
    (account as any).pool = new adapter.Pool();

    candidate = new AccessCandidate({ role: TAccessRole.User, id: 'user1' });
});

describe('NeonAccount integration', () => {
    it('retrieves all user settings', async () => {
        const result = await account.getAllUserSettings(candidate.readRequest, 'user1');
        expect(result).toEqual([{ key: 'setting1', value: 'uvalue1' }]);
    });

    it('retrieves a single user setting', async () => {
        const value = await account.getUserSetting(candidate.readRequest, 'user1', 'setting1');
        expect(value).toBe('uvalue1');
    });

    it('retrieves agent setting', async () => {
        const value = await account.getAgentSetting(candidate.readRequest, 'agent1', 'setting1');
        expect(value).toBe('avalue1');
    });

    it('retrieves resource ACL', async () => {
        const acl = await account.getResourceACL('res1', candidate);
        expect(acl.ACL.entries?.[TAccessRole.User]).toBeTruthy();
    });

    it('returns default ACL when resource not found', async () => {
        const acl = await account.getResourceACL('missing', candidate);
        const hasOwner = acl.checkExactAccess({ id: '', resourceId: '', candidate, level: TAccessLevel.Owner });
        expect(hasOwner).toBe(true);
    });
});
