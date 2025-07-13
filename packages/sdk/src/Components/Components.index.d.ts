import { Skill } from './Skill';
declare const Component: {
    Skill: typeof Skill;
    APICall: typeof import("./generated/APICall").APICall;
    APIOutput: typeof import("./generated/APIOutput").APIOutput;
    Await: typeof import("./generated/Await").Await;
    Classifier: typeof import("./generated/Classifier").Classifier;
    GenAILLM: typeof import("./generated/GenAILLM").GenAILLM;
    HuggingFace: typeof import("./generated/HuggingFace").HuggingFace;
    ImageGenerator: typeof import("./generated/ImageGenerator").ImageGenerator;
    MCPClient: typeof import("./generated/MCPClient").MCPClient;
    ServerlessCode: typeof import("./generated/ServerlessCode").ServerlessCode;
    TavilyWebSearch: typeof import("./generated/TavilyWebSearch").TavilyWebSearch;
};
export { Component };
