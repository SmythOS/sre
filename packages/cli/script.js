import fs from 'fs';
import { stdin, stdout } from 'process';

export function askForValues(message, prompts, options = {}) {
    console.log(message);

    const result = {};

    // Save original terminal mode
    const wasRaw = stdin.isRaw;

    for (const [key, label] of Object.entries(prompts)) {
        stdout.write(`${label} `);

        // Set terminal to raw mode to capture Ctrl+C
        stdin.setRawMode(true);
        stdin.resume();

        let value = '';
        let cancelled = false;

        const promptLength = label.length + 1;

        while (true) {
            const buffer = Buffer.alloc(1);
            const bytesRead = fs.readSync(stdin.fd, buffer, 0, 1, null);

            if (bytesRead === 0) break;

            const char = buffer.toString('utf8');
            const code = buffer[0];

            // ✅ Check for Ctrl+C (code 3)
            if (code === 3) {
                cancelled = true;
                break;
            }

            // Check for Enter (code 13 or 10)
            if (code === 13 || code === 10) {
                stdout.write('\n');
                break;
            }

            // Check for Backspace (code 127 or 8)
            if (code === 127 || code === 8) {
                if (value.length > 0) {
                    const oldValue = value;
                    value = value.slice(0, -1);

                    // ✅ Calculate lines needed for old and new values
                    const terminalWidth = stdout.columns || 80;
                    const oldTotalLength = promptLength + oldValue.length;
                    const newTotalLength = promptLength + value.length;
                    const oldLines = Math.ceil(oldTotalLength / terminalWidth);
                    const newLines = Math.ceil(newTotalLength / terminalWidth);

                    // Move to start of first line
                    for (let i = 1; i < oldLines; i++) {
                        stdout.write('\x1b[1A'); // Move up
                    }
                    stdout.write('\r'); // Go to start of line

                    // Clear all old lines
                    for (let i = 0; i < oldLines; i++) {
                        stdout.write('\x1b[K'); // Clear line
                        if (i < oldLines - 1) {
                            stdout.write('\n'); // Move to next line to clear it
                        }
                    }

                    // Move back to start
                    for (let i = 1; i < oldLines; i++) {
                        stdout.write('\x1b[1A');
                    }
                    stdout.write('\r');

                    // Redraw prompt and new value
                    stdout.write(`${label} ${value}`);
                }
                continue;
            }

            // Regular character
            if (code >= 32 && code <= 126) {
                value += char;
                stdout.write(char);
            }
        }

        // Restore terminal mode
        stdin.setRawMode(wasRaw);
        stdin.pause();

        if (cancelled) {
            console.log('\n❌ Operation cancelled by user.');
            process.exit(130);
        }

        if (value.trim()) result[key] = value.trim();
    }

    return result;
}
const apiKeys = askForValues('Please enter the API keys for your LLM providers (Press Enter to skip any key):', {
    openai: 'OpenAI : ',
    anthropic: 'Anthropic : ',
    googleai: 'Google AI : ',
    xai: 'xAI : ',
    groq: 'Groq : ',
});
console.log('\n\n\n', apiKeys, '\n\n\n');
