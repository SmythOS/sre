//experimental code

import blessed from 'blessed';
import dotenv from 'dotenv';
import { GlobalKeyboardListener } from 'node-global-key-listener';
import { Conversation, SmythRuntime } from '../../../dist/index.dev.js';
dotenv.config();
process.env.LOG_LEVEL = '';
console.log(process.env);

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: process.env.REDIS_SENTINEL_HOSTS,
            name: process.env.REDIS_MASTER_NAME || '',
            password: process.env.REDIS_PASSWORD || '',
        },
    },
    Vault: {
        Connector: 'JSONFileVault',
        Settings: {
            file: './tests/data/vault.json',
        },
    },
    AgentData: {
        Connector: 'CLI',
    },
});

const v = new GlobalKeyboardListener();

let ctrl = false;
let shift = false;

const screen = blessed.screen({
    smartCSR: true,
    title: 'Message Input App',
});

// Create a scrollable output box
const outputBox = blessed.log({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: '60%',
    border: {
        type: 'line',
    },
    scrollbar: {
        ch: ' ',
        track: {
            bg: 'yellow',
        },
        style: {
            inverse: true,
        },
    },
    alwaysScroll: true,
    scrollable: true,
    keys: true,
    mouse: true,
    vi: true,
    tags: true, // Enable markup tags
});

// Create a spinner box
const spinnerBox = blessed.box({
    parent: screen,
    top: '60%',
    left: 'center',
    width: '100%',
    height: '10%',
    border: {
        type: 'line',
    },
    align: 'center',
    valign: 'middle',
    content: '',
});

// Create a scrollable input box
const inputBox = blessed.textarea({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '30%',
    border: {
        type: 'line',
    },
    scrollbar: {
        ch: ' ',
        track: {
            bg: 'yellow',
        },
        style: {
            inverse: true,
        },
    },
    keys: true,
    mouse: true,
    vi: true,
    inputOnFocus: true,
});

screen.render();

v.addListener(function (e, down) {
    //console.log(e);
    if (e.rawKey.name === 'LCONTROL' || e.rawKey.name === 'RCONTROL') {
        ctrl = e.state === 'DOWN';
    }
    if (e.rawKey.name === 'LSHIFT' || e.rawKey.name === 'RSHIFT') {
        shift = e.state === 'DOWN';
    }
    if (e.rawKey.name === 'RETURN' && e.state === 'DOWN' && ctrl) {
        //check if inputBox is focused
        if (inputBox.focused) {
            submit();
        }
    }
});

inputBox.key('C-enter', function (ch, key) {
    console.log('ctrl+enter');
});
// Handle input in the input box
inputBox.key('enter', function (ch, key) {
    if (shift) {
        submit();
    } else {
        //inputBox.insertLine(1, '');
        screen.render();
    }
});

// Focus the input box
inputBox.focus();

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'C-c'], function (ch, key) {
    return process.exit(0);
});
function status(message) {
    spinnerBox.setContent(message);
    screen.render();
}
async function submit() {
    const message = inputBox.getValue().trim();
    if (message.length > 0) {
        const currentContent = outputBox.getContent();
        const content = `\n{blue-fg}Me:{/blue-fg}:${message}`;
        outputBox.setContent(`${currentContent}${content}`);

        status('Processing...');

        screen.render();

        await conv.streamPrompt(message);

        status('');

        spinnerBox.setContent('');
        inputBox.clearValue();
        inputBox.focus();
        screen.render();
    }
}

const specUrl = 'https://closz0vak00009tsctm7e8xzs.agent.stage.smyth.ai/api-docs/openapi.json';

const conv = new Conversation('gpt-3.5-turbo', specUrl);

let streamResult = '';
conv.on('beforeToolCall', (args) => {
    //console.log('beforeToolCall', args);
});
conv.on('content', (content) => {
    //console.log('data', content);
    streamResult += content;

    const currentContent = outputBox.getContent();
    outputBox.setContent(`${currentContent}${content}`);
    screen.render();
});
conv.on('start', (content) => {
    const currentContent = outputBox.getContent();
    outputBox.setContent(`${currentContent}\n{green-fg}Assistant:{/green-fg} `);
    screen.render();
});
conv.on('end', (content) => {
    outputBox.log('');

    screen.render();
});

conv.on('beforeToolCall', (info) => {
    try {
        status('Using tool : ' + info.tool.name);
    } catch (error) {}
});
conv.on('beforeToolCall', (info) => {
    try {
        status('Got response from tool : ' + info.tool.name);
    } catch (error) {}
});

//const result = await conv.streamPrompt('Do we have a documentation about logto ?');

// import readline from 'readline';
// import { stdin as input, stdout as output } from 'process';
// import { GlobalKeyboardListener } from 'node-global-key-listener';
// const v = new GlobalKeyboardListener();

// let ctrl = false;
// let shift = false;
// //Log every key that's pressed.
// v.addListener(function (e, down) {
//     if (e.rawKey.name == 'LCONTROL' || e.rawKey.name == 'RCONTROL') {
//         ctrl = e.state == 'DOWN';
//     }
//     if (e.rawKey.name == 'LSHIFT' || e.rawKey.name == 'RSHIFT') {
//         shift = e.state == 'DOWN';
//     }
//     //console.log(shift);
//     //console.log(e, `${e.name} ${e.state == 'DOWN' ? 'DOWN' : 'UP  '} [${e.rawKey._nameRaw}]`);
// });
// const rl = readline.createInterface({ input, output });

// let isMultilineMode = true; // flag to check if the user is in multi-line mode
// let messages = []; // to store lines of messages

// console.log('Enter your message. hit ctrl+enter to submit');

// rl.on('line', (line) => {
//     //detect enter key

//     if (ctrl) {
//         messages.push(line);
//         const message = messages.join('\n');
//         console.log(`Submitted Message:\n${message}`);
//         messages = [];
//         return;
//     } else {
//         messages.push(line);
//         return;
//     }
// });
