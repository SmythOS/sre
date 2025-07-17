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

        const { isolate, context, jail } = await setupIsolate();
        const remoteUrls = await extractFetchUrls(code);
        for (const url of remoteUrls) {
            const remoteCode = await fetchCodeFromCDN(url);
            await context.eval(`${remoteCode}`);
        }

        const executionCode = `
    (async () => {
        ${code}
        globalThis.__finalResult = result;
    })();
        `;

        // Execute the original code
        const executeScript = await isolate.compileScript(executionCode).catch((err) => {
            console.error(err);
            return { error: 'Compile Error - ' + err.message };
        });
        if ('error' in executeScript) {
            throw new Error(executeScript.error);
        }

        await executeScript.run(context).catch((err) => {
            console.error(err);
            throw new Error('Run Error - ' + err.message);
        });

        // Try to get the result from the global variable first, then fallback to 'result'
        let rawResult = await context.eval('globalThis.__finalResult').catch((err) => {
            console.error('Failed to get __finalResult:', err);
            return null;
        });

        if (rawResult?.error) {
            throw new Error(rawResult.error);
        }
        return { Output: rawResult };
    } catch (error) {
        console.error(error);
        throw new Error(error.message);
    }
}

function getParametersString(parameters: string[], inputs: Record<string, any>) {
    let params = [];
    for (const parameter of parameters) {
        if (typeof inputs[parameter] === 'string') {
            params.push(`'${inputs[parameter]}'`);
        } else {
            params.push(`${inputs[parameter]};`);
        }
    }
    return params.join(',');
}

export function generateExecutableCode(code: string, parameters: string[], inputs: Record<string, any>) {
    const executableCode = `
    ${code}
        const result = await main(${getParametersString(parameters, inputs)});
    `
    return executableCode;
}