import axios from 'axios';
import qs from 'qs';

export async function getM2MToken(configs: {
    oauthAppId: string;
    oauthAppSecret: string;
    resource: string;
    scope: string;
    baseUrl: string;
}): Promise<string> {
    return new Promise((resolve, reject) => {
        const base64Credentials = Buffer.from(`${configs.oauthAppId}:${configs.oauthAppSecret}`, 'utf8').toString('base64');

        const body = {
            grant_type: 'client_credentials',
            resource: configs.resource,
            scope: configs.scope || '',
        };
        axios({
            method: 'post',
            // url: `${config.env.LOGTO_SERVER}/oidc/token`,
            url: configs.baseUrl,
            headers: {
                Authorization: 'Basic ' + base64Credentials,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: qs.stringify(body),
        })
            .then((response) => {
                resolve(response?.data?.access_token);
            })
            .catch((error) => {
                reject({ error: error?.response?.data });
            });
    });
}
