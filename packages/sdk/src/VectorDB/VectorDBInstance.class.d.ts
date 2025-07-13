import { AccessCandidate } from '@smythos/sre';
import { TVectorDBProvider } from '../types/generated/VectorDB.types';
import { SDKObject } from '../Core/SDKObject.class';
import { TParsedDocument } from '../DocParser/DocParser.class';
export type TVectorDBSearchOptions = {
    topK?: number;
    includeEmbeddings?: boolean;
};
export declare class VectorDBInstance extends SDKObject {
    private providerId;
    private VectorDBSettings?;
    private _candidate;
    private _VectorDBRequest;
    private _namespace;
    private _teamId;
    constructor(providerId: TVectorDBProvider, VectorDBSettings?: any, candidate?: AccessCandidate);
    protected init(): Promise<void>;
    private namespaceExists;
    private ensureNamespaceExists;
    private _normalizeName;
    /**
     * Insert a document into the vector database
     * @param name - The name of the document
     * @param data - The data to insert. Can be a string or a TParsedDocument
     * @param metadata - The metadata to insert, can be any key/value pair
     *
     * @example
     * ```typescript
     * const pineConeSettings = {/* ... pinecone settings ... *\/}
     * const pinecone = VectorDB.Pinecone('my_namespace', pineConeSettings);
     * const id = await pinecone.insertDoc('test', 'Hello, world!', { myEntry: 'My Metadata' });
     * ```
     */
    insertDoc(name: string, data: string | TParsedDocument, metadata?: Record<string, string>): Promise<any>;
    /**
     * Update a document in the vector database.
     *
     * Note : this will index the new data on top of the existing data.
     * if you want to replace the existing data, you should delete the document first (see deleteDoc)
     *
     * @param name - The name of the document
     * @param data - The data to update. Can be a string or a TParsedDocument
     * @param metadata - The metadata to update, can be any key/value pair
     *
     * @example
     * ```typescript
     * const pineConeSettings = {/* ... pinecone settings ... *\/}
     * const pinecone = VectorDB.Pinecone('my_namespace', pineConeSettings);
     * const id = await pinecone.updateDoc('test', 'Hello, world!', { myEntry: 'My Metadata' });
     * ```
     */
    updateDoc(name: string, data: string | TParsedDocument, metadata?: Record<string, string>): Promise<any>;
    /**
     * Delete a document from the vector database
     * @param name - The name of the document
     * @returns true if the document was deleted, false otherwise
     *
     * @example
     * ```typescript
     * const pineConeSettings = {/* ... pinecone settings ... *\/}
     * const pinecone = VectorDB.Pinecone('my_namespace', pineConeSettings);
     * const success = await pinecone.deleteDoc('test');
     * ```
     */
    deleteDoc(name: string): Promise<boolean>;
    /**
     * Search the vector database for a query
     * @param query - The query to search for
     * @param options - The options for the search
     * @returns The search results
     *
     * @example
     * ```typescript
     * const pineConeSettings = {/* ... pinecone settings ... *\/}
     * const pinecone = VectorDB.Pinecone('my_namespace', pineConeSettings);
     * const results = await pinecone.search('Hello, world!');
     * ```
     */
    search(query: string, options?: TVectorDBSearchOptions): Promise<any>;
    /**
     * Purge the current namespace of the vector database
     *
     * Note : this will delete all the data in the current namespace.
     *
     * @returns void
     *
     * @example
     * ```typescript
     * const pinecone = VectorDB.Pinecone('my_namespace', pineConeSettings);
     * await pinecone.purge();
     * ```
     */
    purge(): Promise<void>;
}
