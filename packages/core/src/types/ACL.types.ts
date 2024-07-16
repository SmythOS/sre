//==[ SRE: ACL Types ]======================

export enum TAccessLevel {
    None = 'none',
    Owner = 'owner',
    Read = 'read',
    Write = 'write',
}

export enum TAccessRole {
    Agent = 'agent',
    User = 'user',
    Team = 'team',
    Public = 'public',
}

// role and level mappings are used for ACL serialization / deserialization
export const RoleMap = {
    user: 'u',
    agent: 'a',
    team: 't',
    public: 'p',
};

export const LevelMap = {
    none: 'n',
    owner: 'o',
    read: 'r',
    write: 'w',
};

// Reverse mappings
export const ReverseRoleMap = Object.fromEntries(Object.entries(RoleMap).map(([k, v]) => [v, k]));
export const ReverseLevelMap = Object.fromEntries(Object.entries(LevelMap).map(([k, v]) => [v, k]));

/**
 * an ACLEntry is a list of access levels for a given owner.
 * an owner can be an agent, a user, a team or the public.
 */
export type TACLEntry = {
    [hashedOwnerKey: string]: TAccessLevel[] | undefined;
};
/**
 * The Access Control List (ACL) is a list of access rights for a given resource.
 * Each entry in this ACL represents a role
 * Role entries define a list of owners of the resource and the access levels they have.
 * e.g.
 *  The following ACL defines that agentA and teamA has read and write access, while agentB and teamC has read access.
 *   {
 *      agent: {
 *         'agentA': ['read', 'write'],
 *         'agentB': ['read'],
 *     },
 *    team: {
 *       'teamA': ['read', 'write'],
 *       'teamC': ['read'],
 *     }
 * }
 */
// prettier-ignore
export interface IACL {    
    hashAlgorithm?: string | undefined;
    entries?: {
        [key in TAccessRole]?: TACLEntry | undefined;
    };
    migrated?: boolean | undefined;
}

// export type TACLMetadata = {
//     acl?: TACL | undefined;
// };

export interface IAccessCandidate {
    role: TAccessRole;
    id: string;
}

export interface IAccessRequest {
    id: string;
    resourceId: string;
    candidate: IAccessCandidate;
    level: TAccessLevel | TAccessLevel[];
}

export enum TAccessResult {
    Granted = 'granted',
    Denied = 'denied',
}

export type TAccessTicket = {
    request: IAccessRequest;
    access: TAccessResult;
};

//custom errors

//access denied error
export class ACLAccessDeniedError extends Error {
    constructor(message?: string) {
        super(message);
        this.name = 'ACLAccessDeniedError';
    }
}
