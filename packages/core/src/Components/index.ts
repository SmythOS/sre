import Component from './Component.class';
import APIEndpoint from './APIEndpoint.class';
import APIOutput from './APIOutput.class';
import PromptGenerator from './PromptGenerator.class';
import APICall from './APICall.class';
import VisionLLM from './VisionLLM.class';
import FSleep from './FSleep.class';
import FHash from './FHash.class';
import FEncDec from './FEncDec.class';
import FTimestamp from './FTimestamp.class';
import JSONFilter from './JSONFilter.class';
import LogicAND from './LogicAND.class';
import LogicOR from './LogicOR.class';
import LogicXOR from './LogicXOR.class';
import LogicAtLeast from './LogicAtLeast.class';
import LogicAtMost from './LogicAtMost.class';

const components = {
    Component: new Component(),
    Note: new Component(), //this is a fake component
    APIEndpoint: new APIEndpoint(),
    APIOutput: new APIOutput(),
    PromptGenerator: new PromptGenerator(),
    LLMPrompt: new PromptGenerator(),
    APICall: new APICall(),
    VisionLLM: new VisionLLM(),
    FSleep: new FSleep(),
    FHash: new FHash(),
    FEncDec: new FEncDec(),
    // FSign: new FSign(), // TODO: Implement FSign
    FTimestamp: new FTimestamp(),
    JSONFilter: new JSONFilter(),
    LogicAND: new LogicAND(),
    LogicOR: new LogicOR(),
    LogicXOR: new LogicXOR(),
    LogicAtLeast: new LogicAtLeast(),
    LogicAtMost: new LogicAtMost(),
};

export default components;
