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

    const chatResult1 = await chat.prompt('Hi, my name is John Smyth. Give me the current price of Bitcoin and Ethereum ?');
    console.log('1>', chatResult1);

    const chatResult2 = await chat.prompt('Do you remember my name ?');
    console.log('2>', chatResult2);

    //As you can see the agent remembers your name in the second response.
    //But in this example the conversation is only persisted during process run time
    //once the process is finished, the conversation is lost

    //==> in the next example we will see how to persist the conversation across process runs
}

main();
