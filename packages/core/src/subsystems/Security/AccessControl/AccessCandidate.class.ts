import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { AccessRequest } from './AccessRequest.class';

export class AccessCandidate implements IAccessCandidate {
    public role: TAccessRole;
    public id: string;
    //public _candidate: TAccessCandidate;
    constructor(candidate?: IAccessCandidate) {
        //this._candidate = candidate || { role: TAccessRole.Public, id: '' };

        this.role = candidate ? candidate.role : TAccessRole.Public;
        this.id = candidate ? candidate.id : '';
    }

    public toString(): string {
        return `AC:R[${this.role}]:ID[${this.id}]`;
    }

    public get request(): AccessRequest {
        return new AccessRequest(this);
    }

    public get readRequest(): AccessRequest {
        return new AccessRequest(this).setLevel(TAccessLevel.Read);
    }
    public get writeRequest(): AccessRequest {
        return new AccessRequest(this).setLevel(TAccessLevel.Write);
    }
    public get ownerRequest(): AccessRequest {
        return new AccessRequest(this).setLevel(TAccessLevel.Owner);
    }

    public static clone(candidate: IAccessCandidate): AccessCandidate {
        return new AccessCandidate(candidate);
    }

    public team(teamId: string): AccessCandidate {
        this.role = TAccessRole.Team;
        this.id = teamId;

        return this;
    }
    static team(teamId: string): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.Team, id: teamId });
    }

    public agent(agentId: string): AccessCandidate {
        this.role = TAccessRole.Agent;
        this.id = agentId;
        return this;
    }
    static agent(agentId: string): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.Agent, id: agentId });
    }

    public user(userId: string): AccessCandidate {
        this.role = TAccessRole.User;
        this.id = userId;
        return this;
    }
    static user(userId: string): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.User, id: userId });
    }

    public public(): AccessCandidate {
        this.role = TAccessRole.Public;

        //public is a special case we use the role as the owner id because public access does not have specific candidate IDs
        this.id = TAccessRole.Public;

        return this;
    }
    static public(): AccessCandidate {
        return new AccessCandidate({ role: TAccessRole.Public, id: '' });
    }
}
