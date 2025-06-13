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

    //by adding .stream() to the prompt, you get an event emitter that emits the response as it comes in
    const streamResult = await agent
        .prompt(
            'Give me the current price of Bitcoin and Ethereum ? Then analyze Bitcoin market and make an assessment of the crypto market situation'
        )
        .stream();

    //This example shows how to prompt an agent, but prompt()/stream method does not handle a conversation context
    //every agent.prompt() call is independent and does not remember previous messages

    //in the next example we will describe the .chat() method that allows you to handle a chat conversation

    //there are several events you can listen to in order to handle the response

    streamResult.on(TLLMEvent.Content, (content) => {
        process.stdout.write(chalk.white(content));
    });

    streamResult.on(TLLMEvent.End, () => {
        console.log('\n\n');
    });

    streamResult.on(TLLMEvent.Error, (error) => {
        console.error(error);
    });

    streamResult.on(TLLMEvent.ToolCall, (toolCall) => {
        console.log(
            chalk.yellow('[Calling Tool]'),
            toolCall?.tool?.name,
            chalk.gray(typeof toolCall?.tool?.arguments === 'object' ? JSON.stringify(toolCall?.tool?.arguments) : toolCall?.tool?.arguments)
        );
    });

    streamResult.on(TLLMEvent.ToolResult, (toolResult) => {
        console.log(chalk.green('[Tool Result]'), toolResult?.tool?.name);
        console.log(chalk.gray(JSON.stringify(toolResult?.result).substring(0, 100) + '...'));
    });
}

main();
