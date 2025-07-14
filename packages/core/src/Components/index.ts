import { Component } from './Component.class';
import { APIEndpoint } from './APIEndpoint.class';
import { APIOutput } from './APIOutput.class';
import { PromptGenerator } from './PromptGenerator.class';
import { APICall } from './APICall/APICall.class';
import { HTTPCall } from './HTTPCall.class';
import { VisionLLM } from './VisionLLM.class';
import { FSleep } from './FSleep.class';
import { FHash } from './FHash.class';
import { FEncDec } from './FEncDec.class';
import { FTimestamp } from './FTimestamp.class';
import { DataSourceLookup } from './DataSourceLookup.class';
import { DataSourceIndexer } from './DataSourceIndexer.class';
import { DataSourceCleaner } from './DataSourceCleaner.class';
import { JSONFilter } from './JSONFilter.class';
import { LogicAND } from './LogicAND.class';
import { LogicOR } from './LogicOR.class';
import { LogicXOR } from './LogicXOR.class';
import { LogicAtLeast } from './LogicAtLeast.class';
import { LogicAtMost } from './LogicAtMost.class';
import { AgentPlugin } from './AgentPlugin.class';
import { LLMAssistant } from './LLMAssistant.class';
import { Async } from './Async.class';
import { Await } from './Await.class';
import { ForEach } from './ForEach.class';
import { HuggingFace } from './HuggingFace.class';
import { ZapierAction } from './ZapierAction.class';
import { GPTPlugin } from './GPTPlugin.class';
import { Classifier } from './Classifier.class';
import { FSign } from './FSign.class';
import { MultimodalLLM } from './MultimodalLLM.class';
import { GenAILLM } from './GenAILLM.class';
import { FileStore } from './FileStore.class';
import { ScrapflyWebScrape } from './ScrapflyWebScrape.class';
import { TavilyWebSearch } from './TavilyWebSearch.class';
import { WebSearch } from './WebSearch.class';
import { ComponentHost } from './ComponentHost.class';
import { ServerlessCode } from './ServerlessCode.class';
import { ImageGenerator } from './ImageGenerator.class'; // Legacy
import { MCPClient } from './MCPClient.class';
import { OpenAPI } from './OpenAPI.class';
import { GitCommit } from './GitCommit.class';

const components = {
    Component: new Component(),
    Note: new Component(), //this is a fake component
    APIEndpoint: new APIEndpoint(),
    APIOutput: new APIOutput(),
    PromptGenerator: new PromptGenerator(),
    LLMPrompt: new PromptGenerator(),
    APICall: new APICall(),
    HTTPCall: new HTTPCall(),
    VisionLLM: new VisionLLM(),
    FSleep: new FSleep(),
    FHash: new FHash(),
    FEncDec: new FEncDec(),
    FSign: new FSign(),
    FTimestamp: new FTimestamp(),
    DataSourceLookup: new DataSourceLookup(),
    DataSourceIndexer: new DataSourceIndexer(),
    DataSourceCleaner: new DataSourceCleaner(),
    JSONFilter: new JSONFilter(),
    LogicAND: new LogicAND(),
    LogicOR: new LogicOR(),
    LogicXOR: new LogicXOR(),
    LogicAtLeast: new LogicAtLeast(),
    LogicAtMost: new LogicAtMost(),
    AgentPlugin: new AgentPlugin(),
    LLMAssistant: new LLMAssistant(),
    Async: new Async(),
    Await: new Await(),
    ForEach: new ForEach(),
    HuggingFace: new HuggingFace(),
    ZapierAction: new ZapierAction(),
    GPTPlugin: new GPTPlugin(),
    Classifier: new Classifier(),
    MultimodalLLM: new MultimodalLLM(),
    GenAILLM: new GenAILLM(),
    FileStore: new FileStore(),
    WebSearch: new WebSearch(),
    WebScrape: new ScrapflyWebScrape(),
    TavilyWebSearch: new TavilyWebSearch(),
    ScrapflyWebScrape: new ScrapflyWebScrape(),
    ComponentHost: new ComponentHost(),
    ServerlessCode: new ServerlessCode(),
    ImageGenerator: new ImageGenerator(),
    MCPClient: new MCPClient(),
    OpenAPI: new OpenAPI(),
    GitCommit: new GitCommit(),
};

export const ComponentInstances = components;
