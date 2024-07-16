import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { isBuffer } from '@sre/utils';
import * as FileType from 'file-type';
import mime from 'mime';
import { Readable } from 'stream';
import { StorageConnector } from './StorageConnector';

export type TSmythFSURI = {
    hash: string;
    team: string;
    path: string;
};

export class SmythFS {
    private storage: StorageConnector;

    //singleton
    private static instance: SmythFS;
    public static get Instance() {
        if (!this.instance) {
            this.instance = new SmythFS();
        }
        return this.instance;
    }

    private constructor() {
        //SmythFS cannot be used without SRE
        if (!ConnectorService.ready) {
            throw new Error('SRE not available');
        }
        this.storage = ConnectorService.getStorageConnector();
    }

    private URIParser(uri: string) {
        const parts = uri.split('://');
        if (parts.length !== 2) return undefined;
        if (parts[0].toLowerCase() !== 'smythfs') return undefined;
        const parsed = new URL(`http://${parts[1]}`);
        const tld = parsed.hostname.split('.').pop();
        if (tld !== 'team') throw new Error('Invalid Resource URI');
        const team = parsed.hostname.replace(`.${tld}`, '');
        //TODO: check if team exists

        return {
            hash: parsed.hash,
            team,
            path: parsed.pathname,
        };
    }
    public getStoragePath(uri: string) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        return `teams/${smythURI.team}${smythURI.path}`;
    }
    public async read(uri: string, candidate: IAccessCandidate): Promise<Buffer> {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        const data = await this.storage.user(_candidate).read(resourceId);

        return this.toBuffer(data);
    }

    private async toBuffer(data: StorageData): Promise<Buffer> {
        if (Buffer.isBuffer(data)) {
            return data;
        } else if (typeof data === 'string') {
            return Buffer.from(data, 'utf-8');
        } else if (data instanceof Uint8Array) {
            return Buffer.from(data);
        } else if (data instanceof Readable) {
            return new Promise<Buffer>((resolve, reject) => {
                const chunks: Buffer[] = [];
                data.on('data', (chunk) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });
                data.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
                data.on('error', (err) => {
                    reject(err);
                });
            });
        } else {
            throw new Error('Unsupported data type');
        }
    }

    public async write(uri: string, data: any, candidate: IAccessCandidate, metadata?: StorageMetadata) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;
        //when we write a file, it does not exist we need to explicitly provide a resource team in order to have access rights set properly

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        const acl = new ACL()
            //.addAccess(candidate.role, candidate.id, TAccessLevel.Owner) // creator is owner
            .addAccess(TAccessRole.Team, smythURI.team, TAccessLevel.Read).ACL; // team has read access

        if (!metadata) metadata = {};
        if (!metadata?.ContentType) {
            metadata.ContentType = await this.getMimeType(data);
            if (!metadata.ContentType) {
                const ext: any = uri.split('.').pop();
                if (ext) {
                    metadata.ContentType = mime.getType(ext) || 'application/octet-stream';
                }
            }
        }
        await this.storage.user(_candidate).write(resourceId, data, acl, metadata);
    }
    private async getMimeType(data: any) {
        let size = 0;
        if (data instanceof Blob) return data.type;
        if (isBuffer(data)) {
            try {
                const fileType = await FileType.fileTypeFromBuffer(data);
                return fileType.mime;
            } catch {
                return '';
            }
        }

        if (typeof data === 'string') {
            return 'text/plain';
        }
    }

    public async delete(uri: string, candidate: IAccessCandidate) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        await this.storage.user(_candidate).delete(resourceId);
    }

    //TODO: should we require access token here ?
    public async exists(uri: string, candidate: IAccessCandidate) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        //in order to get a consistent access check in case of inexisting resource, we need to explicitly set a default resource team
        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        return await this.storage.user(_candidate).exists(resourceId);
    }
}
