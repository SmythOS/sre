import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { models } from '@sre/LLMManager/models';
import { ModelsProviderConnector } from '../ModelsProviderConnector';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TAccessLevel } from '@sre/types/ACL.types';
import { TAccessRole } from '@sre/types/ACL.types';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { SmythModelsProviderConfig, TLLMModelsList } from '@sre/types/LLM.types';
import { Logger } from '@sre/helpers/Log.helper';

const console = Logger('SmythModelsProvider');

export class SmythModelsProvider extends ModelsProviderConnector {
    public name = 'SmythModelsProvider';

    private models: TLLMModelsList;

    constructor(private config?: SmythModelsProviderConfig) {
        super();

        this.models = JSON.parse(JSON.stringify(models));
        if (typeof this.config.models === 'function') {
            const modelsLoaderFunction = this.config.models as (models: TLLMModelsList) => Promise<TLLMModelsList>;
            modelsLoaderFunction(models as unknown as TLLMModelsList).then((models) => {
                this.models = models;
                this.started = true;
            });
        } else if (typeof this.config.models === 'object') {
            this.models = this.config.models as TLLMModelsList;
            this.started = true;
        } else {
            this.started = true;
        }
    }
    public async start() {
        super.start();
    }

    @SecureConnector.AccessControl
    public async getModels(): Promise<any> {
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
}
