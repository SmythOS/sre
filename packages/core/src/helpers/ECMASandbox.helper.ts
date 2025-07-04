import ivm from 'isolated-vm';
import https from 'https';

function extractFetchUrls(str) {
    const regex = /\/\/@fetch\((https?:\/\/[^\s]+)\)/g;
    let match;
    const urls = [];

    while ((match = regex.exec(str)) !== null) {
        urls.push(match[1]);
    }

    return urls;
}
function fetchCodeFromCDN(url) {
    return new Promise((resolve, reject) => {
        https
            .get(url, (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve(data));
            })
            .on('error', reject);
    });
}

async function setupIsolate() {
    try {
        const isolate = new ivm.Isolate({ memoryLimit: 128 });
        const context = await isolate.createContext();
        const jail = context.global;
        await jail.set('global', jail.derefInto());

        // Define a SafeBuffer object
        const ___internal = {
            b64decode: (str) => Buffer.from(str, 'base64').toString('utf8'),
            b64encode: (str) => Buffer.from(str, 'utf8').toString('base64'),
        };

        //const closureStr =
        const keys = Object.keys(___internal);
        const functions = keys.map((key) => ___internal[key]);
        const closure = `
    globalThis.___internal = {
        ${keys.map((key, i) => `${key}: $${i}`).join(',\n')}
    }`;

        await context.evalClosure(closure, functions);

        return { isolate, context, jail };
    } catch (error) {
        console.error(error);
        throw error;
    }
}

export async function runJs(code: string) {
    try {
        if (!code) {
            throw new Error('No code provided');
        }

        if (!code.endsWith(';')) code += ';';

        let scriptCode = '';
        const { isolate, context, jail } = await setupIsolate();
        const remoteUrls = await extractFetchUrls(code);
        for (const url of remoteUrls) {
            const remoteCode = await fetchCodeFromCDN(url);
            context.eval(`${remoteCode}`);
        }
        const randomId = Math.random().toString(36).substring(2, 15);
        const resId = `res${randomId}`;
        scriptCode = `
      var ${resId}; 
      ${code};

      ${resId} = JSON.stringify(_output); 
      ${resId};
    `;
        const script: any = await isolate.compileScript(scriptCode).catch((err) => {
            console.error(err);
            return { error: 'Compile Error - ' + err.message };
        });
        if (script?.error) {
            throw new Error(script.error);
        }

        const rawResult = await script.run(context).catch((err) => {
            console.error(err);
            return { error: 'Run Error - ' + err.message };
        });
        if (rawResult?.error) {
            throw new Error(rawResult.error);
        }

        // Transfer the result out of the isolate and parse it
        //const serializedResult = rawResult.copySync();
        const Output = JSON.parse(rawResult);

        return Output;
    } catch (error) {
        console.error(error);
        throw new Error(error.message);
    }
}
