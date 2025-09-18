//==[ SRE: WeaviateVectorDB ]======================
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { VectorDBConnector, DeleteTarget } from '../VectorDBConnector';
import {
    DatasourceDto,
    IStorageVectorDataSource,
    IStorageVectorNamespace,
    IVectorDataSourceDto,
    QueryOptions,
    VectorsResultData,
} from '@sre/types/VectorDB.types';
import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { Logger } from '@sre/helpers/Log.helper';
import { NKVConnector } from '@sre/IO/NKV.service/NKVConnector';
import { AccountConnector } from '@sre/Security/Account.service/AccountConnector';
import { JSONContentHelper } from '@sre/helpers/JsonContent.helper';
import { CacheConnector } from '@sre/MemoryManager/Cache.service/CacheConnector';
import crypto from 'crypto';
import { BaseEmbedding, TEmbeddings } from '../embed/BaseEmbedding';
import { EmbeddingsFactory, SupportedProviders, SupportedModels } from '../embed';
import { chunkText } from '@sre/utils/string.utils';
import { jsonrepair } from 'jsonrepair';

const logger = Logger('Weaviate VectorDB');

export type WeaviateConfig = {
    /**
     * The Weaviate instance URL
     */
    url: string;
    /**
     * The Weaviate API key (optional for open source)
     */
    apiKey?: string;
    /**
     * The class name to use for storing vectors
     */
    className?: string;
    /**
     * The embeddings model to use
     */
    embeddings: TEmbeddings;
    /**
     * Additional Weaviate client options
     */
    clientOptions?: {
        timeout?: number;
        headers?: Record<string, string>;
    };
};

export class WeaviateVectorDB extends VectorDBConnector {
    public name = 'WeaviateVectorDB';
    public id = 'weaviate';
    private client: WeaviateClient;
    private className: string;
    private cache: CacheConnector;
    private accountConnector: AccountConnector;
    private nkvConnector: NKVConnector;
    public embedder: any;

    constructor(protected _settings: WeaviateConfig) {
        super(_settings);
        
        if (!_settings.url) {
            logger.warn('Missing Weaviate URL: returning empty Weaviate connector');
            // Initialize with default values to prevent errors
            this.client = null as any;
            this.className = 'SmythVector';
            this.accountConnector = ConnectorService.getAccountConnector();
            this.cache = ConnectorService.getCacheConnector();
            this.nkvConnector = ConnectorService.getNKVConnector();
            this.embedder = null as any;
            return;
        }

        // Initialize Weaviate client
        const clientConfig: any = {
            scheme: _settings.url.startsWith('https') ? 'https' : 'http',
            host: _settings.url.replace(/^https?:\/\//, ''),
        };

        if (_settings.apiKey) {
            clientConfig.apiKey = new ApiKey(_settings.apiKey);
        }

        if (_settings.clientOptions) {
            Object.assign(clientConfig, _settings.clientOptions);
        }

        this.client = weaviate.client(clientConfig);
        this.className = _settings.className || 'SmythVector';
        
        logger.info('Weaviate client initialized');
        logger.info('Weaviate URL:', _settings.url);
        logger.info('Weaviate class name:', this.className);

        this.accountConnector = ConnectorService.getAccountConnector();
        this.cache = ConnectorService.getCacheConnector();
        this.nkvConnector = ConnectorService.getNKVConnector();

        if (!_settings.embeddings.params) _settings.embeddings.params = { dimensions: 1536 };
        if (!_settings.embeddings.params?.dimensions) _settings.embeddings.params.dimensions = 1536;

        this.embedder = EmbeddingsFactory.create(_settings.embeddings.provider, _settings.embeddings);
    }

    /**
     * @async
     * @method getResourceACL
     * @description Gets the ACL for a specific resource in Weaviate
     * @param {string} resourceId - The resource identifier
     * @param {IAccessCandidate} candidate - The access candidate
     * @returns {Promise<ACL>} The ACL for the resource
     * @throws {Error} If there's an error retrieving the ACL
     */
    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        logger.info(`WeaviateVectorDB :: ${candidate.id} :: func.getResourceACL :: InProgress`);
        try {
            const preparedNs = this.constructNsName(candidate as AccessCandidate, resourceId);
            const acl = await this.getACL(AccessCandidate.clone(candidate), preparedNs);
            const exists = !!acl;

            if (!exists) {
                // The resource does not exist yet, grant write access to the candidate
                logger.info(`WeaviateVectorDB :: ${candidate.id} :: func.getResourceACL :: Success :: Resource does not exist, granting owner access`);
                return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
            }
            
            logger.info(`WeaviateVectorDB :: ${candidate.id} :: func.getResourceACL :: Success`);
            return ACL.from(acl);
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${candidate.id} :: func.getResourceACL :: Error ::`, err);
            throw new Error(`Failed to get resource ACL for ${resourceId}: ${err.message}`);
        }
    }
    /**
     * @async
     * @method getACL
     * @description Gets the ACL for a specific namespace in Weaviate
     * @param {AccessCandidate} candidate - The access candidate
     * @param {string} preparedNs - The prepared namespace name
     * @returns {Promise<IACL | null>} The ACL for the namespace or null if not found
     * @throws {Error} If there's an error retrieving the ACL
     */
    private async getACL(candidate: AccessCandidate, preparedNs: string): Promise<IACL | null> {
        try {
            // Try to get ACL from cache first
            const cacheKey = `acl:${preparedNs}:${candidate.id}`;
            const cachedACL = await this.cache.requester(candidate).get(cacheKey);
            if (cachedACL) {
                return cachedACL as IACL;
            }

            // If not in cache, check if namespace exists and create default ACL
            const schema = await this.client.schema.getter().do();
            const classExists = schema.classes?.some((cls: any) => cls.class === preparedNs) || false;
            
            if (!classExists) {
                return null; // Namespace doesn't exist
            }

            // Create default ACL for the namespace
            const defaultACL = new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
            
            // Cache the ACL
            await this.cache.requester(candidate).set(cacheKey, defaultACL.serializedACL);
            
            return defaultACL.ACL;
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${candidate.id} :: func.getACL :: Error ::`, err);
            throw new Error(`Failed to get ACL for namespace ${preparedNs}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method createNamespace
     * @description Creates a namespace in Weaviate by creating a class
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace name
     * @param {object} metadata - Optional metadata
     * @returns {Promise<void>}
     * @throws {Error} If there's an error creating the namespace
     */
    @SecureConnector.AccessControl
    protected async createNamespace(acRequest: AccessRequest, namespace: string, metadata?: { [key: string]: any }): Promise<void> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.createNamespace :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
            
            // Check if class already exists
            const classExists = await this.namespaceExists(acRequest, namespace);
            if (classExists) {
                logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.createNamespace :: Success :: Namespace already exists`);
                return;
            }

            // Create the class schema
            const classSchema = {
                class: preparedNs,
                description: `SmythOS vector storage for namespace: ${namespace}`,
                vectorizer: 'none', // We'll provide our own vectors
                properties: [
                    {
                        name: 'content',
                        dataType: ['text'],
                        description: 'The text content of the vector',
                    },
                    {
                        name: 'metadata',
                        dataType: ['object'],
                        description: 'Additional metadata for the vector',
                    },
                    {
                        name: 'smyth_acl',
                        dataType: ['text'],
                        description: 'SmythOS ACL information',
                    },
                    {
                        name: 'smyth_created_at',
                        dataType: ['date'],
                        description: 'Creation timestamp',
                    },
                ],
            };

            await this.client.schema.classCreator().withClass(classSchema).do();
            
            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.createNamespace :: Success :: Created namespace ${preparedNs}`);
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.createNamespace :: Error ::`, err);
            throw new Error(`Failed to create namespace ${namespace}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method deleteNamespace
     * @description Deletes a namespace by removing the class
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace name
     * @returns {Promise<void>}
     * @throws {Error} If there's an error deleting the namespace
     */
    @SecureConnector.AccessControl
    protected async deleteNamespace(acRequest: AccessRequest, namespace: string): Promise<void> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.deleteNamespace :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
            
            await this.client.schema.classDeleter().withClassName(preparedNs).do();
            
            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.deleteNamespace :: Success :: Deleted namespace ${preparedNs}`);
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.deleteNamespace :: Error ::`, err);
            throw new Error(`Failed to delete namespace ${namespace}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method namespaceExists
     * @description Checks if a namespace exists in Weaviate
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace name
     * @returns {Promise<boolean>} True if namespace exists
     * @throws {Error} If there's an error checking namespace existence
     */
    @SecureConnector.AccessControl
    protected async namespaceExists(acRequest: AccessRequest, namespace: string): Promise<boolean> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.namespaceExists :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
            
            const schema = await this.client.schema.getter().do();
            const classExists = schema.classes?.some((cls: any) => cls.class.toLowerCase() === preparedNs.toLowerCase()) || false;
            
            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.namespaceExists :: Success :: Namespace exists: ${classExists}`);
            return classExists;
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.namespaceExists :: Error ::`, err);
            throw new Error(`Failed to check namespace existence ${namespace}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method search
     * @description Performs vector search in Weaviate
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace to search in
     * @param {string | number[]} query - The search query (text or vector)
     * @param {QueryOptions} options - Search options
     * @returns {Promise<VectorsResultData>} Search results
     * @throws {Error} If there's an error performing the search
     */
    @SecureConnector.AccessControl
    protected async search(
        acRequest: AccessRequest,
        namespace: string,
        query: string | number[],
        options: QueryOptions
    ): Promise<VectorsResultData> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.search :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
            
            // Ensure namespace exists
            const nsExists = await this.namespaceExists(acRequest, namespace);
            if (!nsExists) {
                logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.search :: Success :: Namespace does not exist, returning empty results`);
                return [];
            }

            let searchVector: number[];
            
            if (typeof query === 'string') {
                // Generate embedding for text query
                const embedding = await this.embedder.embedText(query, acRequest.candidate as AccessCandidate);
                searchVector = embedding;
            } else {
                searchVector = query;
            }

            const topK = options.topK || 10;
            const whereClause = options.filter ? this.buildWhereClause(options.filter) : undefined;

            const searchResult = await this.client.graphql
                .get()
                .withClassName(preparedNs)
                .withFields('content metadata smyth_acl smyth_created_at _additional { id distance }')
                .withNearVector({
                    vector: searchVector,
                    distance: options.threshold || 0.8,
                })
                .withLimit(topK)
                .withWhere(whereClause)
                .do();

            const matches = searchResult.data?.Get?.[preparedNs]?.map((result: any) => ({
                id: result._additional.id,
                score: 1 - (result._additional.distance || 0), // Convert distance to similarity score
                values: [], // Weaviate doesn't return vectors in search results by default
                text: result.content || '',
                metadata: {
                    content: result.content,
                    ...result.metadata,
                },
            })) || [];

            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.search :: Success :: Found ${matches.length} matches`);
            return matches;
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.search :: Error ::`, err);
            throw new Error(`Failed to search in namespace ${namespace}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method insert
     * @description Inserts vectors into Weaviate
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace to insert into
     * @param {IVectorDataSourceDto | IVectorDataSourceDto[]} source - The data to insert
     * @returns {Promise<string[]>} Array of inserted IDs
     * @throws {Error} If there's an error inserting data
     */
    @SecureConnector.AccessControl
    protected async insert(
        acRequest: AccessRequest,
        namespace: string,
        source: IVectorDataSourceDto | IVectorDataSourceDto[]
    ): Promise<string[]> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.insert :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);
            
            // Ensure namespace exists
            await this.createNamespace(acRequest, namespace);

            const sources = Array.isArray(source) ? source : [source];
            const insertedIds: string[] = [];

            for (const dataSource of sources) {
                let vector: any;
                
                if (dataSource.vector) {
                    vector = dataSource.vector;
                } else if (dataSource.text) {
                    vector = await this.embedder.embed(dataSource.text);
                } else {
                    throw new Error('Either vector or text must be provided');
                }

                const id = dataSource.id || crypto.randomUUID();
                const acl = await this.getACL(AccessCandidate.clone(acRequest.candidate), preparedNs);
                
                const objectData = {
                    content: dataSource.text || '',
                    metadata: dataSource.metadata || {},
                    smyth_acl: acl ? JSON.stringify(acl) : '',
                    smyth_created_at: new Date().toISOString(),
                };

                await this.client.data
                    .creator()
                    .withClassName(preparedNs)
                    .withId(id)
                    .withProperties(objectData)
                    .withVector(vector)
                    .do();

                insertedIds.push(id);
            }

            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.insert :: Success :: Inserted ${insertedIds.length} vectors`);
            return insertedIds;
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.insert :: Error ::`, err);
            throw new Error(`Failed to insert data into namespace ${namespace}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method delete
     * @description Deletes vectors from Weaviate
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace to delete from
     * @param {DeleteTarget} deleteTarget - What to delete
     * @returns {Promise<void>}
     * @throws {Error} If there's an error deleting data
     */
    @SecureConnector.AccessControl
    protected async delete(acRequest: AccessRequest, namespace: string, deleteTarget: DeleteTarget): Promise<void> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.delete :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

            if (typeof deleteTarget === 'string') {
                // Delete single ID
                await this.client.data.deleter().withClassName(preparedNs).withId(deleteTarget).do();
            } else if (Array.isArray(deleteTarget)) {
                // Delete multiple IDs
                for (const id of deleteTarget) {
                    await this.client.data.deleter().withClassName(preparedNs).withId(id).do();
                }
            } else if (typeof deleteTarget === 'object' && deleteTarget.datasourceId) {
                // Delete by datasource ID (filter)
                const whereClause = {
                    path: ['metadata', 'datasourceId'],
                    operator: 'Equal' as const,
                    valueString: deleteTarget.datasourceId,
                };
                
                await this.client.batch.objectsBatchDeleter()
                    .withClassName(preparedNs)
                    .withWhere(whereClause)
                    .do();
            }

            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.delete :: Success`);
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.delete :: Error ::`, err);
            throw new Error(`Failed to delete from namespace ${namespace}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method createDatasource
     * @description Creates a datasource in Weaviate
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace
     * @param {DatasourceDto} datasource - The datasource data
     * @returns {Promise<IStorageVectorDataSource>} The created datasource
     * @throws {Error} If there's an error creating the datasource
     */
    @SecureConnector.AccessControl
    protected async createDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasource: DatasourceDto
    ): Promise<IStorageVectorDataSource> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.createDatasource :: InProgress`);
        try {
            const datasourceId = datasource.id || crypto.randomUUID();
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

            // Store datasource metadata
            const datasourceData = {
                id: datasourceId,
                namespace: preparedNs,
                metadata: datasource.metadata || {},
                createdAt: new Date().toISOString(),
            };

            // Store in NKV for datasource management
            await this.nkvConnector.requester(AccessCandidate.clone(acRequest.candidate)).set(
                'weaviate',
                `datasource:${preparedNs}:${datasourceId}`,
                JSON.stringify(datasourceData)
            );

            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.createDatasource :: Success :: Created datasource ${datasourceId}`);
            return datasourceData as unknown as IStorageVectorDataSource;
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.createDatasource :: Error ::`, err);
            throw new Error(`Failed to create datasource: ${err.message}`);
        }
    }

    /**
     * @async
     * @method deleteDatasource
     * @description Deletes a datasource from Weaviate
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace
     * @param {string} datasourceId - The datasource ID
     * @returns {Promise<void>}
     * @throws {Error} If there's an error deleting the datasource
     */
    @SecureConnector.AccessControl
    protected async deleteDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasourceId: string
    ): Promise<void> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.deleteDatasource :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

            // Delete datasource metadata
            await this.nkvConnector.requester(AccessCandidate.clone(acRequest.candidate)).delete(
                'weaviate',
                `datasource:${preparedNs}:${datasourceId}`
            );

            // Delete all vectors associated with this datasource
            await this.delete(acRequest, namespace, { datasourceId });

            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.deleteDatasource :: Success :: Deleted datasource ${datasourceId}`);
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.deleteDatasource :: Error ::`, err);
            throw new Error(`Failed to delete datasource ${datasourceId}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method listDatasources
     * @description Lists all datasources in a namespace
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace
     * @returns {Promise<IStorageVectorDataSource[]>} Array of datasources
     * @throws {Error} If there's an error listing datasources
     */
    @SecureConnector.AccessControl
    protected async listDatasources(acRequest: AccessRequest, namespace: string): Promise<IStorageVectorDataSource[]> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.listDatasources :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

            // Get all datasource keys for this namespace
            const datasourceKeys = await this.nkvConnector.requester(AccessCandidate.clone(acRequest.candidate)).list(
                'weaviate'
            );

            const datasources: IStorageVectorDataSource[] = [];
            for (const keyData of datasourceKeys) {
                if (keyData.key.startsWith(`datasource:${preparedNs}:`)) {
                    const datasource = await this.nkvConnector.requester(AccessCandidate.clone(acRequest.candidate)).get(
                        'weaviate',
                        keyData.key
                    );
                    if (datasource) {
                        datasources.push(datasource as unknown as IStorageVectorDataSource);
                    }
                }
            }

            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.listDatasources :: Success :: Found ${datasources.length} datasources`);
            return datasources;
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.listDatasources :: Error ::`, err);
            throw new Error(`Failed to list datasources in namespace ${namespace}: ${err.message}`);
        }
    }

    /**
     * @async
     * @method getDatasource
     * @description Gets a specific datasource
     * @param {AccessRequest} acRequest - The access request
     * @param {string} namespace - The namespace
     * @param {string} datasourceId - The datasource ID
     * @returns {Promise<IStorageVectorDataSource | undefined>} The datasource or undefined
     * @throws {Error} If there's an error getting the datasource
     */
    @SecureConnector.AccessControl
    protected async getDatasource(
        acRequest: AccessRequest,
        namespace: string,
        datasourceId: string
    ): Promise<IStorageVectorDataSource | undefined> {
        logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.getDatasource :: InProgress`);
        try {
            const preparedNs = this.constructNsName(acRequest.candidate as AccessCandidate, namespace);

            const datasource = await this.nkvConnector.requester(AccessCandidate.clone(acRequest.candidate)).get(
                'weaviate',
                `datasource:${preparedNs}:${datasourceId}`
            );

            logger.info(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.getDatasource :: Success`);
            return datasource as unknown as IStorageVectorDataSource | undefined;
        } catch (err) {
            logger.error(`WeaviateVectorDB :: ${acRequest.candidate.id} :: func.getDatasource :: Error ::`, err);
            throw new Error(`Failed to get datasource ${datasourceId}: ${err.message}`);
        }
    }

    /**
     * @method buildWhereClause
     * @description Builds a Weaviate where clause from filter options
     * @param {any} filter - The filter object
     * @returns {object} Weaviate where clause
     */
    private buildWhereClause(filter: any): any {
        // This is a simplified implementation
        // In a real implementation, you'd want to handle more complex filters
        if (filter.datasourceId) {
            return {
                path: ['metadata', 'datasourceId'],
                operator: 'Equal' as const,
                valueString: filter.datasourceId,
            };
        }
        return undefined;
    }

    /**
     * @async
     * @method stop
     * @description Stops the Weaviate connector
     * @returns {Promise<void>}
     */
    public async stop() {
        logger.info(`WeaviateVectorDB :: func.stop :: InProgress`);
        try {
            super.stop();
            // Weaviate client doesn't need explicit cleanup
            logger.info(`WeaviateVectorDB :: func.stop :: Success`);
        } catch (err) {
            logger.error(`WeaviateVectorDB :: func.stop :: Error ::`, err);
        }
    }
}
