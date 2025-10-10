import { Agent, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import util from 'util';

async function main() {
    const agent = new Agent({
        name: 'CryptoMarket Assistant',
        behavior: 'You are a crypto price tracker. You are given a coin id and you need to get the price of the coin in USD',
        model: 'gpt-4o',
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

    const chat = agent.chat();

    const streamResult = await chat.prompt('Hi, my name is John Smyth. Give me the current price of Bitcoin and Ethereum ?').stream();

    streamResult.on(TLLMEvent.Content, (content) => {
        process.stdout.write(chalk.white(content));
    });

    streamResult.on(TLLMEvent.End, () => {
        console.log('\n\n--- Done ---');
    });

    streamResult.on(TLLMEvent.Error, (error) => {
        console.error(chalk.red('❌ Error:', error));
    });

    streamResult.on(TLLMEvent.ToolCall, (toolCall) => {
        console.log(
            chalk.yellow('[Calling Tool]'),
            toolCall?.tool?.name,
            chalk.gray(typeof toolCall?.tool?.arguments === 'object' ? JSON.stringify(toolCall?.tool?.arguments) : toolCall?.tool?.arguments)
        );
    });

    streamResult.on(TLLMEvent.ToolResult, (toolResult) => {
        console.log(chalk.green('[Tool Result]'), toolResult?.result);
    });
}

main();
