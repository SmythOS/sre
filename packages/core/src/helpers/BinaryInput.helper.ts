import axios from 'axios';
import mime from 'mime';
import { fileTypeFromBuffer } from 'file-type';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';

import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { getSizeFromBinary, isUrl, uid, getBase64FileInfo, getMimeType } from '@sre/utils';
import config from '@sre/config';
export class BinaryInput {
    private size: number;
    private url: string;
    private _ready;
    private _readyPromise;
    private _source: Buffer;
    private _uploading: boolean = false;

    constructor(
        data: BinaryInput | Buffer | ArrayBuffer | Blob | string | Record<string, any>,
        private _name?: string,
        public mimetype?: string,
        private candidate?: IAccessCandidate
    ) {
        if (!_name) _name = uid();
        this._name = _name;
        //this._source = data;

        this.load(data, _name, mimetype, candidate);
    }

    public async ready() {
        if (this._ready) return true;

        if (!this._readyPromise) {
            this._readyPromise = new Promise((resolve) => {
                const maxWait = 10000;
                const interval = setInterval(() => {
                    if (this._ready) {
                        clearInterval(interval);
                        resolve(true);
                    }
                    if (maxWait <= 0) {
                        clearInterval(interval);
                        resolve(false);
                    }
                }, 100);
            });
        }

        return this._readyPromise;
    }

    private async load(data, name: string, mimetype?: string, candidate?: IAccessCandidate) {
        //assume the mimetype from the provided name
        const ext: any = name.split('.')?.length > 1 ? name.split('.').pop() : '';
        // Need to set mimetype empty string if no extension is found, setting default mimetype to 'application/octet-stream' lead wrong direction when try to get the mimetype from base64 or buffer data (as it's not accurate all the time)
        this.mimetype = mimetype || mime.getType(ext) || '';
        this.url = ``;

        if (typeof data === 'object' && data.url && data.mimetype && data.size) {
            this.mimetype = data.mimetype;
            this.size = data.size;
            this.url = data.url;

            const ext = mime.getExtension(this.mimetype);
            if (!this._name.endsWith(`.${ext}`)) this._name += `.${ext}`;

            if (candidate) {
                this._source = await SmythFS.Instance.read(this.url, candidate).finally(() => {
                    this._ready = true;
                });
            } else {
                this._ready = true;
            }
            return;
        }

        if (typeof data === 'string' && data.startsWith('smythfs://')) {
            this.url = data;
            if (candidate) {
                try {
                    this._source = await SmythFS.Instance.read(this.url, candidate);
                    this.mimetype = await getMimeType(this._source);
                    this.size = this._source.byteLength;

                    if (!this.mimetype) {
                        this.mimetype = mime.getType(this.url) || mime.getType(this._name) || '';
                    }

                    const ext = mime.getExtension(this.mimetype);
                    if (!this._name.endsWith(`.${ext}`)) this._name += `.${ext}`;
                } finally {
                    this._ready = true;
                }
            } else {
                //try to guess the mimetype from the url extension
                const ext = this.url.split('.').pop();
                this.mimetype = mime.getType(ext) || '';
                this._ready = true;
            }
            return;
        }

        if (isUrl(data)) {
            try {
                const response = await axios({
                    method: 'get',
                    url: data,
                    responseType: 'arraybuffer', // Important for handling binary data
                });

                this.size = response.data.byteLength;
                this._source = Buffer.from(response.data, 'binary');

                let mimetype = response.headers?.['content-type'] || '';

                // Try to get the file extension from the URL
                const urlPath = new URL(data).pathname;
                let extension = urlPath.split('.')?.length > 1 ? urlPath.split('.').pop() : '';

                // When content-type header is missing or invalid, try to determine mime type from file extension
                if (!mimetype || mimetype.startsWith('binary/octet-stream')) {
                    mimetype = extension ? mime.getType(extension) : '';
                }

                // If we couldn't determine the mime type from headers or file extension, try detecting it from the actual file content
                if (!mimetype) {
                    const type = await fileTypeFromBuffer(this._source);
                    mimetype = type?.mime || '';
                }

                this.mimetype = mimetype;

                extension = extension || mime.getExtension(this.mimetype);
                if (!this._name.endsWith(`.${extension}`)) this._name += `.${extension}`;
            } catch (error) {
                console.error('Error loading binary data from url:', data.url, error);
            }

            //this._source = data.url;

            this._ready = true;
            return;
        }

        // console.log('>>>>>>>>>>>>>>>>>>> is base64 file ?', isBase64DataUrl(data));
        const base64FileInfo = await getBase64FileInfo(data);
        if (base64FileInfo) {
            // If the MIME type is already set, it's safe to use it,
            // as determining the MIME type from the base64 string is not always accurate, specially when it's not a base64 URL
            if (!this.mimetype) {
                this.mimetype = base64FileInfo.mimetype;
            }
            this.size = base64FileInfo.size;
            this._source = Buffer.from(base64FileInfo.data, 'base64');

            const ext = mime.getExtension(this.mimetype);
            if (!this._name.endsWith(`.${ext}`)) this._name += `.${ext}`;

            this._ready = true;
            return;
        }

        if (typeof data === 'string') {
            this._source = Buffer.from(data);
            this.size = data.length;
            this.mimetype = 'text/plain';
            if (!this._name.endsWith(`.txt`)) this._name += `.txt`;

            this._ready = true;
            return;
        }

        //this.size = getSizeFromBinary(data);
        // //try to enforce the mimetype from the provided data
        // if (Buffer.isBuffer(data)) {
        //     const fileType = await FileType.fileTypeFromBuffer(data);
        //     this.mimetype = fileType.mime;
        //     const ext = mime.getExtension(this.mimetype);
        //     if (!this._name.endsWith(`.${ext}`)) this._name += `.${ext}`;

        //     this._ready = true;
        //     return;
        // }
        //try to enforce the mimetype from the provided data
        if (Buffer.isBuffer(data)) {
            this._source = data;
            this.size = getSizeFromBinary(data);
            // If the MIME type is already set, it's safe to use it,
            // as determining the MIME type from the buffer is not always accurate.
            if (!this.mimetype) {
                this.mimetype = await getMimeType(data);
            }
            const ext = mime.getExtension(this.mimetype);
            if (!this._name.endsWith(`.${ext}`)) this._name += `.${ext}`;
            this._ready = true;
            return;
        }

        if (data instanceof Blob) {
            this._source = Buffer.from(await data.arrayBuffer());
            this.size = data.size;
            this.mimetype = data.type;
            this._ready = true;
            return;
        }
    }

    private async getUrlInfo(url) {
        try {
            // Before we had axios.head(), head method does not work for all URLs
            const response = await axios.get(url);
            const contentType = response.headers['content-type'];
            const contentLength = response.headers['content-length'];
            return { contentType, contentLength };
        } catch (error) {
            return { contentType: '', contentLength: 0 };
        }
    }

    public static from(source, name?: string, mimetype?: string, candidate?: IAccessCandidate) {
        if (source instanceof BinaryInput) return source;
        return new BinaryInput(source, name, mimetype, candidate);
    }

    public async upload(candidate: IAccessCandidate, ttl?: number) {
        await this.ready();
        if (this._uploading) return;

        try {
            this._uploading = true;
            if (!this.url) {
                const accountConnector = ConnectorService.getAccountConnector();
                const teamId = await accountConnector.getCandidateTeam(candidate);

                this.url = `smythfs://${teamId}.team/${candidate.id}/_temp/${this._name}`;
                await SmythFS.Instance.write(this.url, this._source, candidate, undefined, ttl);
                this._uploading = false;
            } else {
                this._uploading = false;
            }
        } catch (error) {
            console.error('Error uploading binary data:', error);
            this._uploading = false;
        }
    }

    public async getJsonData(candidate: IAccessCandidate, ttl?: number) {
        await this.upload(candidate, ttl);
        return {
            mimetype: this.mimetype,
            size: this.size,
            url: this.url,
            name: this._name,
        };
    }

    public async readData(candidate: IAccessCandidate) {
        await this.ready();
        if (!this.url) {
            throw new Error('Binary data not ready');
        }
        const data = await SmythFS.Instance.read(this.url, candidate);
        return data;
    }

    public async getName() {
        await this.ready();
        return this._name;
    }

    public async getBuffer() {
        await this.ready();

        return this._source;
    }

    /**
     * Creates a read stream from the binary data.
     * Uses temporary files to reduce memory usage for large files.
     */
    public async getReadStream(): Promise<Readable> {
        await this.ready();

        // * Direct in-memory stream; faster but uses memory for the entire file.
        return Readable.from(this._source);

        // * Uses temp files (slower but memory-efficient). Disabled in favor of simpler in-memory approach.
        // let tempDir: string;

        // try {
        //     tempDir = path.join(config.env.DATA_PATH, 'tmp');
        //     // Test if we can access/write to this directory
        //     if (!fs.existsSync(tempDir)) {
        //         fs.mkdirSync(tempDir, { recursive: true });
        //     }
        // } catch (error) {
        //     // Last resort: try to use an in-memory stream instead of a temp file
        //     console.warn('Failed to access temporary directories:', error, error);
        //     return Readable.from(this._source);
        // }

        // // Generate a unique temp file name
        // const tempFilePath = path.join(tempDir, `${Date.now()}-${this._name || uid()}`);

        // try {
        //     // Write the buffer to a temp file
        //     fs.writeFileSync(tempFilePath, this._source);

        //     // Create cleanup handler to remove temp file when stream ends
        //     const stream = fs.createReadStream(tempFilePath);
        //     stream.on('close', () => {
        //         try {
        //             fs.unlinkSync(tempFilePath);
        //         } catch (e) {
        //             console.warn('Failed to clean up temporary file:', tempFilePath, e);
        //         }
        //     });

        //     return stream;
        // } catch (writeError) {
        //     // If we can't write to the temp file, fall back to an in-memory stream
        //     console.warn('Failed to write temporary file:', writeError);
        //     return Readable.from(this._source);
        // }
    }
}
