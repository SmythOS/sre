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
import SmythRuntime from '@sre/Core/SmythRuntime.class';
import { CacheConnector } from '@sre/MemoryManager/Cache.service';
import crypto from 'crypto';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import SystemEvents from '@sre/Core/SystemEvents';
import { RouterConnector } from '../Router.service/RouterConnector';
export type TSmythFSURI = {
    hash: string;
    team: string;
    path: string;
};

SystemEvents.on('SRE:Booted', () => {
    const router = ConnectorService.getRouterConnector();
    if (router && router?.get instanceof Function) {
        router.get('/_temp/:uid', SmythFS.Instance.serveTempContent.bind(SmythFS.Instance));
    }
});

export class SmythFS {
    private storage: StorageConnector;
    private cache: CacheConnector;

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
        this.cache = ConnectorService.getCacheConnector();
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

    public async genTempUrl(uri: string, candidate: IAccessCandidate, ttlSeconds: number = 3600) {
        const smythURI = this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');

        const exists = await this.exists(uri, candidate);
        if (!exists) throw new Error('Resource does not exist');

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;
        const resourceMetadata = await this.storage.user(_candidate).getMetadata(resourceId);

        const uid = crypto.randomUUID();
        const tempUserCandidate = AccessCandidate.user(`system:${uid}`);

        await this.cache.user(tempUserCandidate).set(
            `pub_url:${uid}`,
            JSON.stringify({
                accessCandidate: _candidate,
                uri,
                contentType: resourceMetadata?.ContentType,
            }),
            undefined,
            undefined,
            ttlSeconds
        ); // 1 hour

        const baseUrl = ConnectorService.getRouterConnector().baseUrl;
        return `${baseUrl}/_temp/${uid}`;
    }

    public async destroyTempUrl(url: string, { delResource }: { delResource: boolean } = { delResource: false }) {
        const uid = url.split('/_temp/')[1].split('?')[0]; // remove any query params
        let cacheVal = await this.cache.user(AccessCandidate.user(`system:${uid}`)).get(`pub_url:${uid}`);
        if (!cacheVal) throw new Error('Invalid Temp URL');
        cacheVal = JSONContentHelper.create(cacheVal).tryParse();
        await this.cache.user(AccessCandidate.user(`system:${uid}`)).delete(`pub_url:${uid}`);
        if (delResource) {
            await this.delete(cacheVal.uri, AccessCandidate.clone(cacheVal.accessCandidate));
        }
    }

    public async serveTempContent(req: any, res: any) {
        try {
            const { uid } = req.params;
            let cacheVal = await this.cache.user(AccessCandidate.user(`system:${uid}`)).get(`pub_url:${uid}`);
            if (!cacheVal) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Invalid Temp URL');
                return;
            }
            cacheVal = JSONContentHelper.create(cacheVal).tryParse();
            const content = await this.read(cacheVal.uri, AccessCandidate.clone(cacheVal.accessCandidate));

            const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'binary');

            const contentType = cacheVal.contentType || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Disposition': 'inline',
                'Content-Length': contentBuffer.length,
            });

            res.end(contentBuffer);
        } catch (error) {
            console.error('Error serving temp content:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
}
