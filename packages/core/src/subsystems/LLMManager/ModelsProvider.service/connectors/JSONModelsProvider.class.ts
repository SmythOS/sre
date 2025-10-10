import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { models } from '@sre/LLMManager/models';
import { ModelsProviderConnector } from '../ModelsProviderConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TAccessLevel } from '@sre/types/ACL.types';
import { TAccessRole } from '@sre/types/ACL.types';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { TLLMModel, TLLMModelsList } from '@sre/types/LLM.types';
import { Logger } from '@sre/helpers/Log.helper';
import { debounce } from '@sre/utils/general.utils';
import chokidar from 'chokidar';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { findSmythPath } from '@sre/helpers/Sysconfig.helper';

const console = Logger('SmythModelsProvider');

type SmythModelsProviderConfig = {
    /**
     * The models to be used.
     *
     * If a string is provided, it will be used as the directory name to load the models from.
     * If a TLLMModelsList is provided, it will be used as the models to be used.
     *
     */
    models?: string | TLLMModelsList;

    /**
     * The mode to be used.
     *
     * If 'append' is used, the models will be appended to the existing models.
     * If 'replace' is used, the existing models will be replaced with the new models.
     */
    mode?: 'merge' | 'replace';
};

export class JSONModelsProvider extends ModelsProviderConnector {
    public name = 'JSONModelsProvider';

    private models: TLLMModelsList;

    constructor(protected _settings?: SmythModelsProviderConfig) {
        super(_settings);

        this.models = JSON.parse(JSON.stringify(models));
        if (typeof this._settings.models === 'string') {
            this.initDirWatcher(this._settings.models); //this.started will be set to true when the watcher is ready
        } else if (typeof this._settings.models === 'object') {
            if (this._settings.mode === 'merge') this.models = { ...this.models, ...(this._settings.models as TLLMModelsList) };
            else this.models = this._settings.models as TLLMModelsList;
            this.started = true;
        } else {
            const modelsFolder = this.findModelsFolder();
            if (modelsFolder) {
                this._settings.mode = 'merge'; //Force merge mode if using models from .smyth folder
                this.initDirWatcher(modelsFolder); //this.started will be set to true when the watcher is ready
            } else {
                console.warn('No models folder found ... falling back to built-in models only');
                this.started = true;
            }
        }
    }
    public async start() {
        super.start();
    }

    private findModelsFolder() {
        const _modelsFolder = findSmythPath('models');

        if (fsSync.existsSync(_modelsFolder)) {
            console.warn('Using default models folder  : ', _modelsFolder);
            return _modelsFolder;
        }

        return null;
    }

    @SecureConnector.AccessControl
    public async addModels(acRequest: AccessRequest, models: TLLMModelsList): Promise<void> {
        await this.ready();
        const validModels = (await this.getValidModels(models)) || {};
        if (Object.keys(validModels).length > 0) {
            this.models = { ...this.models, ...validModels };
        }
    }

    @SecureConnector.AccessControl
    public async getModels(acRequest: AccessRequest): Promise<any> {
        await this.ready();

        return this.models;
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate) {
        const accountConnector = ConnectorService.getAccountConnector();

        const acl = new ACL();
        //give read access to the candidate by default
        acl.addAccess(candidate.role, candidate.id, TAccessLevel.Read);

        return acl;
    }

    private async reindexModels(dir: string) {
        try {
            console.debug(`Reindexing models from directory: ${dir}`);

            // Scan directory for models and get them as an object
            const scannedModels = await this.scanDirectoryForModels(dir);

            // Apply models based on settings mode or default behavior
            if (this._settings?.mode === 'merge') {
                this.models = { ...this.models, ...scannedModels };
            } else {
                // Default behavior: reset to base models first, then add scanned models
                this.models = scannedModels;
            }

            JSONModelsProvider.localCache.clear();

            console.debug(`Successfully reindexed models. Total models: ${Object.keys(this.models).length}`);
        } catch (error) {
            console.error(`Error reindexing models from directory "${dir}":`, error);
        }
    }

    private async scanDirectoryForModels(dir: string): Promise<TLLMModelsList> {
        const scannedModels: TLLMModelsList = {};

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    // Recursively scan subdirectories and merge results
                    const subDirModels = await this.scanDirectoryForModels(fullPath);
                    Object.assign(scannedModels, subDirModels);
                } else if (entry.isFile() && entry.name.endsWith('.json')) {
                    // Process JSON files and merge results
                    const fileContent = await fs.readFile(fullPath, 'utf-8');
                    const modelData = JSON.parse(fileContent);
                    const validModels = await this.getValidModels(modelData);
                    Object.assign(scannedModels, validModels);
                }
            }
        } catch (error) {
            console.warn(`Error scanning directory "${dir}":`, error);
        }

        return scannedModels;
    }

    private async getValidModels(modelData: any): Promise<TLLMModelsList> {
        const validModels: TLLMModelsList = {};

        try {
            // Check if it's a single model or an object of models
            if (modelData.modelId) {
                // Single model case
                if (this.isValidSingleModel(modelData)) {
                    validModels[modelData.modelId] = modelData as TLLMModel;
                    console.debug(`Loaded model: ${modelData.modelId}`);
                } else {
                    console.warn(`Invalid model format`, modelData);
                }
            } else if (typeof modelData === 'object' && !Array.isArray(modelData)) {
                // Object of models case
                for (const [modelId, model] of Object.entries(modelData)) {
                    try {
                        if (this.isValidSingleModel(model)) {
                            validModels[modelId] = model as TLLMModel;
                            console.debug(`Loaded model: ${modelId}`);
                        } else {
                            console.warn(`Invalid model format for model "${modelId}"`);
                        }
                    } catch (error) {
                        console.warn(`Error processing model "${modelId}":`, error);
                        // Continue processing other models instead of failing the whole file
                    }
                }
            } else {
                console.warn(`Invalid format (not a model or object of models)`);
            }
        } catch (error) {
            console.warn(`Error loading model:`, error);
        }

        return validModels;
    }

    private isValidSingleModel(data: any): boolean {
        // Basic validation for single model structure
        return (
            data && typeof data === 'object' && typeof data.modelId === 'string' && (data.provider === undefined || typeof data.provider === 'string')
        );
    }

    private isValidModel(data: any): boolean {
        // Keep for backward compatibility, but delegate to simpler function
        return this.isValidSingleModel(data);
    }

    private initDirWatcher(dir) {
        const stats = fsSync.statSync(dir);

        if (!stats.isDirectory() && !stats.isFile()) {
            console.warn(`Path "${dir}" is neither a file nor a directory ... skipping models watcher and falling back to built-in models only`);
            this.started = true;
            return;
        }

        // Synchronous file system operations for initial setup
        try {
            if (!stats.isDirectory()) {
                //is it a file?
                if (stats.isFile()) {
                    //load the file
                    const fileContent = fsSync.readFileSync(dir, 'utf-8');
                    try {
                        const modelData = JSON.parse(fileContent);

                        if (this._settings?.mode === 'merge') this.models = { ...this.models, ...modelData };
                        else this.models = modelData;
                    } catch (error) {
                        console.error(`Error parsing model data from file "${dir}":`, error);
                    }
                    this.started = true;
                    return;
                }

                console.warn(`Path "${dir}" is neither a file nor a directory`);
                return;
            }
        } catch (error) {
            console.warn(`Path "${dir}" does not exist or cannot be accessed:`, error.message);
            return;
        }

        const debouncedReindex = debounce(this.reindexModels.bind(this, dir), 1000, {
            leading: false,
            trailing: true,
            maxWait: 5000,
        });

        const watcher = chokidar.watch(dir, {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true, // Don't fire events for files that already exist
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100,
            },
        });

        watcher
            .on('add', (path) => {
                console.debug(`File ${path} has been added`);
                debouncedReindex();
            })
            .on('change', (path) => {
                console.debug(`File ${path} has been changed`);
                debouncedReindex();
            })
            .on('unlink', (path) => {
                console.debug(`File ${path} has been removed`);
                debouncedReindex();
            })
            .on('ready', async () => {
                console.debug(`Watcher ready. Performing initial scan of ${dir}`);
                // Do initial scan once when watcher is ready
                await this.reindexModels(dir);
                this.started = true;
            });
    }
}
