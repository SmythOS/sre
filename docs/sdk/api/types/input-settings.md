# InputSettings

Describes a skill or component input.

```ts
export type InputSettings = {
    type?: 'Text' | 'Number' | 'Boolean' | 'Object' | 'Array' | 'Any' | 'Binary';
    description?: string;
    optional?: boolean;
    default?: boolean;
};
```
