# AgentData

Structure representing an agent when exported or imported.

```ts
export type AgentData = {
    id: string;
    teamId: string;
    name: string;
    behavior: string;
    components: any[];
    connections: any[];
    defaultModel: string;
};
```
