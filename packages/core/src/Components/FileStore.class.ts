import Agent from '@sre/AgentManager/Agent.class';
import Component from './Component.class';
import Joi from 'joi';
import _config from '@sre/config';
import { S3Storage } from '@sre/IO/Storage.service/connectors/S3Storage.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';
import { BinaryInput } from '@sre/helpers/BinaryInput.helper';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';

export default class FileStore extends Component {
    protected configSchema = Joi.object({
        name: Joi.string().max(1000).allow('').label('Name'),
        ttl: Joi.number().integer().label('TTL'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);

        const logger = this.createComponentLogger(agent, config);
        try {
            logger.debug(`=== File Store Log ===`);
            let Output: any = {};
            let _error = undefined;
            let data = input.Data;
            const accessCandidate = AccessCandidate.agent(agent.id);
            const binaryData = await BinaryInput.from(data, null, null, accessCandidate);
            const fileData = await binaryData.getJsonData(accessCandidate);
            const buffer = await binaryData.getBuffer();
            const customFileName = TemplateString(config.data.name).parse(input).result;
            const metadata = {
                ContentType: fileData.mimetype,
            };
            const ttl = config.data.ttl || 86400;
            const extension = fileData.url?.split('.').pop();
            const s3StorageConnector = ConnectorService.getStorageConnector('S3') as S3Storage;
            const fileName = this.getFileName(customFileName, extension);
            try {
                const s3Key = `teams/${agent.teamId}/components_data/${fileName}`;

                await s3StorageConnector.user(AccessCandidate.agent(agent.teamId)).write(s3Key, buffer, null, metadata);
                await s3StorageConnector.user(AccessCandidate.agent(agent.teamId)).expire(s3Key, +ttl);
                const smythFSUrl = `smythfs://${agent.teamId}.team/components_data/${fileName}`;
                const url = await SmythFS.Instance.genResourceUrl(smythFSUrl, AccessCandidate.agent(agent.teamId));
                Output = {
                    Url: url,
                };
            } catch (error: any) {
                logger.error(`Error saving file \n${error}\n`);
                _error = error?.response?.data || error?.message || error.toString();
                Output = undefined; //prevents running next component if the code execution failed
            }

            return { ...Output, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error saving file \n${_error}\n`);
            return { Output: undefined, _error, _debug: logger.output };
        }
    }

    getExtension(mimeType: string) {
        const extension = mimeType.split('/')[1];
        return extension;
    }

    getFileName(customName: string, extension: string) {
        const uniqueId = (() => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9)))).replace(/[+/=]/g, ''))();
        return `${uniqueId}${customName ? `.${customName}` : ''}.${extension}`;
    }
}
