// IMPORTANT: AWS Secrets Manager Key Naming Convention
//
// The SRE uses a specific naming format to organize secrets in AWS Secrets Manager:
//
// Format: <prefix>/<teamId>/<secretName>
//   - prefix: Namespace for SRE secrets (default: "smythos")
//   - teamId: Team identifier (default: "default")
//   - secretName: Name of the secret (e.g., "openai", "anthropic", "custom-key")
//
// EXAMPLES:
//
// 1. Agent with default team (no teamId specified):
//    Secret id: smythos/default/openai
//
//    const agent = new Agent({
//        id: 'my-agent',
//        behavior: '...',
//        model: 'gpt-4o',
//    });
//
// 2. Agent with custom team:
//    Secret id: smythos/team-id-0001/openai
//
//    const agent = new Agent({
//        id: 'my-agent',
//        behavior: '...',
//        teamId: 'team-id-0001',
//        model: 'gpt-4o',
//    });
//
// TIP: This structure allows you to configure different API keys for different teams,
// enabling multi-tenant configurations and isolated secret management.

import { Agent } from '@smythos/sdk';

import { SRE } from '@smythos/sdk/core';
SRE.init({
    Vault: {
        Connector: 'SecretsManager',
        Settings: {
            region: process.env.AWS_REGION,
            awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
            awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            //The prefix is optional, if you don't provide it, the secret manager will use the default prefix 'smythos'
            //prefix: 'smythos',
        },
    },
});

async function main() {
    //in this example we are using a custom model under .smyth/models/custom.json
    //with the following content :
    // {
    //   "smythos-bedrock": {
    //     "provider": "Bedrock",
    //     "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
    //     "features": ["text"],
    //     "tokens": 200000,
    //     "completionTokens": 4096,
    //     "settings": {
    //       "foundationModel": "anthropic.claude-3-haiku-20240307-v1:0",
    //       "customModel": "",
    //       "region": "us-west-2"
    //     },
    //     "credentials": {
    //       "accessKeyId": "{{KEY(BEDROCK_ACCESS_KEY_ID)}}",
    //       "secretAccessKey": "{{KEY(BEDROCK_SECRET_ACCESS_KEY)}}"
    //     }
    //   }
    // }
    //
    // and in AWS Secrets Manager we have the following secrets :
    // smythos/my-custom-team/BEDROCK_ACCESS_KEY_ID: ...(our aws access key id)
    // smythos/my-custom-team/BEDROCK_SECRET_ACCESS_KEY: ...(our aws secret access key)
    //

    const agent = new Agent({
        id: 'crypto-market-assistant',
        //We are using a custom team here
        //if teamId was not present, the AWS Secrets Manager entries should be under smythos/default/<secretName>
        teamId: 'my-custom-team',

        name: 'CryptoMarket Assistant',
        behavior: 'You are a crypto price tracker. You are given a coin id and you need to get the price of the coin in USD',
        model: 'smythos-bedrock',
    });

    agent.addSkill({
        name: 'MarketData',
        description: 'Use this skill to get comprehensive market data and statistics for a cryptocurrency',
        process: async ({ coin_id }) => {
            const url = `https://api.coingecko.com/api/v3/coins/${coin_id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
            const response = await fetch(url);
            const data = await response.json();
            return data.market_data;
        },
    });

    const promptResult = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');

    console.log(promptResult);
}

main();
