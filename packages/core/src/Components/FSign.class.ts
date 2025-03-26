import Component from './Component.class';
import Agent from '@sre/AgentManager/Agent.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import crypto from 'crypto';
import querystring from 'querystring';

export default class FSign extends Component {
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const logger = this.createComponentLogger(agent, config);
        try {
            const _error = undefined;
            const teamId = agent ? agent.teamId : null;

            let data = input.Data;
            //if (typeof data === 'object') data = JSON.stringify(data);
            let signingKey = input.Key || config.data.key;
            // signingKey = parseTemplate(signingKey, input, { processUnmatched: false });
            // signingKey = await parseKey(signingKey, teamId);
            signingKey = await TemplateString(signingKey).parse(input).parseTeamKeysAsync(teamId).asyncResult;

            const signMethod = config.data.signMethod || 'HMAC';
            const dataTransform = config.data.dataTransform || 'None';
            const hashType = config.data.hashType || 'md5';
            const RSA_padding = config.data.RSA_padding;
            const RSA_saltLength = config.data.RSA_saltLength;
            const encoding = config.data.encoding || 'hex';

            if (typeof data != 'string') {
                switch (dataTransform) {
                    case 'Stringify':
                        data = JSON.stringify(data);
                        break;
                    case 'Querystring':
                        data = querystring.stringify(data);
                        break;
                }
            }
            logger.debug(' Data to sign = ', data);
            logger.debug(` Signing data using ${signMethod} algorithm and ${encoding} encoding`);
            const Signature = this.signData(data, signingKey, signMethod, encoding, { hashType, RSA_padding, RSA_saltLength });

            logger.debug(` Signature generated: ${Signature}`);
            return { Signature, _error, _debug: logger.output };
        } catch (err: any) {
            const _error = err?.response?.data || err?.message || err.toString();
            logger.error(` Error generating hash \n${_error}\n`);
            return { hash: undefined, _error, _debug: logger.output };
        }
    }

    private signData(data, key, signMethod, encoding = 'hex', options: any = {}) {
        // Determine if the algorithm is for HMAC or RSA/DSA/ECDSA
        switch (signMethod) {
            case 'RSA':
                const algo = `${signMethod}-${options.hashType || 'md5'}`.toUpperCase();
                const sign = crypto.createSign(algo);
                sign.update(data);

                const sign_options = {
                    key,
                    padding: options.RSA_padding ? crypto.constants[options.RSA_padding] : undefined,
                    saltLength: options.RSA_saltLength ? crypto.constants[options.RSA_saltLength] : undefined,
                };
                // For RSA/DSA/ECDSA, options may include padding and saltLength
                return sign.sign(sign_options, encoding.toLowerCase() as crypto.BinaryToTextEncoding);

            case 'HMAC':
                const hmac = crypto.createHmac(options.hashType, key);
                hmac.update(data);
                return hmac.digest(encoding as crypto.BinaryToTextEncoding);
        }

        return null;
    }
}
