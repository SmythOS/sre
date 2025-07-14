import { Agent } from '../../Agent/Agent.class';
import { InputSettings } from '../../types/SDKTypes';
export interface TAPICallSettings {
    name?: string;
    /** Method */
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
    /** URL */
    url: string;
    /** Headers */
    headers?: any;
    /** Content-Type */
    contentType?: 'none' | 'application/json' | 'multipart/form-data' | 'binary' | 'application/x-www-form-urlencoded' | 'text/plain' | 'application/xml';
    /** Body */
    body?: any;
    /** Proxy */
    proxy?: string;
    /** OAuth Service */
    oauthService?: string;
    /** Scope */
    scope?: string;
    /** Authorization URL */
    authorizationURL?: string;
    /** Token URL */
    tokenURL?: string;
    /** Client ID */
    clientID?: string;
    /** Client Secret */
    clientSecret?: string;
    /** OAuth2 Callback URL */
    oauth2CallbackURL?: string;
    /** Callback URL */
    callbackURL?: string;
    /** Access Token URL */
    accessTokenURL?: string;
    /** User Authorization URL */
    userAuthorizationURL?: string;
    /** Consumer Key */
    consumerKey?: string;
    /** Consumer Secret */
    consumerSecret?: string;
    /** OAuth1 Callback URL */
    oauth1CallbackURL?: string;
    /** Authenticate */
    authenticate?: string;
}
export type TAPICallInputs = {
    [key: string]: InputSettings;
};
export type TAPICallOutputs = {
    /** The headers of the API call response */
    Headers: any;
    /** The response of the API call */
    Response: any;
    [key: string]: any;
};
/**
 * Use this component to make an API call
 */
export declare function APICall(settings?: TAPICallSettings, agent?: Agent): {
    /** Component outputs - access via .out.OutputName */
    out: TAPICallOutputs;
    /**
     * Create or Connect the component inputs
     * if the input does not exist, it will be created
     * @examples
     *    - component.in({ Input: source.out.data })
     *    - component.in({ Input: { type: 'string', source:source.out.data } })
     */
    in: (inputs: TAPICallInputs) => void;
};
