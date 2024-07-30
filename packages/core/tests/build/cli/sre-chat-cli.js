import blessed from 'blessed';
import contrib from 'blessed-contrib';
import dotenv from 'dotenv';
import { GlobalKeyboardListener } from 'node-global-key-listener';
import { Conversation, SmythRuntime, ConnectorService, config } from '../../../dist/index.dev.js';

dotenv.config();
process.env.LOG_LEVEL = 'debug';

const sre = SmythRuntime.Instance.init({
    CLI: {
        Connector: 'CLI',
    },
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

let conv;
const boxFocusColor = '#00967f';
const kbListener = new GlobalKeyboardListener();

let ctrl = false;
let shift = false;

const screen = blessed.screen({
    smartCSR: true,
    title: 'Smyth Terminal Chat',
    mouse: true,
});
// Create a grid layout using blessed-contrib
const grid = new contrib.grid({
    rows: 20,
    cols: 20,
    screen: screen,
});

function calculateHeight(percentage, minus) {
    return `100%-${Math.round(((100 - percentage) / 100) * screen.height)}-${minus}`;
}
// Create a scrollable output box
const outputBox = blessed.log({
    parent: screen,
    focusable: true,
    top: 0,
    left: 0,
    width: '100%',
    height: '100%-11', //Math.floor((screen.height - 1) * 0.7),
    label: ' {bold}Smyth Terminal Chat{/bold} ', // Title with styling
    border: {
        type: 'line',
        fg: 'white', // Initial border color
    },
    scrollbar: {
        ch: ' ',
        track: {
            bg: '#00cbab',
        },
        style: {
            inverse: true,
        },
    },
    alwaysScroll: true,
    scrollable: true,
    keys: true,
    mouse: true,
    vi: false,
    tags: true, // Enable markup tags
    scrollback: 1000, // Number of lines to store for scrollback
});

// Focus the output box on mouse click
outputBox.on('click', function () {
    inputBox.style.border.fg = 'white';
    outputBox.style.border.fg = 'white';

    outputBox.style.border.fg = boxFocusColor;

    outputBox.focus();
    screen.render();
});

// Create a scrollable input box
const inputBox = blessed.textarea({
    parent: screen,
    bottom: 1,
    left: 0,
    width: '100%',
    height: 9,
    border: {
        type: 'line',
        fg: 'white', // Initial border color
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
    vi: false,
    inputOnFocus: true,
    scrollback: 300, // Number of lines to store for scrollback
});

inputBox.on('click', function () {
    inputBox.style.border.fg = 'white';
    outputBox.style.border.fg = 'white';

    inputBox.style.border.fg = boxFocusColor;

    inputBox.focus();
    screen.render();
});

// Create a spinner box
const infoBox = blessed.box({
    parent: screen,
    bottom: 10,
    left: 'center',
    width: '100%',
    height: 1, // Height set to one line
    // border: {
    //     type: 'line',
    //     fg: 'white',
    // },
    align: 'left',
    valign: 'middle',
    content: '',
    style: {
        fg: 'white', // Text color
        bg: 'black', // Background color
    },
});
// Create a status bar box
const statusBar = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 1,
    tags: true,
    // border: {
    //     type: 'line',
    //     fg: 'white',
    // },
    style: {
        fg: 'black',
        bg: 'black', // Background color for the status bar
    },
    content:
        '{#00cbab-bg} Ctrl+Enter {/#00cbab-bg}{#00967f-bg}Submit Message {/#00967f-bg} {#00cbab-bg} Ctrl+UP/DOWN {/#00cbab-bg}{#00967f-bg}Switch Focus {/#00967f-bg} {#00cbab-bg} UP/DOWN {/#00cbab-bg}{#00967f-bg}Scroll {/#00967f-bg}',
    align: 'left',
});

outputBox.on('focus', function () {
    inputBox.style.border.fg = 'white';
    outputBox.style.border.fg = 'white';

    outputBox.style.border.fg = boxFocusColor;

    screen.render();
});

outputBox.on('blur', function () {
    inputBox.style.border.fg = 'white';
    outputBox.style.border.fg = 'white';
    screen.render();
});
inputBox.on('focus', function () {
    inputBox.style.border.fg = 'white';
    outputBox.style.border.fg = 'white';
    inputBox.style.border.fg = boxFocusColor;
    screen.render();
});
inputBox.on('blur', function () {
    inputBox.style.border.fg = 'white';
    outputBox.style.border.fg = 'white';
    screen.render();
});

screen.render();

kbListener.addListener(function (e, down) {
    //status(`${e.name} ${e.state === 'DOWN' ? 'DOWN' : 'UP  '} [${e.rawKey._nameRaw}]`);

    if (!ctrl) {
        if (e.rawKey.name === 'UP' && e.state === 'DOWN') {
            if (inputBox.style.border.fg == boxFocusColor) inputBox.scroll(-1);
            else outputBox.scroll(-1);
        }
        if (e.rawKey.name === 'DOWN' && e.state === 'DOWN') {
            if (inputBox.style.border.fg == boxFocusColor) inputBox.scroll(1);
            else outputBox.scroll(1);
        }
    }
    if (e.rawKey.name === 'LCONTROL' || e.rawKey.name === 'RCONTROL') {
        ctrl = e.state === 'DOWN';
    }
    if (e.rawKey.name === 'LSHIFT' || e.rawKey.name === 'RSHIFT') {
        shift = e.state === 'DOWN';
    }
    if (e.rawKey.name === 'RETURN' && e.state === 'DOWN' && ctrl) {
        if (inputBox.focused) {
            submit();
        }
    }

    if (ctrl && (e.rawKey.name === 'UP' || e.rawKey.name === 'DOWN') && e.state === 'DOWN') {
        if (inputBox.style.border.fg == boxFocusColor) outputBox.focus();
        else inputBox.focus();
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
        screen.render();
    }
});

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'C-c'], function (ch, key) {
    return process.exit(0);
});

// Handle mouse wheel scrolling
screen.on('mouse', function (data) {
    if (data.action === 'wheeldown') {
        outputBox.scroll(1);
        screen.render();
    } else if (data.action === 'wheelup') {
        outputBox.scroll(-1);
        screen.render();
    }
});

async function submit() {
    const message = inputBox.getValue().trim();
    if (message.length > 0) {
        if (message == '/pic') {
            const picture = grid.set(5, 0, 5, 20, contrib.picture, {
                file: './tests/data/logo.png',
                rows: 20,
                cols: 20,
                onReady: () => screen.render(),
            });
            screen.render();
            return;
        }

        const currentContent = outputBox.getContent();
        const content = `\n{blue-fg}Me:{/blue-fg}${message}`;
        outputBox.setContent(`${currentContent}${content}`);
        inputBox.clearValue();
        animaStatus('Thinking');

        screen.render();

        await conv.streamPrompt(message);

        status('');

        infoBox.setContent('');
        inputBox.clearValue();
        inputBox.focus();
        screen.render();
    }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let statusAnimItv;
function animaStatus(message) {
    if (statusAnimItv) clearInterval(statusAnimItv);
    let i = 0;
    statusAnimItv = setInterval(() => {
        infoBox.setContent(`${message} ${Array(i).fill('.').join('')}`);
        screen.render();
        i++;
        if (i > 3) {
            i = 0;
        }
    }, 300);
    return statusAnimItv;
}

function status(message) {
    if (statusAnimItv) clearInterval(statusAnimItv);
    infoBox.setContent(message);
    screen.render();
}

async function main() {
    try {
        config.env.LOG_LEVEL = 'none';
        const cliConnector = ConnectorService.getCLIConnector();

        const specUrl = cliConnector.params?.agent;
        conv = new Conversation('gpt-4o', specUrl, { maxContextSize: 128000, maxOutputTokens: 4096 });

        let streamResult = '';
        conv.on('beforeToolCall', (args) => {});

        conv.on('content', (content) => {
            streamResult += content;

            const currentContent = outputBox.getContent();
            outputBox.setContent(`${currentContent}${content}`);
            screen.render();
        });

        conv.on('start', (content) => {
            animaStatus('Writing');
            const currentContent = outputBox.getContent();
            outputBox.setContent(`${currentContent}\n{green-fg}Assistant:{/green-fg} `);
            screen.render();
        });

        conv.on('end', (content) => {});

        conv.on('beforeToolCall', (info) => {
            try {
                animaStatus('Using tool : ' + info.tool.name);
                const currentContent = outputBox.getContent();
                let newContent = currentContent;
                newContent +=
                    '{magenta-fg}' +
                    '\n─────────────────────────────────────\n' +
                    `Calling tool ${JSON.stringify(info.tool, null, 2)}` +
                    '\n_____________________\n' +
                    '{/magenta-fg}';
                outputBox.setContent(newContent);
            } catch (error) {}
        });

        conv.on('afterToolCall', async (info) => {
            try {
                status('Got response from tool : ' + info.tool.name);
                await delay(300);
                animaStatus('Writing');
            } catch (error) {}
        });

        //await conv.streamPrompt('Say Hi and Present yourself');

        //status('');

        inputBox.focus();
    } catch (error) {
        console.error(error);
    } finally {
        await sre._stop();
    }
}

main();
