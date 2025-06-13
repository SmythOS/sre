import { SDKLog } from './utils/console.utils';

const console = SDKLog;

export const HELP = {
    SRE: {
        SECURITY_MODEL: '',
    },
    SDK: {
        AGENT_STORAGE_ACCESS: '',
        CHAT_PERSISTENCE: '',
    },
};

export function showHelp(url: string) {
    if (!url) return;

    console.log('Learn more ', url);
}
