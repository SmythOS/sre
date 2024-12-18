import { AxiosProxyConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

import Agent from '@sre/AgentManager/Agent.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';

export async function parseProxy(input, config, agent: Agent): Promise<AxiosProxyConfig | SocksProxyAgent | false> {
    const teamId = agent ? agent.teamId : null;
    const templateSettings = config?.template?.settings || {};

    let proxy = config?.data?.proxy;

    if (!proxy) {
        return false;
    }

    proxy = decodeURIComponent(proxy); //decode the url in order to parse the template vars

    //parse component template vars
    if (config.data._templateVars && templateSettings) {
        proxy = await TemplateString(proxy)
            .parseComponentTemplateVarsAsync(templateSettings) // replaces component template vars with their IDs (this turns the string parses into an async parser)
            .parse(config.data._templateVars).asyncResult; // replaces IDs with actual values then returns parser promise
    }

    //parse vault keys
    proxy = await TemplateString(proxy).parseTeamKeysAsync(teamId).asyncResult;

    //parse input variables and clean up the remaining unparsed values
    proxy = TemplateString(proxy).parse(input).clean().result;

    const proxyList = proxy.split(/\n|\\n/).filter((p) => p) || [];

    const randomIdx = Math.floor(Math.random() * proxyList?.length);
    const proxyUrl = proxyList[randomIdx]?.trim();

    //URL will take care of encoding the url properly
    const urlObj = new URL(proxyUrl);
    const protocol = urlObj.protocol.replace(':', ''); // As urlObj.protocol is like 'http:'

    let proxyConfig: AxiosProxyConfig | SocksProxyAgent;

    if (urlObj.protocol.startsWith('socks')) {
        let proxyUrlString = `${protocol}://${urlObj.hostname}:${urlObj.port}`;

        if ((protocol === 'socks4' || protocol === 'socks4a') && urlObj.username) {
            proxyUrlString = `${protocol}://${urlObj.username}@${urlObj.hostname}:${urlObj.port}`;
        } else if (protocol === 'socks5' && urlObj.username) {
            proxyUrlString = `${protocol}://${urlObj.username}:${urlObj.password}@${urlObj.hostname}:${urlObj.port}`;
        }

        proxyConfig = new SocksProxyAgent(proxyUrlString);
    } else {
        proxyConfig = {
            protocol,
            host: urlObj.hostname,
            port: parseInt(urlObj.port),
            auth: urlObj.username
                ? {
                      username: urlObj.username,
                      password: urlObj.password,
                  }
                : undefined,
        };
    }

    return proxyConfig;
}
