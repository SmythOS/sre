// Global type declarations for Node.js environment
declare global {
    namespace NodeJS {
        interface ProcessEnv {
            PORT?: string;
            ZOOM_SECRET_TOKEN?: string;
            ZOOM_CLIENT_ID?: string;
            ZOOM_CLIENT_SECRET?: string;
            WEBHOOK_PATH?: string;
            OPENAI_API_KEY?: string;
            ANTHROPIC_API_KEY?: string;
            PINECONE_API_KEY?: string;
            PINECONE_INDEX_NAME?: string;
            AWS_ACCESS_KEY_ID?: string;
            AWS_SECRET_ACCESS_KEY?: string;
            AWS_REGION?: string;
            AWS_S3_BUCKET?: string;
            LOG_LEVEL?: string;
        }
    }

    var process: NodeJS.Process;
    var console: Console;
    var Buffer: BufferConstructor;
}

declare module 'crypto' {
    export function createHmac(algorithm: string, key: string): any;
}

declare module 'ws' {
    export default class WebSocket {
        constructor(url: string, options?: any);
        on(event: string, callback: Function): void;
        send(data: string): void;
        close(): void;
    }
}

declare module 'express' {
    export interface Request {
        body: any;
    }

    export interface Response {
        json(data: any): void;
        sendStatus(code: number): void;
    }

    interface Express {
        use(middleware: any): void;
        post(path: string, handler: any): void;
        get(path: string, handler: any): void;
        listen(port: string | number, callback?: () => void): void;
    }

    interface ExpressStatic {
        (): Express;
        json(): any;
    }

    const express: ExpressStatic;
    export default express;
    export { Request, Response };
}

declare module 'dotenv' {
    export function config(): void;
}

export {};
