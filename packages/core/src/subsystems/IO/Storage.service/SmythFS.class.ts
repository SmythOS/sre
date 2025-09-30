import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { DEFAULT_TEAM_ID, IAccessCandidate, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { getMimeType } from '@sre/utils';
import mime from 'mime';
import { Readable } from 'stream';
import { StorageConnector } from './StorageConnector';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import crypto from 'crypto';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { SystemEvents } from '@sre/Core/SystemEvents';

export type TSmythFSURI = {
    hash: string;
    team: string;
    path: string;
};

// SystemEvents.on('SRE:Booted', () => {
//     const router = ConnectorService.getRouterConnector();
//     if (router && router?.get instanceof Function) {
//         router.get('/_temp/:uid', SmythFS.Instance.serveTempContent.bind(SmythFS.Instance));
//         router.get('/storage/:file_id', SmythFS.Instance.serveResource.bind(SmythFS.Instance));
//     }
// });

export class SmythFS {
    private hash: string; // Store the instance hash for URL generation

    static instances: any = {};

    // Centralized hash generation to ensure consistency
    private static generateInstanceHash(storageName: string, cacheName: string): string {
        const instanceProps = `${storageName}:${cacheName}`;
        return crypto.createHash('sha256').update(instanceProps).digest('hex').substring(0, 6);
    }

    // Default singleton instance (most common use case)
    public static get Instance(): SmythFS {
        return SmythFS.getInstance(); // Uses default empty string providers
    }

    // Multiton pattern - get instance based on storage and cache provider combination
    public static getInstance(storageProvider: string | StorageConnector = '', cacheProvider: string | CacheConnector = ''): SmythFS {
        // First get the actual connector names to calculate the correct hash
        const storage = storageProvider instanceof StorageConnector ? storageProvider : ConnectorService.getStorageConnector(storageProvider);
        const cache = cacheProvider instanceof CacheConnector ? cacheProvider : ConnectorService.getCacheConnector(cacheProvider);
        const hash = SmythFS.generateInstanceHash(storage.name, cache.name);

        if (SmythFS.instances[hash]) {
            return SmythFS.instances[hash];
        }

        const instance = new SmythFS(storage, cache);

        //register routes
        const router = ConnectorService.getRouterConnector();
        if (router && router?.get instanceof Function) {
            router.get(`/_temp/${hash}/:uid`, instance.serveTempContent.bind(instance));
            router.get(`/storage/${hash}/:file_id`, instance.serveResource.bind(instance));
        }

        SmythFS.instances[hash] = instance;
        return instance;
    }

    private constructor(private storage: StorageConnector, private cache: CacheConnector) {
        //SmythFS cannot be used without SRE
        // if (!ConnectorService.ready) {
        //     throw new Error('SRE not available');
        // }

        // Use centralized hash generation method
        this.hash = SmythFS.generateInstanceHash(this.storage.name, this.cache.name);
    }

    // public getStoragePath(uri: string) {
    //     const smythURI = this.URIParser(uri);
    //     if (!smythURI) throw new Error('Invalid Resource URI');
    //     return `teams/${smythURI.team}${smythURI.path}`;
    // }

    public getBaseUri(candidate: IAccessCandidate) {
        const uri = `smythfs://${candidate.id}.${candidate.role}`;

        return uri;
    }

    /**
     * Reads a resource from smyth file system
     * @param uri smythfs:// uri
     * @param candidate
     * @returns
     */
    public async read(uri: string, candidate?: IAccessCandidate): Promise<Buffer> {
        const smythURI = await this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        candidate = candidate || smythURI.defaultCandidate; //fallback to default candidate if not provided

        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        const data = await this.storage.requester(_candidate).read(resourceId);

        return data ? this.toBuffer(data) : null;
    }

    public async getMetadata(uri: string, candidate?: IAccessCandidate) {
        const smythURI = await this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        candidate = candidate || smythURI.defaultCandidate; //fallback to default candidate if not provided

        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        return await this.storage.requester(_candidate).getMetadata(resourceId);
    }

    public async write(uri: string, data: StorageData, candidate?: IAccessCandidate, metadata?: StorageMetadata, ttl?: number) {
        const smythURI = await this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        candidate = candidate || smythURI.defaultCandidate; //fallback to default candidate if not provided

        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;
        //when we write a file, it does not exist we need to explicitly provide a resource team in order to have access rights set properly

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        let acl: ACL;

        //give team read access if this is a team resource and not the default team
        //because the default team is a fallback used when no team is specified or account connector is not available
        //in that case we need to only allow the creator to access the resource
        if (smythURI.team && smythURI.team !== DEFAULT_TEAM_ID) {
            acl = new ACL()
                //.addAccess(candidate.role, candidate.id, TAccessLevel.Owner) // creator is owner
                .addAccess(TAccessRole.Team, smythURI.team, TAccessLevel.Read).ACL as ACL; // team has read access
        }

        if (!metadata) metadata = {};
        if (!metadata?.ContentType) {
            metadata.ContentType = await getMimeType(data);
            if (!metadata.ContentType) {
                const ext: any = uri.split('.').pop();
                if (ext) {
                    metadata.ContentType = mime.getType(ext) || 'application/octet-stream';
                }
            }
        }
        await this.storage.requester(_candidate).write(resourceId, data, acl, metadata);

        if (ttl) {
            await this.storage.requester(_candidate).expire(resourceId, ttl);
        }
    }

    public async delete(uri: string, candidate?: IAccessCandidate) {
        const smythURI = await this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        candidate = candidate || smythURI.defaultCandidate; //fallback to default candidate if not provided

        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        await this.storage.requester(_candidate).delete(resourceId);
    }

    //TODO: should we require access token here ?
    public async exists(uri: string, candidate?: IAccessCandidate) {
        const smythURI = await this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        candidate = candidate || smythURI.defaultCandidate; //fallback to default candidate if not provided

        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;

        //in order to get a consistent access check in case of inexisting resource, we need to explicitly set a default resource team
        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        return await this.storage.requester(_candidate).exists(resourceId);
    }

    //#region Temp URL (mainly used for returning agent output to user for temporary access)
    public async genTempUrl(uri: string, candidate?: IAccessCandidate, ttlSeconds: number = 3600) {
        const smythURI = await this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        candidate = candidate || smythURI.defaultCandidate; //fallback to default candidate if not provided

        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const exists = await this.exists(uri, candidate);
        if (!exists) throw new Error('Resource does not exist');

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;
        const resourceMetadata = await this.storage.requester(_candidate).getMetadata(resourceId);

        const uid = crypto.randomUUID();
        const tempUserCandidate = AccessCandidate.user(`system-${uid}`);

        await this.cache.requester(tempUserCandidate).set(
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
        return `${baseUrl}/_temp/${this.hash}/${uid}`;
    }

    public async destroyTempUrl(url: string, { delResource }: { delResource: boolean } = { delResource: false }) {
        // Parse URL with new format: /_temp/{hash}/{uid}
        const tempPath = url.split('/_temp/')[1];
        if (!tempPath) throw new Error('Invalid Temp URL format');

        const uid = tempPath.split('/')[1]?.split('?')[0]; // get uid and remove query params
        if (!uid) throw new Error('Invalid Temp URL format');

        let cacheVal = await this.cache.requester(AccessCandidate.user(`system-${uid}`)).get(`pub_url:${uid}`);
        if (!cacheVal) throw new Error('Invalid Temp URL');
        cacheVal = JSONContentHelper.create(cacheVal).tryParse();
        await this.cache.requester(AccessCandidate.user(`system-${uid}`)).delete(`pub_url:${uid}`);
        if (delResource) {
            await this.delete(cacheVal.uri, AccessCandidate.clone(cacheVal.accessCandidate));
        }
    }

    public async serveTempContent(req: any, res: any) {
        try {
            const { uid } = req.params;
            let cacheVal = await this.cache.requester(AccessCandidate.user(`system-${uid}`)).get(`pub_url:${uid}`);
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
    //#endregion

    //#region Resource Serving

    /**
     * Generates a public url for the resource
     * @param uri
     * @param candidate
     * @returns
     */
    public async genResourceUrl(uri: string, candidate?: IAccessCandidate) {
        const smythURI = await this.URIParser(uri);
        if (!smythURI) throw new Error('Invalid Resource URI');
        candidate = candidate || smythURI.defaultCandidate; //fallback to default candidate if not provided

        const accountConnector = ConnectorService.getAccountConnector();
        const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
        if (!isMember) throw new Error('Access Denied');

        const exists = await this.exists(uri, candidate);
        if (!exists) throw new Error('Resource does not exist');

        const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);
        if (_candidate.role !== TAccessRole.Agent) {
            throw new Error('Only agents can generate resource urls');
        }
        const agentId = _candidate.id;

        const resourceId = `teams/${smythURI.team}${smythURI.path}`;
        const resourceMetadata = await this.storage.requester(_candidate).getMetadata(resourceId);

        const uid = crypto.randomUUID(); // maybe instead of a random uuid, u can use the resource
        const tempUserCandidate = AccessCandidate.user(`system-${uid}`);

        await this.cache.requester(tempUserCandidate).set(
            `storage_url-${uid}`,
            JSON.stringify({
                accessCandidate: _candidate,
                uri,
                contentType: resourceMetadata?.ContentType,
            }),
            undefined,
            undefined
            // 3600 // 1 hour
        );

        const contentType = resourceMetadata?.ContentType;
        const ext = contentType ? mime.getExtension(contentType) : undefined;

        // get the agent domain
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        const baseUrl = ConnectorService.getRouterConnector().baseUrl;
        const domain = agentDataConnector.getAgentConfig(agentId)?.agentStageDomain
            ? `https://${agentDataConnector.getAgentConfig(agentId).agentStageDomain}`
            : baseUrl;

        return `${domain}/storage/${this.hash}/${uid}${ext ? `.${ext}` : ''}`;
    }
    public async destroyResourceUrl(url: string, { delResource }: { delResource: boolean } = { delResource: false }) {}
    public async serveResource(req: any, res: any) {
        try {
            const { file_id } = req.params;
            const [uid, extention] = file_id.split('.');
            let cacheVal = await this.cache.requester(AccessCandidate.user(`system-${uid}`)).get(`storage_url-${uid}`);
            if (!cacheVal) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Invalid Resource URL');
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
            console.error('Error serving storage resource content:', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    }
    //#endregion

    private async URIParser(uri: string) {
        const parts = uri.split('://');
        if (parts.length !== 2) return undefined;
        if (parts[0].toLowerCase() !== 'smythfs') return undefined;
        const parsed = this.CaseSensitiveURL(`http://${parts[1]}`);
        const tld = parsed.hostname.split('.').pop();
        if (tld !== 'team' && tld !== 'user' && tld !== 'agent' && tld !== 'smyth') throw new Error('Invalid Resource URI');
        let team = tld === 'team' ? parsed.hostname.replace(`.${tld}`, '') : undefined;
        const user = tld === 'user' ? parsed.hostname.replace(`.${tld}`, '') : undefined;
        const agent = tld === 'agent' ? parsed.hostname.replace(`.${tld}`, '') : undefined;
        const smyth = tld === 'smyth' ? parsed.hostname.replace(`.${tld}`, '') : undefined;

        let basePath = '';
        if (!team) {
            let candidate: IAccessCandidate;
            if (user) {
                candidate = AccessCandidate.user(user);
                basePath = '.user/' + user;
            } else if (agent) {
                candidate = AccessCandidate.agent(agent);
                basePath = '.agent/' + agent;
            }

            if (candidate) {
                team = await ConnectorService.getAccountConnector().getCandidateTeam(candidate);
            }
        }

        // create a default candidate based on the uri
        let defaultCandidate: IAccessCandidate;

        if (team) {
            defaultCandidate = AccessCandidate.team(team);
        } else if (user) {
            defaultCandidate = AccessCandidate.user(user);
        } else if (agent) {
            defaultCandidate = AccessCandidate.agent(agent);
        }

        return {
            hash: parsed.hash,
            team,
            user,
            agent,
            smyth,
            defaultCandidate,
            path: basePath + parsed.pathname,
        };
    }

    private CaseSensitiveURL(urlString: string) {
        // First, extract the original hostname for case preservation
        const parts = urlString.split('://');
        if (parts.length !== 2) return null;

        const afterProtocol = parts[1];
        const hostnameEnd = Math.min(
            ...[afterProtocol.indexOf('/'), afterProtocol.indexOf('?'), afterProtocol.indexOf('#'), afterProtocol.length].filter((i) => i >= 0)
        );

        const originalHostnamePart = afterProtocol.substring(0, hostnameEnd);
        const [originalHostname, originalPort] = originalHostnamePart.split(':');

        // Use URL constructor for robust parsing of everything else
        const parsed = new URL(urlString);

        // Explicitly copy URL properties since they're not enumerable
        return {
            protocol: parsed.protocol,
            hostname: originalHostname, // Case-sensitive hostname
            port: parsed.port,
            pathname: parsed.pathname,
            search: parsed.search,
            searchParams: parsed.searchParams,
            hash: parsed.hash,
            href: parsed.href,
            origin: parsed.origin,
            host: originalHostname + (parsed.port ? `:${parsed.port}` : ''),
            originalPort: originalPort || null,
        };
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
}
