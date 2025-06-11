import { Agent, Component, Model } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
    //#region
    /*
    In this example we will create a the following workflow that uses a skill to get the market data of a coin.

    == MARKET DATA WORKFLOW 

    +--[ mdSkill ]--+               +---[ mdAPICall ]--+    (Resp.market_data)   +---[ mdOutput ]---+
    |               |               |                  | ----------------------->|                  |
    |               |               |                  |                         |                  |
    | Input:        |               | URL: coingecko   |                         | Output:          |
    | * coin_id     |   (coin_id)   | /coins/{coin_id} |                         | * MarketData     |
    |               |---+---------->| ?market_data=true|                         | * coin_id        |
    +---------------+   |           +------------------+                         +------------------+
                        |                                                             ^
                        +-------------------------------------------------------------+
                                                    (coin_id)


    */
    //#endregion

    const agent = new Agent({
        name: 'SRE Assistant',
        behavior: 'You are a crypto price tracker. You are given a coin id and you need to get the price of the coin in USD',
        model: 'gpt-4o',
    });

    //#region [ Market Data Skill ] ================
    //this skill is used to get comprehensive market data of a coin including price, market cap, volume, etc.

    //Creating a market data skill entry
    const mdSkill = agent.addSkill({
        name: 'MarketData',
        description: 'Use this skill to get comprehensive market data and statistics for a cryptocurrency',
    });

    //Defining the inputs of the skill
    mdSkill.in({
        coin_id: {
            type: 'string',
            description: 'The coin id to get the comprehensive market data of',
            required: true,
        },
    });

    //Creating an API call component for market data
    //note the use of {{coin_id}} to dynamically pass the coin id to the API call
    //this endpoint returns comprehensive market data including current price, market cap, volume, price changes, etc.
    const mdAPICall = Component.APICall({
        url: 'https://api.coingecko.com/api/v3/coins/{{coin_id}}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false',
        method: 'GET',
    });

    //Connecting the skill output "coin_id" to the API call input "coin_id"
    mdAPICall.in({ coin_id: mdSkill.out.coin_id });

    //Creating an API output component for market data : this component allows formatting the outputs
    //and also selecting which outputs are returned back to the agent.
    //The response from marketDataAPICall contains a comprehensive json object with lots of data
    // (see below how we filter the response to only return the market_data section)
    const mdOutput = Component.APIOutput({ format: 'minimal' });

    //Here we return an entry called "MarketData" that contains only the market_data section from the API response
    //marketDataAPICall.out.Response contains the full response json, but we're only redirecting the market_data field to the output
    mdOutput.in({ MarketData: mdAPICall.out.Response.market_data });

    //and we can also return the coin id from the market data skill component
    mdOutput.in({ coin_id: mdSkill.out.coin_id });

    //#endregion

    const result = await agent.prompt('Hello, what is the price of bitcoin in USD');

    //const result2 = await agent.prompt('Give me a summary of bitcoin market data');

    // const chat = agent.chat();
    // const result = await chat.prompt('Hello, my name is Aladdin what is the capital of France');

    // const result2 = await chat.prompt('do you remember my name?');

    console.log(result);
    //console.log(result2);
}

main();
