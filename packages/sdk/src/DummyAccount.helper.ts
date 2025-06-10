import { DummyAccount, ConnectorService } from '@smythos/sre';

/*
    This class is a helper class for the DummyAccount connector.
    It is used to add agents and users to the DummyAccount connector.
*/
export class DummyAccountHelper {
    public static addAgentToTeam(agentId: string, teamId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        if (!(accountConnector instanceof DummyAccount)) return;

        //
        if (!accountConnector.data[teamId]) {
            accountConnector.data[teamId] = {
                users: {},
                agents: {},
                settings: {},
            };
        }

        if (!accountConnector.data[teamId].agents[agentId]) {
            accountConnector.data[teamId].agents[agentId] = { settings: {} };
        }

        return accountConnector.data[teamId].agents[agentId];
    }

    public static addUserToTeam(userId: string, teamId: string) {
        const accountConnector = ConnectorService.getAccountConnector();
        if (!(accountConnector instanceof DummyAccount)) return;

        if (!accountConnector.data[teamId]) {
            accountConnector.data[teamId] = {
                users: {},
                agents: {},
                settings: {},
            };
        }

        if (!accountConnector.data[teamId].users[userId]) {
            accountConnector.data[teamId].users[userId] = { settings: {} };
        }

        return accountConnector.data[teamId].users[userId];
    }
}
