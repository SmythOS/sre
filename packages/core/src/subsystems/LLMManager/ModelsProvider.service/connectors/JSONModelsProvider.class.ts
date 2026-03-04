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

const logger = Logger('SmythModelsProvider');

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
                logger.warn('No models folder found ... falling back to built-in models only');
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
            logger.warn('Using default models folder  : ', _modelsFolder);
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
            logger.debug(`Reindexing models from directory: ${dir}`);

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

            logger.debug(`Successfully reindexed models. Total models: ${Object.keys(this.models).length}`);
        } catch (error) {
            logger.error(`Error reindexing models from directory "${dir}":`, error);
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
                    try {
                        // Process JSON files and merge results

                        const fileContent = await fs.readFile(fullPath, 'utf-8');
                        const modelData = JSON.parse(fileContent);
                        const validModels = await this.getValidModels(modelData);
                        Object.assign(scannedModels, validModels);
                    } catch (error) {
                        console.error(`Error parsing model data from file "${fullPath}"`);
                        logger.warn(`Error parsing model data from file "${fullPath}":`, error.message);
                    }
                }
            }
        } catch (error) {
            logger.warn(`Error scanning directory "${dir}":`, error);
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
                    logger.debug(`Loaded model: ${modelData.modelId}`);
                } else {
                    logger.warn(`Invalid model format`, modelData);
                }
            } else if (typeof modelData === 'object' && !Array.isArray(modelData)) {
                // Object of models case
                let models = '';
                for (const [modelId, model] of Object.entries(modelData)) {
                    try {
                        if (this.isValidSingleModel(model)) {
                            validModels[modelId] = model as TLLMModel;
                            //console.debug(`Loaded model: ${modelId}`);
                            models += `${modelId} `;
                        } else {
                            logger.warn(`Invalid model format for model "${modelId}"`);
                        }
                    } catch (error) {
                        logger.warn(`Error processing model "${modelId}":`, error);
                        // Continue processing other models instead of failing the whole file
                    }
                }
                logger.debug(`Loaded models: ${models}`);
            } else {
                logger.warn(`Invalid format (not a model or object of models)`);
            }
        } catch (error) {
            logger.warn(`Error loading model:`, error);
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

    /**
     * Determines whether a file path should be ignored by the directory watcher.
     *
     * This method implements a sophisticated filtering strategy for dot-segment paths
     * (paths containing directories that start with a dot, like .git, .env, .cache).
     *
     * **Filtering Strategy:**
     * 1. Paths WITHOUT dot segments: Never ignored
     * 2. Paths WITH dot segments:
     *    - If SMYTH_PATH is not configured: All ignored
     *    - If SMYTH_PATH is configured:
     *      - Allow the watched directory even if SMYTH_PATH contains dot-segments
     *        (e.g., /home/user/.smyth/models/OpenAI/default.json is allowed)
     *      - Ignore dot-segments INSIDE the models directory
     *        (e.g., /home/user/.smyth/models/.hidden/model.json is ignored)
     *      - Paths outside watched directory: Ignored
     *
     * @param filePath - The file path to check
     * @param watchedDir - The absolute path of the directory being watched (models folder)
     * @param smythPath - The resolved SMYTH_PATH, or null if not configured
     * @returns true if the path should be ignored, false if it should be watched
     *
     * @example
     * ```typescript
     * // Path without dot-segment (allowed)
     * shouldIgnorePath('/models/OpenAI/default.json', '/models', '/home/.smyth') // => false
     *
     * // Dot-segment inside models directory (ignored)
     * shouldIgnorePath('/models/.git/config', '/models', '/home/.smyth') // => true
     *
     * // Dot-segment in parent path only (allowed)
     * shouldIgnorePath('/home/.smyth/models/OpenAI/default.json', '/home/.smyth/models', '/home/.smyth') // => false
     * ```
     */
    private shouldIgnorePath(filePath: string, watchedDir: string, smythPath: string | null): boolean {
        // Check if the file path contains a dot-segment (e.g., /.git/, /.env/, /.cache/)
        // Regex explanation: [\\/]\. matches a path separator (/ or \) followed by a dot
        const hasDotSegment = /[\\/]\./.test(filePath);

        // CASE 1: If there is NO dot-segment at all, we never ignore this path
        // Examples: /models/OpenAI/default.json, /models/Anthropic/claude.json
        if (!hasDotSegment) {
            return false;
        }

        // CASE 2: If there IS a dot-segment and SMYTH_PATH is not configured,
        // we ignore all such paths to prevent watching system/hidden files
        // Examples: /.git/config, /node_modules/.cache/file.json
        if (hasDotSegment && !smythPath) {
            return true;
        }

        // Resolve the file path to an absolute path for accurate comparison
        // This ensures we can reliably compare against the watched directory path
        const resolvedPath = path.resolve(filePath);

        // Check if the resolved path is inside the watched directory (models folder)
        // This handles two cases:
        // 1. The path exactly matches the watched directory
        // 2. The path is a child of the watched directory (starts with watchedDir + separator)
        const isInsideWatchedDir = resolvedPath === watchedDir || resolvedPath.startsWith(watchedDir + path.sep);

        // CASE 3: If the path is outside the watched directory, ignore it
        // This prevents watching unrelated files that happen to have dot-segments
        if (!isInsideWatchedDir) {
            return true;
        }

        // CASE 4: Path is inside the watched directory
        // Now we need to determine if the dot-segment is in the models directory itself
        // or if it is part of the parent path (e.g., SMYTH_PATH containing .smyth)

        // Get the relative path from the watched directory to determine where the dot-segment is
        const relativePath = path.relative(watchedDir, resolvedPath);

        // Check if the dot-segment appears in the relative portion (inside models directory)
        // Regex explanation: (^|[\\/])\. matches a dot at the start OR after a path separator
        // Examples that match: '.git/config', 'subdir/.hidden/file.json'
        const hasDotSegmentInsideWatchedDir = /(^|[\\/])\./.test(relativePath);

        // FINAL DECISION:
        // - If dot-segment is INSIDE the models directory (e.g., models/.git/config), IGNORE it (return true)
        // - If dot-segment is OUTSIDE the models directory (e.g., /home/user/.smyth/models/OpenAI/default.json), ALLOW it (return false)
        // This allows SMYTH_PATH to contain dot-segments while preventing dot-segments within the models folder
        return hasDotSegmentInsideWatchedDir;
    }

    private initDirWatcher(dir) {
        const stats = fsSync.statSync(dir);

        if (!stats.isDirectory() && !stats.isFile()) {
            logger.warn(`Path "${dir}" is neither a file nor a directory ... skipping models watcher and falling back to built-in models only`);
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
                        console.error(`Error parsing model data from file "${dir}":`);
                        logger.warn(`Error parsing model data from file "${dir}":`, error.message);
                    }
                    this.started = true;
                    return;
                }

                logger.warn(`Path "${dir}" is neither a file nor a directory`);
                return;
            }
        } catch (error) {
            logger.warn(`Path "${dir}" does not exist or cannot be accessed:`, error.message);
            return;
        }

        const debouncedReindex = debounce(this.reindexModels.bind(this, dir), 1000, {
            leading: false,
            trailing: true,
            maxWait: 5000,
        });

        const smythPath = process.env.SMYTH_PATH ? path.resolve(process.env.SMYTH_PATH) : null;
        const watchedDir = path.resolve(dir);

        const watcher = chokidar.watch(dir, {
            // Use the extracted method for path filtering
            ignored: (filePath: string) => this.shouldIgnorePath(filePath, watchedDir, smythPath),
            persistent: true,
            ignoreInitial: true, // Don't fire events for files that already exist
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100,
            },
        });

        watcher
            .on('add', (path) => {
                logger.debug(`File ${path} has been added`);
                debouncedReindex();
            })
            .on('change', (path) => {
                logger.debug(`File ${path} has been changed`);
                debouncedReindex();
            })
            .on('unlink', (path) => {
                logger.debug(`File ${path} has been removed`);
                debouncedReindex();
            })
            .on('ready', async () => {
                logger.debug(`Watcher ready. Performing initial scan of ${dir}`);
                // Do initial scan once when watcher is ready
                await this.reindexModels(dir);
                this.started = true;
            });
    }
}
