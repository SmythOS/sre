//FIXME: this file should be removed from services

import { createLogger } from '@sre/Core/Logger';
const console = createLogger('___FILENAME___');

export const isTemplateVar = (str: string = ''): boolean => {
    if (!str || typeof str !== 'string') return false;
    return (str?.match(/{{(.*?)}}/g) ?? []).length > 0;
};
export const isKeyTemplateVar = (str: string = ''): boolean => {
    if (!str || typeof str !== 'string') return false;
    return (str?.match(/{{KEY\((.*?)\)}}/g) ?? []).length > 0;
};

export async function parseKey(str: string, teamId: string): Promise<string> {
    console.warn('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    console.warn('parseKey() : NOT IMPLEMENTED');
    return str;
}
