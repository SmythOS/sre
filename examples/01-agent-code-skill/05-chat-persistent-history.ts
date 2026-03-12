import { Agent, Chat, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import * as readline from 'readline';

async function main() {
    const agent = new Agent({
        // Fixed agent ID — required for persistence to know who owns the data
        id: 'crypto-market-assistant',
        name: 'CryptoMarket Assistant',
        behavior: 'You are a crypto price tracker. You are given a coin id and you need to get the price of the coin in USD',
        model: 'gpt-4o',
    });

    agent.addSkill({
        name: 'SearchCoin',
        description: 'Use this skill to search for a cryptocurrency by name',
        process: async ({ search_term }) => {
            const url = `https://api.coingecko.com/api/v3/search/trending?query=${search_term}`;
            const response = await fetch(url);
            const data = await response.json();
            return data.coins;
        },
    });

    agent.addSkill({
        name: 'Price',
        description: 'Use this skill to get the price of a cryptocurrency',
        process: async ({ coin_id }) => {
            const url = `https://api.coingecko.com/api/v3/coins/${coin_id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
            const response = await fetch(url);
            const data = await response.json();
            return data.market_data.current_price;
        },
    });

    // Fixed chat ID — same session resumes every time the script runs
    const chat = agent.chat({ id: 'crypto-chat-session-001', persist: true });

    await chat.ready;

    // Display the last 10 messages from the previous session before starting
    const history = await chat.getContextWindow({ count: 10 });

    if (history.length > 0) {
        console.log(chalk.cyan('\n── Resuming conversation (last messages) ──'));
        history
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .forEach((m) => {
                const label = m.role === 'user' ? chalk.blue('You:') : chalk.green('Assistant:');
                const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                console.log(`${label} ${text}`);
            });
        console.log(chalk.cyan('───────────────────────────────────────\n'));
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: '),
    });

    console.log(chalk.green('🚀 Crypto Market Assistant is ready!'));
    console.log(chalk.yellow('Ask me about cryptocurrency prices, search for coins, or get market data.'));
    console.log(chalk.gray('Type "exit" or "quit" to end the conversation.\n'));

    rl.on('line', (input) => handleUserInput(input, rl, chat));

    rl.on('close', () => {
        console.log(chalk.gray('Chat session ended.'));
        process.exit(0);
    });

    rl.prompt();
}

main();

async function handleUserInput(input: string, rl: readline.Interface, chat: Chat) {
    if (input.toLowerCase().trim() === 'exit' || input.toLowerCase().trim() === 'quit') {
        console.log(chalk.green('👋 Goodbye!'));
        rl.close();
        return;
    }

    if (input.trim() === '') {
        rl.prompt();
        return;
    }

    try {
        console.log(chalk.gray('Assistant is thinking...'));

        const streamChat = await chat.prompt(input).stream();

        process.stdout.write('\r');
        let first = true;

        streamChat.on(TLLMEvent.Content, (content) => {
            if (first) {
                content = chalk.green('🤖 Assistant: ') + content;
                first = false;
            }
            process.stdout.write(chalk.white(content));
        });

        streamChat.on(TLLMEvent.End, () => {
            console.log('\n');
            rl.prompt();
        });

        streamChat.on(TLLMEvent.Error, (error) => {
            console.error(chalk.red('❌ Error:', error));
            rl.prompt();
        });

        streamChat.on(TLLMEvent.ToolCall, (toolCall) => {
            console.log(
                chalk.yellow('[Calling Tool]'),
                toolCall?.tool?.name,
                chalk.gray(typeof toolCall?.tool?.arguments === 'object' ? JSON.stringify(toolCall?.tool?.arguments) : toolCall?.tool?.arguments)
            );
        });
    } catch (error) {
        console.error(chalk.red('❌ Error:', error));
        rl.prompt();
    }
}
