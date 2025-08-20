import { SRE } from '@smythos/sre'; 
import { Agent } from '@smythos/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsPath = path.resolve(__dirname, '../agents-data/models.json');

//We initialize SRE with custom settings of the JSON ModelsProvider, in order to load our additional models
SRE.init({
    ModelsProvider: {
        Connector: 'JSONModelsProvider',
        Settings: {
            models: modelsPath,
            mode: 'merge', //preserve smyth predefined models and add my custom models on top of them
        },
    },
});

async function main() {
    const agent = new Agent({
        id: 'js-code-assistant',

        name: 'JS Code Assistant',
        behavior: 'You are a JS code assistant. you answer any question by providing JS code output, you can use any library you want',
        model: 'gemma-3n-e4b',
    });

    
    const promptResult = await agent.prompt('Write a function that returns the sum of two numbers');
    
    console.log(promptResult);

    
}

main();
