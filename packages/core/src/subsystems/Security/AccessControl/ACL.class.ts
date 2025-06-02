//import { xxh3 } from '@node-rs/xxhash';
import xxhash from 'xxhashjs';
import { IACL, IAccessRequest, LevelMap, ReverseLevelMap, ReverseRoleMap, RoleMap, TACLEntry, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

const ACLHashAlgo = {
    none: (source) => source,
    //xxh3: (source) => xxh3.xxh64(source.toString()).toString(16),
    xxh3: (source) => {
        const h64 = xxhash.h64(); // Use xxhashjs's h64 function
        return source ? h64.update(source.toString()).digest().toString(16) : null;
    },
};

export class ACL implements IACL {
    public hashAlgorithm?: string | undefined;
    public entries?: {
        [key in TAccessRole]?: TACLEntry | undefined;
    };
    public migrated?: boolean | undefined;
    //private acl: TACL;
    public get ACL(): IACL {
        return {
            hashAlgorithm: this.hashAlgorithm,
            entries: JSON.parse(JSON.stringify(this.entries)),
            migrated: this.migrated,
        };
    }
    public get serializedACL(): string {
        return this.serializeACL(this);
    }

    constructor(acl?: IACL | string) {
        if (typeof acl === 'string') {
            this.deserializeACL(acl);
        } else {
            this.hashAlgorithm = acl?.hashAlgorithm;
            this.entries = acl?.entries ? JSON.parse(JSON.stringify(acl?.entries)) : {};
            this.migrated = acl?.migrated;
        }
        if (!this.hashAlgorithm) this.hashAlgorithm = 'xxh3';
        if (!this.entries) this.entries = {};
    }

    static from(acl?: IACL | string): ACL {
        return new ACL(acl);
    }

    /**
     * This function checks if the candidate has access to the requested level
     * it only checks the exact access level, not the higher levels
     * Examples :
     * - if the candidate has read access, it will return true only if the requested level is read
     * - if the current ACL has team access but the candidate is an agent, it will not match the team access
     * @param acRequest
     * @returns
     */
    public checkExactAccess(acRequest: IAccessRequest): boolean {
        if (!this?.entries) return false; // cannot determine the access rights, prefer to deny access

        const role = this?.entries[acRequest.candidate.role];
        if (!role) return false;
        let entryId = acRequest.candidate.id;

        if (!ACLHashAlgo[this.hashAlgorithm]) {
            throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
        }

        entryId = ACLHashAlgo[this.hashAlgorithm](entryId);

        const access = role[entryId];
        if (!access) return false;

        const levels = Array.isArray(acRequest.level) ? acRequest.level : [acRequest.level];

        return levels.every((level) => access.includes(level));
        //return access.includes(req.level);
    }

    public addPublicAccess(level: TAccessLevel | TAccessLevel[]): ACL {
        if (!this?.entries[TAccessRole.Public]) this.entries[TAccessRole.Public] = {};
        if (!ACLHashAlgo[this.hashAlgorithm]) {
            throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
        }
        const ownerId = TAccessRole.Public; //public is a special case we use the role as the owner id because public access does not have specific candidate IDs
        const hashedOwner = ACLHashAlgo[this.hashAlgorithm](ownerId);

        if (!this?.entries[TAccessRole.Public]![hashedOwner]) this.entries[TAccessRole.Public]![hashedOwner] = [];
        //acl[TAccessRole.Public]![hashedOwner]!.push(level);
        //concatenate the levels
        const curLevel: any = this.entries[TAccessRole.Public]![hashedOwner]!;
        this.entries[TAccessRole.Public]![hashedOwner] = [...curLevel, ...level];

        return this;
    }
    public removePublicAccess(level: TAccessLevel | TAccessLevel[]): ACL {
        if (!this?.entries[TAccessRole.Public]) return this;
        const ownerId = TAccessRole.Public; //public is a special case we use the role as the owner id because public access does not have specific candidate IDs
        const hashedOwner = ACLHashAlgo[this.hashAlgorithm](ownerId);

        //remove the levels
        const curLevel = this[TAccessRole.Public]![hashedOwner]!;
        this[TAccessRole.Public]![hashedOwner] = curLevel.filter((l) => !level.includes(l));

        return this;
    }
    public addAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACL {
        if (role === TAccessRole.Public) {
            throw new Error('Adding public access using addAccess method is not allowed. Use addPublicAccess method instead.');
        }
        const _level = Array.isArray(level) ? level : [level];
        if (!this?.entries[role]) this.entries[role] = {};
        if (!ACLHashAlgo[this.hashAlgorithm]) {
            throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
        }
        const hashedOwner = ACLHashAlgo[this.hashAlgorithm](ownerId);

        if (!hashedOwner) {
            throw new Error(`Invalid ownerId: ${role}:${ownerId}`);
        }

        if (!this?.entries[role]![hashedOwner]) this.entries[role]![hashedOwner] = [];
        //acl[role]![ownerId]!.push(level);
        //concatenate the levels
        const curLevel = this.entries[role]![hashedOwner]!;
        this.entries[role]![hashedOwner] = [...curLevel, ..._level];

        return this;
    }
    public static addAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACL {
        return ACL.from().addAccess(role, ownerId, level);
    }

    public removeAccess(role: TAccessRole, ownerId: string, level: TAccessLevel | TAccessLevel[]): ACL {
        const _level = Array.isArray(level) ? level : [level];
        if (!this[role]) return this;
        if (!this[role]![ownerId]) return this;
        //acl[role]![ownerId] = acl[role]![ownerId]!.filter((l) => l !== level);
        //remove the levels
        const curLevel = this[role]![ownerId]!;
        this[role]![ownerId] = curLevel.filter((l) => !_level.includes(l));

        return this;
    }

    private serializeACL(tacl: IACL): string {
        let compressed = '';

        if (tacl.hashAlgorithm) {
            compressed += `h:${tacl.hashAlgorithm}|`;
        }

        if (tacl.entries) {
            for (const [role, entries] of Object.entries(tacl.entries)) {
                const roleShort = RoleMap[role]; // Use the mapping for role
                const entriesArray: any[] = [];

                for (const [hashedOwnerKey, accessLevels] of Object.entries(entries || {})) {
                    if (accessLevels) {
                        const accessLevelsShort = accessLevels.map((level) => LevelMap[level]).join('');
                        entriesArray.push(`${hashedOwnerKey}/${accessLevelsShort}`);
                    }
                }

                if (entriesArray.length > 0) {
                    compressed += `${roleShort}:${entriesArray.join(',')}|`;
                }
            }
        }

        // Remove the trailing '|'
        if (compressed.endsWith('|')) {
            compressed = compressed.slice(0, -1);
        }

        return compressed;
    }

    private deserializeACL(compressed: string) {
        const parts = compressed.split('|');
        this.hashAlgorithm = '';
        this.entries = {};

        for (const part of parts) {
            if (part.startsWith('h:')) {
                this.hashAlgorithm = part.substring(2);
            } else {
                const [roleShort, entries] = part.split(':');
                const role = ReverseRoleMap[roleShort]; // Use the reverse mapping for role

                if (role) {
                    const entriesObj = {};
                    const entriesArray = entries.split(',');

                    for (const entry of entriesArray) {
                        const [hashedOwnerKey, accessLevelsShort] = entry.split('/');
                        const accessLevels = accessLevelsShort.split('').map((short) => ReverseLevelMap[short]);

                        entriesObj[hashedOwnerKey] = accessLevels;
                    }

                    this.entries[role] = entriesObj;
                }
            }
        }

        //return tacl;
    }
}
