import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythFS } from '@sre/IO/Storage.service/SmythFS.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import axios from 'axios';
import * as FileType from 'file-type';
import mime from 'mime';
import { getSizeFromBinary, isUrl, uid } from '../utils';
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
        const ext: any = name.split('.').pop();
        this.mimetype = mimetype || mime.getType(ext) || 'application/octet-stream';
        this.url = ``;

        if (typeof data === 'object' && data.url && data.mimetype && data.size) {
            this.mimetype = data.mimetype;
            this.size = data.size;
            this.url = data.url;
            this._ready = true;
            if (candidate) {
                this._source = await SmythFS.Instance.read(this.url, candidate);
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

        // console.log('>>>>>>>>>>>>>>>>>>> is base64 file ?', isDataUrl(data));
        const base64FileInfo = await this.getBase64FileInfo(data);
        if (base64FileInfo) {
            this.mimetype = base64FileInfo.mimetype;
            this.size = base64FileInfo.size;
            this._source = base64FileInfo.data;
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
            const fileType = await FileType.fileTypeFromBuffer(data);
            this.mimetype = fileType.mime;
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
            const response = await axios.head(url);
            const contentType = response.headers['content-type'];
            const contentLength = response.headers['content-length'];
            return { contentType, contentLength };
        } catch (error) {
            return { contentType: '', contentLength: 0 };
        }
    }
    private async getBase64FileInfo(data: string) {
        //first check if it's a base64 url format
        const validUrlFormatRegex = /data:[^;]+;base64,[A-Za-z0-9+\/]*(={0,2})?$/gm;
        if (!validUrlFormatRegex.test(data)) {
            return null;
        }

        const base64Data = data.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const size = buffer.byteLength;
        const filetype = await FileType.fileTypeFromBuffer(buffer);

        return { size, data: buffer, mimetype: filetype?.mime || '' };
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
