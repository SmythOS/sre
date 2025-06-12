# Building Agents

Agents combine a model with a behaviour description. Create one programmatically:

```typescript
import { Agent } from '@smythos/sdk';

const agent = new Agent({
    name: 'Assistant',
    behavior: 'You answer questions',
    model: 'gpt-4o'
});
```

Prompt the agent or create a chat session:

```typescript
const result = await agent.prompt('What is the capital of France?');

const chat = agent.chat();
await chat.prompt('Hello');
await chat.prompt('Do you remember my name?');
```

## Skills

Extend agents with custom skills that become available to the model as tools:

```typescript
agent.addSkill({
    name: 'getWeather',
    description: 'Return the weather for a city',
    process: async ({ city }) => {
        const data = await fetch(`https://api.weather.com?q=${city}`).then(r => r.json());
        return { weather: data.summary };
    }
});
```

## Importing `.smyth` Files

Agents designed in the visual builder can be loaded from a `.smyth` file:

```typescript
import path from 'path';
import { Agent, Model } from '@smythos/sdk';

const agentPath = path.resolve('crypto-info-agent.smyth');
const agent = Agent.import(agentPath, { model: Model.OpenAI('gpt-4o') });
```
