import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import axios from 'axios';
import mime from 'mime';
import { getSizeFromBinary, isUrl, uid, getBase64FileInfo, getMimeType } from '@sre/utils';
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

                    const ext = mime.getExtension(this.mimetype);
                    if (!this._name.endsWith(`.${ext}`)) this._name += `.${ext}`;
                } finally {
                    this._ready = true;
                }
            } else {
                this._ready = true;
            }
            return;
        }

        if (isUrl(data)) {
            const info: any = await this.getUrlInfo(data);
            this.mimetype = info.contentType;
            this.size = info.contentLength;
            //this.url = data;

            try {
                const response = await axios({
                    method: 'get',
                    url: data,
                    responseType: 'arraybuffer', // Important for handling binary data
                });

                this._source = Buffer.from(response.data, 'binary');
                this.size = response.data.byteLength;

                const ext = mime.getExtension(this.mimetype);
                if (!this._name.endsWith(`.${ext}`)) this._name += `.${ext}`;
            } catch (error) {
                console.error('Error loading binary data from url:', data.url);
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
        }

        if (data instanceof Blob) {
            this._source = Buffer.from(await data.arrayBuffer());
            this.size = data.size;
            this.mimetype = data.type;
        }

        this._ready = true;
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

    public static from(data, name?: string, mimetype?: string, candidate?: IAccessCandidate) {
        if (data instanceof BinaryInput) return data;
        return new BinaryInput(data, name, mimetype, candidate);
    }

    public async upload(candidate: IAccessCandidate) {
        await this.ready();
        if (this._uploading) return;

        try {
            this._uploading = true;
            if (!this.url) {
                const accountConnector = ConnectorService.getAccountConnector();
                const teamId = await accountConnector.getCandidateTeam(candidate);

                this.url = `smythfs://${teamId}.team/${candidate.id}/_temp/${this._name}`;
                //TODO : set a TTL for temporary files
                //we probably need a write with TTL method in SmythFS
                await SmythFS.Instance.write(this.url, this._source, candidate);
                this._uploading = false;
            }
        } catch (error) {
            console.error('Error uploading binary data:', error);
            this._uploading = false;
        }
    }

    public async getJsonData(candidate: IAccessCandidate) {
        await this.upload(candidate);
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
}
