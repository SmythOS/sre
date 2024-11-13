import axios from 'axios';
import config from '../config';

//middleware sys API
export const mwSysAPI = axios.create({
    baseURL: `${config.env.SMYTH_API_BASE_URL}/_sysapi/v1`,
});
export function includeAuth(token: string) {
    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
}
