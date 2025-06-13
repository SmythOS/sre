import { Agent, Chat, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import util from 'util';
import * as readline from 'readline';

async function main() {
    const agent = new Agent({
        //IMPORTANT !! : in order to persist chat, you need to set an id for your agent
        //in fact, due to SRE data isolaton we need to identify the owner of persisted data, in this case the agent
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

    agent.addSkill({
        name: 'MarketData',
        description: 'Use this skill to get comprehensive market data and statistics for a cryptocurrency',
        process: async ({ coin_id }) => {
            const url = `https://api.coingecko.com/api/v3/coins/${coin_id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
            const response = await fetch(url);
            const data = await response.json();
            return data;
        },
    });

    //we call the chat explicitly with persistance enabled
    const chat = agent.chat({ id: 'my-chat-0001', persist: true });
    //we can also use a short syntax
    //const chat = agent.chat('my-chat-0001');
    //if you supply an id as a string and as a single argument, we will implicitly try to enable persistance

    // Create readline interface for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: '),
    });

    console.log(chalk.green('🚀 Crypto Market Assistant is ready!'));
    console.log(chalk.yellow('Ask me about cryptocurrency prices, search for coins, or get market data.'));
    console.log(chalk.gray('Type "exit" or "quit" to end the conversation.\n'));

    // Set up readline event handlers
    rl.on('line', (input) => handleUserInput(input, rl, chat));

    rl.on('close', () => {
        console.log(chalk.gray('Chat session ended.'));
        process.exit(0);
    });

    // Start the interactive chat
    rl.prompt();
}

main();

// Function to handle user input and chat response
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

        // Send message to the agent and get response
        const streamChat = await chat.prompt(input).stream();

        // Clear the current line and move to a new line for the response
        process.stdout.write('\r');
        let first = true;

        streamChat.on(TLLMEvent.Content, (content) => {
            if (first) {
                content = chalk.green('🤖 Assistant: ') + content;
                first = false;
            }
            // Write content without interfering with readline
            process.stdout.write(chalk.white(content));
        });

        streamChat.on(TLLMEvent.End, () => {
            console.log('\n');
            // Restore the prompt after streaming is complete
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
