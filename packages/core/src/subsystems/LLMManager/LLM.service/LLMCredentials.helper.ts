import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { TBedrockSettings, TCustomLLMModel, TLLMCredentials, TLLMModel, TVertexAISettings } from '@sre/types/LLM.types';

export async function getLLMCredentials(candidate: AccessCandidate, modelInfo: TLLMModel | TCustomLLMModel) {
    //create a credentials list that we can iterate over
    //if the credentials are not provided, we will use None as a default in order to return empty credentials
    const credentialsList: any[] = !Array.isArray(modelInfo.credentials) ? [modelInfo.credentials] : modelInfo.credentials || [TLLMCredentials.None];

    for (let credentialsMode of credentialsList) {
        if (typeof credentialsMode === 'object') {
            //credentials passed directly
            return credentialsMode;
        }

        switch (credentialsMode) {
            case TLLMCredentials.None: {
                return { apiKey: '' };
            }
            case TLLMCredentials.Internal: {
                const credentials = await getEnvCredentials(candidate, modelInfo as TLLMModel);
                if (credentials) return credentials;
                break;
            }
            case TLLMCredentials.Vault: {
                const credentials = await getStandardLLMCredentials(candidate, modelInfo as TLLMModel);
                if (credentials) return credentials;
                break;
            }
            case TLLMCredentials.BedrockVault: {
                const credentials = await getBedrockCredentials(candidate, modelInfo as TCustomLLMModel);
                if (credentials) return credentials;
                break;
            }
            case TLLMCredentials.VertexAIVault: {
                const credentials = await getVertexAICredentials(candidate, modelInfo as TCustomLLMModel);
                if (credentials) return credentials;
                break;
            }
        }
    }

    return {};
}

/**
 * Legacy API keys
 * TODO : move this to a special vault entry
 */
const SMYTHOS_API_KEYS = {
    echo: '',
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    googleai: process.env.GOOGLE_AI_API_KEY,
    togetherai: process.env.TOGETHER_AI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    xai: process.env.XAI_API_KEY,
    perplexity: process.env.PERPLEXITY_API_KEY,
};
async function getEnvCredentials(candidate: AccessCandidate, modelInfo: TLLMModel): Promise<{ apiKey: string }> {
    const provider = (modelInfo.provider || modelInfo.llm)?.toLowerCase();
    const apiKey = SMYTHOS_API_KEYS?.[provider] || '';
    if (!apiKey) return null;
    return { apiKey };
}

/**
 * Retrieves API key credentials for standard LLM providers from the vault
 * @param candidate - The access candidate requesting the credentials
 * @param provider - The LLM provider name (e.g., 'openai', 'anthropic')
 * @returns Promise resolving to an object containing the provider's API key
 * @throws {Error} If vault connector is unavailable (handled in parent method)
 * @remarks Returns an empty string as API key if vault access fails
 * @private
 */
async function getStandardLLMCredentials(candidate: AccessCandidate, modelInfo: TLLMModel): Promise<{ apiKey: string; isUserKey: boolean }> {
    const provider = (modelInfo.provider || modelInfo.llm)?.toLowerCase();
    const vaultConnector = ConnectorService.getVaultConnector();

    const apiKey = await vaultConnector
        .requester(candidate)
        .get(provider)
        .catch(() => '');

    if (!apiKey) return null;
    return { apiKey, isUserKey: true };
}

/**
 * Retrieves AWS Bedrock credentials from the vault for authentication
 * @param candidate - The access candidate requesting the credentials
 * @param modelInfo - The Bedrock model information containing credential key names in settings
 * @returns Promise resolving to AWS credentials object
 * @returns {Promise<Object>} credentials
 * @returns {string} credentials.accessKeyId - AWS access key ID
 * @returns {string} credentials.secretAccessKey - AWS secret access key
 * @returns {string} [credentials.sessionToken] - Optional AWS session token
 * @throws {Error} If vault connector is unavailable (handled in parent method)
 * @private
 */
async function getBedrockCredentials(
    candidate: AccessCandidate,
    modelInfo: TCustomLLMModel
): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string; isUserKey: boolean }> {
    const keyIdName = (modelInfo.settings as TBedrockSettings)?.keyIDName;
    const secretKeyName = (modelInfo.settings as TBedrockSettings)?.secretKeyName;
    const sessionKeyName = (modelInfo.settings as TBedrockSettings)?.sessionKeyName;

    const vaultConnector = ConnectorService.getVaultConnector();

    const [accessKeyId, secretAccessKey, sessionToken] = await Promise.all([
        vaultConnector
            .requester(candidate)
            .get(keyIdName)
            .catch(() => ''),
        vaultConnector
            .requester(candidate)
            .get(secretKeyName)
            .catch(() => ''),
        vaultConnector
            .requester(candidate)
            .get(sessionKeyName)
            .catch(() => ''),
    ]);

    let credentials: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
        isUserKey: boolean;
    } = {
        accessKeyId,
        secretAccessKey,
        isUserKey: true,
    };

    if (sessionToken) {
        credentials.sessionToken = sessionToken;
    }

    if (!accessKeyId || !secretAccessKey) return null;
    return credentials;
}

/**
 * Retrieves the credentials required for VertexAI authentication from the vault
 * @param candidate - The access candidate requesting the credentials
 * @param modelInfo - The VertexAI model information containing settings
 * @returns Promise resolving to the parsed JSON credentials for VertexAI
 * @throws {Error} If vault connector is unavailable (handled in parent method)
 * @throws {Error} If JSON parsing fails or credentials are malformed
 * @remarks Returns empty credentials if vault access fails
 * @private
 */
async function getVertexAICredentials(candidate: AccessCandidate, modelInfo: TCustomLLMModel): Promise<any> {
    const jsonCredentialsName = (modelInfo.settings as TVertexAISettings)?.jsonCredentialsName;

    const vaultConnector = ConnectorService.getVaultConnector();

    let jsonCredentials = await vaultConnector
        .requester(candidate)
        .get(jsonCredentialsName)
        .catch(() => '');

    const credentials = JSON.parse(jsonCredentials);

    if (!credentials) return null;
    return { ...credentials, isUserKey: true };
}
