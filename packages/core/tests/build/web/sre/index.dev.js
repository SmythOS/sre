import 'source-map-support/register.js';
import 'dotenv/config';
import winston from 'winston';
import Transport from 'winston-transport';
import pLimit from 'p-limit';
import * as FileType from 'file-type';
import { fileTypeFromBuffer } from 'file-type';
import 'isbinaryfile';
import axios from 'axios';
import dotenv from 'dotenv';
import EventEmitter$1, { EventEmitter } from 'events';
import Joi from 'joi';
import dayjs from 'dayjs';
import { xxh3 } from '@node-rs/xxhash';
import mime from 'mime';
import { Readable } from 'stream';
import { jsonrepair } from 'jsonrepair';
import crypto from 'crypto';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import fs from 'fs';
import path from 'path';
import { encodeChat, encode } from 'gpt-tokenizer';
import yaml from 'js-yaml';
import SwaggerParser from '@apidevtools/swagger-parser';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import { HfInference } from '@huggingface/inference';
import os from 'os';
import 'process';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import imageSize from 'image-size';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import IORedis from 'ioredis';
import { Pinecone } from '@pinecone-database/pinecone';

var __defProp$V = Object.defineProperty;
var __defNormalProp$V = (obj, key, value) => key in obj ? __defProp$V(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$V = (obj, key, value) => __defNormalProp$V(obj, typeof key !== "symbol" ? key + "" : key, value);
class AgentRequest {
  constructor(req) {
    __publicField$V(this, "headers");
    __publicField$V(this, "body");
    __publicField$V(this, "query");
    __publicField$V(this, "params");
    __publicField$V(this, "method", "GET");
    __publicField$V(this, "path", "");
    __publicField$V(this, "sessionID", "");
    __publicField$V(this, "res", null);
    __publicField$V(this, "req", null);
    __publicField$V(this, "files", []);
    __publicField$V(this, "_agent_authinfo");
    if (!req) return;
    this.headers = JSON.parse(JSON.stringify(req.headers || {}));
    this.body = JSON.parse(JSON.stringify(req.body || req.data || {}));
    this.query = JSON.parse(JSON.stringify(req.query || {}));
    this.params = JSON.parse(JSON.stringify(req.params || {}));
    if (req.url) {
      const parsedUrl = new URL(req.url || "");
      this.path = parsedUrl.pathname;
    }
    if (req.path) this.path = req.path;
    this.method = req.method;
    this.sessionID = req.sessionID;
    this.files = req.files || [];
    this._agent_authinfo = req._agent_authinfo;
    this.req = req instanceof AgentRequest ? req?.req : req;
    this.res = req?.res || null;
  }
  header(name) {
    return this.headers[name.toLowerCase()];
  }
}

var TConnectorService = /* @__PURE__ */ ((TConnectorService2) => {
  TConnectorService2["Storage"] = "Storage";
  TConnectorService2["VectorDB"] = "VectorDB";
  TConnectorService2["Cache"] = "Cache";
  TConnectorService2["LLM"] = "LLM";
  TConnectorService2["Vault"] = "Vault";
  TConnectorService2["Account"] = "Account";
  TConnectorService2["AgentData"] = "AgentData";
  TConnectorService2["CLI"] = "CLI";
  TConnectorService2["NKV"] = "NKV";
  return TConnectorService2;
})(TConnectorService || {});

function uid() {
  return (Date.now() + Math.random()).toString(36).replace(".", "").toUpperCase();
}
function isSubclassOf(subClass, superClass) {
  if (typeof subClass !== "function" || typeof superClass !== "function") {
    return false;
  }
  let prototype = Object.getPrototypeOf(subClass.prototype);
  let depth = 10;
  while (prototype && depth >= 0) {
    if (prototype === superClass.prototype) {
      return true;
    }
    prototype = Object.getPrototypeOf(prototype);
    depth++;
  }
  return false;
}
async function processWithConcurrencyLimit(tasks, maxConcurrentTasks = 10) {
  const limit = pLimit(maxConcurrentTasks);
  const limitedTasks = tasks.map((task) => limit(task));
  const results = await Promise.allSettled(limitedTasks);
  const validResults = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  return validResults;
}

function getCurrentFormattedDate() {
  const date = /* @__PURE__ */ new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}`;
}
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isValidString(str) {
  return str && typeof str === "string";
}
const isValidNumber = (str) => {
  const num = parseFloat(str);
  return !isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER && num.toString() === str.trim();
};
function convertStringToRespectiveType(data) {
  if (data === null || data === void 0) return data;
  if (typeof data !== "object") {
    if (typeof data === "string") {
      if (data.toLowerCase() === "true") {
        return true;
      } else if (data.toLowerCase() === "false") {
        return false;
      } else if (isValidNumber(data)) {
        return Number(data);
      } else if (data.toLowerCase() === "null") {
        return null;
      } else if (data.toLowerCase() === "undefined") {
        return void 0;
      }
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => convertStringToRespectiveType(item));
  }
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, convertStringToRespectiveType(value)]));
}
const kebabToCamel = (input) => {
  if (!input || typeof input !== "string") return input;
  return input.replace(/-([a-z])/g, function(match, group) {
    return group.toUpperCase();
  });
};
const kebabToCapitalize = (input) => {
  if (!input || typeof input !== "string") return input;
  return input.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

const REQUEST_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_TOKENS_FOR_LLM = 2048;
const TOOL_USE_DEFAULT_MODEL$1 = "gpt-3.5-turbo";
const JSON_RESPONSE_INSTRUCTION = "\nAll responses should be in valid JSON format, compacted without newlines, indentations, or additional JSON syntax markers.";

function cleanBase64(str) {
  return str.replace(/\s|\\n|\\s/g, "");
}
function isDataUrl(input) {
  const dataUrlPattern = /^data:([\w+\-\.]+\/[\w+\-\.]+);base64,(.*)$/;
  return dataUrlPattern.test(input);
}
function isRawBase64(str) {
  if (!isValidString(str)) return false;
  const cleanedBase64Data = cleanBase64(str);
  if (cleanedBase64Data.length < 128) return false;
  try {
    const buffer = Buffer.from(cleanedBase64Data, "base64");
    return buffer.toString("base64").replace(/=+$/, "") === cleanedBase64Data.replace(/=+$/, "");
  } catch {
    return false;
  }
}
async function parseBase64(input) {
  try {
    if (isDataUrl(input)) {
      return parseDataUrl(input);
    }
    if (!isRawBase64(input)) {
      throw new Error("Invalid base64 data!");
    }
    return await parseRawBase64(input);
  } catch (error) {
    throw new Error(`Error parsing base64 data: ${error.message}`);
  }
}
function parseDataUrl(input) {
  const dataUrlPattern = /^data:([\w+\-\.]+\/[\w+\-\.]+);base64,(.*)$/;
  const matches = input.match(dataUrlPattern);
  if (!matches) {
    throw new Error("Invalid data URL!");
  }
  const [, mimetype, data] = matches;
  if (!isRawBase64(data)) {
    throw new Error("Invalid base64 data!");
  }
  return { mimetype, data: cleanBase64(data) };
}
async function parseRawBase64(input) {
  const cleanedData = cleanBase64(input);
  const mimetype = await identifyMimetypeFromRawBase64(cleanedData);
  return { mimetype, data: cleanedData };
}
async function identifyMimetypeFromRawBase64(data) {
  try {
    const cleanedData = cleanBase64(data);
    const buffer = Buffer.from(cleanedData, "base64");
    const type = await fileTypeFromBuffer(buffer);
    return type?.mime || "";
  } catch (error) {
    throw new Error(`Error identifying MIME type from base64 data: ${error?.message}`);
  }
}
const _cleanUpBase64Data = (str) => {
  if (typeof str !== "string" || str.length > MAX_FILE_SIZE) {
    throw new Error("Invalid input");
  }
  return str.replace(/\s|\\n|\\s/g, "");
};
const isBase64 = (str) => {
  if (!str || !(typeof str === "string")) return false;
  str = _cleanUpBase64Data(str);
  try {
    if (str?.length < 128) return false;
    const buffer = Buffer.from(str, "base64");
    return buffer.toString("base64") === str;
  } catch {
    return false;
  }
};

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
function dataToBuffer(data) {
  let bufferData;
  switch (true) {
    case data instanceof ArrayBuffer:
      bufferData = Buffer.from(new Uint8Array(data));
      break;
    case (ArrayBuffer.isView(data) && !(data instanceof DataView)):
      bufferData = Buffer.from(new Uint8Array(data.buffer));
      break;
    case data instanceof DataView:
      bufferData = Buffer.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      break;
    case Buffer.isBuffer(data):
      bufferData = data;
      break;
    case typeof data === "string":
      bufferData = Buffer.from(data, "utf-8");
      break;
    default:
      return null;
  }
  return bufferData;
}
const getSizeFromBinary = (data) => {
  const buffer = dataToBuffer(data);
  if (!buffer) return 0;
  return buffer.byteLength;
};
const isPlainObject = (data) => {
  return typeof data === "object" && data !== null && !Array.isArray(data) && Object.prototype.toString.call(data) === "[object Object]" && data.constructor === Object;
};
const isBuffer = (data) => {
  try {
    return Buffer.isBuffer(data);
  } catch {
    return false;
  }
};
function isUrl(str) {
  if (typeof str !== "string") return false;
  const regex = /^([a-zA-Z0-9]+:\/\/)([^\s.]+\.[^\s]{2,})(:[0-9]{1,5})?(\/[^\s]*)?(\?[^\s]*)?$/i;
  return regex.test(str);
}

function parseCLIArgs(argList, argv) {
  if (!argv) argv = process.argv;
  const args = argv;
  const result = {};
  const mainArgs = Array.isArray(argList) ? argList : [argList];
  mainArgs.forEach((mainArg) => {
    const mainArgIndex = args.indexOf(`--${mainArg}`);
    if (mainArgIndex !== -1) {
      const values = [];
      for (let i = mainArgIndex + 1; i < args.length; i++) {
        if (args[i].startsWith("--")) break;
        values.push(args[i]);
      }
      if (values.length === 1 && values[0].includes("=")) {
        const keyValuePairs = {};
        const [key, ...valParts] = values[0].split("=");
        const val = valParts.join("=").replace(/^"|"$/g, "");
        keyValuePairs[key] = val;
        result[mainArg] = keyValuePairs;
      } else if (values.length === 1) {
        result[mainArg] = values[0];
      } else if (values.length > 1) {
        const keyValuePairs = {};
        values.forEach((value) => {
          const [key, ...valParts] = value.split("=");
          const val = valParts.join("=").replace(/^"|"$/g, "");
          keyValuePairs[key] = val;
        });
        result[mainArg] = keyValuePairs;
      }
    }
  });
  return result;
}
function getMainArgs(argv) {
  if (!argv) argv = process.argv;
  const args = argv;
  const result = [];
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      result.push(args[i].replace(/^--/, ""));
    }
  }
  return result;
}

function isDigits(str) {
  if (typeof str === "number") return true;
  if (typeof str !== "string") return false;
  const numRegex = /^-?\d+(\.\d+)?$/;
  return numRegex.test(str.trim());
}
function isSafeNumber(str) {
  const num = parseFloat(str);
  return !isNaN(num) && num <= Number.MAX_SAFE_INTEGER && num >= Number.MIN_SAFE_INTEGER && num.toString() === str.trim();
}

async function getMimeTypeFromUrl(url) {
  try {
    const { data } = await axios.get(url, {
      responseType: "arraybuffer",
      headers: { Range: "bytes=0-4096" }
    });
    const type = await fileTypeFromBuffer(data);
    return type ? type.mime : "";
  } catch (error) {
    throw new Error(`Error fetching the MIME type: ${error.message}`);
  }
}

function validateCharacterSet(value) {
  if (value === "") return true;
  const parts = value.split(/(\{\{[^}]+\}\})/).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("{{") && part.endsWith("}}")) {
      const innerContent = part.slice(2, -2).trim();
      if (innerContent === "") {
        return false;
      }
    } else {
      if (!/^[a-zA-Z0-9\-_.]+$/.test(part)) {
        return false;
      }
    }
  }
  return true;
}
const validateInteger$2 = (args) => {
  return (value, helpers) => {
    const numValue = Number(value);
    const fieldName = helpers.schema._flags.label || helpers.state.path[helpers.state.path.length - 1];
    if (isNaN(numValue)) {
      throw new Error(`The value for '${fieldName}' must be a number`);
    }
    if (args.min !== void 0 && args.max !== void 0) {
      if (numValue < args.min || numValue > args.max) {
        throw new Error(`The value for '${fieldName}' must be from ${args.min} to ${args.max}`);
      }
    } else if (args.min !== void 0) {
      if (numValue < args.min) {
        throw new Error(`The value for '${fieldName}' must be greater or equal to ${args.min}`);
      }
    } else if (args.max !== void 0) {
      if (numValue > args.max) {
        throw new Error(`The value for '${fieldName}' must be less or equal to ${args.max}`);
      }
    }
    return value;
  };
};

dotenv.config();
const config = {
  env: {
    LOG_LEVEL: process.env.LOG_LEVEL || "none",
    LOG_FILTER: process.env.LOG_FILTER || "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    DATA_PATH: process.env.DATA_PATH,
    NODE_ENV: process.env?.NODE_ENV,
    AGENT_DOMAIN: process.env?.AGENT_DOMAIN,
    AGENT_DOMAIN_PORT: process.env?.AGENT_DOMAIN_PORT,
    CODE_SANDBOX_URL: process.env?.CODE_SANDBOX_URL,
    TOGETHER_AI_API_URL: process.env?.TOGETHER_AI_API_URL,
    REDIS_SENTINEL_HOSTS: process.env?.REDIS_SENTINEL_HOSTS || "",
    REDIS_MASTER_NAME: process.env?.REDIS_MASTER_NAME,
    REDIS_PASSWORD: process.env?.REDIS_PASSWORD,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_REGION: process.env.AWS_S3_REGION,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME
  },
  agent: {
    ENDPOINT_PREFIX: "/api"
  }
};

var __defProp$U = Object.defineProperty;
var __defNormalProp$U = (obj, key, value) => key in obj ? __defProp$U(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$U = (obj, key, value) => __defNormalProp$U(obj, typeof key !== "symbol" ? key + "" : key, value);
winston.addColors({
  error: "red",
  warn: "yellow",
  info: "green",
  debug: "blue"
});
let logLevel = parseCLIArgs("debug")?.debug || config.env.LOG_LEVEL || "info";
if (!["none", "error", "warn", "info", "debug"].includes(logLevel)) {
  logLevel = "none";
}
const namespaces = (config.env.LOG_FILTER || "").split(",");
const namespaceFilter = winston.format((info) => {
  if (!config.env.LOG_FILTER || namespaces.some((ns) => info.module?.includes(ns))) {
    return info;
  }
  return false;
})();
class ArrayTransport extends Transport {
  constructor(opts) {
    super(opts);
    __publicField$U(this, "logs");
    this.logs = opts.logs;
  }
  log(info, callback) {
    setImmediate(() => {
      this.emit("logged", info);
    });
    this.logs.push(`${info.level}: ${info.message}`);
    callback();
  }
}
class LogHelper {
  constructor(_logger, data, labels) {
    this._logger = _logger;
    this.data = data;
    this.labels = labels;
    __publicField$U(this, "startTime", Date.now());
  }
  get output() {
    return Array.isArray(this.data) ? this.data.join("\n") : void 0;
  }
  get elapsedTime() {
    return Date.now() - this.startTime;
  }
  log(...args) {
    this._logger.log("info", formatLogMessage(...args), this.labels);
  }
  warn(...args) {
    this._logger.log("warn", formatLogMessage(...args), this.labels);
  }
  debug(...args) {
    this._logger.log("debug", formatLogMessage(...args), this.labels);
  }
  info(...args) {
    this._logger.log("info", formatLogMessage(...args), this.labels);
  }
  verbose(...args) {
    this._logger.log("verbose", formatLogMessage(...args), this.labels);
  }
  error(...args) {
    const stack = new Error().stack;
    this._logger.log("error", formatLogMessage(...args), { ...this.labels, stack });
  }
  close() {
    this._logger.clear();
    this._logger.close();
  }
}
winston.format.printf((info) => {
  return `${info.timestamp} ${winston.format.colorize().colorize(info.level, `${info.level}: ${info.message}`)}`;
});
function createBaseLogger(memoryStore) {
  const logger = winston.createLogger({
    //level: 'info', // log level
    format: winston.format.combine(
      winston.format((info) => {
        if (config.env.LOG_LEVEL == "none") return false;
        return info;
      })(),
      winston.format.timestamp(),
      winston.format.errors({
        stack: true
      }),
      winston.format.splat(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        level: "error",
        //handleExceptions: true,
        format: winston.format.combine(
          winston.format.printf((info) => {
            let message = info.message;
            return `${info.level}:${info.module || ""} ${message} ${info.stack || ""}`;
          })
        ),
        stderrLevels: ["error"]
        // Define levels that should be logged to stderr
      }),
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          namespaceFilter,
          winston.format.printf((info) => {
            const module = info.module ? winston.format.colorize().colorize(info.level, ` [${info.module}]`) : "";
            const ns = winston.format.colorize().colorize(info.level, `${info.level}${module}`);
            let message = info.message;
            return `${ns} - ${message}`;
          })
        )
        //handleExceptions: true,
      })
    ]
  });
  if (Array.isArray(memoryStore)) {
    logger.add(
      new ArrayTransport({
        level: "debug",
        logs: memoryStore
      })
    );
  }
  return logger;
}
function formatLogMessage(...args) {
  return args.map((arg) => {
    if (typeof arg === "object" && arg !== null && !(arg instanceof Error)) {
      return JSON.stringify(arg, null, 2);
    }
    return String(arg);
  }).join(" ");
}
function createLabeledLogger(labels, memoryStore) {
  const _logger = createBaseLogger(memoryStore);
  _logger.defaultMeta = labels;
  const logger = new LogHelper(_logger, memoryStore, labels);
  return logger;
}
function Logger(module, withMemoryStore = false) {
  return createLabeledLogger({ module }, withMemoryStore ? [] : void 0);
}

const logger$1 = Logger("DummyConnector");
const DummyConnector = new Proxy(
  {},
  {
    get: function(target, prop, receiver) {
      if (typeof target[prop] === "function") {
        return target[prop];
      } else {
        return function(...args) {
          logger$1.warn(`[!!] Unimplemented Connector tried to call : ${prop.toString()} with arguments:`, args);
        };
      }
    }
  }
);

var __defProp$T = Object.defineProperty;
var __defNormalProp$T = (obj, key, value) => key in obj ? __defProp$T(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$T = (obj, key, value) => __defNormalProp$T(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$f = Logger("Connector");
class Connector {
  constructor() {
    __publicField$T(this, "started", false);
    __publicField$T(this, "_readyPromise");
  }
  async start() {
    console$f.info(`Starting ${this.name} connector ...`);
    this.started = true;
  }
  async stop() {
    console$f.info(`Stopping ${this.name} connector ...`);
  }
  ready() {
    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve) => {
        let maxWait = 1e4;
        const tick = 100;
        if (this.started) {
          resolve(true);
        } else {
          const interval = setInterval(() => {
            if (this.started) {
              clearInterval(interval);
              resolve(true);
            }
            maxWait -= tick;
            if (maxWait <= 0) {
              clearInterval(interval);
              resolve(false);
            }
          }, tick);
        }
      });
    }
    return this._readyPromise;
  }
}

const SystemEvents = new EventEmitter();

const console$e = Logger("ConnectorService");
const Connectors = {};
const ConnectorInstances = {};
let ServiceRegistry = {};
let _ready = false;
SystemEvents.on("SRE:Booted", (services) => {
  ServiceRegistry = services;
  _ready = true;
});
class ConnectorService {
  //Singleton
  // private constructor() {
  //     SystemEvents.on('SRE:Booted', (services) => {
  //         ServiceRegistry = services;
  //     });
  // }
  // private static instance: ConnectorService;
  // public static get Instance(): ConnectorService {
  //     if (!ConnectorService.instance) {
  //         ConnectorService.instance = new ConnectorService();
  //     }
  //     return ConnectorService.instance;
  // }
  static get ready() {
    return _ready;
  }
  static get service() {
    return ServiceRegistry;
  }
  /**
   * Allows SRE services to register their connectors, a registered conector can then be initialized and used by SRE or its services
   * @param connectorType
   * @param connectorName
   * @param connectorConstructor
   * @returns
   */
  static register(connectorType, connectorName, connectorConstructor) {
    if (typeof connectorConstructor !== "function" || !isSubclassOf(connectorConstructor, Connector)) {
      console$e.error(`Invalid Connector ${connectorType}:${connectorName}`);
      return;
    }
    if (!Connectors[connectorType]) {
      Connectors[connectorType] = {};
    }
    Connectors[connectorType][connectorName] = connectorConstructor;
  }
  /**
   * The init method instantiates a connector and starts it, a connector cannot be used before it is initialized
   * Usually the initialization phase happens during the SRE startup, but some connectors can be initialized later if they are not mandatory for the SRE to start
   *
   *
   * @param connectorType
   * @param connectorName
   * @param settings
   * @param isDefault
   * @returns
   */
  static init(connectorType, connectorName, settings = {}, isDefault = false) {
    if (ConnectorInstances[connectorType]?.[connectorName]) {
      throw new Error(`Connector ${connectorType}:${connectorName} already initialized`);
    }
    const entry = Connectors[connectorType];
    if (!entry) return;
    const connectorConstructor = entry[connectorName];
    if (connectorConstructor) {
      const connector = new connectorConstructor(settings);
      connector.start();
      if (!ConnectorInstances[connectorType]) ConnectorInstances[connectorType] = {};
      ConnectorInstances[connectorType][connectorName] = connector;
      if (!ConnectorInstances[connectorType].default && isDefault) {
        ConnectorInstances[connectorType].default = connector;
      }
    }
  }
  static async _stop() {
    for (let connectorName in ConnectorInstances) {
      let allConnectors = Object.values(ConnectorInstances[connectorName]);
      allConnectors = allConnectors.filter((value, index, self) => self.indexOf(value) === index);
      for (let connector of allConnectors) {
        connector.stop();
      }
    }
  }
  static getInstance(connectorType, connectorName = "default") {
    const instance = ConnectorInstances[connectorType]?.[connectorName];
    if (!instance) {
      if (ConnectorInstances[connectorType] && Object.keys(ConnectorInstances[connectorType]).length > 0) {
        return ConnectorInstances[connectorType][Object.keys(ConnectorInstances[connectorType])[0]];
      }
      console$e.warn(`Connector ${connectorType} not initialized returning DummyConnector`);
      return DummyConnector;
    }
    return instance;
  }
  // Storage?: StorageService;
  // Cache?: CacheService;
  // LLM?: LLMService;
  // Vault?: VaultService;
  // Account?: AccountService;
  static getStorageConnector(name) {
    return ConnectorService.getInstance(TConnectorService.Storage, name);
  }
  static getCacheConnector(name) {
    return ConnectorService.getInstance(TConnectorService.Cache, name);
  }
  static getVectorDBConnector(name) {
    return ConnectorService.getInstance(TConnectorService.VectorDB, name);
  }
  static getNKVConnector(name) {
    return ConnectorService.getInstance(TConnectorService.NKV, name);
  }
  static getLLMConnector(name) {
    return ConnectorService.getInstance(TConnectorService.LLM, name);
  }
  static getVaultConnector(name) {
    return ConnectorService.getInstance(TConnectorService.Vault, name);
  }
  static getAccountConnector(name) {
    return ConnectorService.getInstance(TConnectorService.Account, name);
  }
  static getAgentDataConnector(name) {
    return ConnectorService.getInstance(TConnectorService.AgentData, name);
  }
  static getCLIConnector(name) {
    return ConnectorService.getInstance(TConnectorService.CLI, name);
  }
  //TODO: add missing get<Connector> functions : e.g getAgentData(), getCache() etc ...
  static hasInstance(connectorType, connectorName = "default") {
    const instance = ConnectorInstances[connectorType]?.[connectorName];
    return instance && instance !== DummyConnector;
  }
}
class ConnectorServiceProvider {
  init() {
  }
  constructor() {
    this.register();
  }
}

var __defProp$S = Object.defineProperty;
var __defNormalProp$S = (obj, key, value) => key in obj ? __defProp$S(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$S = (obj, key, value) => __defNormalProp$S(obj, typeof key !== "symbol" ? key + "" : key, value);
Logger("EmbodimentSettings");
class EmbodimentSettings {
  constructor(agentId) {
    __publicField$S(this, "_embodiments");
    __publicField$S(this, "_ready", false);
    this.init(agentId);
  }
  async init(data) {
    this._embodiments = data;
    this._ready = true;
  }
  ready(maxWait = 1e4) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (this._ready) {
          clearInterval(interval);
          resolve(true);
        }
        maxWait -= 100;
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        reject(false);
      }, maxWait);
    });
  }
  get(embodimentType, key) {
    if (!this._embodiments) return void 0;
    const _embodiment = this._embodiments.find((embodiment) => embodiment.type?.toLowerCase() === embodimentType.toLowerCase());
    if (key) {
      return _embodiment?.properties?.[key];
    }
    return _embodiment?.properties;
  }
}

var __defProp$R = Object.defineProperty;
var __defNormalProp$R = (obj, key, value) => key in obj ? __defProp$R(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$R = (obj, key, value) => __defNormalProp$R(obj, typeof key !== "symbol" ? key + "" : key, value);
Logger("AgentSettings");
class AgentSettings {
  constructor(agentId) {
    __publicField$R(this, "_settings");
    __publicField$R(this, "embodiments");
    __publicField$R(this, "_ready", false);
    if (agentId) {
      this.init(agentId);
    }
  }
  async init(agentId) {
    const agentDataConnector = ConnectorService.getAgentDataConnector();
    this._settings = await agentDataConnector.getAgentSettings(agentId).catch((e) => {
    }) || {};
    this.embodiments = new EmbodimentSettings(this._settings.embodiments);
    this._ready = true;
  }
  ready(maxWait = 1e4) {
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (this._ready) {
          clearInterval(interval);
          resolve(true);
        }
        maxWait -= 100;
      }, 100);
      setTimeout(() => {
        clearInterval(interval);
        reject(false);
      }, maxWait);
    });
  }
  get(key) {
    return this._settings?.find((s) => s.key === key)?.value;
  }
  set(key, value) {
    this._settings[key] = value;
  }
  has(key) {
    return this._settings[key];
  }
}

var TAccessLevel = /* @__PURE__ */ ((TAccessLevel2) => {
  TAccessLevel2["None"] = "none";
  TAccessLevel2["Owner"] = "owner";
  TAccessLevel2["Read"] = "read";
  TAccessLevel2["Write"] = "write";
  return TAccessLevel2;
})(TAccessLevel || {});
var TAccessRole = /* @__PURE__ */ ((TAccessRole2) => {
  TAccessRole2["Agent"] = "agent";
  TAccessRole2["User"] = "user";
  TAccessRole2["Team"] = "team";
  TAccessRole2["Public"] = "public";
  return TAccessRole2;
})(TAccessRole || {});
const RoleMap = {
  user: "u",
  agent: "a",
  team: "t",
  public: "p"
};
const LevelMap = {
  none: "n",
  owner: "o",
  read: "r",
  write: "w"
};
const ReverseRoleMap = Object.fromEntries(Object.entries(RoleMap).map(([k, v]) => [v, k]));
const ReverseLevelMap = Object.fromEntries(Object.entries(LevelMap).map(([k, v]) => [v, k]));
var TAccessResult = /* @__PURE__ */ ((TAccessResult2) => {
  TAccessResult2["Granted"] = "granted";
  TAccessResult2["Denied"] = "denied";
  return TAccessResult2;
})(TAccessResult || {});
class ACLAccessDeniedError extends Error {
  constructor(message) {
    super(message);
    this.name = "ACLAccessDeniedError";
  }
}

var __defProp$Q = Object.defineProperty;
var __defNormalProp$Q = (obj, key, value) => key in obj ? __defProp$Q(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$Q = (obj, key, value) => __defNormalProp$Q(obj, typeof key !== "symbol" ? key + "" : key, value);
class AccessRequest {
  constructor(object) {
    __publicField$Q(this, "id");
    __publicField$Q(this, "resourceId");
    __publicField$Q(this, "level", []);
    __publicField$Q(this, "candidate");
    if (!object) {
      this.id = "aclR:" + uid();
    }
    if (["role", "id"].every((k) => k in object)) {
      this.id = "aclR:" + uid();
      this.candidate = object;
    } else {
      const acReq = object;
      this.id = acReq.id;
      this.level = acReq.level;
      this.candidate = acReq.candidate;
    }
    this.resourceId = void 0;
  }
  static clone(request) {
    return new AccessRequest(request);
  }
  setLevel(level) {
    this.level = Array.isArray(level) ? level : [level];
    return this;
  }
  addLevel(level) {
    this.level = [...this.level, ...Array.isArray(level) ? level : [level]];
    return this;
  }
  resource(resourceId) {
    this.resourceId = resourceId;
    return this;
  }
  setCandidate(candidate) {
    this.candidate = candidate;
    return this;
  }
}

var __defProp$P = Object.defineProperty;
var __defNormalProp$P = (obj, key, value) => key in obj ? __defProp$P(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$P = (obj, key, value) => __defNormalProp$P(obj, typeof key !== "symbol" ? key + "" : key, value);
class AccessCandidate {
  //public _candidate: TAccessCandidate;
  constructor(candidate) {
    __publicField$P(this, "role");
    __publicField$P(this, "id");
    this.role = candidate ? candidate.role : TAccessRole.Public;
    this.id = candidate ? candidate.id : "";
  }
  get request() {
    return new AccessRequest(this);
  }
  get readRequest() {
    return new AccessRequest(this).setLevel(TAccessLevel.Read);
  }
  get writeRequest() {
    return new AccessRequest(this).setLevel(TAccessLevel.Write);
  }
  get ownerRequest() {
    return new AccessRequest(this).setLevel(TAccessLevel.Owner);
  }
  static clone(candidate) {
    return new AccessCandidate(candidate);
  }
  team(teamId) {
    this.role = TAccessRole.Team;
    this.id = teamId;
    return this;
  }
  static team(teamId) {
    return new AccessCandidate({ role: TAccessRole.Team, id: teamId });
  }
  agent(agentId) {
    this.role = TAccessRole.Agent;
    this.id = agentId;
    return this;
  }
  static agent(agentId) {
    return new AccessCandidate({ role: TAccessRole.Agent, id: agentId });
  }
  user(userId) {
    this.role = TAccessRole.User;
    this.id = userId;
    return this;
  }
  static user(userId) {
    return new AccessCandidate({ role: TAccessRole.User, id: userId });
  }
  public() {
    this.role = TAccessRole.Public;
    this.id = TAccessRole.Public;
    return this;
  }
  static public() {
    return new AccessCandidate({ role: TAccessRole.Public, id: "" });
  }
}

var __defProp$O = Object.defineProperty;
var __defNormalProp$O = (obj, key, value) => key in obj ? __defProp$O(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$O = (obj, key, value) => __defNormalProp$O(obj, typeof key !== "symbol" ? key + "" : key, value);
const ACLHashAlgo = {
  none: (source) => source,
  xxh3: (source) => xxh3.xxh64(source.toString()).toString(16)
};
class ACL {
  constructor(acl) {
    __publicField$O(this, "hashAlgorithm");
    __publicField$O(this, "entries");
    __publicField$O(this, "migrated");
    if (typeof acl === "string") {
      this.deserializeACL(acl);
    } else {
      this.hashAlgorithm = acl?.hashAlgorithm;
      this.entries = acl?.entries ? JSON.parse(JSON.stringify(acl?.entries)) : {};
      this.migrated = acl?.migrated;
    }
    if (!this.hashAlgorithm) this.hashAlgorithm = "xxh3";
    if (!this.entries) this.entries = {};
  }
  //private acl: TACL;
  get ACL() {
    return {
      hashAlgorithm: this.hashAlgorithm,
      entries: JSON.parse(JSON.stringify(this.entries)),
      migrated: this.migrated
    };
  }
  get serializedACL() {
    return this.serializeACL(this);
  }
  static from(acl) {
    return new ACL(acl);
  }
  /**
   * This function checks if the candidate has access to the requested level
   * it only checks the exact access level, not the higher levels
   * Examples :
   * - if the candidate has read access, it will return true only if the requested level is read
   * - if the current ACL has team access but the candidate is an agent, it will not match the team access
   * @param acRequest
   * @returns
   */
  checkExactAccess(acRequest) {
    if (!this?.entries) return false;
    const role = this?.entries[acRequest.candidate.role];
    if (!role) return false;
    let entryId = acRequest.candidate.id;
    if (!ACLHashAlgo[this.hashAlgorithm]) {
      throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
    }
    entryId = ACLHashAlgo[this.hashAlgorithm](entryId);
    const access = role[entryId];
    if (!access) return false;
    const levels = Array.isArray(acRequest.level) ? acRequest.level : [acRequest.level];
    return levels.every((level) => access.includes(level));
  }
  addPublicAccess(level) {
    if (!this?.entries[TAccessRole.Public]) this.entries[TAccessRole.Public] = {};
    if (!ACLHashAlgo[this.hashAlgorithm]) {
      throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
    }
    const ownerId = TAccessRole.Public;
    const hashedOwner = ACLHashAlgo[this.hashAlgorithm](ownerId);
    if (!this?.entries[TAccessRole.Public][hashedOwner]) this.entries[TAccessRole.Public][hashedOwner] = [];
    const curLevel = this.entries[TAccessRole.Public][hashedOwner];
    this.entries[TAccessRole.Public][hashedOwner] = [...curLevel, ...level];
    return this;
  }
  removePublicAccess(level) {
    if (!this?.entries[TAccessRole.Public]) return this;
    const ownerId = TAccessRole.Public;
    const hashedOwner = ACLHashAlgo[this.hashAlgorithm](ownerId);
    const curLevel = this[TAccessRole.Public][hashedOwner];
    this[TAccessRole.Public][hashedOwner] = curLevel.filter((l) => !level.includes(l));
    return this;
  }
  addAccess(role, ownerId, level) {
    if (role === TAccessRole.Public) {
      throw new Error("Adding public access using addAccess method is not allowed. Use addPublicAccess method instead.");
    }
    const _level = Array.isArray(level) ? level : [level];
    if (!this?.entries[role]) this.entries[role] = {};
    if (!ACLHashAlgo[this.hashAlgorithm]) {
      throw new Error(`Hash algorithm ${this.hashAlgorithm} not supported`);
    }
    const hashedOwner = ACLHashAlgo[this.hashAlgorithm](ownerId);
    if (!this?.entries[role][hashedOwner]) this.entries[role][hashedOwner] = [];
    const curLevel = this.entries[role][hashedOwner];
    this.entries[role][hashedOwner] = [...curLevel, ..._level];
    return this;
  }
  static addAccess(role, ownerId, level) {
    return ACL.from().addAccess(role, ownerId, level);
  }
  removeAccess(role, ownerId, level) {
    const _level = Array.isArray(level) ? level : [level];
    if (!this[role]) return this;
    if (!this[role][ownerId]) return this;
    const curLevel = this[role][ownerId];
    this[role][ownerId] = curLevel.filter((l) => !_level.includes(l));
    return this;
  }
  serializeACL(tacl) {
    let compressed = "";
    if (tacl.hashAlgorithm) {
      compressed += `h:${tacl.hashAlgorithm}|`;
    }
    if (tacl.entries) {
      for (const [role, entries] of Object.entries(tacl.entries)) {
        const roleShort = RoleMap[role];
        const entriesArray = [];
        for (const [hashedOwnerKey, accessLevels] of Object.entries(entries || {})) {
          if (accessLevels) {
            const accessLevelsShort = accessLevels.map((level) => LevelMap[level]).join("");
            entriesArray.push(`${hashedOwnerKey}/${accessLevelsShort}`);
          }
        }
        if (entriesArray.length > 0) {
          compressed += `${roleShort}:${entriesArray.join(",")}|`;
        }
      }
    }
    if (compressed.endsWith("|")) {
      compressed = compressed.slice(0, -1);
    }
    return compressed;
  }
  deserializeACL(compressed) {
    const parts = compressed.split("|");
    this.hashAlgorithm = "";
    this.entries = {};
    for (const part of parts) {
      if (part.startsWith("h:")) {
        this.hashAlgorithm = part.substring(2);
      } else {
        const [roleShort, entries] = part.split(":");
        const role = ReverseRoleMap[roleShort];
        if (role) {
          const entriesObj = {};
          const entriesArray = entries.split(",");
          for (const entry of entriesArray) {
            const [hashedOwnerKey, accessLevelsShort] = entry.split("/");
            const accessLevels = accessLevelsShort.split("").map((short) => ReverseLevelMap[short]);
            entriesObj[hashedOwnerKey] = accessLevels;
          }
          this.entries[role] = entriesObj;
        }
      }
    }
  }
}

var __defProp$N = Object.defineProperty;
var __defNormalProp$N = (obj, key, value) => key in obj ? __defProp$N(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$N = (obj, key, value) => __defNormalProp$N(obj, typeof key !== "symbol" ? key + "" : key, value);
const _SmythFS = class _SmythFS {
  constructor() {
    __publicField$N(this, "storage");
    if (!ConnectorService.ready) {
      throw new Error("SRE not available");
    }
    this.storage = ConnectorService.getStorageConnector();
  }
  static get Instance() {
    if (!this.instance) {
      this.instance = new _SmythFS();
    }
    return this.instance;
  }
  URIParser(uri) {
    const parts = uri.split("://");
    if (parts.length !== 2) return void 0;
    if (parts[0].toLowerCase() !== "smythfs") return void 0;
    const parsed = new URL(`http://${parts[1]}`);
    const tld = parsed.hostname.split(".").pop();
    if (tld !== "team") throw new Error("Invalid Resource URI");
    const team = parsed.hostname.replace(`.${tld}`, "");
    return {
      hash: parsed.hash,
      team,
      path: parsed.pathname
    };
  }
  getStoragePath(uri) {
    const smythURI = this.URIParser(uri);
    if (!smythURI) throw new Error("Invalid Resource URI");
    return `teams/${smythURI.team}${smythURI.path}`;
  }
  async read(uri, candidate) {
    const smythURI = this.URIParser(uri);
    if (!smythURI) throw new Error("Invalid Resource URI");
    const resourceId = `teams/${smythURI.team}${smythURI.path}`;
    const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);
    const data = await this.storage.user(_candidate).read(resourceId);
    return this.toBuffer(data);
  }
  async toBuffer(data) {
    if (Buffer.isBuffer(data)) {
      return data;
    } else if (typeof data === "string") {
      return Buffer.from(data, "utf-8");
    } else if (data instanceof Uint8Array) {
      return Buffer.from(data);
    } else if (data instanceof Readable) {
      return new Promise((resolve, reject) => {
        const chunks = [];
        data.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        data.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
        data.on("error", (err) => {
          reject(err);
        });
      });
    } else {
      throw new Error("Unsupported data type");
    }
  }
  async write(uri, data, candidate, metadata) {
    const smythURI = this.URIParser(uri);
    if (!smythURI) throw new Error("Invalid Resource URI");
    const accountConnector = ConnectorService.getAccountConnector();
    const isMember = await accountConnector.isTeamMember(smythURI.team, candidate);
    if (!isMember) throw new Error("Access Denied");
    const resourceId = `teams/${smythURI.team}${smythURI.path}`;
    const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);
    const acl = new ACL().addAccess(TAccessRole.Team, smythURI.team, TAccessLevel.Read).ACL;
    if (!metadata) metadata = {};
    if (!metadata?.ContentType) {
      metadata.ContentType = await this.getMimeType(data);
      if (!metadata.ContentType) {
        const ext = uri.split(".").pop();
        if (ext) {
          metadata.ContentType = mime.getType(ext) || "application/octet-stream";
        }
      }
    }
    await this.storage.user(_candidate).write(resourceId, data, acl, metadata);
  }
  async getMimeType(data) {
    if (data instanceof Blob) return data.type;
    if (isBuffer(data)) {
      try {
        const fileType = await FileType.fileTypeFromBuffer(data);
        return fileType.mime;
      } catch {
        return "";
      }
    }
    if (typeof data === "string") {
      return "text/plain";
    }
  }
  async delete(uri, candidate) {
    const smythURI = this.URIParser(uri);
    if (!smythURI) throw new Error("Invalid Resource URI");
    const resourceId = `teams/${smythURI.team}${smythURI.path}`;
    const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);
    await this.storage.user(_candidate).delete(resourceId);
  }
  //TODO: should we require access token here ?
  async exists(uri, candidate) {
    const smythURI = this.URIParser(uri);
    if (!smythURI) throw new Error("Invalid Resource URI");
    const resourceId = `teams/${smythURI.team}${smythURI.path}`;
    const _candidate = candidate instanceof AccessCandidate ? candidate : new AccessCandidate(candidate);
    return await this.storage.user(_candidate).exists(resourceId);
  }
};
//singleton
__publicField$N(_SmythFS, "instance");
let SmythFS = _SmythFS;

var __defProp$M = Object.defineProperty;
var __defNormalProp$M = (obj, key, value) => key in obj ? __defProp$M(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$M = (obj, key, value) => __defNormalProp$M(obj, typeof key !== "symbol" ? key + "" : key, value);
class BinaryInput {
  constructor(data, _name, mimetype) {
    this._name = _name;
    this.mimetype = mimetype;
    __publicField$M(this, "size");
    __publicField$M(this, "url");
    __publicField$M(this, "_ready");
    __publicField$M(this, "_readyPromise");
    __publicField$M(this, "_source");
    __publicField$M(this, "_uploading", false);
    if (!_name) _name = uid();
    this._name = _name;
    this.load(data, _name, mimetype);
  }
  async ready() {
    if (this._ready) return true;
    if (!this._readyPromise) {
      this._readyPromise = new Promise((resolve) => {
        const interval = setInterval(() => {
          if (this._ready) {
            clearInterval(interval);
            resolve(true);
          }
        }, 100);
      });
    }
    return this._readyPromise;
  }
  async load(data, name, mimetype) {
    const ext = name.split(".").pop();
    this.mimetype = mimetype || mime.getType(ext) || "application/octet-stream";
    this.url = ``;
    if (typeof data === "object" && data.url && data.mimetype && data.size) {
      this.mimetype = data.mimetype;
      this.size = data.size;
      this.url = data.url;
      this._ready = true;
      return;
    }
    if (isUrl(data)) {
      const info = await this.getUrlInfo(data);
      this.mimetype = info.contentType;
      this.size = info.contentLength;
      try {
        const response = await axios({
          method: "get",
          url: data,
          responseType: "arraybuffer"
          // Important for handling binary data
        });
        this._source = Buffer.from(response.data, "binary");
        this.size = response.data.byteLength;
        const ext2 = mime.getExtension(this.mimetype);
        if (!this._name.endsWith(`.${ext2}`)) this._name += `.${ext2}`;
      } catch (error) {
        console.error("Error loading binary data from url:", data.url);
      }
      this._ready = true;
      return;
    }
    const base64FileInfo = await this.getBase64FileInfo(data);
    if (base64FileInfo) {
      this.mimetype = base64FileInfo.mimetype;
      this.size = base64FileInfo.size;
      this._source = base64FileInfo.data;
      const ext2 = mime.getExtension(this.mimetype);
      if (!this._name.endsWith(`.${ext2}`)) this._name += `.${ext2}`;
      this._ready = true;
      return;
    }
    if (typeof data === "string") {
      this._source = Buffer.from(data);
      this.size = data.length;
      this.mimetype = "text/plain";
      if (!this._name.endsWith(`.txt`)) this._name += `.txt`;
      this._ready = true;
      return;
    }
    if (Buffer.isBuffer(data)) {
      this._source = data;
      this.size = getSizeFromBinary(data);
      const fileType = await FileType.fileTypeFromBuffer(data);
      this.mimetype = fileType.mime;
      const ext2 = mime.getExtension(this.mimetype);
      if (!this._name.endsWith(`.${ext2}`)) this._name += `.${ext2}`;
    }
    this._ready = true;
  }
  async getUrlInfo(url) {
    try {
      const response = await axios.head(url);
      const contentType = response.headers["content-type"];
      const contentLength = response.headers["content-length"];
      return { contentType, contentLength };
    } catch (error) {
      return { contentType: "", contentLength: 0 };
    }
  }
  async getBase64FileInfo(data) {
    const validUrlFormatRegex = /data:[^;]+;base64,[A-Za-z0-9+\/]*(={0,2})?$/gm;
    if (!validUrlFormatRegex.test(data)) {
      return null;
    }
    const base64Data = data.split(",")[1];
    const buffer = Buffer.from(base64Data, "base64");
    const size = buffer.byteLength;
    const filetype = await FileType.fileTypeFromBuffer(buffer);
    return { size, data: buffer, mimetype: filetype?.mime || "" };
  }
  static from(data, name, mimetype) {
    if (data instanceof BinaryInput) return data;
    return new BinaryInput(data, name, mimetype);
  }
  async upload(candidate) {
    await this.ready();
    if (this._uploading) return;
    try {
      this._uploading = true;
      if (!this.url) {
        const accountConnector = ConnectorService.getAccountConnector();
        const teamId = await accountConnector.getCandidateTeam(candidate);
        this.url = `smythfs://${teamId}.team/${candidate.id}/_temp/${this._name}`;
        await SmythFS.Instance.write(this.url, this._source, candidate);
        this._uploading = false;
      }
    } catch (error) {
      console.error("Error uploading binary data:", error);
      this._uploading = false;
    }
  }
  async getJsonData(candidate) {
    await this.upload(candidate);
    return {
      mimetype: this.mimetype,
      size: this.size,
      url: this.url
    };
  }
  async readData(candidate) {
    await this.ready();
    if (!this.url) {
      throw new Error("Binary data not ready");
    }
    const data = await SmythFS.Instance.read(this.url, candidate);
    return data;
  }
  async getBuffer() {
    await this.ready();
    return this._source;
  }
}

var __defProp$L = Object.defineProperty;
var __defNormalProp$L = (obj, key, value) => key in obj ? __defProp$L(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$L = (obj, key, value) => __defNormalProp$L(obj, typeof key !== "symbol" ? key + "" : key, value);
class JSONContentHelper {
  constructor(dataString) {
    this.dataString = dataString;
    __publicField$L(this, "_current");
    this._current = dataString;
  }
  get result() {
    return this._current;
  }
  static create(dataString) {
    return new JSONContentHelper(dataString);
  }
  /**
   * This function tries to extract and parse a JSON object from a string. If it fails, it returns the original string.
   * if the string is not a JSON representation, but contains a JSON object, it will extract and parse it.
   * @returns
   */
  tryParse() {
    const strInput = this._current;
    if (!isValidString(strInput)) return strInput;
    let str = (this.extractJsonFromString(strInput) || strInput).trim();
    if (isDigits(str) && !isSafeNumber(str) || !str.startsWith("{") && !str.startsWith("[")) return str;
    try {
      return JSON.parse(str);
    } catch (e) {
      try {
        return JSON.parse(jsonrepair(str));
      } catch (e2) {
        return strInput;
      }
    }
  }
  extractJsonFromString(str) {
    try {
      const regex = /(\{.*\})/s;
      const match = str.match(regex);
      return match?.[1];
    } catch {
      return null;
    }
  }
}
function JSONContent(dataString) {
  return JSONContentHelper.create(dataString);
}

const InferenceStrategies = {
  any: inferAnyType,
  string: inferStringType,
  number: inferNumberType,
  integer: inferIntegerType,
  boolean: inferBooleanType,
  array: inferArrayType,
  object: inferObjectType,
  binary: inferBinaryType,
  date: inferDateType
};
async function performTypeInference(inputs, inputConfig, agent) {
  try {
    if (!inputConfig || Object.keys(inputConfig)?.length === 0) return inputs;
    const _inputs = { ...inputs };
    const _inputConfig = {};
    for (const input of inputConfig) {
      if (input?.name) {
        _inputConfig[input.name] = { ...input };
      }
    }
    for (const [key, config] of Object.entries(_inputConfig)) {
      let value = inputs?.[key] || "";
      if (!value) continue;
      const type = config?.type?.toLowerCase() || "any";
      if (!InferenceStrategies[type]) {
        throw new Error(`Invalid type: ${type} for Input: ${key}`);
      }
      _inputs[key] = await InferenceStrategies[type](value, key, agent);
    }
    return _inputs;
  } catch (error) {
    throw error;
  }
}
async function inferStringType(value, key, agent) {
  if (value === null || value === void 0 || value === "null" || value === "undefined") {
    return "";
  } else if (isRawBase64(value) || isDataUrl(value)) {
    return value;
  } else if (typeof value === "object" || Array.isArray(value)) {
    return JSON.stringify(value);
  } else {
    return String(value);
  }
}
async function inferNumberType(value, key, agent) {
  const floatVal = parseFloat(value);
  if (isNaN(floatVal)) {
    throw new Error("Invalid Number value");
  }
  return floatVal;
}
async function inferIntegerType(value, key, agent) {
  const intVal = parseInt(value);
  if (isNaN(intVal)) throw new Error("Invalid Integer value");
  return intVal;
}
async function inferBooleanType(value, key, agent) {
  if (typeof value === "boolean") {
    return value;
  } else if (typeof value === "string" || typeof value === "number") {
    const lowerCaseValue = String(value).toLowerCase();
    if (["true", "1"].includes(lowerCaseValue)) {
      return true;
    } else if (["false", "0"].includes(lowerCaseValue)) {
      return false;
    } else {
      throw new Error("Invalid Boolean value");
    }
  } else {
    throw new Error("Invalid Boolean value");
  }
}
async function inferArrayType(value, key, agent) {
  try {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") throw new Error("Invalid Array value");
    try {
      return value.trim().startsWith("[") ? JSONContent(value).tryParse() : value.split(",");
    } catch {
      throw new Error("Invalid Array value");
    }
  } catch (error) {
    throw new Error("Invalid Array value");
  }
}
async function inferObjectType(value, key, agent) {
  try {
    const obj = isPlainObject(value) ? value : JSONContent(value).tryParse();
    if (!isPlainObject(obj)) throw new Error("Invalid Object value");
    return obj;
  } catch (error) {
    throw new Error("Invalid Object value");
  }
}
async function inferBinaryType(value, key, agent) {
  const binaryInput = BinaryInput.from(value, uid() + "-" + key);
  return await binaryInput.getJsonData(AccessCandidate.agent(agent.id));
}
async function inferDateType(value, key, agent) {
  const errMsg = `Invalid Date value
The date string is expected to be in a format commonly used in English-speaking countries.`;
  if (typeof value !== "string" && typeof value !== "number") throw new Error(errMsg);
  let date;
  if (typeof value === "string" && isNaN(Number(value))) {
    date = dayjs(value).locale("en");
  } else {
    const timestamp = typeof value === "number" ? value : Number(value);
    date = dayjs.unix(timestamp / 1e3);
  }
  if (!date.isValid()) throw new Error(errMsg);
  return date.toISOString();
}
async function inferAnyType(value) {
  return value;
}

var __defProp$K = Object.defineProperty;
var __defNormalProp$K = (obj, key, value) => key in obj ? __defProp$K(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$K = (obj, key, value) => __defNormalProp$K(obj, typeof key !== "symbol" ? key + "" : key, value);
class Component {
  constructor() {
    __publicField$K(this, "hasReadOutput", false);
    __publicField$K(this, "hasPostProcess", true);
    __publicField$K(this, "alwaysActive", false);
    //for components like readable memories
    __publicField$K(this, "exclusive", false);
    //for components like writable memories : when exclusive components are active, they are processed in a run cycle bofore other components
    __publicField$K(this, "configSchema");
  }
  init() {
  }
  createComponentLogger(agent, name) {
    const logger = Logger(name || this.constructor.name, agent?.agentRuntime?.debug);
    return logger;
  }
  async validateConfig(config) {
    if (!this.configSchema) return {};
    if (config.data._templateVars) {
      for (let tplVar in config.data._templateVars) {
        this.configSchema = this.configSchema.append({ [tplVar]: Joi.any() });
      }
    }
    const valid = await this.configSchema.validate(config.data);
    if (valid.error) {
      return {
        id: config.id,
        name: config.name,
        _error: `Schema Validation error: ${valid?.error?.message} on component ${config.displayName}:${config.title}`,
        _debug: `Schema Validation error: ${valid?.error?.message} on component ${config.displayName}:${config.title}`
      };
    }
    return {};
  }
  async process(input, config, agent) {
    const _input = await performTypeInference(input, config?.inputs, agent);
    for (const [key, value] of Object.entries(_input)) {
      input[key] = value;
    }
  }
  async postProcess(output, config, agent) {
    if (output?.result) {
      delete output?.result?._debug;
      if (!output?.result?._error) delete output?.result?._error;
    }
    return output;
  }
  async enable(config, agent) {
  }
  async disable(config, agent) {
  }
  readOutput(id, config, agent) {
    return null;
  }
  hasOutput(id, config, agent) {
    return false;
  }
}

class VaultHelper {
  static async getTeamKey(key, teamId) {
    const vaultConnector = ConnectorService.getVaultConnector();
    return await vaultConnector.user(AccessCandidate.team(teamId)).get(key);
  }
  static async getUserKey(key, userId) {
    const vaultConnector = ConnectorService.getVaultConnector();
    const accountConnector = ConnectorService.getAccountConnector();
    const teamId = await accountConnector.getCandidateTeam(AccessCandidate.user(userId));
    return await vaultConnector.user(AccessCandidate.team(teamId)).get(key);
  }
  static async getAgentKey(key, agentId) {
    const vaultConnector = ConnectorService.getVaultConnector();
    const accountConnector = ConnectorService.getAccountConnector();
    const teamId = await accountConnector.getCandidateTeam(AccessCandidate.agent(agentId));
    return await vaultConnector.user(AccessCandidate.team(teamId)).get(key);
  }
}

var __defProp$J = Object.defineProperty;
var __defNormalProp$J = (obj, key, value) => key in obj ? __defProp$J(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$J = (obj, key, value) => __defNormalProp$J(obj, typeof key !== "symbol" ? key + "" : key, value);
const Match = {
  default: /{{(.*?)}}/g,
  //matches all placeholders
  doubleCurly: /{{(.*?)}}/g,
  singleCurly: /{(.*?)}/g,
  //matches only the placeholders that have a specific prefix
  prefix(prefix) {
    return new RegExp(`{{${prefix}(.*?)}}`, "g");
  },
  //matches only the placeholders that have a specific suffix
  suffix(suffix) {
    return new RegExp(`{{(.*?)${suffix}}}`, "g");
  },
  //matches only the placeholders that have a specific prefix and suffix
  prefSuf(prefix, suffix) {
    return new RegExp(`{{${prefix}(.*?)${suffix}}}`, "g");
  },
  //matches a function annotation with a given name, just like prefix but with wrapping parenthesis
  fn(name) {
    return new RegExp(`{{${name}\\((.*?)\\)}}`, "g");
  }
};
const TPLProcessor = {
  vaultTeam(teamId) {
    return async (token) => await VaultHelper.getTeamKey(token, teamId);
  }
};
class TemplateStringHelper {
  constructor(templateString) {
    this.templateString = templateString;
    __publicField$J(this, "_current");
    //this queue is used to wait for asyncronous results when async processors are used
    //if all processors are synchronous, this queue will be empty and .result getter can be used
    //if any processor is async, the .result getter will throw an error and you should use .asyncResult instead
    __publicField$J(this, "_promiseQueue", []);
    this._current = templateString;
  }
  get result() {
    if (this._promiseQueue.length <= 0) return this._current;
    throw new Error("This template object has async results, you should use .asyncResult with await instead of .result");
  }
  get asyncResult() {
    return new Promise(async (resolve, reject) => {
      await Promise.all(this._promiseQueue);
      resolve(this._current);
    });
  }
  static create(templateString) {
    return new TemplateStringHelper(templateString);
  }
  /**
   * Parses a template string by replacing the placeholders with the values from the provided data object
   * unmatched placeholders will be left as is
   */
  parse(data, regex = Match.default) {
    if (typeof this._current !== "string") return this;
    this._current = this._current.replace(regex, (match, token) => {
      return data[token] || match;
    });
    return this;
  }
  /**
   * This is a shortcut function that parses vault key values and replace them with corresponding values from team vault
   * @param teamId
   * @returns
   */
  parseTeamKeys(teamId) {
    return this.process(TPLProcessor.vaultTeam(teamId), Match.fn("KEY"));
  }
  /**
   * Processes a template string by replacing the placeholders with the result of the provided processor function
   * The processor function receives the token as an argument and should return the value to replace the token with
   * If the processor function returns undefined, the token will be left as is
   */
  process(processor, regex = Match.default) {
    if (typeof this._current !== "string") return this;
    let tokens = {};
    let match;
    const prosessorPromises = [];
    while ((match = regex.exec(this._current)) !== null) {
      const token = match[1];
      tokens[token] = match[0];
      const _processor = processor(token);
      if (_processor instanceof Promise) {
        _processor.then((result) => {
          if (result === void 0) {
            return match[0];
          }
          tokens[token] = result;
        });
        prosessorPromises.push(_processor);
      } else {
        tokens[token] = _processor;
      }
    }
    if (prosessorPromises.length > 0) {
      new Promise(async (resolve, reject) => {
        await Promise.all(prosessorPromises);
        this.parse(tokens, regex);
        resolve(true);
      });
      this._promiseQueue.push(Promise.all(prosessorPromises));
    } else {
      this.parse(tokens, regex);
    }
    return this;
  }
  /**
   * Removes all placeholders from the template string, leaving only the plain text
   * This is useful when you want to clean up a template string that has placeholders that were not parsed
   */
  clean(regex = Match.default) {
    if (typeof this._current !== "string") return this;
    this._current = this._current.replace(regex, "");
    return this;
  }
  // public toString() {
  //     if (this._promiseQueue.length <= 0) return this._current;
  //     return new Promise(async (resolve, reject) => {
  //         await Promise.all(this._promiseQueue);
  //         resolve(this._current);
  //     });
  // }
}
function escapeString(str) {
  if (!str) return str;
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
}
function TemplateString(templateString) {
  return TemplateStringHelper.create(templateString);
}

var __defProp$I = Object.defineProperty;
var __defNormalProp$I = (obj, key, value) => key in obj ? __defProp$I(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$I = (obj, key, value) => __defNormalProp$I(obj, typeof key !== "symbol" ? key + "" : key, value);
function isEmpty(value) {
  return value === void 0 || value === null || typeof value === "string" && value.trim() === "" || Array.isArray(value) && value.length === 0 || typeof value === "object" && value !== null && Object.keys(value).length === 0;
}
function isTemplateVar(str = "") {
  if (!str || typeof str !== "string") return false;
  return (str?.match(/{{(.*?)}}/g) ?? []).length > 0;
}
function isKeyTemplateVar(str = "") {
  if (!str || typeof str !== "string") return false;
  return (str?.match(/{{KEY\((.*?)\)}}/g) ?? []).length > 0;
}
function parseKey(str = "", teamId) {
  return str.replace(/{{KEY\((.*?)\)}}/g, (match, key) => {
    return key === "teamid" ? teamId : "";
  });
}
class APIEndpoint extends Component {
  constructor() {
    super();
    __publicField$I(this, "configSchema", Joi.object({
      endpoint: Joi.string().pattern(/^[a-zA-Z0-9]+([-_][a-zA-Z0-9]+)*$/).max(50).required(),
      method: Joi.string().valid("POST", "GET").allow(""),
      //we're accepting empty value because we consider it POST by default.
      description: Joi.string().max(5e3).allow(""),
      summary: Joi.string().max(1e3).allow(""),
      doc: Joi.string().max(1e3).allow(""),
      ai_exposed: Joi.boolean().default(true)
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const req = agent.agentRequest;
    const logger = this.createComponentLogger(agent, config.name);
    const headers = req ? req.headers : {};
    let body = req ? req.body : input;
    const params = req ? req.params : {};
    let query = req ? req.query : {};
    const _authInfo = req ? req._agent_authinfo : void 0;
    for (const [key, value] of Object.entries(body)) {
      if (isKeyTemplateVar(value)) {
        body[key] = await parseKey(value, agent?.teamId);
      } else if (isTemplateVar(value)) {
        body[key] = TemplateString(value).parse(input).result;
      }
    }
    for (const [key, value] of Object.entries(query)) {
      if (isKeyTemplateVar(value)) {
        query[key] = await parseKey(value, agent?.teamId);
      } else if (isTemplateVar(value)) {
        query[key] = TemplateString(value).parse(input).result;
      }
    }
    const inputsWithDefaultValue = config.inputs.filter(
      (input2) => input2.defaultVal !== void 0 && input2.defaultVal !== "" && input2.defaultVal !== null
    );
    const bodyInputNames = [];
    const queryInputNames = [];
    for (const output of config.outputs) {
      const outputName = output?.expression || output?.name;
      const inputName = outputName?.split(".")[1];
      if (inputName) {
        if (outputName?.includes("body")) {
          bodyInputNames.push(inputName);
        }
        if (outputName?.includes("query")) {
          queryInputNames.push(inputName);
        }
      }
    }
    for (const _inputWithDefaultValue of inputsWithDefaultValue) {
      const inputName = _inputWithDefaultValue?.name;
      let inputValue = input[inputName];
      if (bodyInputNames.includes(inputName) && isEmpty(body[inputName])) {
        body[inputName] = inputValue;
      }
      if (queryInputNames.includes(inputName) && isEmpty(query[inputName])) {
        query[inputName] = inputValue;
      }
    }
    const isDbgInjection = req.header("X-Debug-Inj") !== void 0;
    if (isDbgInjection && agent.agentRuntime.debug && Object.values(input).length > 0) {
      switch (config.data.method) {
        case "GET":
          for (const [key, value] of Object.entries(input)) {
            if (value instanceof BinaryInput) {
              logger.debug("[WARNING] Binary files are not supported for GET requests. Key:", key);
            } else {
              query[key] = value;
            }
          }
          break;
        case "POST":
        default:
          body = input;
          break;
      }
    }
    body = await performTypeInference(body, config.inputs, agent);
    query = await performTypeInference(query, config.inputs, agent);
    logger.debug("Parsing inputs");
    logger.debug(" Headers", headers);
    logger.debug(" Body", body);
    logger.debug(" Params", params);
    logger.debug(" Query", query);
    logger.debug("Parsing body json input");
    for (let key in body) {
      const value = body[key];
      if (typeof value === "string" && value.trim().startsWith("{") && value.trim().endsWith("}")) {
        try {
          const obj = JSON.parse(jsonrepair(body[key]));
          body[key] = obj;
        } catch {
        }
      }
    }
    logger.debug("Parsed body json input", body);
    logger.debug("Parsing query json input");
    for (let key in query) {
      const value = query[key];
      if (typeof value === "string" && value.trim().startsWith("{") && value.trim().endsWith("}")) {
        try {
          const obj = JSON.parse(jsonrepair(query[key]));
          query[key] = obj;
        } catch {
        }
      }
    }
    logger.debug("Parsed query json input", query);
    for (let input2 of config.inputs) {
      if (!input2.isFile && input2?.type?.toLowerCase() !== "binary") continue;
      const fieldname = input2.name;
      logger.debug("Parsing file input ", fieldname);
      let binaryInput = body[fieldname];
      if (!(binaryInput instanceof BinaryInput)) {
        if (req.files?.length > 0) {
          const file = req.files.find((file2) => file2.fieldname === fieldname);
          if (!file) continue;
          binaryInput = new BinaryInput(file.buffer, uid() + "-" + file.originalname, file.mimetype);
        }
      }
      if (binaryInput instanceof BinaryInput) {
        body[fieldname] = await binaryInput.getJsonData(AccessCandidate.agent(agent.id));
      }
    }
    return { headers, body, query, params, _authInfo, _debug: logger.output };
  }
}

var __defProp$H = Object.defineProperty;
var __defNormalProp$H = (obj, key, value) => key in obj ? __defProp$H(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$H = (obj, key, value) => __defNormalProp$H(obj, typeof key !== "symbol" ? key + "" : key, value);
class APIOutput extends Component {
  constructor() {
    super();
    __publicField$H(this, "configSchema", Joi.object({
      format: Joi.string().valid("full", "minimal").required().label("Output Format")
    }));
    __publicField$H(this, "hasPostProcess", true);
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    const _error = void 0;
    const Output = {};
    logger.debug(` Processing outputs `);
    for (let key in input) {
      Output[key] = input[key];
    }
    return { Output, _error, _debug: logger.output };
  }
  async postProcess(output, config, agent) {
    for (let agentVar in agent.agentVariables) {
      delete output?.result?.Output?.[agentVar];
    }
    if (config?.data?.format == "minimal") {
      if (output?.result?.Output) {
        return output?.result?.Output;
      }
      if (output?.result?._error) {
        return output?.result?._error;
      }
      delete output.id;
      delete output.name;
    }
    return output;
  }
}

var models = {
  // GPT-4o
  "gpt-4o-mini": {
    llm: "OpenAI",
    alias: "gpt-4o-mini-2024-07-18",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "VisionLLM",
      "AgentPlugin",
      "Chatbot"
    ]
  },
  "gpt-4o-mini-2024-07-18": {
    llm: "OpenAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 128e3, completionTokens: 16383 }
  },
  "gpt-4o": {
    llm: "OpenAI",
    alias: "gpt-4o-2024-05-13",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "VisionLLM",
      "AgentPlugin",
      "Chatbot"
    ]
  },
  "gpt-4o-2024-05-13": {
    llm: "OpenAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 128e3, completionTokens: 4096 }
  },
  // GPT-4-turbo
  "gpt-4-turbo-latest": {
    llm: "OpenAI",
    alias: "gpt-4-turbo-2024-04-09",
    components: ["PromptGenerator", "LLMAssistant", "Classifier"],
    tags: ["legacy"]
  },
  "gpt-4-turbo": {
    llm: "OpenAI",
    alias: "gpt-4-turbo-2024-04-09",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "VisionLLM",
      "GPTPlugin",
      "AgentPlugin",
      "Chatbot"
    ],
    tags: ["legacy"]
  },
  "gpt-4-turbo-2024-04-09": {
    llm: "OpenAI",
    tokens: 1024,
    completionTokens: 1024,
    enabled: true,
    keyOptions: { tokens: 128e3, completionTokens: 4096 }
  },
  // GPT-4
  "gpt-4-latest": {
    llm: "OpenAI",
    alias: "gpt-4-0613",
    enabled: true,
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["legacy"]
  },
  "gpt-4": {
    llm: "OpenAI",
    tokens: 1024,
    completionTokens: 1024,
    enabled: true,
    keyOptions: { tokens: 8192, completionTokens: 8192 },
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "GPTPlugin",
      "AgentPlugin",
      "Chatbot"
    ],
    tags: ["legacy"]
  },
  "gpt-4-0613": {
    llm: "OpenAI",
    tokens: 1024,
    completionTokens: 1024,
    enabled: true,
    hidden: true,
    keyOptions: { tokens: 8192, completionTokens: 8192 }
  },
  "gpt-4-vision-preview": {
    llm: "OpenAI",
    tokens: 1024,
    completionTokens: 1024,
    enabled: true,
    keyOptions: { tokens: 128e3, completionTokens: 4096 },
    components: ["VisionLLM"],
    tags: ["legacy"]
  },
  "gpt-4-1106-vision-preview": {
    llm: "OpenAI",
    tokens: 1024,
    completionTokens: 1024,
    enabled: true,
    keyOptions: { tokens: 128e3, completionTokens: 4096 },
    tags: ["legacy"]
  },
  // GPT-3.5
  "gpt-3.5-turbo-latest": {
    llm: "OpenAI",
    alias: "gpt-3.5-turbo-0125",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "GPTPlugin",
      "AgentPlugin",
      "Chatbot"
    ],
    tags: ["legacy"]
  },
  "gpt-3.5-turbo": {
    llm: "OpenAI",
    alias: "gpt-3.5-turbo-0125",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "GPTPlugin",
      "AgentPlugin",
      "Chatbot"
    ],
    tags: ["legacy"]
  },
  "gpt-3.5-turbo-0125": {
    llm: "OpenAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 16385, completionTokens: 4096 }
  },
  "gpt-3.5-turbo-1106": {
    llm: "OpenAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: true,
    keyOptions: { tokens: 16384, completionTokens: 4096 },
    //components: ['PromptGenerator', 'LLMAssistant'],
    tags: ["legacy"]
  },
  "gpt-3.5-turbo-16k": {
    llm: "OpenAI",
    alias: "gpt-3.5-turbo-0125",
    //components: ['PromptGenerator', 'LLMAssistant'],
    tags: ["legacy"]
  },
  // legacy model to continue support for Agent Plugins
  "gpt-3.5-turbo-0613": {
    llm: "OpenAI",
    alias: "gpt-3.5-turbo-0125",
    //components: ['GPTPlugin', 'AgentPlugin'],
    tags: ["deprecated"]
  },
  // AnthropicAI
  "claude-3-opus": {
    llm: "AnthropicAI",
    alias: "claude-3-opus-20240229",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "VisionLLM",
      "AgentPlugin",
      "Chatbot"
    ]
  },
  "claude-3.5-sonnet": {
    llm: "AnthropicAI",
    alias: "claude-3-5-sonnet-20240620",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "VisionLLM",
      "AgentPlugin",
      "Chatbot"
    ]
  },
  "claude-3-sonnet": {
    llm: "AnthropicAI",
    alias: "claude-3-sonnet-20240229",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "VisionLLM",
      "AgentPlugin",
      "Chatbot"
    ],
    tags: ["legacy"]
  },
  "claude-3-haiku": {
    llm: "AnthropicAI",
    alias: "claude-3-haiku-20240307",
    components: [
      "PromptGenerator",
      "LLMAssistant",
      "Classifier",
      "VisionLLM",
      "AgentPlugin",
      "Chatbot"
    ]
  },
  "claude-3-opus-20240229": {
    llm: "AnthropicAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2e5, completionTokens: 4096, enabled: true }
  },
  "claude-3-5-sonnet-20240620": {
    llm: "AnthropicAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2e5, completionTokens: 4096, enabled: true }
  },
  "claude-3-sonnet-20240229": {
    llm: "AnthropicAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2e5, completionTokens: 4096, enabled: true }
  },
  "claude-3-haiku-20240307": {
    llm: "AnthropicAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2e5, completionTokens: 4096, enabled: true }
  },
  "claude-2.1": {
    llm: "AnthropicAI",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2e5, completionTokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant", "Classifier"],
    tags: ["legacy"]
  },
  "claude-instant-1.2": {
    llm: "AnthropicAI",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 1e5, completionTokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant", "Classifier"],
    tags: ["legacy"]
  },
  /*** Models from Google AI ***/
  // Gemini 1.5 pro
  "gemini-1.5-pro-latest": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant", "VisionLLM", "MultimodalLLM"],
    tags: ["legacy"]
  },
  "gemini-1.5-pro-exp-0801": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant", "VisionLLM", "MultimodalLLM"]
  },
  "gemini-1.5-pro-latest-stable": {
    llm: "GoogleAI",
    alias: "gemini-1.5-pro",
    components: ["PromptGenerator", "LLMAssistant", "VisionLLM", "MultimodalLLM"]
  },
  "gemini-1.5-pro-stable": {
    llm: "GoogleAI",
    alias: "gemini-1.5-pro-001",
    components: ["PromptGenerator", "LLMAssistant", "VisionLLM", "MultimodalLLM"]
  },
  "gemini-1.5-pro": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true }
  },
  "gemini-1.5-pro-001": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 2097152, completionTokens: 8192, enabled: true }
  },
  // Gemini 1.5 flash
  "gemini-1.5-flash-latest": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant", "VisionLLM", "MultimodalLLM"],
    tags: ["legacy"]
  },
  "gemini-1.5-flash-latest-stable": {
    llm: "GoogleAI",
    alias: "gemini-1.5-flash",
    components: ["PromptGenerator", "LLMAssistant", "VisionLLM", "MultimodalLLM"],
    tags: ["legacy"]
  },
  "gemini-1.5-flash-stable": {
    llm: "GoogleAI",
    alias: "gemini-1.5-flash-001",
    components: ["PromptGenerator", "LLMAssistant", "VisionLLM", "MultimodalLLM"]
  },
  "gemini-1.5-flash": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true }
  },
  "gemini-1.5-flash-001": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 1048576, completionTokens: 8192, enabled: true }
  },
  // Gemini 1.0 pro
  "gemini-1.0-pro-latest": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 30720, completionTokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["legacy"]
  },
  "gemini-1.0-pro-latest-stable": {
    llm: "GoogleAI",
    alias: "gemini-1.0-pro",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["legacy"]
  },
  "gemini-1.0-pro-stable": {
    llm: "GoogleAI",
    alias: "gemini-1.0-pro-001",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["legacy"]
  },
  "gemini-1.0-pro": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 30720, completionTokens: 8192, enabled: true }
  },
  "gemini-1.0-pro-001": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 30720, completionTokens: 8192, enabled: true }
  },
  "gemini-pro-vision": {
    llm: "GoogleAI",
    tokens: 2048,
    completionTokens: 2048,
    enabled: false,
    keyOptions: { tokens: 12288, completionTokens: 4096, enabled: true },
    components: ["VisionLLM"],
    tags: ["legacy"]
  },
  /* Groq */
  "groq-llama-3.1-405b-reasoning": {
    llm: "Groq",
    alias: "llama-3.1-405b-reasoning",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "llama-3.1-405b-reasoning": {
    llm: "Groq",
    tokens: 16e3,
    completionTokens: 16e3,
    enabled: false,
    keyOptions: { tokens: 131072, completionTokens: 131072, enabled: true }
  },
  "groq-llama-3.1-70b-versatile": {
    llm: "Groq",
    alias: "llama-3.1-70b-versatile",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "llama-3.1-70b-versatile": {
    llm: "Groq",
    tokens: 8e3,
    completionTokens: 8e3,
    enabled: false,
    keyOptions: { tokens: 131072, completionTokens: 131072, enabled: true }
  },
  "groq-llama-3.1-8b-instant": {
    llm: "Groq",
    alias: "llama-3.1-8b-instant",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "llama-3.1-8b-instant": {
    llm: "Groq",
    tokens: 8e3,
    completionTokens: 8e3,
    enabled: false,
    keyOptions: { tokens: 131072, completionTokens: 131072, enabled: true }
  },
  "llama3-groq-70b-8192-tool-use-preview": {
    llm: "Groq",
    tokens: 8192,
    completionTokens: 8192,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "llama3-groq-8b-8192-tool-use-preview": {
    llm: "Groq",
    tokens: 8192,
    completionTokens: 8192,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "groq-llama3-8b": {
    llm: "Groq",
    alias: "llama3-8b-8192",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "llama3-8b-8192": {
    llm: "Groq",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true }
  },
  "groq-llama3-70b": {
    llm: "Groq",
    alias: "llama3-70b-8192",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "llama3-70b-8192": {
    llm: "Groq",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true }
  },
  "groq-llama2-70b": {
    llm: "Groq",
    alias: "llama2-70b-4096",
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "llama2-70b-4096": {
    llm: "Groq",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, completionTokens: 4096, enabled: true }
  },
  "groq-mixtral-8x7b": {
    llm: "Groq",
    alias: "mixtral-8x7b-32768",
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "mixtral-8x7b-32768": {
    llm: "Groq",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, completionTokens: 32768, enabled: true }
  },
  "groq-gemma-7b": {
    llm: "Groq",
    alias: "gemma-7b-it",
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "gemma-7b-it": {
    llm: "Groq",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true }
  },
  "groq-gemma2-9b": {
    llm: "Groq",
    alias: "gemma2-9b-it",
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "gemma2-9b-it": {
    llm: "Groq",
    tokens: 1024,
    completionTokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, completionTokens: 8192, enabled: true }
  },
  /* Together AI */
  "zero-one-ai/Yi-34B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["LLMAssistant"]
    // * Excluded from 'PromptGenerator' (has "```json...```" with JSON response)
  },
  "Austism/chronos-hermes-13b": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  // Meta
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": {
    llm: "TogetherAI",
    tokens: 4096,
    enabled: false,
    keyOptions: { tokens: 128e3, enabled: true },
    components: ["LLMAssistant", "PromptGenerator"],
    tags: ["new"]
  },
  "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": {
    llm: "TogetherAI",
    tokens: 4096,
    enabled: false,
    keyOptions: { tokens: 128e3, enabled: true },
    components: ["LLMAssistant", "PromptGenerator"],
    tags: ["new"]
  },
  "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": {
    llm: "TogetherAI",
    tokens: 4096,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["LLMAssistant", "PromptGenerator"],
    tags: ["new"]
  },
  "meta-llama/Meta-Llama-3-8B-Instruct-Turbo": {
    llm: "TogetherAI",
    tokens: 4096,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["LLMAssistant", "PromptGenerator"],
    tags: ["new"]
  },
  "meta-llama/Meta-Llama-3-70B-Instruct-Turbo": {
    llm: "TogetherAI",
    tokens: 4096,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["LLMAssistant", "PromptGenerator"],
    tags: ["new"]
  },
  "meta-llama/Meta-Llama-3-8B-Instruct-Lite": {
    llm: "TogetherAI",
    tokens: 4096,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["LLMAssistant", "PromptGenerator"],
    tags: ["new"]
  },
  "meta-llama/Meta-Llama-3-70B-Instruct-Lite": {
    llm: "TogetherAI",
    tokens: 4096,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["LLMAssistant", "PromptGenerator"],
    tags: ["new"]
  },
  "togethercomputer/CodeLlama-13b-Instruct": {
    // ! DEPRECATED: will be removed (replace with codellama/CodeLlama-13b-Instruct-hf)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true }
  },
  "codellama/CodeLlama-13b-Instruct-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "togethercomputer/CodeLlama-34b-Instruct": {
    // ! DEPRECATED: will be removed (replaced with codellama/CodeLlama-34b-Instruct-hf)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true }
  },
  "codellama/CodeLlama-34b-Instruct-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "codellama/CodeLlama-70b-Instruct-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "togethercomputer/CodeLlama-7b-Instruct": {
    // ! DEPRECATED: will be removed (replaced with codellama/CodeLlama-7b-Instruct-hf)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true }
  },
  "codellama/CodeLlama-7b-Instruct-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 16384, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "togethercomputer/llama-2-70b-chat": {
    // ! DEPRECATED: will be removed (replaced with meta-llama/Llama-2-70b-chat-hf)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true }
  },
  "meta-llama/Llama-2-70b-chat-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "togethercomputer/llama-2-13b-chat": {
    // ! DEPRECATED: will be removed (replaced with meta-llama/Llama-2-13b-chat-hf)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true }
  },
  "meta-llama/Llama-2-13b-chat-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["LLMAssistant"]
    // * Excluded from 'PromptGenerator' (has introductory text with JSON response)
  },
  "togethercomputer/llama-2-7b-chat": {
    // ! DEPRECATED: will be removed (replaced with meta-llama/Llama-2-7b-chat-hf)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true }
  },
  "meta-llama/Llama-2-7b-chat-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["LLMAssistant"]
    // * Excluded from 'PromptGenerator' (has introductory text with JSON response)
  },
  "meta-llama/Llama-3-8b-chat-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "meta-llama/Llama-3-70b-chat-hf": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "DiscoResearch/DiscoLM-mixtral-8x7b-v2": {
    // ! DEPRECATED: will be removed (404 - not found)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true }
  },
  "togethercomputer/falcon-40b-instruct": {
    // ! DEPRECATED: will be removed (404 - not found)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true }
  },
  "togethercomputer/falcon-7b-instruct": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "togethercomputer/GPT-NeoXT-Chat-Base-20B": {
    // ! DEPRECATED: will be removed (404 - not found)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true }
  },
  "togethercomputer/Llama-2-7B-32K-Instruct": {
    // ! DEPRECATED: will be removed
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true }
  },
  // mistralai
  "mistralai/Mistral-7B-Instruct-v0.1": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "mistralai/Mistral-7B-Instruct-v0.2": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "mistralai/Mistral-7B-Instruct-v0.3": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant", "Classifier"],
    tags: ["new"]
  },
  "mistralai/Mixtral-8x7B-Instruct-v0.1": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant", "Classifier"]
  },
  "mistralai/Mixtral-8x22B-Instruct-v0.1": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 65536, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Gryphe/MythoMax-L2-13b": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  // NousResearch
  "NousResearch/Nous-Hermes-Llama2-70b": {
    // ! DEPRECATED: will be removed (404 - not found)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true }
  },
  "NousResearch/Nous-Capybara-7B-V1p9": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "NousResearch/Nous-Hermes-2-Mistral-7B-DPO": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "NousResearch/Nous-Hermes-2-Yi-34B": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "NousResearch/Nous-Hermes-llama-2-7b": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "NousResearch/Nous-Hermes-Llama2-13b": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  // OpenChat
  "openchat/openchat-3.5-1210": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  // Teknium
  "teknium/OpenHermes-2-Mistral-7B": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "teknium/OpenHermes-2p5-Mistral-7B": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "garage-bAInd/Platypus2-70B-instruct": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "togethercomputer/Pythia-Chat-Base-7B-v0.16": {
    // ! DEPRECATED: will be removed (404 - not found)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true }
  },
  "togethercomputer/Qwen-7B-Chat": {
    // ! DEPRECATED: will be removed (404 - not found)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true }
  },
  "togethercomputer/RedPajama-INCITE-Chat-3B-v1": {
    // ! DEPRECATED: will be removed (Weird response)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true }
  },
  "togethercomputer/RedPajama-INCITE-7B-Chat": {
    // ! DEPRECATED: will be removed (Weird response)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true }
  },
  "upstage/SOLAR-0-70b-16bit": {
    // ! DEPRECATED: will be removed (404 - not found) (replaced with upstage/SOLAR-10.7B-Instruct-v1.0)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true }
  },
  "upstage/SOLAR-10.7B-Instruct-v1.0": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "togethercomputer/StripedHyena-Nous-7B": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "lmsys/vicuna-7b-v1.5": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "lmsys/vicuna-13b-v1.5": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "lmsys/vicuna-13b-v1.5-16k": {
    // ! DEPRECATED: will be removed (not exists in models page)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 16384, enabled: true }
  },
  // Allen AI
  // ! Response it is not JSON and have unnecessary information
  /* 'allenai/OLMo-7B-Instruct': {
        llm: 'TogetherAI',
        tokens: 1024,
        enabled: false,
        keyOptions: { tokens: 2048, enabled: true },
    }, */
  "allenai/OLMo-7B-Twin-2T": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "allenai/OLMo-7B": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  // Qwen
  "Qwen/Qwen1.5-0.5B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["LLMAssistant"],
    // * Excluded from 'PromptGenerator' (has introductory text with JSON response)
    tags: ["new"]
  },
  "Qwen/Qwen1.5-1.8B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Qwen/Qwen1.5-4B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Qwen/Qwen1.5-7B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Qwen/Qwen1.5-14B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Qwen/Qwen1.5-32B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Qwen/Qwen1.5-72B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Qwen/Qwen1.5-110B-Chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  // DeepSeek
  "deepseek-ai/deepseek-coder-33b-instruct": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 16384, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "deepseek-ai/deepseek-llm-67b-chat": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  // Google
  "google/gemma-2b-it": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "google/gemma-7b-it": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "google/gemma-2-9b-it": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "google/gemma-2-27b-it": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  // Undi95
  "Undi95/ReMM-SLERP-L2-13B": {
    // ! DEPRECATED: will be removed (always have empty response)
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true }
  },
  "Undi95/Toppy-M-7B": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  // Others
  "cognitivecomputations/dolphin-2.5-mixtral-8x7b": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "databricks/dbrx-instruct": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "Open-Orca/Mistral-7B-OpenOrca": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 8192, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "snorkelai/Snorkel-Mistral-PairRM-DPO": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 32768, enabled: true },
    components: ["LLMAssistant"],
    // * Excluded from 'PromptGenerator' (has some other text)
    tags: ["new"]
  },
  "Snowflake/snowflake-arctic-instruct": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"],
    tags: ["new"]
  },
  "togethercomputer/alpaca-7b": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 2048, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  },
  "WizardLM/WizardLM-13B-V1.2": {
    llm: "TogetherAI",
    tokens: 1024,
    enabled: false,
    keyOptions: { tokens: 4096, enabled: true },
    components: ["PromptGenerator", "LLMAssistant"]
  }
};

var __defProp$G = Object.defineProperty;
var __defNormalProp$G = (obj, key, value) => key in obj ? __defProp$G(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$G = (obj, key, value) => __defNormalProp$G(obj, typeof key !== "symbol" ? key + "" : key, value);
class LLMHelper$1 {
  constructor(model) {
    this.model = model;
    __publicField$G(this, "_llmConnector");
    __publicField$G(this, "_modelId");
    __publicField$G(this, "_modelInfo");
    const llmName = models[model]?.llm;
    this._modelId = models[model]?.alias || model;
    this._modelInfo = models[this._modelId];
    this._llmConnector = ConnectorService.getLLMConnector(llmName);
  }
  static load(model) {
    return new LLMHelper$1(model);
  }
  get modelInfo() {
    return this._modelInfo;
  }
  get connector() {
    return this._llmConnector;
  }
  async promptRequest(prompt, config = {}, agent, customParams = {}) {
    if (!this._llmConnector) return { error: "LLM request failed", details: `Model ${this.model} not supported` };
    const agentId = agent instanceof Agent ? agent.id : agent;
    const params = await this._llmConnector.extractLLMComponentParams(config);
    params.model = this._modelId;
    Object.assign(params, customParams);
    try {
      prompt = this._llmConnector.enhancePrompt(prompt, config);
      let response = await this._llmConnector.user(AccessCandidate.agent(agentId)).chatRequest(prompt, params);
      const result = this._llmConnector.postProcess(response?.content);
      if (result.error && response.finishReason !== "stop") {
        result.details = "The model stopped before completing the response, this is usually due to output token limit reached.";
      }
      return result;
    } catch (error) {
      return { error: "LLM request failed", details: error?.message || error?.toString() };
    }
  }
  async visionRequest(prompt, sources, config = {}, agent) {
    const agentId = agent instanceof Agent ? agent.id : agent;
    const params = await this._llmConnector.extractVisionLLMParams(config);
    params.model = this._modelId;
    params.sources = sources;
    try {
      prompt = this._llmConnector.enhancePrompt(prompt, config);
      let response = await this._llmConnector.user(AccessCandidate.agent(agentId)).visionRequest(prompt, params);
      const result = this._llmConnector.postProcess(response?.content);
      if (result.error && response.finishReason !== "stop") {
        result.details = "The model stopped before completing the response, this is usually due to output token limit reached.";
      }
      return result;
    } catch (error) {
      return { error: "LLM request failed", details: error?.message || error?.toString() };
    }
  }
  async toolRequest(params, agent) {
    const agentId = agent instanceof Agent ? agent.id : agent;
    return this._llmConnector.user(AccessCandidate.agent(agentId)).toolRequest(params);
  }
  async streamToolRequest(params, agent) {
    const agentId = agent instanceof Agent ? agent.id : agent;
    return this._llmConnector.user(AccessCandidate.agent(agentId)).streamToolRequest(params);
  }
  async streamRequest(params, agent) {
    const agentId = agent instanceof Agent ? agent.id : agent;
    return this._llmConnector.user(AccessCandidate.agent(agentId)).streamRequest(params);
  }
}

var __defProp$F = Object.defineProperty;
var __defNormalProp$F = (obj, key, value) => key in obj ? __defProp$F(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$F = (obj, key, value) => __defNormalProp$F(obj, typeof key !== "symbol" ? key + "" : key, value);
class PromptGenerator extends Component {
  constructor() {
    super();
    __publicField$F(this, "configSchema", Joi.object({
      model: Joi.string().max(200).required(),
      prompt: Joi.string().required().label("Prompt"),
      temperature: Joi.number().min(0).max(5).label("Temperature"),
      // max temperature is 2 for OpenAI and togetherAI but 5 for cohere
      maxTokens: Joi.number().min(1).label("Maximum Tokens"),
      stopSequences: Joi.string().allow("").max(400).label("Stop Sequences"),
      topP: Joi.number().min(0).max(1).label("Top P"),
      topK: Joi.number().min(0).max(500).label("Top K"),
      // max top_k is 100 for togetherAI but 500 for cohere
      frequencyPenalty: Joi.number().min(0).max(2).label("Frequency Penalty"),
      presencePenalty: Joi.number().min(0).max(2).label("Presence Penalty")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      logger.debug(`=== LLM Prompt Log ===`);
      const model = config.data.model || "echo";
      const llmHelper = LLMHelper$1.load(model);
      if (!llmHelper.connector) {
        return {
          _error: `The model '${model}' is not available. Please try a different one.`,
          _debug: logger.output
        };
      }
      logger.debug(` Model : ${model}`);
      let prompt = TemplateString(config.data.prompt).parse(input).result;
      logger.debug(` Parsed prompt
`, prompt, "\n");
      const response = await llmHelper.promptRequest(prompt, config, agent).catch((error) => ({ error }));
      logger.debug(` Enhanced prompt 
`, prompt, "\n");
      if (!response) {
        return { _error: " LLM Error = Empty Response!", _debug: logger.output };
      }
      if (response?.error) {
        logger.error(` LLM Error=${JSON.stringify(response.error)}`);
        return { Reply: response?.data, _error: response?.error + " " + response?.details, _debug: logger.output };
      }
      const result = { Reply: response };
      result["_debug"] = logger.output;
      return result;
    } catch (error) {
      return { _error: error.message, _debug: logger.output };
    }
  }
}

var __defProp$E = Object.defineProperty;
var __defNormalProp$E = (obj, key, value) => key in obj ? __defProp$E(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$E = (obj, key, value) => __defNormalProp$E(obj, typeof key !== "symbol" ? key + "" : key, value);
class APICall extends Component {
  constructor() {
    super();
    __publicField$E(this, "configSchema", Joi.object({
      method: Joi.string().valid("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD").required().label("Method"),
      url: Joi.string().max(8192).required().label("URL"),
      headers: Joi.string().allow("").label("Headers"),
      contentType: Joi.string().valid("none", "application/json", "multipart/form-data", "binary", "application/x-www-form-urlencoded", "text/plain", "application/xml").label("Content-Type"),
      body: Joi.string().allow("").label("Body"),
      _templateSettings: Joi.object().allow(null).label("Template Settings"),
      _templateVars: Joi.object().allow(null).label("Template Variables"),
      proxy: Joi.string().allow("").label("Proxy"),
      oauthService: Joi.string().allow("").label("OAuth Service"),
      scope: Joi.string().allow("").label("Scope"),
      authorizationURL: Joi.string().allow("").label("Authorization URL"),
      tokenURL: Joi.string().allow("").label("Token URL"),
      clientID: Joi.string().allow("").label("Client ID"),
      clientSecret: Joi.string().allow("").label("Client Secret"),
      oauth2CallbackURL: Joi.string().allow("").label("OAuth2 Callback URL"),
      callbackURL: Joi.string().allow("").label("Callback URL"),
      // !TEMP: prevent validation error
      requestTokenURL: Joi.string().allow("").label("Request Token URL"),
      accessTokenURL: Joi.string().allow("").label("Access Token URL"),
      userAuthorizationURL: Joi.string().allow("").label("User Authorization URL"),
      consumerKey: Joi.string().allow("").label("Consumer Key"),
      consumerSecret: Joi.string().allow("").label("Consumer Secret"),
      oauth1CallbackURL: Joi.string().allow("").label("OAuth1 Callback URL"),
      authenticate: Joi.string().allow("").label("Authenticate")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    const _error = void 0;
    try {
      logger.debug(`=== API Call Log ===`);
      let additionalParams = {}, rootUrl = null;
      const templateSettings = config?.template?.settings || {};
      const reqConfig = {};
      let dataForDebug;
      const method = config?.data?.method || "get";
      reqConfig.method = method;
      let _url = config?.data?.url;
      return { Response: {}, Headers: {}, _error, _debug: logger.output };
    } catch (error) {
      return { _error: error.message, _debug: logger.output };
    }
  }
}

var __defProp$D = Object.defineProperty;
var __defNormalProp$D = (obj, key, value) => key in obj ? __defProp$D(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$D = (obj, key, value) => __defNormalProp$D(obj, typeof key !== "symbol" ? key + "" : key, value);
class VisionLLM extends Component {
  constructor() {
    super();
    __publicField$D(this, "configSchema", Joi.object({
      prompt: Joi.string().required().label("Prompt"),
      maxTokens: Joi.number().min(1).label("Maximum Tokens"),
      model: Joi.string().max(200).required()
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      logger.debug(`=== Vision LLM Log ===`);
      const model = config.data.model || "gpt-4-vision-preview";
      const llmHelper = LLMHelper$1.load(model);
      if (!llmHelper.connector) {
        return {
          _error: `The model '${model}' is not available. Please try a different one.`,
          _debug: logger.output
        };
      }
      let prompt = TemplateString(config.data.prompt).parse(input).result;
      logger.debug(` Parsed prompt
`, prompt, "\n");
      const sources = [];
      const images = Array.isArray(input.Images) ? input.Images : [input.Images];
      const promises = [];
      for (let image of images) {
        const binaryInput = BinaryInput.from(image);
        sources.push(binaryInput);
        promises.push(binaryInput.upload(AccessCandidate.agent(agent.id)));
      }
      await Promise.all(promises);
      const response = await llmHelper.visionRequest(prompt, sources, config, agent);
      logger.debug(` Enhanced prompt 
`, prompt, "\n");
      if (!response) {
        return { _error: " LLM Error = Empty Response!", _debug: logger.output };
      }
      if (response?.error) {
        logger.error(` LLM Error=${JSON.stringify(response.error)}`);
        return { Reply: response?.data, _error: response?.error + " " + response?.details, _debug: logger.output };
      }
      const result = { Reply: response };
      result["_debug"] = logger.output;
      return result;
    } catch (error) {
      return { _error: error.message, _debug: logger.output };
    }
  }
}

class FSleep extends Component {
  constructor() {
    super();
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      const _error = void 0;
      const delay = parseInt(config.data.delay || 1);
      const Output = input.Input;
      logger.debug(`Sleeping for ${delay} seconds`);
      await new Promise((resolve) => setTimeout(resolve, delay * 1e3));
      return { Output, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
    } catch (err) {
      const _error = err?.response?.data || err?.message || err.toString();
      logger.error(` Error processing data 
${_error}
`);
      return { hash: void 0, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
    }
  }
}

class FHash extends Component {
  constructor() {
    super();
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      const _error = void 0;
      const data = input.Data;
      const algorithm = config.data.algorithm;
      const encoding = config.data.encoding;
      logger.debug(` Generating hash using ${algorithm} algorithm and ${encoding} encoding`);
      const hashAlgo = crypto.createHash(algorithm);
      hashAlgo.update(data);
      const Hash = hashAlgo.digest(encoding);
      logger.debug(` Generated hash: ${Hash}`);
      return { Hash, _error, _debug: logger.output };
    } catch (err) {
      const _error = err?.response?.data || err?.message || err.toString();
      logger.error(` Error generating hash 
${_error}
`);
      return { hash: void 0, _error, _debug: logger.output };
    }
  }
}

class FEncDec extends Component {
  constructor() {
    super();
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      const _error = void 0;
      const data = input.Data;
      const action = config.data.action || "Encode";
      const encoding = config.data.encoding;
      logger.debug(`${encoding} ${action} data`);
      const Output = action == "Encode" ? Buffer.from(data).toString(encoding) : Buffer.from(data, encoding).toString("utf8");
      return { Output, _error, _debug: logger.output };
    } catch (err) {
      const _error = err?.response?.data || err?.message || err.toString();
      logger.error(` Error processing data 
${_error}
`);
      return { hash: void 0, _error, _debug: logger.output };
    }
  }
}

class FTimestamp extends Component {
  constructor() {
    super();
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      const _error = void 0;
      const format = config.data.format;
      const Timestamp = Date.now();
      logger.debug(`Timestamp : ${Timestamp}`);
      return { Timestamp, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
    } catch (err) {
      const _error = err?.response?.data || err?.message || err.toString();
      logger.error(` Error processing data 
${_error}
`);
      return { hash: void 0, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
    }
  }
}

var __defProp$C = Object.defineProperty;
var __defNormalProp$C = (obj, key, value) => key in obj ? __defProp$C(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$C = (obj, key, value) => __defNormalProp$C(obj, typeof key !== "symbol" ? key + "" : key, value);
class LLMHelper {
  static load(model) {
    throw new Error("Method not implemented.");
  }
}
class DataSourceLookup extends Component {
  constructor() {
    super();
    __publicField$C(this, "configSchema", Joi.object({
      topK: Joi.string().custom(validateInteger$2({ min: 0 }), "custom range validation").label("Result Count"),
      model: Joi.string().valid("gpt-3.5-turbo", "gpt-4", "gpt-3.5-turbo-16k").required(),
      prompt: Joi.string().max(3e4).allow("").label("Prompt"),
      postprocess: Joi.boolean().strict().required(),
      includeMetadata: Joi.boolean().strict().optional(),
      namespace: Joi.string().allow("").max(80).messages({
        // Need to reserve 30 characters for the prefixed unique id
        "string.max": `The length of the 'namespace' name must be 50 characters or fewer.`
      })
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const componentId = config.id;
    agent.components[componentId];
    const teamId = agent.teamId;
    const outputs = {};
    for (let con of config.outputs) {
      if (con.default) continue;
      outputs[con.name] = "";
    }
    const namespace = config.data.namespace;
    const model = config.data.model;
    const prompt = config.data.prompt?.trim?.() || "";
    const postprocess = config.data.postprocess;
    const includeMetadata = config.data.includeMetadata || false;
    const _input = typeof input.Query === "string" ? input.Query : JSON.stringify(input.Query);
    const topK = Math.max(config.data.topK, 50);
    const vectorDB = ConnectorService.getVectorDBConnector();
    let results;
    let _error;
    try {
      const response = await vectorDB.user(AccessCandidate.team(teamId)).search(namespace, _input, { topK, includeMetadata: true });
      results = response.slice(0, config.data.topK).map((result) => ({
        content: result.metadata?.text,
        metadata: result.metadata
      }));
      if (includeMetadata) {
        results = results.map((result) => ({
          content: result.content,
          metadata: this.parseMetadata(
            result.metadata?.user || result.metadata?.metadata
            //* legacy user-specific metadata key [result.metadata?.metadata]
          )
        }));
      } else {
        results = results.map((result) => result.content);
      }
    } catch (error) {
      _error = error.toString();
    }
    if (postprocess && prompt) {
      const promises = [];
      for (let result of results) {
        TemplateString(prompt.replace(/{{result}}/g, JSON.stringify(result))).parse(input).result;
        LLMHelper.load(model);
      }
      results = await Promise.all(promises);
      for (let i = 0; i < results.length; i++) {
        if (typeof results[i] === "string") {
          results[i] = JSONContent(results[i]).tryParse();
        }
      }
    }
    const totalLength = JSON.stringify(results).length;
    return {
      Results: results,
      _error,
      _debug: `totalLength = ${totalLength}`
      //_debug: `Query: ${_input}. \nTotal Length = ${totalLength} \nResults: ${JSON.stringify(results)}`,
    };
  }
  // private async checkIfTeamOwnsNamespace(teamId: string, namespaceId: string, token: string) {
  //     try {
  //         const res = await SmythAPIHelper.fromAuth({ token }).mwSysAPI.get(`/vectors/namespaces/${namespaceId}`);
  //         if (res.data?.namespace?.teamId !== teamId) {
  //             throw new Error(`Namespace does not exist`);
  //         }
  //         return true;
  //     } catch (err) {
  //         throw new Error(`Namespace does not exist`);
  //     }
  // }
  parseMetadata(metadata) {
    try {
      return JSON.parse(jsonrepair(metadata));
    } catch (err) {
      return metadata;
    }
  }
}

const console$d = Logger("SecureConnector");
class SecureConnector extends Connector {
  async start() {
    console$d.info(`Starting ${this.name} connector ...`);
  }
  async stop() {
    console$d.info(`Stopping ${this.name} connector ...`);
  }
  async hasAccess(acRequest) {
    const aclHelper = await this.getResourceACL(acRequest.resourceId, acRequest.candidate);
    const exactAccess = aclHelper.checkExactAccess(acRequest);
    if (exactAccess) return true;
    const ownerRequest = AccessRequest.clone(acRequest).setLevel(TAccessLevel.Owner);
    const ownerAccess = aclHelper.checkExactAccess(ownerRequest);
    if (ownerAccess) return true;
    const publicRequest = AccessRequest.clone(acRequest).setCandidate(AccessCandidate.public());
    const publicAccess = aclHelper.checkExactAccess(publicRequest);
    if (publicAccess) return true;
    const accountConnector = ConnectorService.getAccountConnector();
    const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
    const teamRequest = AccessRequest.clone(acRequest).setCandidate(AccessCandidate.team(teamId));
    const teamAccess = aclHelper.checkExactAccess(teamRequest);
    if (teamAccess) return true;
    const teamOwnerRequest = AccessRequest.clone(teamRequest).setLevel(TAccessLevel.Owner);
    const teamOwnerAccess = aclHelper.checkExactAccess(teamOwnerRequest);
    if (teamOwnerAccess) return true;
    return false;
  }
  async getAccessTicket(resourceId, request) {
    const sysAcRequest = AccessRequest.clone(request).resource(resourceId);
    const accessTicket = {
      request,
      access: await this.hasAccess(sysAcRequest) ? TAccessResult.Granted : TAccessResult.Denied
    };
    return accessTicket;
  }
  //#region [ Decorators ]==========================
  //AccessControl decorator
  //This decorator will inject the access control logic into storage connector methods
  // in order to work properly, the connector expects the resourceId to be the first argument and the access request to be the second argument
  static AccessControl(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args) {
      const [acRequest, resourceId] = args;
      const accessTicket = await this.getAccessTicket(resourceId, acRequest);
      if (accessTicket.access !== TAccessResult.Granted) throw new ACLAccessDeniedError("Access Denied");
      return originalMethod.apply(this, args);
    };
    return descriptor;
  }
  //#endregion
}

class VectorDBConnector extends SecureConnector {
  // protected abstract updateVectors(acRequest: AccessRequest, resourceId: string): Promise<void>;
  // protected abstract getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined>;
  // protected abstract setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata): Promise<void>;
  // protected abstract getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined>;
  // protected abstract setACL(acRequest: AccessRequest, resourceId: string, acl: IACL): Promise<void>;
  static constructNsName(name, teamId) {
    return `${teamId}::${name}`;
  }
  static parseNsName(nsName) {
    const parts = nsName.split("::");
    if (parts.length != 2) return null;
    return {
      teamId: parts[0],
      name: parts[1]
    };
  }
}

var __defProp$B = Object.defineProperty;
var __defNormalProp$B = (obj, key, value) => key in obj ? __defProp$B(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$B = (obj, key, value) => __defNormalProp$B(obj, typeof key !== "symbol" ? key + "" : key, value);
class VectorsHelper {
  constructor() {
    __publicField$B(this, "_vectorDBconnector");
    __publicField$B(this, "embeddingsProvider");
    __publicField$B(this, "_vectorDimention");
    __publicField$B(this, "_nkvConnector");
    this._vectorDBconnector = ConnectorService.getVectorDBConnector();
    this.embeddingsProvider = new OpenAIEmbeddings();
    if (this._vectorDimention && !isNaN(this._vectorDimention)) {
      this.embeddingsProvider.dimensions = this._vectorDimention;
    }
    this._nkvConnector = ConnectorService.getNKVConnector();
  }
  static load(options = {}) {
    const instance = new VectorsHelper();
    options.vectorDimention && instance.setVectorDimention(options.vectorDimention);
    return instance;
  }
  setVectorDimention(vectorDimention) {
    this._vectorDimention = vectorDimention;
  }
  static async chunkText(text, {
    chunkSize = 4e3,
    chunkOverlap = 500
  } = {}) {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap
    });
    let output = await textSplitter.splitText(text);
    return output;
  }
  async createDatasource(text, namespace, {
    teamId,
    metadata,
    chunkSize = 4e3,
    chunkOverlap = 500,
    label,
    id
  } = {}) {
    const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
    const chunkedText = await VectorsHelper.chunkText(text, { chunkSize, chunkOverlap });
    const ids = Array.from({ length: chunkedText.length }, (_, i) => crypto.randomUUID());
    const source = chunkedText.map((doc, i) => {
      return {
        id: ids[i],
        source: doc,
        metadata: {
          user: VectorsHelper.stringifyMetadata(metadata)
          // user-speficied metadata
        }
      };
    });
    const _vIds = await this._vectorDBconnector.user(AccessCandidate.team(teamId)).insert(namespace, source);
    const dsId = id || crypto.randomUUID();
    const dsData = {
      namespaceId: formattedNs,
      teamId,
      name: label || "Untitled",
      metadata: VectorsHelper.stringifyMetadata(metadata),
      text,
      embeddingIds: _vIds
    };
    await this._nkvConnector.user(AccessCandidate.team(teamId)).set(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId, JSON.stringify(dsData));
    return dsId;
  }
  async listDatasources(teamId, namespace) {
    const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
    return (await this._nkvConnector.user(AccessCandidate.team(teamId)).list(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`)).map(
      (ds) => {
        return {
          id: ds.key,
          data: JSONContentHelper.create(ds.data?.toString()).tryParse()
        };
      }
    );
  }
  async getDatasource(teamId, namespace, dsId) {
    const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
    return JSONContentHelper.create(
      (await this._nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId))?.toString()
    ).tryParse();
  }
  async deleteDatasource(teamId, namespace, dsId) {
    const formattedNs = VectorDBConnector.constructNsName(namespace, teamId);
    let ds = JSONContentHelper.create(
      (await this._nkvConnector.user(AccessCandidate.team(teamId)).get(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId))?.toString()
    ).tryParse();
    if (!ds || typeof ds !== "object") {
      throw new Error(`Data source not found with id: ${dsId}`);
    }
    await this._vectorDBconnector.user(AccessCandidate.team(teamId)).delete(namespace, ds.embeddingIds || []);
    this._nkvConnector.user(AccessCandidate.team(teamId)).delete(`vectorDB:pinecone:namespaces:${formattedNs}:datasources`, dsId);
  }
  async embedText(text) {
    return this.embeddingsProvider.embedQuery(text);
  }
  async embedTexts(texts) {
    return this.embeddingsProvider.embedDocuments(texts);
  }
  static stringifyMetadata(metadata) {
    try {
      return jsonrepair(JSON.stringify(metadata));
    } catch (err) {
      return metadata;
    }
  }
}

var __defProp$A = Object.defineProperty;
var __defNormalProp$A = (obj, key, value) => key in obj ? __defProp$A(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$A = (obj, key, value) => __defNormalProp$A(obj, typeof key !== "symbol" ? key + "" : key, value);
class DataSourceIndexer extends Component {
  constructor() {
    super();
    __publicField$A(this, "MAX_ALLOWED_URLS_PER_INPUT", 20);
    __publicField$A(this, "configSchema", Joi.object({
      namespace: Joi.string().max(50).allow(""),
      id: Joi.string().custom(validateCharacterSet, "id custom validation").allow("").label("source identifier"),
      name: Joi.string().max(50).allow("").label("label"),
      metadata: Joi.string().allow(null).allow("").max(1e4).label("metadata")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const teamId = agent.teamId;
    agent.id;
    let debugOutput = agent.agentRuntime?.debug ? "== Source Indexer Log ==\n" : null;
    try {
      const _config = {
        ...config.data,
        name: TemplateString(config.data.name).parse(input).result,
        id: TemplateString(config.data.id).parse(input).result,
        metadata: TemplateString(config.data.metadata).parse(input).result
      };
      const outputs = {};
      for (let con of config.outputs) {
        if (con.default) continue;
        outputs[con.name] = con?.description ? `<${con?.description}>` : "";
      }
      const namespaceId = _config.namespace;
      debugOutput += `[Selected namespace id] 
${namespaceId}

`;
      const vectorDB = ConnectorService.getVectorDBConnector();
      const nsExists = vectorDB.user(AccessCandidate.team(teamId)).namespaceExists(namespaceId);
      if (!nsExists) {
        throw new Error(`Namespace ${namespaceId} does not exist`);
      }
      const inputSchema = this.validateInput(input);
      if (inputSchema.error) {
        throw new Error(`Input validation error: ${inputSchema.error}
 EXITING...`);
      }
      const providedId = _config.id;
      const idRegex = /^[a-zA-Z0-9\-\_\.]+$/;
      if (!providedId) {
        throw new Error(`Id is required`);
      } else if (!idRegex.test(providedId)) {
        throw new Error(`Invalid id. Accepted characters: 'a-z', 'A-Z', '0-9', '-', '_', '.'`);
      }
      let indexRes = null;
      let parsedUrlArray = null;
      //! DISABLE URL ARRAY PARSING FOR NOW UNTIL WE HAVE A GOOD WAY TO HANDLE BULK INDEXING
      const dsId = DataSourceIndexer.genDsId(providedId, teamId, namespaceId);
      if (isUrl(inputSchema.value.Source)) {
        debugOutput += `STEP: Parsing input as url

`;
        throw new Error("URLs are not supported yet");
      } else {
        debugOutput += `STEP: Parsing input as text

`;
        indexRes = await this.addDSFromText({
          teamId,
          namespaceId,
          text: inputSchema.value.Source,
          name: _config.name || "Untitled",
          metadata: _config.metadata || null,
          sourceId: dsId
        });
      }
      debugOutput += `Created datasource successfully

`;
      return {
        _debug: debugOutput,
        Success: {
          result: indexRes?.data?.dataSource || true,
          id: _config.id
        }
        // _error,
      };
    } catch (err) {
      debugOutput += `Error: ${err?.message || "Couldn't index data source"}

`;
      return {
        _debug: debugOutput,
        _error: err?.message || "Couldn't index data source"
      };
    }
  }
  validateInput(input) {
    return Joi.object({
      Source: Joi.any().required()
    }).unknown(true).validate(input);
  }
  async addDSFromText({ teamId, sourceId, namespaceId, text, name, metadata }) {
    const id = await VectorsHelper.load().createDatasource(text, namespaceId, {
      teamId,
      metadata,
      id: sourceId,
      label: name
    });
    return id;
  }
  static genDsId(providedId, teamId, namespaceId) {
    return `${teamId}::${namespaceId}::${providedId}`;
  }
  async addDSFromUrl({ teamId, namespaceId, dsId, type, url, name, metadata }) {
    throw new Error("URLs are not supported yet");
  }
}

var __defProp$z = Object.defineProperty;
var __defNormalProp$z = (obj, key, value) => key in obj ? __defProp$z(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$z = (obj, key, value) => __defNormalProp$z(obj, typeof key !== "symbol" ? key + "" : key, value);
class DataSourceCleaner extends Component {
  constructor() {
    super();
    __publicField$z(this, "configSchema", Joi.object({
      namespaceId: Joi.string().max(50).allow("").label("namespace"),
      id: Joi.string().custom(validateCharacterSet, "custom validation characterSet").allow("").label("source identifier")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const teamId = agent.teamId;
    agent.id;
    let debugOutput = agent.agentRuntime?.debug ? "== Source Indexer Log ==\n" : null;
    try {
      const configSchema = this.validateConfigData(config.data);
      if (configSchema.error) {
        throw new Error(`Config data validation error: ${configSchema.error}
 EXITING...`);
      }
      const outputs = {};
      for (let con of config.outputs) {
        if (con.default) continue;
        outputs[con.name] = con?.description ? `<${con?.description}>` : "";
      }
      const inputSchema = this.validateInput(input);
      if (inputSchema.error) {
        throw new Error(`Input validation error: ${inputSchema.error}
 EXITING...`);
      }
      const namespaceId = configSchema.value.namespaceId;
      const vectorDB = ConnectorService.getVectorDBConnector();
      const nsExists = vectorDB.user(AccessCandidate.team(teamId)).namespaceExists(namespaceId);
      if (!nsExists) {
        throw new Error(`Namespace ${namespaceId} does not exist`);
      }
      const providedId = TemplateString(config.data.id).parse(input).result;
      const idRegex = /^[a-zA-Z0-9\-\_\.]+$/;
      if (!idRegex.test(providedId)) {
        throw new Error(`Invalid id. Accepted characters: 'a-z', 'A-Z', '0-9', '-', '_', '.'`);
      }
      debugOutput += `Searching for data source with id: ${providedId}
`;
      const dsId = DataSourceIndexer.genDsId(providedId, teamId, namespaceId);
      await VectorsHelper.load().deleteDatasource(teamId, namespaceId, dsId);
      debugOutput += `Deleted data source with id: ${providedId}
`;
      return {
        _debug: debugOutput,
        Success: true
        // _error,
      };
    } catch (err) {
      debugOutput += `Failed to delete data source: 
 Error: ${err?.message}
`;
      return {
        _debug: debugOutput,
        _error: err?.message || "Couldn't delete data source"
      };
    }
  }
  validateInput(input) {
    return Joi.object({}).unknown(true).validate(input);
  }
  validateConfigData(data) {
    return Joi.object({
      namespaceId: Joi.string().required(),
      id: Joi.string().optional().allow("").allow(null)
    }).unknown(true).validate(data);
  }
}

var __defProp$y = Object.defineProperty;
var __defNormalProp$y = (obj, key, value) => key in obj ? __defProp$y(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$y = (obj, key, value) => __defNormalProp$y(obj, typeof key !== "symbol" ? key + "" : key, value);
class JSONFilter extends Component {
  constructor() {
    super();
    __publicField$y(this, "configSchema", Joi.object({
      fields: Joi.string().max(3e4).allow("").label("Prompt")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    logger.debug(`=== JSONFilter Log ===`);
    let Output = {};
    let _error = null;
    try {
      const componentId = config.id;
      const fields = config.data.fields;
      const obj = input.Input;
      Output = filterFields(obj, fields);
      logger.debug(`Output filtered`);
    } catch (error) {
      _error = error;
      logger.error(` JSONFilter Error 
 ${error.toString()}`);
    }
    return { Output, _error, _debug: logger.output };
  }
}
function filterFields(obj, fields) {
  const fieldList = fields?.split(",").map((field) => field.trim());
  function filterObject(obj2) {
    if (Array.isArray(obj2)) {
      return obj2.map(filterObject);
    } else if (obj2 !== null && typeof obj2 === "object") {
      return Object.keys(obj2).filter((key) => fieldList.includes(key)).reduce((acc, key) => {
        acc[key] = filterObject(obj2[key]);
        return acc;
      }, {});
    }
    return obj2;
  }
  return filterObject(obj);
}

class LogicAND extends Component {
  constructor() {
    super();
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    this.createComponentLogger(agent, config.name);
    const result = { Output: true };
    for (let cfgInput of config.inputs) {
      if (!input[cfgInput.name]) {
        result.Output = void 0;
        break;
      }
    }
    result.Verified = result.Output !== void 0;
    result.Unverified = !result.Verified;
    if (!result.Verified) delete result.Verified;
    if (!result.Unverified) delete result.Unverified;
    return result;
  }
}

class LogicOR extends Component {
  constructor() {
    super();
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const result = { Output: void 0 };
    console.log(input);
    console.log(config);
    for (let cfgInput of config.inputs) {
      if (input[cfgInput.name]) {
        result.Output = true;
        break;
      }
    }
    result.Verified = result.Output !== void 0;
    result.Unverified = !result.Verified;
    if (!result.Verified) delete result.Verified;
    if (!result.Unverified) delete result.Unverified;
    return result;
  }
}

class LogicXOR extends Component {
  constructor() {
    super();
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const result = { Output: void 0 };
    let trueCount = 0;
    for (let cfgInput of config.inputs) {
      if (input[cfgInput.name]) {
        trueCount++;
      }
    }
    if (trueCount === 1) {
      result.Output = true;
    }
    result.Verified = result.Output !== void 0;
    result.Unverified = !result.Verified;
    if (!result.Verified) delete result.Verified;
    if (!result.Unverified) delete result.Unverified;
    return result;
  }
}

var __defProp$x = Object.defineProperty;
var __defNormalProp$x = (obj, key, value) => key in obj ? __defProp$x(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$x = (obj, key, value) => __defNormalProp$x(obj, typeof key !== "symbol" ? key + "" : key, value);
class LogicAtLeast extends Component {
  constructor() {
    super();
    __publicField$x(this, "configSchema", Joi.object({
      // TODO (Forhad): Need to check if min and max work instead of the custom validateInteger
      minSetInputs: Joi.string().custom(validateInteger$1({ min: 0, max: 9 }), "custom range validation").label("Minimum Inputs")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    this.createComponentLogger(agent, config.name);
    const result = { Output: void 0 };
    if (typeof config.data.minSetInputs !== "string" || config.data.minSetInputs.trim() === "" || isNaN(Number(config.data.minSetInputs))) {
      return result;
    }
    const minSetInputs = Number(config.data.minSetInputs);
    if (config.inputs.length < minSetInputs) {
      return result;
    }
    let trueCount = 0;
    for (let cfgInput of config.inputs) {
      if (input[cfgInput.name]) {
        trueCount++;
      }
    }
    if (trueCount >= minSetInputs) {
      result.Output = true;
    }
    result.Verified = result.Output !== void 0;
    result.Unverified = !result.Verified;
    if (!result.Verified) delete result.Verified;
    if (!result.Unverified) delete result.Unverified;
    return result;
  }
}
function validateInteger$1(args) {
  return (value, helpers) => {
    const numValue = Number(value);
    const fieldName = helpers.schema._flags.label || helpers.state.path[helpers.state.path.length - 1];
    if (isNaN(numValue)) {
      throw new Error(`The value for '${fieldName}' must be a number`);
    }
    if (args.min !== void 0 && args.max !== void 0) {
      if (numValue < args.min || numValue > args.max) {
        throw new Error(`The value for '${fieldName}' must be from ${args.min} to ${args.max}`);
      }
    } else if (args.min !== void 0) {
      if (numValue < args.min) {
        throw new Error(`The value for '${fieldName}' must be greater or equal to ${args.min}`);
      }
    } else if (args.max !== void 0) {
      if (numValue > args.max) {
        throw new Error(`The value for '${fieldName}' must be less or equal to ${args.max}`);
      }
    }
    return value;
  };
}

var __defProp$w = Object.defineProperty;
var __defNormalProp$w = (obj, key, value) => key in obj ? __defProp$w(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$w = (obj, key, value) => __defNormalProp$w(obj, typeof key !== "symbol" ? key + "" : key, value);
class LogicAtMost extends Component {
  constructor() {
    super();
    __publicField$w(this, "configSchema", Joi.object({
      // TODO (Forhad): Need to check if min and max work instead of the custom validateInteger
      maxSetInputs: Joi.string().custom(validateInteger({ min: 0, max: 9 }), "custom range validation").label("Maximum Inputs")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const result = { Output: void 0 };
    if (typeof config.data.maxSetInputs !== "string" || config.data.maxSetInputs.trim() === "" || isNaN(Number(config.data.maxSetInputs))) {
      return result;
    }
    const maxSetInputs = Number(config.data.maxSetInputs);
    if (config.inputs.length < maxSetInputs) {
      return result;
    }
    let trueCount = 0;
    for (let cfgInput of config.inputs) {
      if (input[cfgInput.name]) {
        trueCount++;
        if (trueCount > maxSetInputs) {
          break;
        }
      }
    }
    if (trueCount <= maxSetInputs) {
      result.Output = true;
    }
    result.Verified = result.Output !== void 0;
    result.Unverified = !result.Verified;
    if (!result.Verified) delete result.Verified;
    if (!result.Unverified) delete result.Unverified;
    return result;
  }
}
function validateInteger(args) {
  return (value, helpers) => {
    const numValue = Number(value);
    const fieldName = helpers.schema._flags.label || helpers.state.path[helpers.state.path.length - 1];
    if (isNaN(numValue)) {
      throw new Error(`The value for '${fieldName}' must be a number`);
    }
    if (args.min !== void 0 && args.max !== void 0) {
      if (numValue < args.min || numValue > args.max) {
        throw new Error(`The value for '${fieldName}' must be from ${args.min} to ${args.max}`);
      }
    } else if (args.min !== void 0) {
      if (numValue < args.min) {
        throw new Error(`The value for '${fieldName}' must be greater or equal to ${args.min}`);
      }
    } else if (args.max !== void 0) {
      if (numValue > args.max) {
        throw new Error(`The value for '${fieldName}' must be less or equal to ${args.max}`);
      }
    }
    return value;
  };
}

var __defProp$v = Object.defineProperty;
var __defNormalProp$v = (obj, key, value) => key in obj ? __defProp$v(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$v = (obj, key, value) => __defNormalProp$v(obj, typeof key !== "symbol" ? key + "" : key, value);
class AgentProcess {
  constructor(agentData) {
    this.agentData = agentData;
    __publicField$v(this, "agent");
    __publicField$v(this, "_loadPromise");
    this.initAgent(agentData);
  }
  async initAgent(agentData) {
    let data;
    let agentId;
    if (typeof agentData === "object") {
      data = agentData;
      if (data.components && data.connections) {
        data = { data, version: "1.0" };
      }
      agentId = data.data.id || "tmp-" + uid();
    } else {
      const jsonRegex = /^{.*}$/g;
      const jsonData = agentData.match(jsonRegex)?.[0];
      const idRegex = /^[a-zA-Z0-9\-]+$/g;
      agentId = agentData.match(idRegex)?.[0];
      if (agentId) {
        const agentDataConnector = ConnectorService.getAgentDataConnector();
        data = await agentDataConnector.getAgentData(agentId, "latest");
      }
      if (!data && jsonData) {
        data = JSON.parse(jsonData);
        agentId = data.id || "tmp-" + uid();
        if (data.components && data.connections) {
          data = { data, version: "1.0" };
        }
      }
    }
    const agentSettings = new AgentSettings(agentId);
    this.agent = new Agent(agentId, data, agentSettings);
  }
  async ready() {
    if (this._loadPromise) {
      return this._loadPromise;
    }
    return this._loadPromise = new Promise((resolve) => {
      let maxWait = 1e4;
      const itv = setInterval(() => {
        if (this.agent) {
          clearInterval(itv);
          resolve(true);
        }
        maxWait -= 100;
        if (maxWait <= 0) {
          clearInterval(itv);
          resolve(false);
        }
      }, 100);
    });
  }
  static load(agentData) {
    const agentProcess = new AgentProcess(agentData);
    return agentProcess;
  }
  async run(reqConfig) {
    await this.ready();
    if (!this.agent) throw new Error("Failed to load agent");
    let request = this.parseReqConfig(reqConfig);
    this.agent.setRequest(request);
    const pathMatches = request.path.match(/(^\/v[0-9]+\.[0-9]+?)?(\/api\/(.+)?)/);
    if (!pathMatches || !pathMatches[2]) {
      return { status: 404, data: { error: "Endpoint not found" } };
    }
    const endpointPath = pathMatches[2];
    const input = request.method == "GET" ? request.query : request.body;
    const result = await this.agent.process(endpointPath, input).catch((error) => ({ error: error.message }));
    return { data: result };
  }
  reset() {
    this.initAgent(this.agentData);
  }
  parseReqConfig(reqConfig) {
    if (reqConfig instanceof AgentRequest) return reqConfig;
    if (Array.isArray(reqConfig)) return this.parseCLI(reqConfig);
    return new AgentRequest(reqConfig);
  }
  parseCLI(argList) {
    const cliConnector = ConnectorService.getCLIConnector();
    const methods = ["get", "post", "put", "delete", "patch", "head", "options"];
    const cli = cliConnector.parse(argList, ["endpoint", "post", "get", "put", "delete", "patch", "head", "options", "headers", "session"]);
    const usedMethod = methods.find((method) => cli[method]);
    const req = new AgentRequest();
    req.method = usedMethod?.toUpperCase() || "GET";
    req.body = {};
    req.query = {};
    switch (usedMethod) {
      case "get":
      case "delete":
      case "head":
      case "options":
        req.query = cli[usedMethod];
        break;
      case "post":
      case "put":
      case "patch":
        req.body = cli[usedMethod];
        break;
    }
    req.path = `/api/${cli.endpoint}`;
    req.params = cli.endpoint?.split("/");
    req.headers = cli.headers || {};
    for (let key in req.headers) {
      req.headers[key.toLowerCase()] = req.headers[key];
      delete req.headers[key];
    }
    req.sessionID = cli.session || uid();
    req.files = [];
    if (req.body) {
      for (let entry in req.body) {
        let value = req.body[entry];
        const filePath = path.join(process.cwd(), value);
        const fileName = path.basename(filePath);
        if (!fs.existsSync(filePath)) continue;
        try {
          const fileBuffer = fs.readFileSync(filePath);
          const ext = fileName.split(".").pop();
          const fileObj = {
            fieldname: entry,
            originalname: fileName,
            buffer: fileBuffer,
            mimetype: mime.getType(ext) || "application/octet-stream"
          };
          delete req.body[entry];
          req.files.push(fileObj);
          FileType.fileTypeFromBuffer(fileBuffer).then((fileType) => {
            if (fileType) {
              fileObj.mimetype = fileType.mime;
            }
          });
        } catch (error) {
          console.warn("Coud not read file", filePath, error.message);
        }
      }
    }
    return req;
  }
  async post(path2, input, headers) {
    return this.run({ method: "POST", path: path2, body: input || {}, headers });
  }
  async get(path2, query, headers) {
    return this.run({ method: "GET", path: path2, query, headers });
  }
}

var __defProp$u = Object.defineProperty;
var __defNormalProp$u = (obj, key, value) => key in obj ? __defProp$u(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$u = (obj, key, value) => __defNormalProp$u(obj, typeof key !== "symbol" ? key + "" : key, value);
class LLMContext {
  /**
   *
   * @param source a messages[] object, or smyth file system uri (smythfs://...)
   */
  constructor(_model, _systemPrompt = "", _messages = []) {
    this._model = _model;
    this._systemPrompt = _systemPrompt;
    this._messages = _messages;
    __publicField$u(this, "_llmHelper");
    __publicField$u(this, "contextLength");
    this._llmHelper = LLMHelper$1.load(this._model);
  }
  get llmHelper() {
    return this._llmHelper;
  }
  get messages() {
    return this._messages;
  }
  push(...message) {
    this._messages.push(...message);
  }
  addUserMessage(content) {
    this.push({ role: "user", content });
  }
  getContextWindow(maxTokens, maxOutputTokens = 256) {
    const maxModelContext = this._llmHelper?.modelInfo?.keyOptions?.tokens || this._llmHelper?.modelInfo?.tokens || 256;
    let maxInputContext = Math.min(maxTokens, maxModelContext);
    if (maxInputContext + maxOutputTokens > maxModelContext) {
      maxInputContext -= maxInputContext + maxOutputTokens - maxModelContext;
    }
    let messages = [];
    const systemMessage = { role: "system", content: this._systemPrompt };
    let tokens = encodeChat([systemMessage], "gpt-4o").length;
    for (let i = this._messages.length - 1; i >= 0; i--) {
      const message = this._messages[i];
      if (message.role === "system") continue;
      if (!message.content) {
        messages.unshift(message);
        continue;
      }
      delete message["__smyth_data__"];
      const textContent = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
      const encoded = encode(textContent);
      tokens += encoded.length;
      if (tokens > maxInputContext) {
        if (typeof message.content !== "string") {
          break;
        }
        const diff = tokens - maxInputContext;
        const excessPercentage = diff / encoded.length;
        message.content = message.content.slice(0, Math.floor(message.content.length * (1 - excessPercentage)) - 200);
        message.content += "...\n\nWARNING : The context window has been truncated to fit the maximum token limit.";
        tokens -= encoded.length;
        tokens += encodeChat([message], "gpt-4").length;
      }
      messages.unshift(message);
    }
    messages.unshift(systemMessage);
    return messages;
  }
}

const swaggerParser = new SwaggerParser();
class OpenAPIParser {
  static mapReqMethods(paths) {
    const methods = /* @__PURE__ */ new Map();
    for (const path in paths) {
      const pathData = paths[path];
      for (const method in pathData) {
        const data = pathData[method];
        if (REQUEST_METHODS.includes(method.toUpperCase())) {
          methods.set(data?.operationId, method);
        }
      }
    }
    return methods;
  }
  static mapEndpoints(paths) {
    const operationIds = /* @__PURE__ */ new Map();
    for (const path in paths) {
      const pathData = paths[path];
      for (const method in pathData) {
        const data = pathData[method];
        if (REQUEST_METHODS.includes(method.toUpperCase())) {
          operationIds.set(data?.operationId, path);
        }
      }
    }
    return operationIds;
  }
  static async yamlToJson(yamlData) {
    const data = yaml.load(yamlData);
    const schema = await $RefParser.dereference(data);
    return schema;
  }
  static async getJson(data) {
    try {
      let _data = data;
      if (typeof data === "string") {
        _data = JSON.parse(_data);
      }
      const result = swaggerParser.dereference(_data);
      return result;
    } catch (error) {
      try {
        return OpenAPIParser.yamlToJson(data);
      } catch (error2) {
        throw new Error("Invalid OpenAPI specification data format");
      }
    }
  }
  static async getJsonFromUrl(url) {
    const response = await axios.get(url);
    const data = response.data;
    return OpenAPIParser.getJson(data);
  }
  static isValidOpenAPI(data) {
    return data?.openapi && data?.paths && data?.servers;
  }
}

var __defProp$t = Object.defineProperty;
var __defNormalProp$t = (obj, key, value) => key in obj ? __defProp$t(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$t = (obj, key, value) => __defNormalProp$t(obj, typeof key !== "symbol" ? key + "" : key, value);
class Conversation extends EventEmitter$1 {
  constructor(_model, _specSource, _settings) {
    super();
    this._model = _model;
    this._specSource = _specSource;
    this._settings = _settings;
    __publicField$t(this, "_agentId", "");
    __publicField$t(this, "systemPrompt");
    __publicField$t(this, "assistantName");
    __publicField$t(this, "_reqMethods");
    __publicField$t(this, "_toolsConfig");
    __publicField$t(this, "_endpoints");
    __publicField$t(this, "_baseUrl");
    __publicField$t(this, "_status", "");
    __publicField$t(this, "_currentWaitPromise");
    __publicField$t(this, "_context");
    __publicField$t(this, "_maxContextSize", 1024 * 16);
    __publicField$t(this, "_maxOutputTokens", 1024);
    __publicField$t(this, "_lastError");
    __publicField$t(this, "_spec");
    this.on("error", (error) => {
      this._lastError = error;
      console.warn("Conversation Error: ", error);
    });
    if (_settings?.maxContextSize) this._maxContextSize = _settings.maxContextSize;
    if (_settings?.maxOutputTokens) this._maxOutputTokens = _settings.maxOutputTokens;
    if (_specSource) {
      this.loadSpecFromSource(_specSource).then((spec) => {
        if (!spec) {
          this._status = "error";
          this.emit("error", "Unable to parse OpenAPI specifications");
          throw new Error("Invalid OpenAPI specification data format");
        }
        this._spec = spec;
        this.updateModel(this._model);
        this._status = "ready";
      }).catch((error) => {
        this._status = "error";
        this.emit("error", error);
      });
    } else {
      this.updateModel(this._model);
      this._status = "ready";
    }
  }
  get context() {
    return this._context;
  }
  set spec(specSource) {
    this.ready.then(() => {
      this._status = "";
      this.loadSpecFromSource(specSource).then((spec) => {
        if (!spec) {
          this._status = "error";
          this.emit("error", "Invalid OpenAPI specification data format");
          throw new Error("Invalid OpenAPI specification data format");
        }
        this._spec = spec;
        this.updateModel(this._model);
        this._status = "ready";
      });
    });
  }
  set model(model) {
    this.ready.then(() => {
      this._status = "";
      this.updateModel(model);
      this._status = "ready";
    });
  }
  get model() {
    return this._model;
  }
  get ready() {
    if (this._currentWaitPromise) return this._currentWaitPromise;
    this._currentWaitPromise = new Promise((resolve, reject) => {
      if (this._status) {
        return resolve(this._status);
      }
      const maxWaitTime = 3e4;
      let waitTime = 0;
      const interval = 100;
      const wait = setInterval(() => {
        if (this._status) {
          clearInterval(wait);
          return resolve(this._status);
        } else {
          waitTime += interval;
          if (waitTime >= maxWaitTime) {
            clearInterval(wait);
            return reject("Timeout: Failed to prepare data");
          }
        }
      }, interval);
    });
    return this._currentWaitPromise;
  }
  //TODO : handle attachments
  async prompt(message, toolHeaders = {}) {
    await this.ready;
    const reqMethods = this._reqMethods;
    const toolsConfig = this._toolsConfig;
    const endpoints = this._endpoints;
    const baseUrl = this._baseUrl;
    console.debug("Request to LLM with the given model, messages and functions properties.", {
      model: this.model,
      message,
      toolsConfig
    });
    const llmHelper = LLMHelper$1.load(this.model);
    if (message) this._context.addUserMessage(message);
    const contextWindow = this._context.getContextWindow(this._maxContextSize, this._maxOutputTokens);
    const { data: llmResponse, error } = await llmHelper.toolRequest(
      {
        model: this.model,
        messages: contextWindow,
        toolsConfig,
        max_tokens: this._maxOutputTokens
      },
      this._agentId
    );
    if (error) {
      throw new Error(
        "[LLM Request Error]\n" + JSON.stringify({
          code: error?.name || "LLMRequestFailed",
          message: error?.message || "Something went wrong while calling LLM."
        })
      );
    }
    if (llmResponse?.useTool) {
      console.debug({
        type: "ToolsData",
        message: "Tool(s) is available for use.",
        toolsData: llmResponse?.toolsData
      });
      const toolsData = [];
      for (const tool of llmResponse?.toolsData) {
        const endpoint = endpoints?.get(tool?.name);
        const parsedArgs = JSONContent(tool?.arguments).tryParse();
        let args = typeof tool?.arguments === "string" ? parsedArgs || {} : tool?.arguments;
        if (args?.error) {
          throw new Error("[Tool] Arguments Parsing Error\n" + JSON.stringify({ message: args?.error }));
        }
        const toolArgs = {
          type: tool?.type,
          method: reqMethods?.get(tool?.name),
          endpoint,
          args,
          baseUrl,
          headers: toolHeaders
        };
        console.debug({
          type: "UseTool",
          message: "As LLM returned a tool to use, so use it with the provided arguments.",
          plugin_url: { baseUrl, endpoint, args },
          arguments: args
        });
        this.emit("beforeToolCall", toolArgs);
        let { data: functionResponse, error: error2 } = await this.useTool(toolArgs);
        if (error2) {
          this.emit("toolCallError", toolArgs, error2);
          functionResponse = typeof error2 === "object" && typeof error2 !== null ? JSON.stringify(error2) : error2;
        }
        functionResponse = typeof functionResponse === "object" && typeof functionResponse !== null ? JSON.stringify(functionResponse) : functionResponse;
        console.debug({
          type: "ToolResult",
          message: "Result from the tool",
          response: functionResponse
        });
        this.emit("afterToolCall", toolArgs, functionResponse);
        toolsData.push({ ...tool, result: functionResponse });
      }
      const messagesWithToolResult = llmHelper.connector.prepareInputMessageBlocks({ messageBlock: llmResponse?.message, toolsData });
      this._context.push(...messagesWithToolResult);
      return this.prompt(null, toolHeaders);
    }
    let content = JSONContent(llmResponse?.content).tryParse();
    console.debug({
      type: "FinalResult",
      message: "Here is the final result after processing all the tools and LLM response.",
      response: content
    });
    return content;
  }
  //TODO : handle attachments
  async streamPrompt(message, toolHeaders = {}, concurrentToolCalls = 4) {
    await this.ready;
    let _content = "";
    const reqMethods = this._reqMethods;
    const toolsConfig = this._toolsConfig;
    const endpoints = this._endpoints;
    const baseUrl = this._baseUrl;
    const llmHelper = LLMHelper$1.load(this.model);
    if (message) this._context.addUserMessage(message);
    const contextWindow = this._context.getContextWindow(this._maxContextSize, this._maxOutputTokens);
    const eventEmitter = await llmHelper.streamRequest(
      {
        model: this.model,
        messages: contextWindow,
        toolsConfig,
        max_tokens: this._maxOutputTokens
      },
      this._agentId
    ).catch((error) => {
      console.error("Error on streamRequest: ", error);
    });
    if (!eventEmitter || eventEmitter.error) {
      throw new Error("[LLM Request Error]");
    }
    if (message) this.emit("start");
    eventEmitter.on("data", (data) => {
      this.emit("data", data);
    });
    eventEmitter.on("content", (content2) => {
      _content += content2;
      this.emit("content", content2);
    });
    let toolsPromise = new Promise((resolve, reject) => {
      let hasTools = false;
      eventEmitter.on("toolsData", async (toolsData) => {
        hasTools = true;
        let llmMessage = {
          role: "assistant",
          content: _content,
          tool_calls: []
        };
        llmMessage.tool_calls = toolsData.map((tool) => {
          return {
            id: tool.id,
            type: tool.type,
            function: {
              name: tool.name,
              arguments: tool.arguments
            }
          };
        });
        this.emit("toolInfo", toolsData);
        const toolProcessingTasks = toolsData.map(
          (tool) => async () => {
            const endpoint = endpoints?.get(tool?.name);
            let args = typeof tool?.arguments === "string" ? JSONContent(tool?.arguments).tryParse() || {} : tool?.arguments;
            if (args?.error) {
              throw new Error("[Tool] Arguments Parsing Error\n" + JSON.stringify({ message: args?.error }));
            }
            this.emit("beforeToolCall", { tool, args });
            const toolArgs = {
              type: tool?.type,
              method: reqMethods?.get(tool?.name),
              endpoint,
              args,
              baseUrl,
              headers: toolHeaders
            };
            let { data: functionResponse, error } = await this.useTool(toolArgs);
            if (error) {
              functionResponse = typeof error === "object" && typeof error !== null ? JSON.stringify(error) : error;
            }
            functionResponse = typeof functionResponse === "object" && typeof functionResponse !== null ? JSON.stringify(functionResponse) : functionResponse;
            this.emit("afterToolCall", { tool, args }, functionResponse);
            return { ...tool, result: functionResponse };
          }
        );
        const processedToolsData = await processWithConcurrencyLimit(toolProcessingTasks, concurrentToolCalls);
        const messagesWithToolResult = llmHelper.connector.prepareInputMessageBlocks({
          messageBlock: llmMessage,
          toolsData: processedToolsData
        });
        this._context.push(...messagesWithToolResult);
        await resolve(await this.streamPrompt(null, toolHeaders, concurrentToolCalls));
      });
      eventEmitter.on("end", async (toolsData) => {
        if (!hasTools) {
          this._context.push({ role: "assistant", content: _content });
          resolve(_content);
        }
      });
    });
    const toolsContent = await toolsPromise;
    _content += toolsContent;
    let content = JSONContent(_content).tryParse();
    if (message) {
      this.emit("end");
    }
    return content;
  }
  async _streamPrompt(message, toolHeaders = {}, concurrentToolCalls = 4) {
    await this.ready;
    const reqMethods = this._reqMethods;
    const toolsConfig = this._toolsConfig;
    const endpoints = this._endpoints;
    const baseUrl = this._baseUrl;
    const llmHelper = LLMHelper$1.load(this.model);
    if (message) this._context.addUserMessage(message);
    const contextWindow = this._context.getContextWindow(this._maxContextSize, this._maxOutputTokens);
    const { data: llmResponse, error } = await llmHelper.streamToolRequest(
      {
        model: this.model,
        messages: contextWindow,
        toolsConfig
      },
      this._agentId
    );
    if (error) {
      throw new Error(
        "[LLM Request Error]\n" + JSON.stringify({
          code: error?.name || "LLMRequestFailed",
          message: error?.message || "Something went wrong while calling LLM."
        })
      );
    }
    if (llmResponse?.useTool) {
      const llmMessage = llmResponse?.message;
      const toolsData = llmResponse?.toolsData;
      this.emit("toolInfo", toolsData);
      const toolProcessingTasks = toolsData.map(
        (tool) => async () => {
          const endpoint = endpoints?.get(tool?.name);
          let args = typeof tool?.arguments === "string" ? JSONContent(tool?.arguments).tryParse() || {} : tool?.arguments;
          if (args?.error) {
            throw new Error("[Tool] Arguments Parsing Error\n" + JSON.stringify({ message: args?.error }));
          }
          this.emit("beforeToolCall", { tool, args });
          const toolArgs = {
            type: tool?.type,
            method: reqMethods?.get(tool?.name),
            endpoint,
            args,
            baseUrl,
            headers: toolHeaders
          };
          let { data: functionResponse, error: error2 } = await this.useTool(toolArgs);
          if (error2) {
            functionResponse = typeof error2 === "object" && typeof error2 !== null ? JSON.stringify(error2) : error2;
          }
          functionResponse = typeof functionResponse === "object" && typeof functionResponse !== null ? JSON.stringify(functionResponse) : functionResponse;
          this.emit("afterToolCall", { tool, args }, functionResponse);
          return { ...tool, result: functionResponse };
        }
      );
      const processedToolsData = await processWithConcurrencyLimit(toolProcessingTasks, concurrentToolCalls);
      const messagesWithToolResult = llmHelper.connector.prepareInputMessageBlocks({
        messageBlock: llmMessage,
        toolsData: processedToolsData
      });
      this._context.push(...messagesWithToolResult);
      return this.streamPrompt(null, toolHeaders, concurrentToolCalls);
    }
    let _content = "";
    if (llmResponse.content) {
      _content = llmResponse.content;
    }
    if (llmResponse.stream) {
      this.emit("start");
      for await (const part of llmResponse.stream) {
        const delta = part.choices[0].delta;
        this.emit("data", delta);
        if (delta.content) this.emit("content", delta.content);
        _content += delta.content || "";
      }
      this.emit("end");
    }
    let content = JSONContent(_content).tryParse();
    return content;
  }
  resolveToolEndpoint(baseUrl, method, endpoint, params) {
    let templateParams = {};
    if (params) {
      const parameters = this._spec?.paths?.[endpoint]?.[method.toLowerCase()]?.parameters || [];
      for (let p of parameters) {
        if (p.in === "path") {
          templateParams[p.name] = params[p.name] || "";
          delete params[p.name];
        }
      }
    }
    const parsedEndpoint = TemplateString(endpoint).parse(templateParams, Match.singleCurly).clean().result;
    const url = new URL(parsedEndpoint, baseUrl);
    Object.keys(params).forEach((key) => {
      url.searchParams.append(key, params[key]);
    });
    return url.toString();
  }
  async useTool(params) {
    const { type, endpoint, args, method, baseUrl, headers = {} } = params;
    if (type === "function") {
      try {
        const url = this.resolveToolEndpoint(baseUrl, method, endpoint, method == "get" ? args : {});
        const reqConfig = {
          method,
          url,
          headers
        };
        if (method !== "get") {
          if (Object.keys(args).length) {
            reqConfig.data = args;
          }
          reqConfig.headers["Content-Type"] = "application/json";
        }
        console.debug("Calling tool: ", reqConfig);
        if (reqConfig.url.includes("localhost")) {
          const response = await AgentProcess.load(reqConfig.headers["X-AGENT-ID"]).run(reqConfig);
          return { data: response.data, error: null };
        } else {
          const response = await axios.request(reqConfig);
          return { data: response.data, error: null };
        }
      } catch (error) {
        console.warn("Failed to call Tool: ", baseUrl, endpoint);
        console.warn("  ====>", error);
        return { data: null, error: error?.response?.data || error?.message };
      }
    }
    return { data: null, error: `'${type}' tool type not supported at the moment` };
  }
  /**
   * updates LLM model, if spec is available, it will update the tools config
   * @param model
   */
  updateModel(model) {
    this._model = model;
    if (this._spec) {
      this._reqMethods = OpenAPIParser.mapReqMethods(this._spec?.paths);
      this._endpoints = OpenAPIParser.mapEndpoints(this._spec?.paths);
      this._baseUrl = this._spec?.servers?.[0].url;
      const functionDeclarations = this.getFunctionDeclarations(this._spec);
      const llmHelper = LLMHelper$1.load(this._model);
      this._toolsConfig = llmHelper.connector.formatToolsConfig({
        type: "function",
        toolDefinitions: functionDeclarations,
        toolChoice: "auto"
      });
      let messages = [];
      if (this._context) messages = this._context.messages;
      this._context = new LLMContext(this._model, this.systemPrompt, messages);
    } else {
      this._toolsConfig = null;
      this._reqMethods = null;
      this._endpoints = null;
      this._baseUrl = null;
    }
  }
  /**
   * this function is used to patch the spec with missing fields that are required for the tool to work
   * @param spec
   */
  patchSpec(spec) {
    const paths = spec?.paths;
    for (const path in paths) {
      const pathData = paths[path];
      for (const key in pathData) {
        const data = pathData[key];
        if (!data?.operationId) {
          data.operationId = path.replace(/\//g, "_").replace(/{|}/g, "").replace(/\./g, "_");
        }
      }
    }
    return spec;
  }
  /**
   * Loads OpenAPI specification from source
   * @param specSource
   * @returns
   */
  async loadSpecFromSource(specSource) {
    if (typeof specSource === "object") {
      if (OpenAPIParser.isValidOpenAPI(specSource)) return this.patchSpec(specSource);
      return null;
    }
    if (typeof specSource === "string") {
      if (isUrl(specSource)) {
        const spec2 = await OpenAPIParser.getJsonFromUrl(specSource);
        if (spec2.info?.description) this.systemPrompt = spec2.info.description;
        if (spec2.info?.title) this.assistantName = spec2.info.title;
        const defaultBaseUrl = new URL(specSource).origin;
        if (!spec2?.servers) spec2.servers = [{ url: defaultBaseUrl }];
        if (spec2.servers?.length == 0) spec2.servers = [{ url: defaultBaseUrl }];
        if (this.assistantName) {
          this.systemPrompt = `Assistant Name : ${this.assistantName}

${this.systemPrompt}`;
        }
        return this.patchSpec(spec2);
      }
      const agentDataConnector = ConnectorService.getAgentDataConnector();
      const agentId = specSource;
      const agentData = await agentDataConnector.getAgentData(agentId).catch((error) => null);
      if (!agentData) return null;
      this._agentId = agentId;
      this.systemPrompt = agentData?.data?.behavior || this.systemPrompt;
      this.assistantName = agentData?.data?.name || agentData?.data?.templateInfo?.name || this.assistantName;
      if (this.assistantName) {
        this.systemPrompt = `Assistant Name : ${this.assistantName}

${this.systemPrompt}`;
      }
      const spec = await agentDataConnector.getOpenAPIJSON(agentData, "http://localhost/", "latest", true).catch((error) => null);
      return this.patchSpec(spec);
    }
  }
  /**
   * Extracts function declarations from OpenAPI specification
   * @param spec
   * @returns
   */
  getFunctionDeclarations(spec) {
    const paths = spec?.paths;
    const reqMethods = OpenAPIParser.mapReqMethods(paths);
    let declarations = [];
    for (const path in paths) {
      const pathData = paths[path];
      for (const key in pathData) {
        const data = pathData[key];
        const method = reqMethods.get(data?.operationId) || "get";
        let properties = {};
        let requiredFields = [];
        if (method.toLowerCase() === "get") {
          const params = data?.parameters || [];
          for (const prop of params) {
            properties[prop.name] = {
              ...prop.schema,
              description: prop.description
            };
            if (prop.required === true) {
              requiredFields.push(prop?.name || "");
            }
          }
        } else {
          properties = data?.requestBody?.content?.["application/json"]?.schema?.properties;
          requiredFields = data?.requestBody?.content?.["application/json"]?.schema?.required;
          for (const prop in properties) {
            delete properties[prop]?.required;
          }
        }
        if (!properties) properties = {};
        if (!requiredFields) requiredFields = [];
        const declaration = {
          name: data?.operationId,
          description: data?.description || data?.summary || "",
          properties,
          requiredFields
        };
        declarations.push(declaration);
      }
    }
    return declarations;
  }
}

var __defProp$s = Object.defineProperty;
var __defNormalProp$s = (obj, key, value) => key in obj ? __defProp$s(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$s = (obj, key, value) => __defNormalProp$s(obj, typeof key !== "symbol" ? key + "" : key, value);
class AgentPlugin extends Component {
  constructor() {
    super();
    __publicField$s(this, "configSchema", Joi.object({
      agentId: Joi.string().max(200).required(),
      openAiModel: Joi.string().max(200).required(),
      descForModel: Joi.string().max(5e3).allow("").label("Description for Model"),
      id: Joi.string().max(200),
      name: Joi.string().max(500),
      desc: Joi.string().max(5e3).allow("").label("Description"),
      logoUrl: Joi.string().max(8192).allow(""),
      version: Joi.string().max(100).allow(""),
      domain: Joi.string().max(253).allow("")
    }));
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    logger.debug(`=== Agent Plugin Log ===`);
    try {
      const subAgentId = config.data?.agentId;
      if (!subAgentId) {
        return { _error: "Agent Component ID is required!", _debug: logger.output };
      }
      const reqTag = agent.agentRuntime?.reqTag;
      const model = config?.data?.openAiModel;
      const descForModel = TemplateString(config?.data?.descForModel).parse(input).result;
      const prompt = typeof input?.Prompt === "string" ? input?.Prompt : JSON.stringify(input?.Prompt);
      const agentDataConnector = ConnectorService.getAgentDataConnector();
      const isSubAgentDeployed = await agentDataConnector.isDeployed(subAgentId);
      let version = config.data?.version || "";
      logger.debug("Version: ", version);
      if (version === "same-as-parent") {
        const isParentAgentDeployed = await agentDataConnector.isDeployed(agent?.id);
        if (isParentAgentDeployed) {
          if (isSubAgentDeployed) {
            version = "latest";
          } else {
            return {
              _error: `Call failed, Agent '${config.data?.name}' (${subAgentId}) is not deployed. Please deploy the agent and try again.`,
              _debug: logger.output
            };
          }
        } else {
          version = "";
        }
      } else if (version === "dev-latest") {
        version = "";
      } else if (version === "prod-latest") {
        if (isSubAgentDeployed) {
          version = "latest";
        } else {
          return {
            _error: `Call failed, Agent '${config.data?.name}' (${subAgentId}) is not deployed. Please deploy the agent and try again.`,
            _debug: logger.output
          };
        }
      }
      const conv = new Conversation(config?.data?.openAiModel, subAgentId);
      const result = await conv.prompt(prompt, {
        "X-AGENT-ID": subAgentId,
        "X-AGENT-VERSION": version,
        "X-REQUEST-TAG": reqTag,
        //request Tag identifies the request and tells the called agent that the call comes from internal agent
        "x-caller-session-id": agent.callerSessionId
      });
      logger.debug(`Response:
`, result, "\n");
      return { Response: result, _debug: logger.output };
    } catch (error) {
      console.error("Error on running Agent Component: ", error);
      return { _error: `Error on running Agent Component!
${error?.message || JSON.stringify(error)}`, _debug: logger.output };
    }
  }
}

var __defProp$r = Object.defineProperty;
var __defNormalProp$r = (obj, key, value) => key in obj ? __defProp$r(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$r = (obj, key, value) => __defNormalProp$r(obj, typeof key !== "symbol" ? key + "" : key, value);
let cacheConnector;
function getCacheConnector() {
  if (!cacheConnector) {
    cacheConnector = ConnectorService.getCacheConnector();
  }
  return cacheConnector;
}
async function saveMessagesToSession(agentId, userId, conversationId, messages, ttl) {
  if (!userId && !conversationId) return;
  const cacheConnector2 = getCacheConnector();
  const conv_uid = `${agentId}:conv-u${userId}-c${conversationId}`;
  cacheConnector2.user(AccessCandidate.agent(agentId)).set(conv_uid, JSON.stringify(messages), null, null, ttl);
}
async function readMessagesFromSession(agentId, userId, conversationId, maxTokens = DEFAULT_MAX_TOKENS_FOR_LLM) {
  if (!userId && !conversationId) return [];
  const cacheConnector2 = getCacheConnector();
  const conv_uid = `${agentId}:conv-u${userId}-c${conversationId}`;
  const sessionData = await cacheConnector2.user(AccessCandidate.agent(agentId)).get(conv_uid);
  const messages = sessionData ? JSONContent(sessionData).tryParse() : [];
  const filteredMessages = [];
  let tokens = 0;
  if (messages[0]?.role == "system") {
    const encoded = encode(messages[0]?.content);
    const messageTokens = encoded.length + 3;
    tokens += messageTokens;
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role == "system") continue;
    const message = messages[i];
    const encoded = encode(message?.content);
    const messageTokens = encoded.length + 3;
    if (tokens + messageTokens > maxTokens) break;
    filteredMessages.unshift(message);
    tokens += messageTokens;
  }
  if (messages[0]?.role == "system") filteredMessages.unshift(messages[0]);
  return filteredMessages;
}
class LLMAssistant extends Component {
  constructor() {
    super();
    __publicField$r(this, "configSchema", Joi.object({
      model: Joi.string().max(200).required(),
      behavior: Joi.string().max(3e4).allow("").label("Behavior")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      logger.debug("== LLM Assistant Log ==\n");
      const model = config.data.model || "echo";
      const ttl = config.data.ttl || void 0;
      const llmHelper = LLMHelper$1.load(model);
      if (!llmHelper.connector) {
        return {
          _error: `The model '${model}' is not available. Please try a different one.`,
          _debug: logger.output
        };
      }
      logger.debug(` Model : ${model}`);
      const userInput = input.UserInput;
      const userId = input.UserId;
      const conversationId = input.ConversationId;
      let behavior = TemplateString(config.data.behavior).parse(input).result;
      logger.debug(`[Parsed Behavior] 
${behavior}

`);
      const modelInfo = llmHelper.modelInfo;
      const maxTokens = modelInfo?.tokens ?? 2048;
      const messages = await readMessagesFromSession(agent.id, userId, conversationId, Math.round(maxTokens / 2));
      if (messages[0]?.role != "system") messages.unshift({ role: "system", content: behavior });
      messages.push({ role: "user", content: userInput });
      const customParams = {
        messages
      };
      const response = await llmHelper.promptRequest(null, config, agent, customParams).catch((error) => ({ error }));
      if (!response) {
        return { _error: " LLM Error = Empty Response!", _debug: logger.output };
      }
      if (response?.error) {
        logger.error(` LLM Error=${JSON.stringify(response.error)}`);
        return { Response: response?.data, _error: response?.error + " " + response?.details, _debug: logger.output };
      }
      messages.push({ role: "assistant", content: response });
      saveMessagesToSession(agent.id, userId, conversationId, messages, ttl);
      const result = { Response: response };
      result["_debug"] = logger.output;
      return result;
    } catch (error) {
      return { _error: error.message, _debug: logger.output };
    }
  }
}

var __defProp$q = Object.defineProperty;
var __defNormalProp$q = (obj, key, value) => key in obj ? __defProp$q(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$q = (obj, key, value) => __defNormalProp$q(obj, typeof key !== "symbol" ? key + "" : key, value);
Logger("ForkedAgent");
class ForkedAgent {
  constructor(parent, componentId) {
    this.parent = parent;
    __publicField$q(this, "agent");
    const data = fork(this.parent.data, componentId);
    const content = { name: this.parent.name, data, teamId: this.parent.teamId, debugSessionEnabled: false, version: this.parent.version };
    const agentRequest = new AgentRequest(this.parent.agentRequest.req);
    agentRequest.headers = [];
    this.agent = new Agent(this.parent.id, content, this.parent.agentSettings, agentRequest);
    const JobID = componentId + "-" + uid();
    this.agent.jobID = JobID;
  }
  get agentRequest() {
    return this.agent.agentRequest;
  }
  get components() {
    return this.agent.components;
  }
  get agentRuntime() {
    return this.agent.agentRuntime;
  }
  get jobID() {
    return this.agent.jobID;
  }
  process(path, input) {
    return this.agent.process(path, input);
  }
}
function cloneComponent(component) {
  const newComponent = JSON.parse(JSON.stringify(component));
  newComponent.id = component.id;
  return newComponent;
}
function cloneRecursively(componentData, currentID, newIDMap, clonedComponents, clonedConnections) {
  const componentToClone = componentData.components.find((c) => c.id === currentID);
  if (!componentToClone) {
    return;
  }
  const clonedComponent = cloneComponent(componentToClone);
  newIDMap[currentID] = clonedComponent.id;
  clonedComponents.push(clonedComponent);
  const outgoingConnections = componentData.connections.filter((conn) => conn.sourceId === currentID);
  outgoingConnections.forEach((conn) => {
    const clonedConnection = JSON.parse(JSON.stringify(conn));
    clonedConnection.sourceId = clonedComponent.id;
    if (!newIDMap[conn.targetId]) {
      cloneRecursively(componentData, conn.targetId, newIDMap, clonedComponents, clonedConnections);
    }
    clonedConnection.targetId = newIDMap[conn.targetId];
    clonedConnections.push(clonedConnection);
  });
}
function fork(componentData, componentID) {
  const clonedComponents = [];
  const clonedConnections = [];
  const newIDMap = {};
  cloneRecursively(componentData, componentID, newIDMap, clonedComponents, clonedConnections);
  const rootComponentData = clonedComponents.find((e) => e.id == componentID);
  if (rootComponentData) {
    if (rootComponentData.name !== "APIEndpoint") {
      const APIEndpointData = {
        id: `${componentID}_ENDPOINT`,
        name: "APIEndpoint",
        outputs: [
          { name: "headers", index: 0, default: true },
          { name: "body", index: 1, default: true },
          { name: "query", index: 2, default: true }
        ],
        inputs: [],
        data: { endpoint: componentID, description: "", method: "POST" },
        displayName: "APIEndpoint",
        title: "APIEndpoint",
        description: ""
      };
      clonedComponents.push(APIEndpointData);
      const incomingConnections = componentData.connections.filter((conn) => conn.targetId === componentID);
      let i = 3;
      for (let con of incomingConnections) {
        const input = rootComponentData.inputs.find((e) => e.index == con.targetIndex);
        const epInput = JSON.parse(JSON.stringify(input));
        APIEndpointData.inputs.push(epInput);
        const epOutput = {
          name: input.name,
          expression: `body.${input.name}`,
          optional: false,
          index: i++,
          default: false
        };
        APIEndpointData.outputs.push(epOutput);
        clonedConnections.push({
          sourceId: APIEndpointData.id,
          targetId: rootComponentData.id,
          sourceIndex: epOutput.index,
          targetIndex: input.index
        });
      }
    }
  }
  return {
    components: clonedComponents,
    connections: clonedConnections
  };
}

var __defProp$p = Object.defineProperty;
var __defNormalProp$p = (obj, key, value) => key in obj ? __defProp$p(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$p = (obj, key, value) => __defNormalProp$p(obj, typeof key !== "symbol" ? key + "" : key, value);
const _Async = class _Async extends Component {
  constructor() {
    super();
    __publicField$p(this, "configSchema", null);
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    this.createComponentLogger(agent, config.name);
    const forked = config.data.forked;
    try {
      if (!forked) {
        const forkedAgent = new ForkedAgent(agent, config.id);
        const JobID = forkedAgent.jobID;
        forkedAgent.agent.async = true;
        forkedAgent.agent.jobID = JobID;
        this.cleanJobIDBranch(forkedAgent.agent);
        const componentData = forkedAgent.components[config.id];
        componentData.data.forked = true;
        forkedAgent.agentRequest.body = { ...input };
        if (!_Async.JOBS[agent.id]) _Async.JOBS[agent.id] = {};
        _Async.JOBS[agent.id][JobID] = {
          //forkedAgent,
          status: "pending"
        };
        if (agent.debugSessionEnabled) {
          const _job_components = Object.keys(forkedAgent.components);
          agent.agentRuntime.updateComponent(config.id, { _job_components });
        }
        forkedAgent.process(`/api/${config.id}`, input).then((result) => {
          _Async.JOBS[agent.id][JobID].result = result;
          _Async.JOBS[agent.id][JobID].status = "done";
        }).finally(async () => {
          if (_Async.JOBS[agent.id][JobID].status !== "done") {
            _Async.JOBS[agent.id][JobID].status = "failed";
          }
          if (agent.debugSessionEnabled) {
            await delay(1e3);
            agent.agentRuntime.reloadCtxData();
            agent.agentRuntime.updateComponent(config.id, { _job_components: [] });
          }
        });
        return { JobID };
      } else {
        let result = { JobID: agent.jobID };
        for (let key in input) {
          result[key] = input[key];
        }
        return result;
      }
    } catch (error) {
    }
    return {};
  }
  // private recursiveTagAsyncComponents(component, agent: Agent) {
  //     for (let output of component.outputs) {
  //         if (component.name == 'Async' && output.name === 'JobID') continue; //'JobID' is a special output
  //         const connected = agent.connections.filter((c) => c.sourceId === component.id && c.sourceIndex === output.index);
  //         if (!connected) continue;
  //         for (let con of connected) {
  //             const targetComponent = agent.components[con.targetId];
  //             if (!targetComponent) continue;
  //             targetComponent.async = true;
  //             this.recursiveTagAsyncComponents(targetComponent, agent);
  //         }
  //     }
  // }
  // private tagAsyncComponents(agent: Agent) {
  //     const componentsList: any[] = Object.values(agent.components);
  //     const AsyncComponent = componentsList.find((c) => c.name === 'Async');
  //     if (!AsyncComponent) return;
  //     AsyncComponent.async = true;
  //     this.recursiveTagAsyncComponents(AsyncComponent, agent);
  // }
  cleanJobIDBranch(agent) {
    const componentsList = Object.values(agent.components);
    const AsyncComponent = componentsList.find((c) => c.name === "Async");
    if (!AsyncComponent) return;
    const jobIDOutputIndex = AsyncComponent.outputs.findIndex((o) => o.name === "JobID");
    if (jobIDOutputIndex === -1) return;
    agent.connections = agent.connections.filter((c) => {
      const toDelete = c.sourceId === AsyncComponent.id && c.sourceIndex === jobIDOutputIndex && !agent.components[c.targetId].async;
      return !toDelete;
    });
    this.removeOrphanedBranches(agent);
  }
  removeOrphanedBranches(agent) {
    const toDelete = [];
    for (let componentId in agent.components) {
      const component = agent.components[componentId];
      if (component.name === "APIEndpoint") continue;
      const connected = agent.connections.some((c) => c.targetId === component.id);
      if (!connected) {
        toDelete.push(component.id);
      }
    }
    for (let id of toDelete) {
      this.removeComponent(agent, id);
    }
  }
  removeComponent(agent, componentId) {
    agent.components[componentId];
    delete agent.components[componentId];
    agent.connections = agent.connections.filter((c) => c.sourceId !== componentId);
    this.removeOrphanedBranches(agent);
  }
};
__publicField$p(_Async, "JOBS", {});
__publicField$p(_Async, "ForkedAgent");
let Async = _Async;

var __defProp$o = Object.defineProperty;
var __defNormalProp$o = (obj, key, value) => key in obj ? __defProp$o(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$o = (obj, key, value) => __defNormalProp$o(obj, typeof key !== "symbol" ? key + "" : key, value);
const _Await = class _Await extends Component {
  constructor() {
    super();
    __publicField$o(this, "configSchema", Joi.object({
      jobs_count: Joi.number().min(1).max(100).default(1).label("Jobs Count"),
      max_time: Joi.number().min(1).max(21600).default(1).label("Max time")
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    try {
      let Results = {};
      const _error = null;
      let jobs_count = parseInt(config.data.jobs_count || 1);
      let max_time = parseInt(config.data.max_time || 1);
      const jobs = Array.isArray(input.Jobs) ? input.Jobs : [input.Jobs];
      if (!_Await.WAITS[agent.id]) _Await.WAITS[agent.id] = {};
      if (!_Await.WAITS[agent.id][config.id]) _Await.WAITS[agent.id][config.id] = {};
      if (!_Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId])
        _Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId] = [];
      for (let jobID of jobs) _Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId].push(jobID);
      logger.debug("Jobs", jobs);
      logger.debug("Waiting for jobs to finish");
      let promise = new Promise((resolve, reject) => {
        let interval = setInterval(() => {
          if (max_time < 0) {
            clearInterval(interval);
            return resolve(true);
          }
          let done = true;
          let completed = 0;
          for (let jobID of jobs) {
            if (Async.JOBS?.[agent.id]?.[jobID]?.status == "pending") {
              done = false;
              break;
            } else {
              completed++;
            }
          }
          if (completed >= jobs_count) {
            done = true;
          }
          if (done) {
            clearInterval(interval);
            return resolve(true);
          }
          max_time -= 1;
        }, 1e3);
      });
      await promise;
      logger.debug("Jobs finished, collecting results");
      for (let jobID of jobs) {
        Results[jobID] = {
          output: Async.JOBS?.[agent.id]?.[jobID]?.result,
          status: Async.JOBS?.[agent.id]?.[jobID]?.status || "unknown_job"
        };
      }
      delete _Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId];
      logger.debug("Results", Results);
      return { Results, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
    } catch (err) {
      const _error = err?.response?.data || err?.message || err.toString();
      logger.error(` Error running code 
${_error}
`);
      delete _Await.WAITS[agent.id][config.id][agent.agentRuntime.workflowReqId];
      return { Output: void 0, _error, _debug: logger.output, _debug_time: logger.elapsedTime };
    }
  }
};
__publicField$o(_Await, "WAITS", {});
let Await = _Await;

var __defProp$n = Object.defineProperty;
var __defNormalProp$n = (obj, key, value) => key in obj ? __defProp$n(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$n = (obj, key, value) => __defNormalProp$n(obj, typeof key !== "symbol" ? key + "" : key, value);
class ForEach extends Component {
  constructor() {
    super();
    __publicField$n(this, "configSchema", null);
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    let Loop = {};
    let Result;
    let _temp_result;
    let _error = null;
    let _in_progress = true;
    const logger = this.createComponentLogger(agent, config.name);
    try {
      const inputObject = input.Input;
      let inputArray = Array.isArray(inputObject) ? inputObject : [inputObject];
      if (!Array.isArray(inputArray) && typeof inputArray === "object")
        inputArray = Object.values(inputArray);
      const runtimeData = agent.agentRuntime.getRuntimeData(config.id);
      const _ForEachData = runtimeData._LoopData || { parentId: config.id, loopIndex: 0, loopLength: inputArray.length };
      logger.debug(`Loop: ${_ForEachData.loopIndex} / ${_ForEachData.loopLength}`);
      delete _ForEachData.branches;
      if (_ForEachData.result) {
        _temp_result = _ForEachData.result;
        logger.debug(`  => Loop Result : ${JSON.stringify(Loop, null, 2)}`);
        logger.debug(`---------------------------------------------------`);
      }
      Loop = inputArray[_ForEachData.loopIndex];
      logger.debug(`  => Loop Data : ${JSON.stringify(Loop, null, 2)}`);
      _in_progress = Loop !== void 0;
      if (_in_progress) {
        _ForEachData.loopIndex++;
      }
      _ForEachData._in_progress = _in_progress;
      agent.agentRuntime.updateRuntimeData(config.id, { _LoopData: _ForEachData });
    } catch (error) {
      _error = error;
      logger.error(error);
    }
    if (!_in_progress) {
      Result = _temp_result || [];
      switch (config?.data?.format) {
        case "minimal":
          Result = Result.map((item) => cleanupResult(item.result));
          break;
        case "results-array":
          Result = Result.map((item) => Object.values(cleanupResult(item.result))).flat(Infinity);
          break;
      }
    }
    return { Loop, Result, _temp_result, _error, _in_progress, _debug: logger.output };
  }
  async postProcess(output, config, agent) {
    output = await super.postProcess(output, config, agent);
    if (output?.result) {
      delete output.result._temp_result;
      delete output.result._in_progress;
      delete output.result.Loop;
    }
    return output;
  }
}
function cleanupResult(result) {
  if (typeof result !== "object") return result;
  if (result._debug) delete result._debug;
  if (result._error) delete result._error;
  if (result._temp_result) delete result._temp_result;
  if (result._in_progress) delete result._in_progress;
  return result;
}

var __defProp$m = Object.defineProperty;
var __defNormalProp$m = (obj, key, value) => key in obj ? __defProp$m(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$m = (obj, key, value) => __defNormalProp$m(obj, typeof key !== "symbol" ? key + "" : key, value);
class Code extends Component {
  constructor() {
    super();
    __publicField$m(this, "configSchema", Joi.object({
      code_vars: Joi.string().max(1e3).allow("").label("Variables"),
      code_body: Joi.string().max(5e5).allow("").label("Code"),
      _templateSettings: Joi.object().allow(null).label("Template Settings"),
      _templateVars: Joi.object().allow(null).label("Template Variables")
    }));
  }
  init() {
  }
  async process(input, config$1, agent) {
    await super.process(input, config$1, agent);
    const logger = this.createComponentLogger(agent, config$1.name);
    try {
      let Output = {};
      let _error = void 0;
      const url = config.env.CODE_SANDBOX_URL + "/run-js";
      let codeInputs = {};
      for (let fieldName in input) {
        const _type = typeof input[fieldName];
        switch (_type) {
          case "string":
            const b64encoded = Buffer.from(input[fieldName]).toString("base64");
            codeInputs[fieldName] = `___internal.b64decode('${b64encoded}')`;
            break;
          case "number":
          case "boolean":
            codeInputs[fieldName] = input[fieldName];
            break;
          default:
            codeInputs[fieldName] = input[fieldName];
            break;
        }
      }
      let code_vars = TemplateStringHelper.create(config$1.data.code_vars || "").parse(codeInputs).result;
      let code_body = config$1.data.code_body;
      if (config$1.data._templateVars) {
        code_body = TemplateStringHelper.create(code_body).parse(config$1.data._templateVars).result;
      }
      const code = code_vars + "\n" + code_body;
      logger.debug(` Running code 
${code}
`);
      const result = await axios.post(url, { code }).catch((error) => ({ error }));
      if (result.error) {
        _error = result.error?.response?.data || result.error?.message || result.error.toString();
        logger.error(` Error running code 
${_error}
`);
        Output = void 0;
      } else {
        logger.debug(` Code result 
${JSON.stringify(result.data, null, 2)}
`);
        Output = result.data?.Output;
      }
      return { Output, _error, _debug: logger.output };
    } catch (err) {
      const _error = err?.response?.data || err?.message || err.toString();
      logger.error(` Error running code 
${_error}
`);
      return { Output: void 0, _error, _debug: logger.output };
    }
  }
}

var translation = {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be translated in the original languages",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: \"{{text}}\""
};
var summarization = {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be summarized",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	parameters: {
		min_length: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the minimum length in tokens of the output summary."
		},
		max_length: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the maximum length in tokens of the output summary."
		},
		top_k: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the top tokens considered within the sample operation to create new text."
		},
		top_p: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float to define the tokens that are within the sample operation of text generation. Add tokens in the sample for more probable to least probable until the sum of the probabilities is greater than top_p."
		},
		temperature: {
			type: "number",
			"default": 1,
			desc: "(Default: 1.0). Float (0.0-100.0). The temperature of the sampling operation. 1 means regular sampling, 0 means always take the highest score, 100.0 is getting closer to uniform probability."
		},
		repetition_penalty: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0.0-100.0). The more a token is used within generation the more it is penalized to not be picked in successive generation passes."
		},
		max_time: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0-120.0). The amount of time in seconds that the query should take maximum. Network can cause some overhead so it will be a soft limit."
		}
	},
	formatRequest: "inputs: \"{{text}}\""
};
var conversational = {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) The last input from the user in the conversation.",
			request_parameter_name: "text",
			request_parameter_type: "string"
		},
		Generated_responses: {
			type: "string[]",
			desc: "A list of strings corresponding to the earlier replies from the model.",
			request_parameter_name: "generated_responses",
			request_parameter_type: "string[]"
		},
		Past_user_inputs: {
			type: "string[]",
			desc: "A list of strings corresponding to the earlier replies from the user. Should be of the same length of generated_responses.",
			request_parameter_name: "past_user_inputs",
			request_parameter_type: "string[]"
		}
	},
	parameters: {
		min_length: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the minimum length in tokens of the output summary."
		},
		max_length: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the maximum length in tokens of the output summary."
		},
		top_k: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the top tokens considered within the sample operation to create new text."
		},
		top_p: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float to define the tokens that are within the sample operation of text generation. Add tokens in the sample for more probable to least probable until the sum of the probabilities is greater than top_p."
		},
		temperature: {
			type: "number",
			"default": 1,
			desc: "(Default: 1.0). Float (0.0-100.0). The temperature of the sampling operation. 1 means regular sampling, 0 means always take the highest score, 100.0 is getting closer to uniform probability."
		},
		repetition_penalty: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0.0-100.0). The more a token is used within generation the more it is penalized to not be picked in successive generation passes."
		},
		max_time: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0-120.0). The amount of time in seconds that the query should take maximum. Network can cause some overhead so it will be a soft limit."
		}
	},
	formatRequest: "inputs: \"{{text}}\", past_user_inputs: [{{past_user_inputs}}], generated_responses: [{{generated_responses}}] }"
};
var hfParams = {
	"text-classification": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be classified",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: \"{{text}}\""
},
	"token-classification": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be classified",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	parameters: {
		aggregation_strategy: {
			type: "string",
			"default": "simple",
			desc: "(Default: simple). There are several aggregation strategies:",
			supportedValues: [
				{
					value: "none",
					desc: "Every token gets classified without further aggregation."
				},
				{
					value: "simple",
					desc: "Entities are grouped according to the default schema (B-, I- tags get merged when the tag is similar)."
				},
				{
					value: "first",
					desc: "Same as the simple strategy except words cannot end up with different tags. Words will use the tag of the first token when there is ambiguity."
				},
				{
					value: "average",
					desc: "Same as the simple strategy except words cannot end up with different tags. Scores are averaged across tokens and then the maximum label is applied."
				},
				{
					value: "max",
					desc: "Same as the simple strategy except words cannot end up with different tags. Word entity will be the token with the maximum score."
				}
			]
		}
	},
	formatRequest: "inputs: \"{{text}}\""
},
	"table-question-answering": {
	inputs: {
		Query: {
			type: "string",
			desc: "(required) The query in plain text that you want to ask the table",
			request_parameter_name: "query",
			request_parameter_type: "string"
		},
		Table: {
			type: "string",
			desc: "(required) A table of data represented as a dict of list where entries are headers and the lists are all the values, all lists must have the same size.",
			request_parameter_name: "table",
			request_parameter_type: "Record<string, string[]>"
		}
	},
	formatRequest: "inputs: { query: \"{{query}}\", table: {{table}} }"
},
	"question-answering": {
	inputs: {
		Question: {
			type: "string",
			request_parameter_name: "question",
			request_parameter_type: "string"
		},
		Context: {
			type: "string",
			request_parameter_name: "context",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: { context: \"{{context}}\", question: \"{{question}}\" }"
},
	"document-question-answering": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "image",
			request_parameter_type: "Blob | ArrayBuffer"
		},
		Question: {
			type: "string",
			desc: "(required) Question about document image.",
			request_parameter_name: "question",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: { image: {{image}}, question: \"{{question}}\" }"
},
	"visual-question-answering": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "image",
			request_parameter_type: "Blob | ArrayBuffer"
		},
		Question: {
			type: "string",
			desc: "(required) Question about visual image.",
			request_parameter_name: "question",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: { image: {{image}}, question: \"{{question}}\" }"
},
	"zero-shot-classification": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string or list of strings",
			request_parameter_name: "inputs",
			request_parameter_type: "string | string[]"
		}
	},
	parameters: {
		candidate_labels: {
			type: "string[]",
			"default": [
			],
			desc: "(required) a list of strings that are potential classes for inputs. (max 10 candidate_labels, for more, simply run multiple requests, results are going to be misleading if using too many candidate_labels anyway. If you want to keep the exact same, you can simply run multi_label=true and do the scaling on your end. )"
		},
		multi_label: {
			type: "boolean",
			"default": false,
			desc: "(Default: false) Boolean that is set to True if classes can overlap"
		}
	},
	formatRequest: "inputs: \"{{text}}\", parameters: { candidate_labels: [{{candidate_labels}}] }"
},
	translation: translation,
	summarization: summarization,
	conversational: conversational,
	"text-generation": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be generated from",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	parameters: {
		do_sample: {
			type: "boolean",
			"default": true,
			desc: "(Optional: true). Bool. Whether or not to use sampling, use greedy decoding otherwise."
		},
		max_time: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0-120.0). The amount of time in seconds that the query should take maximum. Network can cause some overhead so it will be a soft limit."
		},
		num_return_sequences: {
			type: "number",
			"default": 1,
			desc: "(Default: 1). Integer. The number of proposition you want to be returned."
		},
		repetition_penalty: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0.0-100.0). The more a token is used within generation the more it is penalized to not be picked in successive generation passes."
		},
		return_full_text: {
			type: "boolean",
			"default": true,
			desc: "(Default: true). Bool. If set to False, the return results will not contain the original query making it easier for prompting."
		},
		temperature: {
			type: "number",
			"default": 1,
			desc: "(Default: 1.0). Float (0.0-100.0). The temperature of the sampling operation. 1 means regular sampling, 0 means always take the highest score, 100.0 is getting closer to uniform probability."
		},
		max_new_tokens: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Int (0-250). The amount of new tokens to be generated, this does not include the input length it is a estimate of the size of generated text you want. Each new tokens slows down the request, so look for balance between response times and length of text generated."
		},
		top_k: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the top tokens considered within the sample operation to create new text."
		},
		top_p: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float to define the tokens that are within the sample operation of text generation. Add tokens in the sample for more probable to least probable until the sum of the probabilities is greater than top_p."
		},
		truncate: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer. The maximum number of tokens from the input."
		}
	},
	formatRequest: "inputs: \"{{text}}\""
},
	"text2text-generation": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be generated from",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	parameters: {
		max_time: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0-120.0). The amount of time in seconds that the query should take maximum. Network can cause some overhead so it will be a soft limit."
		},
		num_return_sequences: {
			type: "number",
			"default": 1,
			desc: "(Default: 1). Integer. The number of proposition you want to be returned."
		},
		repetition_penalty: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float (0.0-100.0). The more a token is used within generation the more it is penalized to not be picked in successive generation passes."
		},
		temperature: {
			type: "number",
			"default": 1,
			desc: "(Default: 1.0). Float (0.0-100.0). The temperature of the sampling operation. 1 means regular sampling, 0 means always take the highest score, 100.0 is getting closer to uniform probability."
		},
		max_new_tokens: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Int (0-250). The amount of new tokens to be generated, this does not include the input length it is a estimate of the size of generated text you want. Each new tokens slows down the request, so look for balance between response times and length of text generated."
		},
		top_k: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Integer to define the top tokens considered within the sample operation to create new text."
		},
		top_p: {
			type: "number",
			"default": "None",
			desc: "(Default: None). Float to define the tokens that are within the sample operation of text generation. Add tokens in the sample for more probable to least probable until the sum of the probabilities is greater than top_p."
		}
	},
	formatRequest: "inputs: \"{{text}}\""
},
	"fill-mask": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be filled from, must contain the [MASK] token (check model card for exact name of the mask)",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: \"{{text}}\""
},
	"sentence-similarity": {
	inputs: {
		Source_sentence: {
			type: "string",
			desc: "(required) The string that you wish to compare the other strings with. This can be a phrase, sentence, or longer passage, depending on the model being used.",
			request_parameter_name: "source_sentence",
			request_parameter_type: "string"
		},
		Sentences: {
			type: "string[]",
			desc: "(required) A list of strings which will be compared against the source_sentence.",
			request_parameter_name: "sentences",
			request_parameter_type: "string[]"
		}
	},
	formatRequest: "inputs: { source_sentence: \"{{source_sentence}}\", sentences: [{{sentences}}] }"
},
	"text-to-image": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) prompt to generate image from",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: \"{{text}}\""
},
	"image-to-text": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "data",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	formatRequest: "data: {{image}} "
},
	"image-classification": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "data",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	formatRequest: "data: {{image}}"
},
	"object-detection": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "data",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	formatRequest: "data: {{image}}"
},
	"image-segmentation": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "data",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	formatRequest: "data: {{image}}"
},
	"zero-shot-image-classification": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "image",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	parameters: {
		candidate_labels: {
			type: "string[]",
			desc: "A list of strings that are potential classes for inputs. (max 10)"
		}
	},
	formatRequest: "inputs: { image: {{image}}, parameters: { candidate_labels: [{{candidate_labels}}] } }"
},
	"image-to-image": {
	inputs: {
		Image: {
			type: "URL | base64 | file | SmythFileObject",
			desc: "(required) image URL, base64 string, uploaded image, or linked image output",
			request_parameter_name: "inputs",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	parameters: {
		prompt: {
			type: "string",
			desc: "(Optional) The text prompt to guide the image generation",
			"default": "None"
		},
		strength: {
			type: "number",
			"default": 0,
			desc: "(Optional) The 'strength' parameter is effective only for SD img2img and alt diffusion img2img models. It conceptually indicates the extent of transformation applied to the reference 'image,' with values between 0 and 1. A higher 'strength' adds more noise to the initial 'image,' and the denoising process runs for the specified number of iterations in 'num_inference_steps.' A 'strength' of 1 ignores the 'image,' applying maximum added noise and running denoising for the full set of iterations."
		},
		negative_prompt: {
			type: "string",
			"default": "None",
			desc: "(Optional) A negative prompt for the image generation"
		},
		height: {
			type: "number",
			"default": "None",
			desc: "(Optional) The height in pixels of the generated image"
		},
		width: {
			type: "number",
			"default": "None",
			desc: "(Optional) The width in pixels of the generated image"
		},
		num_inference_steps: {
			type: "number",
			"default": "None",
			desc: "(Optional) The number of denoising steps. More denoising steps usually lead to a higher quality image at the expense of slower inference."
		},
		guidance_scale: {
			type: "number",
			"default": "None",
			desc: "(Optional) Guidance scale: Higher guidance scale encourages to generate images that are closely linked to the text `prompt`, usually at the expense of lower image quality."
		},
		guess_mode: {
			type: "boolean",
			"default": "None",
			desc: "(Optional) guess_mode only works for ControlNet models, defaults to False In this mode, the ControlNet encoder will try best to recognize the content of the input image even if you remove all prompts. The `guidance_scale` between 3.0 and 5.0 is recommended."
		}
	},
	formatRequest: "inputs: {{image}}"
},
	"text-to-speech": {
	inputs: {
		Text: {
			type: "string",
			desc: "(required) a string to be converted to speech",
			request_parameter_name: "inputs",
			request_parameter_type: "string"
		}
	},
	formatRequest: "inputs: \"{{text}}\""
},
	"automatic-speech-recognition": {
	inputs: {
		Audio: {
			type: "URL | base64 | SmythFileObject",
			desc: "(required) audio URL, base64 string, SmythFileObject",
			request_parameter_name: "data",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	formatRequest: "data: {{audio}}"
},
	"audio-to-audio": {
	inputs: {
		Audio: {
			type: "URL | base64 | SmythFileObject",
			desc: "(required) audio URL, base64 string, SmythFileObject",
			request_parameter_name: "data",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	formatRequest: "data: {{audio}}"
},
	"audio-classification": {
	inputs: {
		Audio: {
			type: "URL | base64 | SmythFileObject",
			desc: "(required) audio URL, base64 string, SmythFileObject",
			request_parameter_name: "data",
			request_parameter_type: "Blob | ArrayBuffer"
		}
	},
	formatRequest: "data: {{audio}}"
},
	"feature-extraction": {
	inputs: {
		Text: {
			type: "string | string[]",
			desc: "(required) a string or a list of strings to get the features from.",
			request_parameter_name: "inputs",
			request_parameter_type: "string | string[]"
		}
	},
	formatRequest: "inputs: \"{{text}}\""
}
};

var __defProp$l = Object.defineProperty;
var __defNormalProp$l = (obj, key, value) => key in obj ? __defProp$l(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$l = (obj, key, value) => __defNormalProp$l(obj, typeof key !== "symbol" ? key + "" : key, value);
function shouldNestInputs(formatRequestPattern) {
  const trimmedPattern = formatRequestPattern?.trim();
  return /^(inputs|data):\s*{(?![{])/.test(trimmedPattern);
}
function validateAndParseJson(value, helpers) {
  let parsedJson = null;
  try {
    parsedJson = JSON.parse(value);
  } catch (error) {
    return helpers.error("string.invalidJson", { value });
  }
  if (typeof parsedJson !== "object" || parsedJson === null) {
    return helpers.error("string.notJsonObject", { value });
  }
  for (const key in parsedJson) {
    if (key.trim() === "") {
      return helpers.error("object.emptyKey", { value });
    }
  }
  return parsedJson;
}
class HuggingFace extends Component {
  constructor() {
    super();
    __publicField$l(this, "configSchema", Joi.object({
      accessToken: Joi.string().max(350).required().label("Access Token"),
      modelName: Joi.string().max(100).required(),
      modelTask: Joi.string().max(100).required(),
      inputConfig: Joi.string().allow(""),
      parameters: Joi.string().custom(validateAndParseJson, "custom JSON validation").allow(""),
      name: Joi.string().max(100).required(),
      displayName: Joi.string().max(100).required(),
      desc: Joi.string().max(5e3).required().allow(""),
      logoUrl: Joi.string().max(500).allow(""),
      disableCache: Joi.boolean().strict()
    }));
  }
  init() {
  }
  async process(input, config, agent) {
    await super.process(input, config, agent);
    const logger = this.createComponentLogger(agent, config.name);
    logger.debug(`=== Hugging Face Log ===`);
    agent?.id;
    const teamId = agent?.teamId;
    const accessToken = await TemplateStringHelper.create(config?.data?.accessToken).parseTeamKeys(teamId).asyncResult;
    if (!accessToken) {
      return { _error: "Please provide a valid Hugging Face Access Token", _debug: logger.output };
    }
    const hf = new HfInference(accessToken);
    const task = config?.data?.modelTask;
    if (!task) {
      return { _error: "Hugging Face Task is required!", _debug: logger.output };
    }
    logger.debug(`Task: ${kebabToCapitalize(task)}`);
    let hfFunc = kebabToCamel(task);
    if (hfFunc === "text2textGeneration") {
      hfFunc = "textGeneration";
    }
    if (!hf?.[hfFunc]) {
      return { _error: `Inference API does not support for this task - ${kebabToCapitalize(task)}`, _debug: logger.output };
    }
    const modelName = config?.data?.modelName;
    if (!modelName) {
      return { _error: "Hugging Face Model is required!", _debug: logger.output };
    }
    logger.debug(`Model Name: ${modelName}`);
    let inputConfig = {};
    const formatRequest = hfParams?.[task]?.formatRequest;
    const _hfParams = hfParams?.[task]?.inputs;
    if (_hfParams && Object.keys(_hfParams).length > 0) {
      for (const key in _hfParams) {
        const config2 = _hfParams[key];
        inputConfig[key] = config2;
      }
      if (typeof inputConfig === "object" && inputConfig !== null) {
        inputConfig = { ...inputConfig, formatRequest };
      }
    }
    if (!inputConfig || Object.keys(inputConfig)?.length === 0) {
      console.log("No inputs config found for Hugging Face Model!");
    }
    let inputs = {};
    if (!input || Object.keys(input)?.length === 0) {
      return { _error: "Please provide a valid input!", _debug: logger.output };
    }
    if (typeof input !== "object") {
      return { _error: "Invalid input!", _debug: logger.output };
    }
    if (typeof input == "object" && Object.keys(input)?.length > 0) {
      for (const key in input) {
        if (inputConfig?.[key]) {
          let value = input[key];
          let name = inputConfig[key]["request_parameter_name"];
          let type = inputConfig[key]["request_parameter_type"];
          if (type && type?.includes("Blob")) {
            try {
              const binaryFile = new BinaryInput(value);
              const buffer = await binaryFile.getBuffer();
              const blob = new Blob([buffer]);
              inputs[name] = blob;
            } catch (error) {
              return { _error: error?.message || JSON.stringify(error), _debug: logger.output };
            }
          } else {
            inputs[name] = value;
          }
        }
      }
    }
    const nestInputs = shouldNestInputs(inputConfig.formatRequest);
    const structuredInputs = nestInputs ? { inputs } : inputs;
    let inputsLog;
    if (structuredInputs["inputs"] && typeof structuredInputs["inputs"] === "object") {
      inputsLog = { ...structuredInputs["inputs"] };
      for (const [key, value] of Object.entries(structuredInputs["inputs"] || {})) {
        if (value instanceof Blob) {
          inputsLog[key] = `Blob size=${value.size}`;
        }
      }
    } else {
      inputsLog = structuredInputs;
    }
    logger.debug("Inputs: ", inputsLog);
    let params = JSON.parse(config?.data?.parameters || "{}");
    params = convertStringToRespectiveType(params);
    let parameters = {};
    if (params && Object.keys(params)?.length > 0) {
      for (const key in params) {
        const value = params[key];
        if (typeof value === "string") {
          if (value?.toLowerCase() === "none") continue;
          parameters[key] = TemplateStringHelper.create(value).parse(input).result;
        } else {
          parameters[key] = value;
        }
      }
    }
    let args = { model: modelName, ...structuredInputs };
    const options = {};
    if (config?.data?.disableCache) {
      options["use_cache"] = false;
    }
    if (Object.keys(parameters)?.length > 0) {
      args["parameters"] = parameters;
      logger.debug("Parameters: \n", parameters);
    }
    const modelCallWithRetry = async ({ retryCount = 0, retryLimit = 2, retryDelay = 1e3 }) => {
      try {
        if (typeof hf[hfFunc] !== "function" || retryCount === retryLimit) {
          hfFunc = "request";
        }
        const result = await hf[hfFunc](args, options);
        let output;
        if (result instanceof Blob) {
          const obj = await BinaryInput.from(result).getJsonData(AccessCandidate.agent(agent.id));
          output = obj;
        } else if (Array.isArray(result)) {
          output = await Promise.all(
            result.map(async (item) => {
              if (item.blob instanceof Blob || typeof item.blob === "string" && isBase64(item.blob)) {
                let binaryInput;
                if (item.blob instanceof Blob) {
                  binaryInput = BinaryInput.from(item.blob);
                } else {
                  binaryInput = BinaryInput.from(item.blob, void 0, item["content-type"]);
                }
                const fileObj = await binaryInput.getJsonData(AccessCandidate.agent(agent.id));
                return { ...item, blob: fileObj };
              } else {
                return item;
              }
            })
          );
        } else {
          output = result;
        }
        return output;
      } catch (error) {
        if (retryCount < retryLimit) {
          await delay(retryDelay);
          return modelCallWithRetry({
            retryCount: retryCount + 1,
            retryLimit,
            retryDelay: retryDelay * 2
          });
        }
        throw error;
      }
    };
    try {
      const output = await modelCallWithRetry({
        retryCount: 0,
        retryLimit: 2,
        retryDelay: 5e3
      });
      logger.debug("Output: \n", output);
      return { Output: output, _debug: logger.output };
    } catch (error) {
      console.log(`Error on running Hugging Face Model!`, error);
      console.log("Error: args, options ", args, options);
      return { _error: `Error from Hugging Face: 
${error?.message || JSON.stringify(error)}`, _debug: logger.output };
    }
  }
}

const components = {
  Component: new Component(),
  Note: new Component(),
  //this is a fake component
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
  Code: new Code(),
  HuggingFace: new HuggingFace()
};

var __defProp$k = Object.defineProperty;
var __defNormalProp$k = (obj, key, value) => key in obj ? __defProp$k(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$k = (obj, key, value) => __defNormalProp$k(obj, typeof key !== "symbol" ? key + "" : key, value);
Logger("AgentLogger");
const _AgentLogger = class _AgentLogger {
  constructor(agent) {
    this.agent = agent;
  }
  static async cleanup() {
    const trIds = Object.keys(_AgentLogger.transactions);
    for (const trId of trIds) {
      const transaction = _AgentLogger.transactions[trId];
      if (transaction.canDelete()) {
        delete _AgentLogger.transactions[trId];
      }
    }
  }
  static log(agent, trId, logData) {
    if (!trId) trId = "log-" + uid();
    return trId;
  }
  static async logTask(agent, tasks) {
  }
};
__publicField$k(_AgentLogger, "transactions", {});
let AgentLogger = _AgentLogger;

var __defProp$j = Object.defineProperty;
var __defNormalProp$j = (obj, key, value) => key in obj ? __defProp$j(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$j = (obj, key, value) => __defNormalProp$j(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$c = Logger("RuntimeContext");
class RuntimeContext extends EventEmitter$1 {
  constructor(runtime) {
    super();
    this.runtime = runtime;
    __publicField$j(this, "circularLimitReached", false);
    __publicField$j(this, "step", 0);
    __publicField$j(this, "sessionResult", false);
    __publicField$j(this, "sessionResults");
    __publicField$j(this, "components", {});
    __publicField$j(this, "checkRuntimeContext", null);
    __publicField$j(this, "ctxFile", "");
    __publicField$j(this, "_runtimeFileReady");
    const agent = runtime.agent;
    const dbgFolder = path.join(config.env.DATA_PATH, `/debug/${agent.id}/`);
    if (!fs.existsSync(dbgFolder)) {
      fs.mkdirSync(dbgFolder, { recursive: true });
    }
    const processRootID = runtime.processID?.split(":")[0] || "";
    const reqId = processRootID == runtime.xDebugId ? "" : "." + uid() + runtime.reqTag;
    this.ctxFile = path.join(dbgFolder, `${runtime.xDebugId}${reqId}${agent.jobID ? `-job-${agent.jobID}` : ""}.json`);
    this.initRuntimeContext();
  }
  serialize() {
    const data = {
      step: this.step,
      sessionResult: this.sessionResult,
      sessionResults: this.sessionResults,
      components: this.components
    };
    return data;
  }
  deserialize(data) {
    this.step = data.step;
    this.sessionResult = data.sessionResult;
    this.sessionResults = data.sessionResults;
    this.components = data.components;
  }
  reset() {
    this.step = 0;
    this.sessionResult = false;
    this.sessionResults = null;
    this.components = {};
  }
  initRuntimeContext() {
    if (this._runtimeFileReady) return;
    const endpointDBGCall = this.runtime.xDebugId?.startsWith("dbg-");
    console$c.debug("Init ctxFile", this.ctxFile);
    const agent = this.runtime.agent;
    let method = (agent.agentRequest.method || "POST").toUpperCase();
    const endpoint = agent.endpoints?.[agent.agentRequest.path]?.[method];
    let ctxData = {};
    if (!fs.existsSync(this.ctxFile)) {
      ctxData = JSON.parse(JSON.stringify({ components: agent.components, connections: agent.connections, timestamp: Date.now() }));
      if (!ctxData.step) ctxData.step = 0;
      for (let cptId in ctxData.components) {
        ctxData.components[cptId] = {
          id: cptId,
          name: ctxData.components[cptId].name,
          //dbg: { active: false, name: ctxData.components[cptId].name },
          ctx: { active: false, name: ctxData.components[cptId].name }
        };
        const cpt = ctxData.components[cptId];
        if (endpoint && endpoint.id != void 0 && cpt.id == endpoint.id && endpointDBGCall) {
          cpt.ctx.active = true;
        }
      }
      fs.writeFileSync(this.ctxFile, JSON.stringify(ctxData, null, 2));
    } else {
      ctxData = JSON.parse(fs.readFileSync(this.ctxFile, "utf8"));
      if (!ctxData.step) ctxData.step = 0;
    }
    this.deserialize(ctxData);
    this._runtimeFileReady = true;
    this.emit("ready");
  }
  async sync() {
    if (!this.ctxFile) return;
    this.emit("syncing");
    const deleteSession = this.runtime.sessionClosed;
    if (deleteSession) {
      if (this.runtime.debug && fs.existsSync(this.ctxFile)) await delay(1e3 * 60);
      if (fs.existsSync(this.ctxFile)) fs.unlinkSync(this.ctxFile);
    } else {
      const data = this.serialize();
      if (data) fs.writeFileSync(this.ctxFile, JSON.stringify(data, null, 2));
    }
  }
  incStep() {
    this.step++;
    this.sync();
  }
  updateComponent(componentId, data) {
    const ctxData = this;
    if (!ctxData) return;
    const component = ctxData.components[componentId];
    if (!component) {
      console$c.log(">>>>>>> updateComponent Component debug data not found", componentId, component);
      console$c.log(">>> ctxFile", this.ctxFile);
      console$c.log(">>> ctxData", ctxData);
    }
    component.ctx = { ...component.ctx, ...data, step: this.step };
    this.sync();
  }
  resetComponent(componentId) {
    const ctxData = this;
    const component = ctxData.components[componentId];
    if (!component) {
      console$c.log(">>>>>>> resetComponent Component debug data not found", componentId, component);
      console$c.log(">>> ctxFile", this.ctxFile);
      console$c.log(">>> ctxData", ctxData);
    }
    component.ctx.runtimeData = {};
    component.ctx.active = false;
    this.sync();
  }
  getComponentData(componentId) {
    const ctxData = this;
    if (!ctxData) return null;
    const component = ctxData.components[componentId];
    if (!component) {
      console$c.log(">>>>>>> getComponentData Component debug data not found", componentId, component);
      console$c.log(">>> ctxFile", this.ctxFile);
      console$c.log(">>> ctxData", ctxData);
    }
    const data = component.ctx;
    return data;
  }
}

var __defProp$i = Object.defineProperty;
var __defNormalProp$i = (obj, key, value) => key in obj ? __defProp$i(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$i = (obj, key, value) => __defNormalProp$i(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$b = Logger("AgentRuntime");
const AgentRuntimeUnavailable = new Proxy(
  {},
  {
    get: function(target, prop, receiver) {
      if (typeof target[prop] === "function") {
        return target[prop];
      } else {
        return function() {
          console$b.warn(`AgentRuntime Unavailable tried to call : ${prop.toString()}`);
        };
      }
    }
  }
);
const _AgentRuntime = class _AgentRuntime {
  constructor(agent) {
    this.agent = agent;
    __publicField$i(this, "agentContext");
    //private ctxFile: string = '';
    __publicField$i(this, "xDebugRun", "");
    __publicField$i(this, "xDebugInject", "");
    __publicField$i(this, "xDebugRead", "");
    __publicField$i(this, "xDebugStop", "");
    __publicField$i(this, "xDebugPendingInject", null);
    __publicField$i(this, "xDebugId", "");
    __publicField$i(this, "xDebugCmd", "");
    __publicField$i(this, "_debugActive", false);
    __publicField$i(this, "_runtimeFileReady", false);
    __publicField$i(this, "sessionClosed", false);
    __publicField$i(this, "reqTagOwner", false);
    //reqTag is used to identify the current running workflow including nested calls, it allows us to identify circular calls
    __publicField$i(this, "reqTag");
    __publicField$i(this, "processID");
    //this identifies the current processID, a process ID is the full set of runCycles that is executed by the agent.
    __publicField$i(this, "workflowReqId");
    //this identifies the current running workflow. a workflow starts when and agent endpoint is called, or a debug session is initiated, and ends when no more steps can be executed.
    __publicField$i(this, "alwaysActiveComponents", {});
    __publicField$i(this, "exclusiveComponents", {});
    __publicField$i(this, "checkRuntimeContext", null);
    this.reqTag = agent.agentRequest.header("X-REQUEST-TAG");
    const isNestedProcess = !!this.reqTag;
    if (!this.reqTag) {
      this.xDebugStop = agent.agentRequest.header("X-DEBUG-STOP");
      this.xDebugRun = agent.agentRequest.header("X-DEBUG-RUN");
      this.xDebugInject = agent.agentRequest.header("X-DEBUG-INJ");
      this.xDebugRead = agent.agentRequest.header("X-DEBUG-READ");
      this.reqTag = "xTAG-" + uid();
      this.reqTagOwner = true;
    } else {
      this.xDebugStop = void 0;
      this.xDebugRun = void 0;
      this.xDebugInject = void 0;
      this.xDebugRead = void 0;
    }
    this.xDebugId = this.xDebugStop || this.xDebugRun || this.xDebugRead;
    if (!this.xDebugId && agent.agentRequest.body) {
      if (this.xDebugInject != void 0 && this.xDebugInject != null) {
        this.xDebugPendingInject = agent.agentRequest.body;
        this.xDebugRun = this.xDebugInject || "inj-" + uid();
      } else {
        if (this.xDebugRun == "") {
          this.xDebugRun = "dbg-" + uid();
        }
      }
      this.xDebugId = this.xDebugRun;
    }
    this.processID = this.xDebugId;
    if (!this.xDebugId) {
      this.xDebugId = agent.sessionId;
      this.processID = this.reqTag;
    }
    if (isNestedProcess) {
      this.processID += `:${Math.floor(1e3 + Math.random() * 9e3)}`;
    }
    this.workflowReqId = this.xDebugRun || this.xDebugStop || this.reqTag;
    if (!_AgentRuntime.tagsData[this.reqTag]) _AgentRuntime.tagsData[this.reqTag] = {};
    if (!_AgentRuntime.processResults[this.processID])
      _AgentRuntime.processResults[this.processID] = {
        timestamp: Date.now(),
        errorResults: [],
        sessionResults: []
      };
    this.agentContext = new RuntimeContext(this);
    this.agentContext.on("ready", () => {
      this.alwaysActiveComponents = {};
      this.exclusiveComponents = {};
      for (let component of this.agent.data.components) {
        const cpt = components[component.name];
        if (!cpt) {
          console$b.warn(`Component ${component.name} Exists in agent but has no implementation`);
          continue;
        }
        if (cpt.alwaysActive) {
          this.alwaysActiveComponents[component.id] = cpt;
          this.updateComponent(component.id, { active: true, alwaysActive: true });
          const runtimeData = { ...this.getRuntimeData(component.id) };
          this.saveRuntimeComponentData(component.id, runtimeData);
        }
        if (cpt.exclusive) {
          this.exclusiveComponents[component.id] = cpt;
          this.updateComponent(component.id, { exclusive: true });
          const runtimeData = { ...this.getRuntimeData(component.id) };
          this.saveRuntimeComponentData(component.id, runtimeData);
        }
      }
    });
    this._debugActive = this.xDebugId != agent.sessionId;
  }
  get circularLimitReached() {
    return this.agentContext?.circularLimitReached || false;
  }
  set circularLimitReached(value) {
    if (this.agentContext) this.agentContext.circularLimitReached = value;
  }
  get debug() {
    return this._debugActive;
  }
  get curStep() {
    return this.agentContext?.step || 0;
  }
  destroy() {
    this.sessionClosed = true;
    this.sync();
  }
  incTag(componentId) {
    if (!_AgentRuntime.tagsData[this.reqTag][componentId]) _AgentRuntime.tagsData[this.reqTag][componentId] = 0;
    _AgentRuntime.tagsData[this.reqTag][componentId]++;
  }
  async sync() {
    const deleteTag = this.reqTagOwner && this.sessionClosed || this.circularLimitReached;
    if (deleteTag) {
      console$b.log(">>>>>>>>>>>> deleting tagsData", this.reqTag);
      delete _AgentRuntime.tagsData[this.reqTag];
    }
    this.agentContext.sync();
  }
  getWaitingComponents() {
    const ctxData = this.agentContext;
    const dbgComponents = Object.values(ctxData?.components || []).filter((c) => c?.ctx?.active == true);
    const waitingComponents = dbgComponents.filter((c) => c?.ctx?.status && typeof c?.ctx?.output !== void 0);
    return waitingComponents;
  }
  getExclusiveActiveComponents() {
    const ctxData = this.agentContext;
    const dbgComponents = Object.values(ctxData?.components || []).filter((c) => c?.ctx?.active == true);
    const exclusiveActiveComponents = dbgComponents.filter((c) => c?.ctx?.exclusive == true);
    return exclusiveActiveComponents;
  }
  readState(stateId, deltaOnly = false) {
    if (!this._debugActive || !stateId) return null;
    const runtime = this;
    const agent = this.agent;
    const ctxData = runtime.agentContext;
    const dbgAllComponents = runtime.xDebugPendingInject || Object.values(ctxData?.components || []);
    let dbgActiveComponents;
    dbgActiveComponents = dbgAllComponents.filter((c) => c?.ctx?.active == true && c?.ctx?.exclusive == true);
    if (!dbgActiveComponents || dbgActiveComponents.length == 0)
      dbgActiveComponents = dbgAllComponents.filter(
        (c) => c?.ctx?.active == true || !c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0
      );
    dbgAllComponents.filter(
      (c) => c?.ctx?.active == true && c?.ctx?.status && typeof c?.ctx?.output !== void 0
    );
    dbgAllComponents.filter((c) => c?.ctx?.active == true && !c?.ctx?.status);
    let state = {};
    for (let dbgComponent of dbgAllComponents) {
      state[dbgComponent.id] = dbgComponent.ctx;
    }
    let dbgSession = stateId;
    if (!dbgActiveComponents || dbgActiveComponents.length == 0) {
      dbgSession = null;
      runtime.sessionClosed = true;
    }
    const remainingActiveComponents = Object.values(ctxData?.components || []).filter(
      (c) => c?.ctx?.active == true && !c?.ctx?.alwaysActive
    );
    const activeAsyncComponents = Object.values(ctxData?.components || []).filter(
      (c) => !c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0
    );
    if (remainingActiveComponents.length == 0 && activeAsyncComponents.length == 0) {
      runtime.sessionClosed = true;
    }
    if (runtime.circularLimitReached) {
      const circularLimitData = runtime.checkCircularLimit();
      const error = `Circular Calls Limit Reached on ${circularLimitData}. Current agent circular limit is ${agent.circularLimit}`;
      runtime.sessionClosed = true;
      return { state, dbgSession, sessionClosed: runtime.sessionClosed, error };
    }
    const step = this.curStep >= 1 ? this.curStep - 1 : 0;
    if (deltaOnly) {
      const delta = {};
      for (let cptId in state) {
        const cpt = state[cptId];
        if (cpt.step >= step) delta[cptId] = cpt;
      }
      state = delta;
    }
    return { state, dbgSession, sessionClosed: runtime.sessionClosed, step };
  }
  /**
   * This method is called by the agent to run a process cycle, it will run all active components and return the results
   * The function is called multiple times until all components are executed and no more active components are available
   * @returns
   */
  async runCycle() {
    console$b.debug(
      `runCycle agentId=${this.agent.id} wfReqId=${this.workflowReqId}  reqTag=${this.reqTag} session=${this.xDebugRun} cycleId=${this.processID}`
    );
    const runtime = this;
    const agent = this.agent;
    const ctxData = runtime.agentContext;
    const dbgAllComponents = runtime.xDebugPendingInject || Object.values(ctxData?.components || []);
    let dbgActiveComponents;
    dbgActiveComponents = dbgAllComponents.filter((c) => c?.ctx?.active == true && c?.ctx?.exclusive == true);
    if (!dbgActiveComponents || dbgActiveComponents.length == 0)
      dbgActiveComponents = dbgAllComponents.filter(
        (c) => c?.ctx?.active == true || !c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0
      );
    const dbgActiveWaitingComponents = dbgAllComponents.filter(
      (c) => c?.ctx?.active == true && c?.ctx?.status && typeof c?.ctx?.output !== void 0
    );
    const dbgActiveReadyComponents = dbgAllComponents.filter(
      (c) => c?.ctx?.active == true && !c?.ctx?.status || !c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0
    );
    let step;
    if (!dbgActiveComponents || dbgActiveComponents.length == 0) {
      runtime.sessionClosed = true;
      step = {
        state: { sessionClosed: true },
        dbgSession: null,
        //expiredDbgSession: runtime.xDebugRun || runtime.xDebugStop,
        expiredDbgSession: runtime.xDebugId,
        sessionClosed: true
      };
    }
    if (!step && dbgActiveComponents.length == dbgActiveWaitingComponents.length && ctxData.sessionResult) {
      runtime.sessionClosed = true;
      step = {
        state: { sessionClosed: true },
        dbgSession: null,
        //expiredDbgSession: runtime.xDebugRun,
        expiredDbgSession: runtime.xDebugId,
        sessionClosed: true
      };
    }
    if (!step && dbgActiveReadyComponents.length > 0) {
      const promises = [];
      for (let dbgComponent of dbgActiveReadyComponents) {
        const injectInput = runtime.xDebugPendingInject ? dbgComponent.ctx.input : void 0;
        promises.push(agent.callComponent(dbgComponent.ctx.sourceId, dbgComponent.id, injectInput));
      }
      const dbgResults = await Promise.all(promises);
      const state = dbgResults.length == 1 ? dbgResults[0] : dbgResults;
      runtime.xDebugPendingInject = null;
      const remainingActiveComponents = Object.values(ctxData?.components || []).filter((c) => c?.ctx?.active == true);
      const activeAsyncComponents = Object.values(ctxData?.components || []).filter(
        (c) => !c?.ctx?.output?._error && Array.isArray(c?.ctx?._job_components) && c?.ctx?._job_components.length > 0
      );
      const dbgActiveWaitingComponents2 = dbgAllComponents.filter((c) => c?.ctx?.status && typeof c?.ctx?.output !== void 0);
      if (dbgActiveWaitingComponents2.length == remainingActiveComponents.length) {
        ctxData.sessionResult = true;
      }
      let sessionResults = dbgResults.flat().filter(
        (e) => e.id && e.result && !e.result._missing_inputs && //check if this is the last component in the chain
        !agent.connections.find((c) => c.sourceId == e.id)
      );
      let errorResults = dbgResults.flat().filter((e) => e.id && (e.error || e.result?._error));
      if (ctxData.sessionResult && sessionResults.length == 0 && runtime.sessionClosed) {
        sessionResults = errorResults;
      }
      ctxData.sessionResults = sessionResults;
      step = {
        state,
        dbgSession: runtime.xDebugRun,
        sessionResult: runtime.agentContext.sessionResult,
        sessionResults: runtime.agentContext.sessionResults,
        errorResults,
        sessionClosed: remainingActiveComponents.length == 0 && activeAsyncComponents.length == 0
      };
    } else {
      runtime.sessionClosed = true;
      step = {
        state: { sessionClosed: true },
        dbgSession: null,
        //expiredDbgSession: runtime.xDebugRun || runtime.xDebugStop,
        expiredDbgSession: runtime.xDebugId,
        sessionClosed: true
      };
    }
    this.checkCircularLimit();
    if (step.sessionResults) {
      _AgentRuntime.processResults[this.processID].sessionResults.push(step.sessionResults);
    }
    if (step.errorResults) {
      _AgentRuntime.processResults[this.processID].errorResults.push(step.errorResults);
    }
    if (step?.sessionClosed || this.circularLimitReached) {
      const finalResult = this.processResults();
      step.finalResult = finalResult;
      runtime.sessionClosed = true;
    }
    this.incStep();
    this.sync();
    return step;
  }
  processResults() {
    let result = { error: "Error processing results" };
    const sessionResults = _AgentRuntime.processResults[this.processID].sessionResults;
    const errorResults = _AgentRuntime.processResults[this.processID].errorResults;
    if (this.circularLimitReached) {
      const circularLimitData = this.circularLimitReached;
      result = { error: `Circular Calls Limit Reached on ${circularLimitData}. Current circular limit is ${this.agent.circularLimit}` };
    } else {
      let state = [sessionResults, errorResults].flat(Infinity);
      if (!state || state.length == 0) state = errorResults.flat(Infinity);
      const data = state.reduce(
        (acc, current) => {
          if (!acc.seen[current.id]) {
            acc.result.push(current);
            acc.seen[current.id] = true;
          }
          return acc;
        },
        { seen: {}, result: [] }
      ).result.filter((e) => !e.result?._exclude);
      result = data;
    }
    delete _AgentRuntime.processResults[this.processID];
    this.sync();
    return result;
  }
  checkCircularLimit() {
    if (this.circularLimitReached) return this.agentContext.circularLimitReached;
    for (let componentId in _AgentRuntime.tagsData[this.reqTag]) {
      if (_AgentRuntime.tagsData[this.reqTag][componentId] > this.agent.circularLimit) {
        this.sessionClosed = true;
        this.agentContext.circularLimitReached = componentId;
        return componentId;
      }
    }
    return false;
  }
  async injectDebugOutput(componentId) {
    if (this.xDebugPendingInject) {
      const component = this.xDebugPendingInject.find((c) => c.id == componentId);
      if (component?.ctx?.output) {
        let allEmpty = true;
        for (let key in component.ctx.output) {
          if (component.ctx.output[key] != "") {
            allEmpty = false;
            break;
          }
        }
        if (allEmpty) return null;
        return component.ctx.output;
      }
    }
  }
  getRuntimeData(componentId) {
    const componentData = this.getComponentData(componentId);
    if (!componentData) return {};
    const rData = componentData.runtimeData || {};
    return rData;
  }
  updateRuntimeData(componentId, data) {
    const componentData = this.getComponentData(componentId);
    if (!componentData) return;
    componentData.runtimeData = { ...componentData.runtimeData, ...data };
    this.sync();
  }
  saveRuntimeComponentData(componentId, data) {
    this.updateComponent(componentId, { runtimeData: data });
  }
  incStep() {
    this.agentContext.incStep();
  }
  updateComponent(componentId, data) {
    this.agentContext.updateComponent(componentId, data);
  }
  resetComponent(componentId) {
    this.agentContext.resetComponent(componentId);
  }
  getComponentData(componentId) {
    return this.agentContext.getComponentData(componentId);
  }
};
__publicField$i(_AgentRuntime, "processResults", {});
__publicField$i(_AgentRuntime, "tagsData", {});
__publicField$i(_AgentRuntime, "dummy", AgentRuntimeUnavailable);
let AgentRuntime = _AgentRuntime;

const OSResourceMonitor = {
  mem: getMemoryUsage(),
  //processMemory: getProcessMemoryUsage(),
  cpu: getCpuUsage()
  //processCpu: getProcessCpuUsage(),
};
function getCpuUsage() {
  const cpus = os.cpus();
  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  let total = 0;
  for (let cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  total = user + nice + sys + idle + irq;
  return {
    user: user / total * 100,
    sys: sys / total * 100,
    idle: idle / total * 100,
    load: 100 - idle / total * 100
  };
}
function getMemoryUsage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  return {
    totalMemory: (totalMemory / 1024 ** 3).toFixed(2) + " GB",
    freeMemory: (freeMemory / 1024 ** 3).toFixed(2) + " GB",
    usedMemory: (usedMemory / 1024 ** 3).toFixed(2) + " GB",
    memoryUsagePercentage: (usedMemory / totalMemory * 100).toFixed(2)
  };
}

var __defProp$h = Object.defineProperty;
var __defNormalProp$h = (obj, key, value) => key in obj ? __defProp$h(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$h = (obj, key, value) => __defNormalProp$h(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$a = Logger("Agent");
const idPromise = (id) => id;
class Agent {
  constructor(id, agentData, agentSettings, agentRequest) {
    this.id = id;
    this.agentSettings = agentSettings;
    __publicField$h(this, "name");
    __publicField$h(this, "data");
    __publicField$h(this, "teamId");
    __publicField$h(this, "components");
    __publicField$h(this, "connections");
    __publicField$h(this, "endpoints", {});
    __publicField$h(this, "sessionId");
    __publicField$h(this, "sessionTag", "");
    __publicField$h(this, "callerSessionId");
    __publicField$h(this, "apiBasePath", "/api");
    __publicField$h(this, "agentRuntime");
    __publicField$h(this, "usingTestDomain", false);
    __publicField$h(this, "domain", "");
    __publicField$h(this, "debugSessionEnabled", false);
    __publicField$h(this, "circularLimit", 100);
    //TODO : make it configurable from agent settings
    __publicField$h(this, "version", "");
    //public baseUrl = '';
    __publicField$h(this, "agentVariables", {});
    __publicField$h(this, "_kill", false);
    //public agentRequest: Request | AgentRequest | any;
    __publicField$h(this, "async", false);
    __publicField$h(this, "jobID", "");
    __publicField$h(this, "planInfo", {});
    __publicField$h(this, "agentRequest");
    const json = typeof agentData === "string" ? JSON.parse(agentData) : agentData;
    this.name = json.name;
    this.data = json.data;
    this.version = this.data.agentVersion || "";
    this.teamId = json.teamId;
    this.connections = this.data.connections;
    this.debugSessionEnabled = this.data.debugSessionEnabled;
    this.agentVariables = json.data.variables || {};
    const endpoints = this.data.components.filter((c) => c.name == "APIEndpoint");
    for (let endpoint of endpoints) {
      let method = endpoint.data.method || "POST";
      method = method.toUpperCase();
      if (!this.endpoints[`${this.apiBasePath}/${endpoint.data.endpoint}`])
        this.endpoints[`${this.apiBasePath}/${endpoint.data.endpoint}`] = {};
      this.endpoints[`${this.apiBasePath}/${endpoint.data.endpoint}`][method] = endpoint;
    }
    this.components = {};
    for (let component of this.data.components) {
      this.components[component.id] = component;
    }
    for (let connection of this.data.connections) {
      const sourceComponent = this.components[connection.sourceId];
      const targetComponent = this.components[connection.targetId];
      const sourceIndex = connection.sourceIndex;
      const targetIndex = connection.targetIndex;
      if (!sourceComponent.outputs[sourceIndex].next) sourceComponent.outputs[sourceIndex].next = [];
      sourceComponent.outputs[sourceIndex].next.push(targetComponent.id);
      if (!targetComponent.inputs[targetIndex].prev) targetComponent.inputs[targetIndex].prev = [];
      targetComponent.inputs[targetIndex].prev.push(sourceComponent.id);
    }
    this.tagAsyncComponents();
    if (agentRequest) {
      this.setRequest(agentRequest);
    }
  }
  setRequest(agentRequest) {
    if (this.agentRequest) return;
    this.agentRequest = agentRequest;
    this.agentRequest = agentRequest;
    const dateTime = getCurrentFormattedDate();
    this.sessionId = "rt-" + (this.agentRequest.sessionID || dateTime + "." + uid());
    const sessionTags = this?.agentRequest?.headers["x-session-tag"];
    if (sessionTags) this.sessionTag += this.sessionTag ? `,${sessionTags}` : sessionTags;
    var regex = new RegExp(`^/v[0-9]+(.[0-9]+)?${this.apiBasePath}/(.*)`);
    if (this.agentRequest?.path?.startsWith(`${this.apiBasePath}/`) || this.agentRequest?.path?.match(regex)) {
      this.agentRuntime = new AgentRuntime(this);
      this.callerSessionId = this?.agentRequest?.headers["x-caller-session-id"]?.substring(0, 256) || this.agentRuntime.workflowReqId || this.sessionId;
    } else {
      this.agentRuntime = AgentRuntime.dummy;
    }
  }
  kill() {
    this._kill = true;
  }
  async parseVariables() {
    if (typeof this.agentVariables === "object") {
      for (let key in this.agentVariables) {
        const value = this.agentVariables[key];
        if (value.startsWith("{{") && value.endsWith("}}")) {
          this.agentVariables[key] = await TemplateString(value).parseTeamKeys(this.teamId).asyncResult;
        }
      }
    }
  }
  async process(endpointPath, input) {
    let result;
    let dbgSession = null;
    let sessionClosed = false;
    const logId = AgentLogger.log(this, null, {
      sourceId: endpointPath,
      componentId: `AGENT`,
      domain: this.domain,
      input,
      workflowID: this.agentRuntime.workflowReqId,
      processID: this.agentRuntime.processID,
      inputTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionID: this.callerSessionId,
      tags: this.sessionTag
    });
    const method = this.agentRequest.method.toUpperCase();
    const endpoint = this.endpoints[endpointPath]?.[method];
    if (this.agentRuntime.debug) {
      if (!endpoint && this.agentRequest.path != "/api/") {
        if (logId) AgentLogger.log(this, logId, { error: `Endpoint ${method} ${endpointPath} Not Found` });
        throw new Error(`Endpoint ${method} ${endpointPath} Not Found`);
      }
      let dbgResult;
      if (!dbgResult) dbgResult = await this.agentRuntime.runCycle();
      if (dbgResult && typeof dbgResult?.state !== "undefined") {
        this.agentRuntime.sync();
        if (dbgResult?.finalResult) {
          dbgResult.finalResult = await this.postProcess(dbgResult.finalResult).catch((error) => ({ error }));
        }
        return dbgResult;
      }
    }
    if (!endpoint) {
      if (logId) AgentLogger.log(this, logId, { error: `Endpoint ${method} ${endpointPath} Not Found` });
      throw new Error(`Endpoint ${method} ${endpointPath} Not Found`);
    }
    this.agentRuntime.updateComponent(endpoint.id, { active: true, input, sourceId: null });
    let step;
    do {
      step = await this.agentRuntime.runCycle();
      const qosLatency = Math.floor(OSResourceMonitor.cpu.load * this.planInfo?.maxLatency || 0);
      await delay(30 + qosLatency);
    } while (!step?.finalResult && !this._kill);
    if (this._kill) {
      console$a.warn(`Agent ${this.id} was killed`);
      return { error: "Agent killed" };
    }
    result = await this.postProcess(step?.finalResult).catch((error) => ({ error }));
    if (this.agentRuntime.circularLimitReached) {
      const circularLimitData = this.agentRuntime.circularLimitReached;
      result = { error: `Circular Calls Limit Reached on ${circularLimitData}. Current circular limit is ${this.circularLimit}` };
      throw new Error(`Circular Calls Limit Reached on ${circularLimitData}. Current circular limit is ${this.circularLimit}`);
    }
    if (logId) AgentLogger.log(this, logId, { outputTimestamp: "" + Date.now(), result });
    this.updateTasksCount();
    return this.agentRuntime.debug ? { state: result, dbgSession, sessionClosed } : result;
  }
  async updateTasksCount() {
  }
  async postProcess(result) {
    if (Array.isArray(result)) result = result.flat(Infinity);
    if (!Array.isArray(result)) result = [result];
    for (let i = 0; i < result.length; i++) {
      const _result = result[i];
      if (!_result) continue;
      if (_result._debug) delete _result._debug;
      if (_result._debug_time) delete _result._debug_time;
      const _componentData = this.components[_result.id];
      if (!_componentData) continue;
      const _component = components[_componentData.name];
      if (!_component) continue;
      const postProcessResult = await _component.postProcess(_result, _componentData, this).catch((error) => ({ error }));
      result[i] = postProcessResult;
    }
    if (result.length == 1) result = result[0];
    return result;
  }
  // public saveRuntimeComponentData(componentId, data) {
  //     //let runtimeData = { ...this.agentRuntime.getRuntimeData(componentId), ...data };
  //     //this.agentRuntime.updateComponent(componentId, { runtimeData: data });
  //     this.agentRuntime.saveRuntimeComponentData(componentId, data);
  // }
  // private getRuntimeData(componentId) {
  //     // const componentData = this.agentRuntime.getComponentData(componentId);
  //     // if (!componentData) return {};
  //     // const rData = componentData.runtimeData || {};
  //     return this.agentRuntime.getRuntimeData(componentId);
  // }
  // private clearRuntimeComponentData(componentId) {
  //     this.agentRuntime.resetComponent(componentId);
  // }
  hasLoopAncestor(inputEntry) {
    if (!inputEntry.prev) return false;
    for (let prevId of inputEntry.prev) {
      const prevComponentData = this.components[prevId];
      if (prevComponentData.name == "ForEach") return true;
      for (let inputEntry2 of prevComponentData.inputs) {
        if (this.hasLoopAncestor(inputEntry2)) return true;
      }
    }
  }
  clearChildLoopRuntimeComponentData(componentId) {
    const componentData = this.components[componentId];
    const runtimeData = this.agentRuntime.getRuntimeData(componentId);
    if (runtimeData._ChildLoopData) {
      for (let inputEntry of componentData.inputs) {
        if (this.hasLoopAncestor(inputEntry)) {
          delete runtimeData.input[inputEntry.name];
        }
      }
    }
  }
  getComponentMissingInputs(componentId, _input) {
    let missingInputs = [];
    const componentData = this.components[componentId];
    const component = components[componentData.name];
    if (component.alwaysActive) return missingInputs;
    const readablePredecessors = this.findReadablePredecessors(componentId);
    const readableInputNames = {};
    for (let pred of readablePredecessors) {
      if (pred) {
        readableInputNames[pred.input.name] = pred;
      }
    }
    const allInputIndexes = this.connections.filter((c) => c.targetId == componentId).map((e) => e.targetIndex);
    const allInputs = componentData.inputs.filter((r) => allInputIndexes.includes(r.index));
    if (Array.isArray(allInputs) && allInputs.length > 0) {
      for (let input of allInputs) {
        if (input.optional) continue;
        if (readableInputNames[input.name]) {
          const pred = readableInputNames[input.name];
          const component2 = pred.component;
          const predComponentData = this.components[pred.id];
          const foundOutput = component2.hasOutput(pred.output.name, predComponentData, this);
          if (foundOutput) continue;
        }
        if (typeof _input[input.name] == "undefined") {
          missingInputs.push(input.name);
        }
      }
    }
    return missingInputs;
  }
  findReadablePredecessors(componentId) {
    const componentData = this.components[componentId];
    components[componentData.name];
    const connections = this.connections.filter((c) => c.targetId == componentId);
    const readablePredecessors = connections.map((c) => {
      const sourceComponentData = this.components[c.sourceId];
      const sourceComponent = components[sourceComponentData.name];
      const output = sourceComponentData.outputs[c.sourceIndex];
      const input = componentData.inputs[c.targetIndex];
      if (sourceComponent.hasReadOutput) {
        return { output, input, component: sourceComponent, id: c.sourceId };
      }
      return null;
    });
    return readablePredecessors.filter((e) => e != null);
  }
  /**
   *
   * @param sourceId
   * @param componentId
   */
  updateStep(sourceId, componentId) {
    const agentRuntime = this.agentRuntime;
    const step = agentRuntime.curStep;
    agentRuntime.getComponentData(componentId);
    agentRuntime.updateComponent(componentId, { step });
  }
  async callComponent(sourceId, componentId, input) {
    const agentRuntime = this.agentRuntime;
    const componentData = this.components[componentId];
    const component = components[componentData.name];
    if (this._kill) {
      console$a.warn(`Agent ${this.id} was killed, skipping component ${componentData.name}`);
      return { id: componentData.id, name: componentData.displayName, result: null, error: "Agent killed" };
    }
    if (!component) {
      throw new Error(`Component ${componentData.name} not found`);
    }
    this.agentRuntime.incTag(componentId);
    this.agentRuntime.checkCircularLimit();
    if (this.agentRuntime.circularLimitReached) {
      return { error: `Circular Calls Reached` };
    }
    const data = agentRuntime.getComponentData(componentId);
    if (data?.output?._missing_inputs) {
      agentRuntime.updateComponent(componentId, { output: {} });
    }
    const _input = this.prepareComponentInput(componentId, input);
    const logId = AgentLogger.log(this, null, {
      sourceId: sourceId || "AGENT",
      componentId,
      domain: this.domain,
      workflowID: this.agentRuntime.workflowReqId,
      processID: this.agentRuntime.processID,
      input: componentData.name == "APIEndpoint" ? this.agentRequest.method == "GET" ? this.agentRequest.query : this.agentRequest.body : _input,
      inputTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionID: this.callerSessionId,
      tags: this.sessionTag
    });
    let output = null;
    let missingInputs = [];
    this.updateStep(sourceId, componentId);
    if (agentRuntime.debug) {
      output = await agentRuntime.injectDebugOutput(componentId);
    }
    if (!output) {
      missingInputs = this.getComponentMissingInputs(componentId, _input);
      if (missingInputs.length > 0) {
        agentRuntime.updateComponent(componentId, { active: true, status: "waiting" });
        const connections = this.connections.filter((c) => c.sourceId == componentId) || [];
        for (let connection of connections) {
          const outputEndpoint = componentData.outputs[connection.sourceIndex];
          if (outputEndpoint.name == "_error") {
            break;
          }
        }
        output = { _error: "Missing inputs : " + JSON.stringify(missingInputs), _missing_inputs: missingInputs };
      }
      if (!output) {
        const validationResult = await component.validateConfig(componentData);
        if (validationResult._error) {
          output = validationResult;
        } else {
          try {
            await this.parseVariables();
            output = await component.process({ ...this.agentVariables, ..._input }, componentData, this);
            console$a.log(output);
          } catch (error) {
            console$a.error("Error on component process: ", { componentId, name: componentData.name, input: _input }, error);
            if (error?.message) output = { Response: void 0, _error: error.message, _debug: error.message };
            else output = { Response: void 0, _error: error.toString(), _debug: error.toString() };
          }
        }
      }
    }
    const runtimeData = this.agentRuntime.getRuntimeData(componentId);
    agentRuntime.updateComponent(componentId, { output });
    if (output._in_progress) {
      agentRuntime.updateComponent(componentId, { active: true, status: "in_progress" });
    }
    if (output.error || output._error) {
      this.agentRuntime.resetComponent(componentId);
      if (logId) {
        AgentLogger.log(this, logId, { error: output.error || output._error });
      }
      if (output.error)
        return [
          {
            id: componentData.id,
            name: componentData.displayName,
            result: null,
            error: output.error || output._error,
            _debug: output.error || output._error
          }
        ];
    }
    let results = [];
    if (output && !output._missing_inputs) {
      AgentLogger.logTask(this, 1);
      results = await this.callNextComponents(componentId, output).catch((error) => ({
        error,
        id: componentData.id,
        name: componentData.displayName
      }));
      if (runtimeData._LoopData && output._in_progress && runtimeData._LoopData.branches == void 0) {
        const branches = Array.isArray(results) ? results.length : 1;
        if (output._in_progress) {
          runtimeData._LoopData.branches = branches;
          agentRuntime.updateRuntimeData(componentId, { _LoopData: runtimeData._LoopData });
        }
      }
      if (results._is_leaf) {
        delete results._is_leaf;
        const _ChildLoopData = runtimeData._ChildLoopData;
        if (_ChildLoopData && _ChildLoopData.parentId) {
          const parentId = _ChildLoopData.parentId;
          const _LoopData = this.agentRuntime.getRuntimeData(parentId)._LoopData;
          if (_LoopData) {
            if (!_LoopData.result) _LoopData.result = [];
            let resultsCopy = JSON.parse(JSON.stringify(results));
            if (results.result) results.result._exclude = true;
            resultsCopy = await component.postProcess(resultsCopy, componentData, this);
            _LoopData.result.push(resultsCopy);
            _LoopData.branches--;
            if (_LoopData.branches <= 0) {
              agentRuntime.updateComponent(parentId, { active: true, status: "" });
            }
            agentRuntime.updateRuntimeData(parentId, { _LoopData });
          }
        } else {
          const _LoopData = this.agentRuntime.getRuntimeData(componentId)._LoopData;
          if (_LoopData && _LoopData.loopIndex == 1) {
            _LoopData._in_progress = false;
            output._in_progress = false;
            agentRuntime.updateComponent(componentId, { active: true, status: "" });
            agentRuntime.updateRuntimeData(componentId, { _LoopData });
          }
        }
      }
    }
    if (!output._missing_inputs && !output._in_progress) {
      const inLoop = runtimeData?._ChildLoopData?._in_progress && runtimeData._ChildLoopData?.loopIndex < runtimeData._ChildLoopData?.loopLength;
      if (inLoop) {
        this.clearChildLoopRuntimeComponentData(componentId);
        agentRuntime.updateComponent(componentId, { active: true, status: "waiting" });
      } else {
        this.agentRuntime.resetComponent(componentId);
      }
    }
    if (Array.isArray(results)) results = results.flat(Infinity).filter((r) => r.result != null);
    if (logId) {
      AgentLogger.log(this, logId, { output, outputTimestamp: "" + Date.now() });
    }
    return [results, { id: componentData.id, name: componentData.displayName, result: output }];
  }
  JSONExpression(obj, propertyString) {
    const properties = propertyString.split(/\.|\[|\]\.|\]\[|\]/).filter(Boolean);
    let currentProperty = obj;
    for (let property of properties) {
      if (currentProperty === void 0 || currentProperty === null) {
        return void 0;
      }
      currentProperty = currentProperty[property];
    }
    return currentProperty;
  }
  //
  async callNextComponents(componentId, output) {
    const agentRuntime = this.agentRuntime;
    const componentData = this.components[componentId];
    components[componentData.name];
    let connections = this.connections.filter(
      (c) => c.sourceId == componentId
      /*|| this.alwaysActiveComponents[c.sourceId]*/
    ).map((c) => ({ ...c, output, componentData }));
    const waitingComponents = agentRuntime.getWaitingComponents();
    const waitingComponentIds = waitingComponents.map((e) => e.id);
    const alwaysActiveIds = Object.keys(this.agentRuntime.alwaysActiveComponents);
    const alwaysActiveConnections = this.connections.filter((c) => alwaysActiveIds.includes(c.sourceId) && waitingComponentIds.includes(c.targetId)).map((c) => {
      const output2 = {};
      waitingComponents.find((e) => e.id == c.targetId);
      const prevComponentData = this.components[c.sourceId];
      const prevComponent = components[prevComponentData.name];
      const outputEndpoint = prevComponentData.outputs[c.sourceIndex];
      output2[outputEndpoint.name] = prevComponent.readOutput(outputEndpoint.name, prevComponentData, this);
      return { ...c, output: output2, componentData: this.components[c.sourceId] };
    });
    connections = [...connections, ...alwaysActiveConnections];
    if (!Array.isArray(connections) || connections.length == 0) {
      return { id: componentData.id, name: componentData.name, result: output, _is_leaf: true };
    }
    const targetComponents = (
      //classify connections by objects
      connections.reduce((acc, obj) => {
        let key = obj.targetId;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(obj);
        return acc;
      }, {})
    );
    const promises = [];
    for (let targetId in targetComponents) {
      const targetComponentData = this.components[targetId];
      if (!this.async && targetComponentData.async && targetComponentData.name !== "Async") continue;
      components[targetComponentData.name];
      const connections2 = targetComponents[targetId];
      if (Array.isArray(connections2) && connections2.length > 0) {
        const nextInput = {};
        for (let connection of connections2) {
          const output2 = connection.output;
          const componentData2 = connection.componentData;
          const outputEndpoint = componentData2.outputs[connection.sourceIndex];
          const inputEndpoint = targetComponentData.inputs[connection.targetIndex];
          const outputExpression = outputEndpoint.expression || outputEndpoint.name;
          const outputParts = outputExpression.split(".");
          const defaultOutputs = componentData2.outputs.find((c) => c.default);
          let value = void 0;
          if (outputEndpoint.default) value = output2[outputEndpoint.name];
          else {
            if (defaultOutputs) {
              value = output2[defaultOutputs.name]?.[outputEndpoint.name];
            }
          }
          if (
            /*value === null || */
            value === void 0 && outputParts.length >= 1
          ) {
            let val = this.JSONExpression(output2, outputExpression);
            if (val !== void 0) value = val;
          }
          if (
            /*value !== null && */
            value !== void 0
          ) {
            let combinedInput = [...[nextInput[inputEndpoint.name]].flat(), ...[value].flat()].filter(
              (e) => e !== void 0
              /*&& e !== null*/
            );
            nextInput[inputEndpoint.name] = combinedInput.length === 1 ? combinedInput[0] : combinedInput;
          }
        }
        if (!nextInput || JSON.stringify(nextInput) == "{}") continue;
        const input = this.prepareComponentInput(targetId, nextInput);
        const targetComponent2 = this.components[targetId];
        const missingInputs = this.getComponentMissingInputs(targetId, input);
        const status = missingInputs.length > 0 ? "waiting" : void 0;
        const sourceRuntimeData = this.agentRuntime.getRuntimeData(componentId);
        let _ChildLoopData = sourceRuntimeData._LoopData;
        if (!_ChildLoopData || !_ChildLoopData._in_progress) {
          _ChildLoopData = sourceRuntimeData._ChildLoopData;
        }
        agentRuntime.updateComponent(targetId, { active: true, input: nextInput, sourceId: componentId, status });
        agentRuntime.updateRuntimeData(targetId, { _ChildLoopData, _LoopData: null });
        promises.push(idPromise({ id: targetId, name: targetComponent2.name, inputs: nextInput }));
        if (status) {
          AgentLogger.log(this, null, {
            sourceId: componentId,
            componentId: targetId,
            step: this.agentRuntime.curStep + 1,
            //we force to next step because the current step order is updated in the next runCycle()
            domain: this.domain,
            workflowID: this.agentRuntime.workflowReqId,
            processID: this.agentRuntime.processID,
            input: { __action: "status_update", __status: status, data: nextInput },
            inputTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionID: this.callerSessionId,
            tags: this.sessionTag
          });
        }
      }
    }
    if (promises.length == 0) {
      return { id: componentData.id, name: componentData.name, result: output, _is_leaf: true };
    }
    const results = await Promise.all(promises);
    return results.length == 1 ? results[0] : results;
  }
  prepareComponentInput(targetId, inputs) {
    const rData = this.agentRuntime.getRuntimeData(targetId);
    const componentData = this.components[targetId];
    const rDataInput = rData?.input || {};
    let _input = { ...rDataInput };
    if (inputs) {
      for (let key in inputs) {
        let value = inputs[key];
        _input[key] = [rDataInput[key], value].flat(Infinity).filter((e) => e !== void 0);
        if (_input[key].length == 1) _input[key] = _input[key][0];
      }
    }
    const readablePredecessors = this.findReadablePredecessors(targetId);
    for (let c of readablePredecessors) {
      if (c) {
        const predComponentData = this.components[c.id];
        const value = c.component.readOutput(c.output.name, predComponentData, this);
        if (value && c.input?.name) {
          if (!_input) _input = {};
          _input[c.input.name] = value;
        }
      }
    }
    this.agentRuntime.updateRuntimeData(targetId, { input: _input });
    for (let input of componentData.inputs) {
      if (input.defaultVal && _input[input.name] === void 0) {
        _input[input.name] = TemplateString(input.defaultVal).parse(this.agentVariables).result;
      }
    }
    return _input;
  }
  getConnectionSource(connection) {
    return this.components[connection.sourceId].inputs.find((e) => e.index === connection.sourceIndex);
  }
  getConnectionTarget(connection) {
    return this.components[connection.targetId].inputs.find((e) => e.index === connection.targetIndex);
  }
  recursiveTagAsyncComponents(component) {
    const agent = this;
    for (let output of component.outputs) {
      if (component.name == "Async" && output.name === "JobID") continue;
      const connected = agent.connections.filter((c) => c.sourceId === component.id && c.sourceIndex === output.index);
      if (!connected) continue;
      for (let con of connected) {
        const targetComponent = agent.components[con.targetId];
        if (!targetComponent) continue;
        targetComponent.async = true;
        this.recursiveTagAsyncComponents(targetComponent);
      }
    }
  }
  tagAsyncComponents() {
    const agent = this;
    const componentsList = Object.values(agent.components);
    const AsyncComponents = componentsList.filter((c) => c.name === "Async");
    if (!AsyncComponents || AsyncComponents.length == 0) return;
    for (let AsyncComponent of AsyncComponents) {
      AsyncComponent.async = true;
      this.recursiveTagAsyncComponents(AsyncComponent);
    }
  }
}

var __defProp$g = Object.defineProperty;
var __defNormalProp$g = (obj, key, value) => key in obj ? __defProp$g(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$g = (obj, key, value) => __defNormalProp$g(obj, typeof key !== "symbol" ? key + "" : key, value);
const logger = Logger("SRE");
const CInstance = ConnectorService;
const _SmythRuntime = class _SmythRuntime {
  constructor() {
    __publicField$g(this, "started", false);
    __publicField$g(this, "initialized", false);
    this.started = true;
  }
  static get Instance() {
    if (!_SmythRuntime.instance) {
      _SmythRuntime.instance = new _SmythRuntime();
    }
    return _SmythRuntime.instance;
  }
  init(_config) {
    if (this.initialized) {
      throw new Error("SRE already initialized");
    }
    this.initialized = true;
    const config = this.autoConf(_config);
    for (let connectorType in config) {
      for (let configEntry of config[connectorType]) {
        CInstance.init(connectorType, configEntry.Connector, configEntry.Settings, configEntry.Default);
      }
    }
    SystemEvents.emit("SRE:Initialized");
    return _SmythRuntime.Instance;
  }
  /**
   * This function tries to auto configure, or fixes the provided configuration
   *
   * FIXME: The current version does not actually auto configure SRE, it just fixes the provided configuration for now
   * TODO: Implement auto configuration based on present environment variables and auto-detected configs
   * @param config
   */
  autoConf(config) {
    const newConfig = {};
    for (let connectorType in config) {
      newConfig[connectorType] = [];
      if (typeof config[connectorType] === "object") config[connectorType] = [config[connectorType]];
      let hasDefault = false;
      for (let connector of config[connectorType]) {
        if (!connector.Connector) {
          console.warn(`Missing Connector Name in ${connectorType} entry ... it will be ignored`);
          continue;
        }
        if (connector.Default) {
          if (hasDefault) {
            console.warn(`Entry ${connectorType} has more than one default Connector ... only the first one will be used`);
          }
          hasDefault = true;
        }
        newConfig[connectorType].push(connector);
      }
      if (!hasDefault && newConfig[connectorType].length > 0) {
        newConfig[connectorType][0].Default = true;
      }
    }
    return newConfig;
  }
  ready() {
    return this.initialized;
  }
  async _stop() {
    logger.info("Shutting Down SmythRuntime ...");
    CInstance._stop();
    _SmythRuntime.instance = void 0;
    this.started = false;
  }
};
__publicField$g(_SmythRuntime, "instance");
let SmythRuntime = _SmythRuntime;

class StorageConnector extends SecureConnector {
}

var __defProp$f = Object.defineProperty;
var __getOwnPropDesc$4 = Object.getOwnPropertyDescriptor;
var __defNormalProp$f = (obj, key, value) => key in obj ? __defProp$f(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __decorateClass$4 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$4(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$f(target, key, result);
  return result;
};
var __publicField$f = (obj, key, value) => __defNormalProp$f(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$9 = Logger("S3Storage");
class S3Storage extends StorageConnector {
  constructor(config) {
    super();
    this.config = config;
    __publicField$f(this, "name", "S3Storage");
    __publicField$f(this, "client");
    __publicField$f(this, "bucket");
    if (!SmythRuntime.Instance) throw new Error("SRE not initialized");
    this.bucket = config.bucket;
    const clientConfig = {};
    if (config.region) clientConfig.region = config.region;
    if (config.accessKeyId && config.secretAccessKey) {
      clientConfig.credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      };
    }
    this.client = new S3Client(clientConfig);
  }
  user(candidate) {
    return {
      write: async (resourceId, value, acl, metadata) => {
        return await this.write(candidate.writeRequest, resourceId, value, acl, metadata);
      },
      read: async (resourceId) => {
        return await this.read(candidate.readRequest, resourceId);
      },
      delete: async (resourceId) => {
        await this.delete(candidate.readRequest, resourceId);
      },
      exists: async (resourceId) => {
        return await this.exists(candidate.readRequest, resourceId);
      },
      getMetadata: async (resourceId) => {
        return await this.getMetadata(candidate.readRequest, resourceId);
      },
      setMetadata: async (resourceId, metadata) => {
        await this.setMetadata(candidate.writeRequest, resourceId, metadata);
      },
      getACL: async (resourceId) => {
        return await this.getACL(candidate.readRequest, resourceId);
      },
      setACL: async (resourceId, acl) => {
        return await this.setACL(candidate.writeRequest, resourceId, acl);
      }
    };
  }
  async read(acRequest, resourceId) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: resourceId
    });
    try {
      const response = await this.client.send(command);
      return await streamToBuffer(response.Body);
    } catch (error) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return void 0;
      }
      console$9.error(`Error reading object from S3`, error.name, error.message);
      throw error;
    }
  }
  async getMetadata(acRequest, resourceId) {
    try {
      const s3Metadata = await this.getS3Metadata(resourceId);
      return s3Metadata;
    } catch (error) {
      console$9.error(`Error getting access rights in S3`, error.name, error.message);
      throw error;
    }
  }
  async setMetadata(acRequest, resourceId, metadata) {
    try {
      let s3Metadata = await this.getS3Metadata(resourceId);
      if (!s3Metadata) s3Metadata = {};
      s3Metadata = { ...s3Metadata, ...metadata };
      await this.setS3Metadata(resourceId, s3Metadata);
    } catch (error) {
      console$9.error(`Error setting access rights in S3`, error);
      throw error;
    }
  }
  async write(acRequest, resourceId, value, acl, metadata) {
    const accessCandidate = acRequest.candidate;
    let amzACL = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
    let s3Metadata = {
      ...metadata,
      "x-amz-meta-acl": amzACL
    };
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: resourceId,
      Body: value,
      Metadata: this.serializeS3Metadata(s3Metadata),
      ContentType: s3Metadata["ContentType"]
    });
    try {
      const result = await this.client.send(command);
    } catch (error) {
      console$9.error(`Error writing object to S3`, error.name, error.message);
      throw error;
    }
  }
  async delete(acRequest, resourceId) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: resourceId
    });
    try {
      await this.client.send(command);
    } catch (error) {
      console$9.error(`Error deleting object from S3`, error.name, error.message);
      throw error;
    }
  }
  async exists(acRequest, resourceId) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: resourceId
    });
    try {
      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return false;
      }
      console$9.error(`Error checking object existence in S3`, error.name, error.message);
      throw error;
    }
  }
  //this determines the access rights for the requested resource
  //the connector should check if the resource exists or not
  //if the resource exists we read it's ACL and return it
  //if the resource does not exist we return an write access ACL for the candidate
  async getResourceACL(resourceId, candidate) {
    const s3Metadata = await this.getS3Metadata(resourceId);
    const exists = s3Metadata !== void 0;
    if (!exists) {
      return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }
    return ACL.from(s3Metadata?.["x-amz-meta-acl"]);
  }
  async getACL(acRequest, resourceId) {
    try {
      const s3Metadata = await this.getS3Metadata(resourceId);
      return ACL.from(s3Metadata?.["x-amz-meta-acl"]);
    } catch (error) {
      console$9.error(`Error getting access rights in S3`, error.name, error.message);
      throw error;
    }
  }
  async setACL(acRequest, resourceId, acl) {
    try {
      let s3Metadata = await this.getS3Metadata(resourceId);
      if (!s3Metadata) s3Metadata = {};
      s3Metadata["x-amz-meta-acl"] = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
      await this.setS3Metadata(resourceId, s3Metadata);
    } catch (error) {
      console$9.error(`Error setting access rights in S3`, error);
      throw error;
    }
  }
  migrateMetadata(metadata) {
    if (!metadata.agentid && !metadata.teamid && !metadata.userid) return metadata;
    else {
      const convertibleItems = ["agentid", "teamid", "userid"];
      const aclHelper = new ACL();
      for (let key of convertibleItems) {
        if (!metadata[key]) continue;
        const role = key === "agentid" ? TAccessRole.Agent : key === "teamid" ? TAccessRole.Team : TAccessRole.User;
        aclHelper.addAccess(role, metadata[key].toString(), [TAccessLevel.Owner, TAccessLevel.Read, TAccessLevel.Write]);
        delete metadata[key];
      }
      aclHelper.migrated = true;
      const newMetadata = {
        "x-amz-meta-acl": aclHelper.ACL
      };
      for (let key in metadata) {
        newMetadata[key] = metadata[key];
      }
      return newMetadata;
    }
  }
  serializeS3Metadata(s3Metadata) {
    let amzMetadata = {};
    if (s3Metadata["x-amz-meta-acl"]) {
      if (s3Metadata["x-amz-meta-acl"]) {
        amzMetadata["x-amz-meta-acl"] = typeof s3Metadata["x-amz-meta-acl"] == "string" ? s3Metadata["x-amz-meta-acl"] : ACL.from(s3Metadata["x-amz-meta-acl"]).serializedACL;
      }
      delete s3Metadata["x-amz-meta-acl"];
    }
    for (let key in s3Metadata) {
      if (key == "ContentType") continue;
      amzMetadata[key] = typeof s3Metadata[key] === "string" ? s3Metadata[key] : JSON.stringify(s3Metadata[key]);
    }
    return amzMetadata;
  }
  deserializeS3Metadata(amzMetadata) {
    let metadata = {};
    for (let key in amzMetadata) {
      if (key === "x-amz-meta-acl") {
        metadata[key] = ACL.from(amzMetadata[key]).ACL;
        continue;
      }
      try {
        metadata[key] = JSON.parse(amzMetadata[key]);
      } catch (error) {
        metadata[key] = amzMetadata[key];
      }
    }
    metadata = this.migrateMetadata(metadata);
    return metadata;
  }
  async getS3Metadata(resourceId) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: resourceId
      });
      const response = await this.client.send(command);
      const s3RawMetadata = response.Metadata;
      if (!s3RawMetadata || Object.keys(s3RawMetadata).length === 0) return {};
      let metadata = this.deserializeS3Metadata(s3RawMetadata);
      if (!metadata["ContentType"]) metadata["ContentType"] = response.ContentType ? response.ContentType : "application/octet-stream";
      return metadata;
    } catch (error) {
      if (error.name === "NotFound" || error.name === "NoSuchKey") {
        return void 0;
      }
      console$9.error(`Error reading object metadata from S3`, error.name, error.message);
      throw error;
    }
  }
  async setS3Metadata(resourceId, metadata) {
    try {
      const getObjectCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: resourceId
      });
      const objectData = await this.client.send(getObjectCommand);
      const bufferBody = await streamToBuffer(objectData.Body);
      const amzMetadata = this.serializeS3Metadata(metadata);
      const putObjectCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: resourceId,
        Body: bufferBody,
        Metadata: amzMetadata
      });
      await this.client.send(putObjectCommand);
    } catch (error) {
      console$9.error(`Error setting object metadata in S3`, error.name, error.message);
      throw error;
    }
  }
}
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "read", 1);
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "getMetadata", 1);
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "setMetadata", 1);
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "write", 1);
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "delete", 1);
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "exists", 1);
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "getACL", 1);
__decorateClass$4([
  SecureConnector.AccessControl
], S3Storage.prototype, "setACL", 1);

class StorageService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.Storage, "S3", S3Storage);
  }
}

var paramMappings = {
  Echo: {
    maxTokens: "max_tokens",
    temperature: "temperature",
    stopSequences: "stop",
    topP: "top_p",
    frequencyPenalty: "frequency_penalty",
    presencePenalty: "presence_penalty"
  },
  OpenAI: {
    maxTokens: "max_tokens",
    temperature: "temperature",
    stopSequences: "stop",
    topP: "top_p",
    frequencyPenalty: "frequency_penalty",
    presencePenalty: "presence_penalty"
  },
  cohere: {
    maxTokens: "max_tokens",
    temperature: "temperature",
    stopSequences: "stop_sequences",
    topP: "p",
    topK: "k",
    frequencyPenalty: "frequency_penalty",
    presencePenalty: "presence_penalty"
  },
  togetherAI: {
    maxTokens: "max_tokens",
    temperature: "temperature",
    stopSequences: "stop",
    topP: "top_p",
    topK: "top_k",
    frequencyPenalty: "repetition_penalty"
  },
  AnthropicAI: {
    maxTokens: "max_tokens",
    temperature: "temperature",
    stopSequences: "stop_sequences",
    topP: "top_p",
    topK: "top_k"
  },
  GoogleAI: {
    maxTokens: "maxOutputTokens",
    temperature: "temperature",
    stopSequences: "stopSequences",
    topP: "topP",
    topK: "topK"
  },
  Groq: {
    maxTokens: "max_tokens",
    temperature: "temperature",
    stopSequences: "stop",
    topP: "top_p"
  }
};

const console$8 = Logger("LLMConnector");
class LLMConnector extends Connector {
  user(candidate) {
    if (candidate.role !== "agent") throw new Error("Only agents can use LLM connector");
    const vaultConnector = ConnectorService.getVaultConnector();
    if (!vaultConnector) throw new Error("Vault Connector unavailable, cannot proceed");
    return {
      chatRequest: async (prompt, params) => {
        const llm = models[params.model]?.llm;
        if (!llm) throw new Error(`Model ${params.model} not supported`);
        params.apiKey = await vaultConnector.user(candidate).get(llm).catch((e) => "");
        return this.chatRequest(candidate.readRequest, prompt, params);
      },
      visionRequest: async (prompt, params) => {
        const llm = models[params.model]?.llm;
        if (!llm) throw new Error(`Model ${params.model} not supported`);
        params.apiKey = await vaultConnector.user(candidate).get(llm).catch((e) => "");
        return this.visionRequest(candidate.readRequest, prompt, params, candidate.id);
      },
      toolRequest: async (params) => {
        const llm = models[params.model]?.llm;
        if (!llm) throw new Error(`Model ${params.model} not supported`);
        params.apiKey = await vaultConnector.user(candidate).get(llm).catch((e) => "");
        return this.toolRequest(candidate.readRequest, params);
      },
      streamToolRequest: async (params) => {
        const llm = models[params.model]?.llm;
        if (!llm) throw new Error(`Model ${params.model} not supported`);
        params.apiKey = await vaultConnector.user(candidate).get(llm).catch((e) => "");
        return this.streamToolRequest(candidate.readRequest, params);
      },
      streamRequest: async (params) => {
        const llm = models[params.model]?.llm;
        if (!llm) throw new Error(`Model ${params.model} not supported`);
        params.apiKey = await vaultConnector.user(candidate).get(llm).catch((e) => "");
        return this.streamRequest(candidate.readRequest, params);
      }
    };
  }
  getAllowedCompletionTokens(model, hasTeamAPIKey = false) {
    const alias = models[model]?.alias || model;
    const maxTokens = hasTeamAPIKey ? models[alias]?.keyOptions?.completionTokens || models[alias]?.keyOptions?.tokens : models[alias]?.completionTokens || models[alias]?.tokens;
    return +(maxTokens ?? DEFAULT_MAX_TOKENS_FOR_LLM);
  }
  async getSafeMaxTokens(givenMaxTokens, model, hasApiKey) {
    let allowedTokens = this.getAllowedCompletionTokens(model, hasApiKey);
    let maxTokens = givenMaxTokens > allowedTokens ? allowedTokens : givenMaxTokens;
    return +maxTokens;
  }
  async countVisionPromptTokens(prompt) {
    let tokens = 0;
    const textObj = prompt?.filter((item) => item.type === "text");
    const textTokens = encode(textObj?.[0]?.text).length;
    const images = prompt?.filter((item) => item.type === "image_url");
    let imageTokens = 0;
    for (const image of images) {
      const image_url = image?.image_url?.url;
      const { width, height } = await _getImageDimensions(image_url);
      const tokens2 = _countImageTokens(width, height);
      imageTokens += tokens2;
    }
    tokens = textTokens + imageTokens;
    return tokens;
  }
  resolveModelName(model) {
    return models[model]?.alias || model;
  }
  getAllowedContextTokens(model, hasTeamAPIKey = false) {
    const alias = this.resolveModelName(model);
    const maxTokens = hasTeamAPIKey ? models[alias]?.keyOptions?.tokens : models[alias]?.tokens;
    return +(maxTokens ?? DEFAULT_MAX_TOKENS_FOR_LLM);
  }
  // ! DEPRECATED: will be removed in favor of validateTokensLimit
  checkTokensLimit({
    model,
    promptTokens,
    completionTokens,
    hasTeamAPIKey = false
  }) {
    const allowedContextTokens = this.getAllowedContextTokens(model, hasTeamAPIKey);
    const totalTokens = promptTokens + completionTokens;
    if (totalTokens > allowedContextTokens) {
      return {
        isExceeded: true,
        error: hasTeamAPIKey ? `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.` : `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`
      };
    }
    return { isExceeded: false, error: "" };
  }
  /**
   * Validates if the total tokens (prompt input token + maximum output token) exceed the allowed context tokens for a given model.
   *
   * @param {Object} params - The function parameters.
   * @param {string} params.model - The model identifier.
   * @param {number} params.promptTokens - The number of tokens in the input prompt.
   * @param {number} params.completionTokens - The number of tokens in the output completion.
   * @param {boolean} [params.hasTeamAPIKey=false] - Indicates if the user has a team API key.
   * @throws {Error} - Throws an error if the total tokens exceed the allowed context tokens.
   */
  validateTokensLimit({
    model,
    promptTokens,
    completionTokens,
    hasTeamAPIKey = false
  }) {
    const allowedContextTokens = this.getAllowedContextTokens(model, hasTeamAPIKey);
    const totalTokens = promptTokens + completionTokens;
    const teamAPIKeyExceededMessage = `This models' maximum content length is ${allowedContextTokens} tokens. (This is the sum of your prompt with all variables and the maximum output tokens you've set in Advanced Settings) However, you requested approx ${totalTokens} tokens (${promptTokens} in the prompt, ${completionTokens} in the output). Please reduce the length of either the input prompt or the Maximum output tokens.`;
    const noAPIKeyExceededMessage = `Input exceeds max tokens limit of ${allowedContextTokens}. Please add your API key to unlock full length.`;
    if (totalTokens > allowedContextTokens) {
      throw new Error(hasTeamAPIKey ? teamAPIKeyExceededMessage : noAPIKeyExceededMessage);
    }
  }
  enhancePrompt(prompt, config) {
    if (!prompt) return prompt;
    let newPrompt = prompt;
    const outputs = {};
    for (let con of config.outputs) {
      if (con.default) continue;
      outputs[con.name] = con?.description ? `<${con?.description}>` : "";
    }
    const excludedKeys = ["_debug", "_error"];
    const outputKeys = Object.keys(outputs).filter((key) => !excludedKeys.includes(key));
    if (outputKeys.length > 0) {
      const outputFormat = {};
      outputKeys.forEach((key) => outputFormat[key] = "<value>");
      newPrompt += "\n##\nExpected output format = " + JSON.stringify(outputFormat) + "\nThe output JSON should only use the entries from the output format.";
    }
    return newPrompt;
  }
  async extractLLMComponentParams(config) {
    const params = {};
    const model = config.data.model;
    const apiKey = "";
    const clonedConfigData = JSON.parse(JSON.stringify(config.data || {}));
    const configParams = {};
    for (const [key, value] of Object.entries(clonedConfigData)) {
      let _value = value;
      if (key === "stopSequences") {
        _value = _value ? _value?.split(",") : null;
      }
      if (typeof _value === "string" && !isNaN(Number(_value))) {
        _value = +_value;
      }
      if (key === "maxTokens") {
        let maxTokens = Number(_value);
        if (!maxTokens) {
          throw new Error("Max output token not provided");
        }
        maxTokens = await this.getSafeMaxTokens(maxTokens, model, !!apiKey);
        _value = maxTokens;
      }
      configParams[key] = _value;
    }
    const alias = models[model]?.alias || model;
    const llm = models[alias]?.llm;
    for (const [configKey, paramKey] of Object.entries(paramMappings[llm])) {
      if (configParams?.[configKey] !== void 0 || configParams?.[configKey] !== null || configParams?.[configKey] !== "") {
        const value = configParams[configKey];
        params[paramKey] = value;
      }
    }
    return params;
  }
  async extractVisionLLMParams(config) {
    const params = {};
    const model = config.data.model;
    const apiKey = "";
    const maxTokens = await this.getSafeMaxTokens(+config.data.maxTokens, model, !!apiKey) || 300;
    const alias = models[model]?.alias || model;
    const llm = models[alias]?.llm;
    params[paramMappings[llm]?.maxTokens] = maxTokens;
    return params;
  }
  postProcess(response) {
    try {
      return JSONContent(response).tryParse();
    } catch (error) {
      return {
        error: "Invalid JSON response",
        data: response,
        details: "The response from the model is not a valid JSON object. Please check the model output and try again."
      };
    }
  }
  formatToolsConfig({ type = "function", toolDefinitions, toolChoice = "auto" }) {
    throw new Error("This model does not support tools");
  }
  prepareInputMessageBlocks({
    messageBlock,
    toolsData
  }) {
    throw new Error("This model does not support tools");
  }
  hasSystemMessage(messages) {
    if (!Array.isArray(messages)) return false;
    return messages?.some((message) => message.role === "system");
  }
  separateSystemMessages(messages) {
    const systemMessage = messages.find((message) => message.role === "system" && message.content) || {};
    const otherMessages = messages.filter((message) => message.role !== "system" && message.content);
    return { systemMessage, otherMessages };
  }
}
function _countImageTokens(width, height, detailMode = "auto") {
  if (detailMode === "low") return 85;
  const maxDimension = Math.max(width, height);
  const minDimension = Math.min(width, height);
  let scaledMinDimension = minDimension;
  if (maxDimension > 2048) {
    scaledMinDimension = 2048 / maxDimension * minDimension;
  }
  scaledMinDimension = Math.floor(768 / 1024 * scaledMinDimension);
  let tileSize = 512;
  let tiles = Math.ceil(scaledMinDimension / tileSize);
  if (minDimension !== scaledMinDimension) {
    tiles *= Math.ceil(scaledMinDimension * (maxDimension / minDimension) / tileSize);
  }
  return tiles * 170 + 85;
}
async function _getImageDimensions(url) {
  try {
    let buffer;
    if (isDataUrl(url)) {
      const base64Data = url.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
    } else if (isUrl(url)) {
      const response = await axios.get(url, { responseType: "arraybuffer" });
      buffer = Buffer.from(response.data);
    } else {
      throw new Error("Please provide a valid image url!");
    }
    const dimensions = imageSize(buffer);
    return {
      width: dimensions?.width || 0,
      height: dimensions?.height || 0
    };
  } catch (error) {
    console$8.error("Error getting image dimensions", error);
    throw new Error("Please provide a valid image url!");
  }
}

var __defProp$e = Object.defineProperty;
var __defNormalProp$e = (obj, key, value) => key in obj ? __defProp$e(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$e = (obj, key, value) => __defNormalProp$e(obj, typeof key !== "symbol" ? key + "" : key, value);
class EchoConnector extends LLMConnector {
  constructor() {
    super(...arguments);
    __publicField$e(this, "name", "LLM:Echo");
  }
  async chatRequest(acRequest, prompt, params) {
    return { content: prompt, finishReason: "stop" };
  }
  async visionRequest(acRequest, prompt, params) {
    return { content: prompt, finishReason: "stop" };
  }
  async toolRequest(acRequest, params) {
    throw new Error("Echo model does not support tool requests");
  }
  async streamToolRequest(acRequest, params) {
    throw new Error("Echo model does not support tool requests");
  }
  async streamRequest(acRequest, params) {
    throw new Error("Echo model does not support streaming");
  }
  enhancePrompt(prompt, config) {
    return prompt;
  }
  postProcess(response) {
    try {
      return JSONContent(response).tryParse();
    } catch (error) {
      return response;
    }
  }
}

var __defProp$d = Object.defineProperty;
var __defNormalProp$d = (obj, key, value) => key in obj ? __defProp$d(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$d = (obj, key, value) => __defNormalProp$d(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$7 = Logger("OpenAIConnector");
class OpenAIConnector extends LLMConnector {
  constructor() {
    super(...arguments);
    __publicField$d(this, "name", "LLM:OpenAI");
  }
  async chatRequest(acRequest, prompt, params) {
    if (!params.messages) params.messages = [];
    if (params.messages[0]?.role !== "system") {
      params.messages.unshift({
        role: "system",
        content: "All responses should be in valid json format. The returned json should not be formatted with any newlines or indentations."
      });
      if (params.model.startsWith("gpt-4-turbo") || params.model.startsWith("gpt-3.5-turbo")) {
        params.response_format = { type: "json_object" };
      }
    }
    if (prompt && params.messages.length === 1) {
      params.messages.push({ role: "user", content: prompt });
    }
    delete params.prompt;
    const apiKey = params?.apiKey;
    delete params.apiKey;
    const openai = new OpenAI({
      //FIXME: use config.env instead of process.env
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
    const promptTokens = encodeChat(params.messages, "gpt-4")?.length;
    const tokensLimit = this.checkTokensLimit({
      model: params.model,
      promptTokens,
      completionTokens: params?.max_tokens,
      hasTeamAPIKey: !!apiKey
    });
    if (tokensLimit.isExceeded) throw new Error(tokensLimit.error);
    const response = await openai.chat.completions.create(params);
    const content = response?.choices?.[0]?.message.content;
    return { content, finishReason: response?.choices?.[0]?.finish_reason };
  }
  async visionRequest(acRequest, prompt, params, agent) {
    if (!params.messages || params.messages?.length === 0) params.messages = [];
    if (params.messages?.role !== "system") {
      params.messages.unshift({
        role: "system",
        content: 'All responses should be in valid json format. The returned json should not be formatted with any newlines, indentations. For example: {"<guess key from response>":"<response>"}'
      });
    }
    const sources = params?.sources || [];
    delete params?.sources;
    const agentId = agent instanceof Agent ? agent.id : agent;
    const imageData = [];
    for (let source of sources) {
      const bufferData = await source.readData(AccessCandidate.agent(agentId));
      const base64Data = bufferData.toString("base64");
      const url = `data:${source.mimetype};base64,${base64Data}`;
      imageData.push({
        type: "image_url",
        image_url: {
          url
        }
      });
    }
    const promptData = [{ type: "text", text: prompt }, ...imageData];
    params.messages.push({ role: "user", content: promptData });
    try {
      const apiKey = params?.apiKey;
      delete params.apiKey;
      const openai = new OpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY
      });
      const promptTokens = await this.countVisionPromptTokens(promptData);
      const tokenLimit = this.checkTokensLimit({
        model: params.model,
        promptTokens,
        completionTokens: params?.max_tokens,
        hasTeamAPIKey: !!apiKey
      });
      if (tokenLimit.isExceeded) throw new Error(tokenLimit.error);
      const response = await openai.chat.completions.create({ ...params });
      const content = response?.choices?.[0]?.message.content;
      return { content, finishReason: response?.choices?.[0]?.finish_reason };
    } catch (error) {
      console$7.log("Error in visionLLMRequest: ", error);
      throw error;
    }
  }
  async toolRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, max_tokens, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    try {
      const openai = new OpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY
      });
      if (!Array.isArray(messages) || !messages?.length) {
        return { error: new Error("Invalid messages argument for chat completion.") };
      }
      let args = {
        model,
        messages,
        max_tokens
      };
      if (tools && tools.length > 0) args.tools = tools;
      if (tool_choice) args.tool_choice = tool_choice;
      const result = await openai.chat.completions.create(args);
      const message = result?.choices?.[0]?.message;
      const finishReason = result?.choices?.[0]?.finish_reason;
      let toolsData = [];
      let useTool = false;
      if (finishReason === "tool_calls") {
        toolsData = message?.tool_calls?.map((tool, index) => ({
          index,
          id: tool?.id,
          type: tool?.type,
          name: tool?.function?.name,
          arguments: tool?.function?.arguments,
          role: "tool"
        })) || [];
        useTool = true;
      }
      return {
        data: { useTool, message, content: message?.content ?? "", toolsData }
      };
    } catch (error) {
      console$7.log("Error on toolUseLLMRequest: ", error);
      return { error };
    }
  }
  async streamToolRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    try {
      const openai = new OpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY
      });
      if (!Array.isArray(messages) || !messages?.length) {
        return { error: new Error("Invalid messages argument for chat completion.") };
      }
      console$7.log("model", model);
      console$7.log("messages", messages);
      let args = {
        model,
        messages,
        stream: true
      };
      if (tools && tools.length > 0) args.tools = tools;
      if (tool_choice) args.tool_choice = tool_choice;
      const stream = await openai.chat.completions.create(args);
      const [toolCallsStream, contentStream] = stream.tee();
      let useTool = false;
      let delta = {};
      let toolsData = [];
      let _stream;
      let message = {
        role: "",
        content: "",
        tool_calls: []
      };
      for await (const part of toolCallsStream) {
        delta = part.choices[0].delta;
        message.role += delta?.role || "";
        message.content += delta?.content || "";
        if (!delta?.tool_calls && delta?.content === "") {
          _stream = contentStream;
          break;
        }
        if (delta?.tool_calls) {
          const toolCall = delta?.tool_calls?.[0];
          const index = toolCall?.index;
          toolsData[index] = {
            index,
            role: "tool",
            id: (toolsData?.[index]?.id || "") + (toolCall?.id || ""),
            type: (toolsData?.[index]?.type || "") + (toolCall?.type || ""),
            name: (toolsData?.[index]?.name || "") + (toolCall?.function?.name || ""),
            arguments: (toolsData?.[index]?.arguments || "") + (toolCall?.function?.arguments || "")
          };
        }
      }
      if (toolsData?.length > 0) {
        useTool = true;
      }
      message.tool_calls = toolsData.map((tool) => {
        return {
          id: tool.id,
          type: tool.type,
          function: {
            name: tool.name,
            arguments: tool.arguments
          }
        };
      });
      return {
        data: { useTool, message, stream: _stream, toolsData }
      };
    } catch (error) {
      console$7.log("Error on toolUseLLMRequest: ", error);
      return { error };
    }
  }
  // protected async stremRequest(
  //     acRequest: AccessRequest,
  //     { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = '' }
  // ): Promise<Readable> {
  //     const stream = new LLMStream();
  //     const openai = new OpenAI({
  //         apiKey: apiKey || process.env.OPENAI_API_KEY,
  //     });
  //     console.log('model', model);
  //     console.log('messages', messages);
  //     let args: OpenAI.ChatCompletionCreateParamsStreaming = {
  //         model,
  //         messages,
  //         stream: true,
  //     };
  //     if (tools && tools.length > 0) args.tools = tools;
  //     if (tool_choice) args.tool_choice = tool_choice;
  //     const openaiStream: any = await openai.chat.completions.create(args);
  //     let toolsData: any = [];
  //     stream.enqueueData({ start: true });
  //     (async () => {
  //         for await (const part of openaiStream) {
  //             const delta = part.choices[0].delta;
  //             //stream.enqueueData(delta);
  //             if (!delta?.tool_calls && delta?.content) {
  //                 stream.enqueueData({ content: delta.content, role: delta.role });
  //             }
  //             if (delta?.tool_calls) {
  //                 const toolCall = delta.tool_calls[0];
  //                 const index = toolCall.index;
  //                 toolsData[index] = {
  //                     index,
  //                     role: 'tool',
  //                     id: (toolsData[index]?.id || '') + (toolCall?.id || ''),
  //                     type: (toolsData[index]?.type || '') + (toolCall?.type || ''),
  //                     name: (toolsData[index]?.name || '') + (toolCall?.function?.name || ''),
  //                     arguments: (toolsData[index]?.arguments || '') + (toolCall?.function?.arguments || ''),
  //                 };
  //             }
  //         }
  //         stream.enqueueData({ toolsData });
  //         //stream.endStream();
  //     })();
  //     return stream;
  // }
  async streamRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, max_tokens, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    const emitter = new EventEmitter$1();
    const openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY
    });
    console$7.log("model", model);
    console$7.log("messages", messages);
    let args = {
      model,
      messages,
      max_tokens,
      stream: true
    };
    if (tools && tools.length > 0) args.tools = tools;
    if (tool_choice) args.tool_choice = tool_choice;
    const stream = await openai.chat.completions.create(args);
    (async () => {
      let delta = {};
      let toolsData = [];
      for await (const part of stream) {
        delta = part.choices[0].delta;
        emitter.emit("data", delta);
        if (!delta?.tool_calls && delta?.content) {
          emitter.emit("content", delta?.content, delta?.role);
        }
        if (delta?.tool_calls) {
          const toolCall = delta?.tool_calls?.[0];
          const index = toolCall?.index;
          toolsData[index] = {
            index,
            role: "tool",
            id: (toolsData?.[index]?.id || "") + (toolCall?.id || ""),
            type: (toolsData?.[index]?.type || "") + (toolCall?.type || ""),
            name: (toolsData?.[index]?.name || "") + (toolCall?.function?.name || ""),
            arguments: (toolsData?.[index]?.arguments || "") + (toolCall?.function?.arguments || "")
          };
        }
      }
      if (toolsData?.length > 0) {
        emitter.emit("toolsData", toolsData);
      }
      setTimeout(() => {
        emitter.emit("end", toolsData);
      }, 100);
    })();
    return emitter;
  }
  async extractVisionLLMParams(config) {
    const params = await super.extractVisionLLMParams(config);
    return params;
  }
  formatToolsConfig({ type = "function", toolDefinitions, toolChoice = "auto" }) {
    let tools = [];
    if (type === "function") {
      tools = toolDefinitions.map((tool) => {
        const { name, description, properties, requiredFields } = tool;
        return {
          type: "function",
          function: {
            name,
            description,
            parameters: {
              type: "object",
              properties,
              required: requiredFields
            }
          }
        };
      });
    }
    return tools?.length > 0 ? { tools, tool_choice: toolChoice || "auto" } : {};
  }
  prepareInputMessageBlocks({
    messageBlock,
    toolsData
  }) {
    const messageBlocks = [];
    if (messageBlock) {
      const transformedMessageBlock = {
        ...messageBlock,
        content: typeof messageBlock.content === "object" ? JSON.stringify(messageBlock.content) : messageBlock.content
      };
      messageBlocks.push(transformedMessageBlock);
    }
    const transformedToolsData = toolsData.map((toolData) => ({
      tool_call_id: toolData.id,
      role: toolData.role,
      name: toolData.name,
      content: typeof toolData.result === "string" ? toolData.result : JSON.stringify(toolData.result)
      // Ensure content is a string
    }));
    return [...messageBlocks, ...transformedToolsData];
  }
}

var __defProp$c = Object.defineProperty;
var __defNormalProp$c = (obj, key, value) => key in obj ? __defProp$c(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$c = (obj, key, value) => __defNormalProp$c(obj, typeof key !== "symbol" ? key + "" : key, value);
const DEFAULT_MODEL = "gemini-pro";
const MODELS_WITH_SYSTEM_MESSAGE = [
  "gemini-1.5-pro-latest",
  "gemini-1.5-pro",
  "gemini-1.5-pro-001",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
  "gemini-1.5-flash-001"
];
const MODELS_WITH_JSON_RESPONSE = MODELS_WITH_SYSTEM_MESSAGE;
const VALID_MIME_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/mov",
  "video/avi",
  "video/x-flv",
  "video/mpg",
  "video/webm",
  "video/wmv",
  "video/3gpp",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
  "audio/wav",
  "audio/mp3",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "text/plain",
  "text/html",
  "text/css",
  "text/javascript",
  "application/x-javascript",
  "text/x-typescript",
  "application/x-typescript",
  "text/csv",
  "text/markdown",
  "text/x-python",
  "application/x-python-code",
  "application/json",
  "text/xml",
  "application/rtf",
  "text/rtf"
];
const VALID_IMAGE_MIME_TYPES$1 = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];
class GoogleAIConnector extends LLMConnector {
  constructor() {
    super(...arguments);
    __publicField$c(this, "name", "LLM:GoogleAI");
    __publicField$c(this, "validMimeTypes", VALID_MIME_TYPES);
    __publicField$c(this, "validImageMimeTypes", VALID_IMAGE_MIME_TYPES$1);
  }
  async chatRequest(acRequest, prompt, params) {
    try {
      const model = params?.model || DEFAULT_MODEL;
      const apiKey = params?.apiKey;
      const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
      let messages = params?.messages || [];
      let systemInstruction;
      let systemMessage = {};
      if (this.hasSystemMessage(params?.messages)) {
        const separateMessages = this.separateSystemMessages(messages);
        systemMessage = separateMessages.systemMessage;
        messages = separateMessages.otherMessages;
      }
      if (MODELS_WITH_SYSTEM_MESSAGE.includes(model)) {
        systemInstruction = systemMessage?.content || "";
      } else {
        prompt = `${prompt}
${systemMessage?.content || ""}`;
      }
      if (params?.messages) {
        prompt = params.messages.map((message) => message?.content || "").join("\n");
      }
      const responseFormat = params?.responseFormat || "json";
      if (responseFormat === "json") {
        if (MODELS_WITH_JSON_RESPONSE.includes(model)) params.responseMimeType = "application/json";
        else prompt += JSON_RESPONSE_INSTRUCTION;
      }
      if (!prompt) throw new Error("Prompt is required!");
      const args = {
        model,
        generationConfig: params
      };
      if (systemInstruction) args.systemInstruction = systemInstruction;
      const generationConfig = {
        stopSequences: params.stopSequences,
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        topP: params.topP,
        topK: params.topK
      };
      const $model = genAI.getGenerativeModel({
        model,
        systemInstruction,
        generationConfig
      });
      const { totalTokens: promptTokens } = await $model.countTokens(prompt);
      this.validateTokensLimit({
        model,
        promptTokens,
        completionTokens: params?.maxOutputTokens,
        hasTeamAPIKey: !!apiKey
      });
      const result = await $model.generateContent(prompt);
      const response = await result?.response;
      const content = response?.text();
      const finishReason = response.candidates[0].finishReason;
      return { content, finishReason };
    } catch (error) {
      console.error("Error in googleAI componentLLMRequest", error);
      throw error;
    }
  }
  async visionRequest(acRequest, prompt, params, agent) {
    try {
      const model = params?.model || "gemini-pro-vision";
      const apiKey = params?.apiKey;
      const fileSources = params?.fileSources || [];
      const agentId = agent instanceof Agent ? agent.id : agent;
      const agentCandidate = AccessCandidate.agent(agentId);
      const validFiles = await this.processValidFiles(fileSources, agentCandidate);
      const fileUploadingTasks = validFiles.map((file) => async () => {
        try {
          const uploadedFile = await this.uploadFile({ file, apiKey });
          return { url: uploadedFile.url, mimetype: file.mimetype };
        } catch {
          return null;
        }
      });
      const uploadedFiles = await processWithConcurrencyLimit(fileUploadingTasks);
      if (uploadedFiles?.length === 0) {
        throw new Error(
          `Unsupported file(s). Please make sure your file is one of the following types: ${this.validImageMimeTypes.join(", ")}`
        );
      }
      const fileDataObjectsArray = uploadedFiles.map((file) => ({
        fileData: {
          mimeType: file.mimetype,
          fileUri: file.url
        }
      }));
      const promptWithFiles = fileDataObjectsArray.length === 1 ? [...fileDataObjectsArray, { text: prompt }] : [prompt, ...fileDataObjectsArray];
      const generationConfig = {
        stopSequences: params.stopSequences,
        maxOutputTokens: params.maxOutputTokens,
        temperature: params.temperature,
        topP: params.topP,
        topK: params.topK
      };
      const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
      const $model = genAI.getGenerativeModel({ model, generationConfig });
      const responseFormat = params?.responseFormat || "json";
      if (responseFormat) {
        if (MODELS_WITH_JSON_RESPONSE.includes(model)) params.responseMimeType = "application/json";
        else prompt += JSON_RESPONSE_INSTRUCTION;
      }
      const { totalTokens: promptTokens } = await $model.countTokens(promptWithFiles);
      this.validateTokensLimit({
        model,
        promptTokens,
        completionTokens: params?.maxOutputTokens,
        hasTeamAPIKey: !!apiKey
      });
      const result = await $model.generateContent(promptWithFiles);
      const response = await result?.response;
      const content = response?.text();
      const finishReason = response.candidates[0].finishReason;
      return { content, finishReason };
    } catch (error) {
      console.error("Error in googleAI visionLLMRequest", error);
      throw error;
    }
  }
  async toolRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
      let systemInstruction = "";
      let formattedMessages;
      if (this.hasSystemMessage(messages)) {
        const separateMessages = this.separateSystemMessages(messages);
        systemInstruction = separateMessages.systemMessage?.content || "";
        formattedMessages = this.formatMessages(separateMessages.otherMessages);
      } else {
        formattedMessages = this.formatMessages(messages);
      }
      const $model = genAI.getGenerativeModel({ model });
      const result = await $model.generateContent({
        contents: formattedMessages,
        tools,
        systemInstruction,
        toolConfig: {
          functionCallingConfig: { mode: tool_choice || "auto" }
        }
      });
      const response = await result.response;
      const content = response.text();
      const toolCalls = response.candidates[0]?.content?.parts?.filter((part) => part.functionCall);
      let toolsData = [];
      let useTool = false;
      if (toolCalls && toolCalls.length > 0) {
        toolsData = toolCalls.map((toolCall, index) => ({
          index,
          id: `tool-${index}`,
          type: "function",
          name: toolCall.functionCall.name,
          arguments: JSON.stringify(toolCall.functionCall.args),
          role: "assistant"
        }));
        useTool = true;
      }
      return {
        data: { useTool, message: { content }, content, toolsData }
      };
    } catch (error) {
      console.log("Error on toolUseLLMRequest: ", error);
      return { error };
    }
  }
  async streamToolRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    throw new Error("streamToolRequest() is Deprecated!");
  }
  async streamRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    const emitter = new EventEmitter$1();
    const genAI = new GoogleGenerativeAI(apiKey || process.env.GOOGLEAI_API_KEY);
    const $model = genAI.getGenerativeModel({ model });
    let systemInstruction = "";
    let formattedMessages;
    if (this.hasSystemMessage(messages)) {
      const separateMessages = this.separateSystemMessages(messages);
      systemInstruction = separateMessages.systemMessage?.content || "";
      formattedMessages = this.formatMessages(separateMessages.otherMessages);
    } else {
      formattedMessages = this.formatMessages(messages);
    }
    try {
      console.log("============== formattedMessages ====================");
      console.log(formattedMessages);
      const result = await $model.generateContentStream({
        contents: formattedMessages,
        tools,
        systemInstruction,
        toolConfig: {
          functionCallingConfig: { mode: tool_choice || "auto" }
        }
      });
      let toolsData = [];
      (async () => {
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          emitter.emit("content", chunkText);
          if (chunk.candidates[0]?.content?.parts) {
            const toolCalls = chunk.candidates[0].content.parts.filter((part) => part.functionCall);
            if (toolCalls.length > 0) {
              toolsData = toolCalls.map((toolCall, index) => ({
                index,
                id: `tool-${index}`,
                type: "function",
                name: toolCall.functionCall.name,
                arguments: JSON.stringify(toolCall.functionCall.args),
                role: "assistant"
              }));
              emitter.emit("toolsData", toolsData);
            }
          }
        }
        setTimeout(() => {
          emitter.emit("end", toolsData);
        }, 100);
      })();
      return emitter;
    } catch (error) {
      emitter.emit("error", error);
      return emitter;
    }
  }
  async extractVisionLLMParams(config) {
    const params = await super.extractVisionLLMParams(config);
    return params;
  }
  formatToolsConfig({ toolDefinitions, toolChoice = "auto" }) {
    const tools = toolDefinitions.map((tool) => {
      const { name, description, properties, requiredFields } = tool;
      const validName = this.sanitizeFunctionName(name);
      const validProperties = properties && Object.keys(properties).length > 0 ? properties : { dummy: { type: "string" } };
      return {
        functionDeclarations: [
          {
            name: validName,
            description: description || "",
            parameters: {
              type: "OBJECT",
              properties: validProperties,
              required: requiredFields || []
            }
          }
        ]
      };
    });
    return {
      tools,
      toolChoice: {
        type: toolChoice
      }
    };
  }
  // Add this helper method to sanitize function names
  sanitizeFunctionName(name) {
    if (name == null) {
      return "_unnamed_function";
    }
    let sanitized = name.replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      sanitized = "_" + sanitized;
    }
    if (sanitized === "") {
      sanitized = "_unnamed_function";
    }
    sanitized = sanitized.slice(0, 64);
    return sanitized;
  }
  async processValidFiles(fileSources, candidate) {
    const fileProcessingTasks = fileSources.map((fileSource) => async () => {
      if (!fileSource) return null;
      if (typeof fileSource === "object" && fileSource.url && fileSource.mimetype) {
        return await this.processObjectFileSource(fileSource);
      }
      if (isValidString(fileSource)) {
        return await this.processStringFileSource(fileSource, candidate);
      }
      return null;
    });
    const validFiles = await processWithConcurrencyLimit(fileProcessingTasks);
    return validFiles;
  }
  processObjectFileSource(fileSource) {
    const { mimetype, url } = fileSource;
    if (!this.validImageMimeTypes.includes(mimetype)) return null;
    return { url, mimetype };
  }
  async processStringFileSource(fileSource, candidate) {
    if (isUrl(fileSource)) {
      const mimetype = await getMimeTypeFromUrl(fileSource);
      return this.validImageMimeTypes.includes(mimetype) ? { url: fileSource, mimetype } : null;
    }
    if (isDataUrl(fileSource) || isRawBase64(fileSource)) {
      const { mimetype } = await parseBase64(fileSource);
      if (!this.validImageMimeTypes.includes(mimetype)) return null;
      const binaryInput = new BinaryInput(fileSource);
      const fileData = await binaryInput.getJsonData(candidate);
      return { url: fileData.url, mimetype };
    }
    return null;
  }
  async uploadFile({ file, apiKey }) {
    try {
      if (!apiKey || !file?.url || !file?.mimetype) {
        throw new Error("Missing required parameters to save file for Google AI!");
      }
      const tempDir = os.tmpdir();
      const fileName = path.basename(new URL(file.url).pathname);
      const tempFilePath = path.join(tempDir, fileName);
      const response = await axios.get(file.url, { responseType: "stream" });
      const writer = fs.createWriteStream(tempFilePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
      const fileManager = new GoogleAIFileManager(apiKey);
      const uploadResponse = await fileManager.uploadFile(tempFilePath, {
        mimeType: file.mimetype,
        displayName: fileName
      });
      const name = uploadResponse.file.name;
      let uploadedFile = await fileManager.getFile(name);
      while (uploadedFile.state === FileState.PROCESSING) {
        process.stdout.write(".");
        await new Promise((resolve) => setTimeout(resolve, 1e4));
        uploadedFile = await fileManager.getFile(name);
      }
      if (uploadedFile.state === FileState.FAILED) {
        throw new Error("File processing failed.");
      }
      fs.unlink(tempFilePath, (err) => {
        if (err) console.error("Error deleting temp file: ", err);
      });
      return {
        url: uploadResponse.file.uri || ""
      };
    } catch (error) {
      throw new Error(`Error uploading file for Google AI ${error.message}`);
    }
  }
  formatMessages(messages) {
    return messages.map((message) => {
      let role = message.role;
      if (message.role === "assistant") {
        role = "model";
      }
      return {
        role,
        parts: [{ text: message.content }]
      };
    });
  }
}

var __defProp$b = Object.defineProperty;
var __defNormalProp$b = (obj, key, value) => key in obj ? __defProp$b(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$b = (obj, key, value) => __defNormalProp$b(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$6 = Logger("AnthropicAIConnector");
const VALID_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const PREFILL_TEXT_FOR_JSON_RESPONSE = "{";
const TOOL_USE_DEFAULT_MODEL = "claude-3-5-sonnet-20240620";
class AnthropicAIConnector extends LLMConnector {
  constructor() {
    super(...arguments);
    __publicField$b(this, "name", "LLM:AnthropicAI");
    __publicField$b(this, "validImageMimeTypes", VALID_IMAGE_MIME_TYPES);
  }
  async chatRequest(acRequest, prompt, params) {
    params.messages = params?.messages || [];
    if (prompt) {
      params.messages.push({
        role: "user",
        content: prompt
      });
    }
    if (this.hasSystemMessage(params.messages)) {
      const { systemMessage, otherMessages } = this.separateSystemMessages(params.messages);
      params.messages = otherMessages;
      params.system = systemMessage?.content;
    }
    const responseFormat = params?.responseFormat || "json";
    if (responseFormat === "json") {
      params.system += JSON_RESPONSE_INSTRUCTION;
      params.messages.push({ role: "assistant", content: PREFILL_TEXT_FOR_JSON_RESPONSE });
    }
    const apiKey = params?.apiKey;
    if (!apiKey) throw new Error("Please provide an API key for AnthropicAI");
    const anthropic = new Anthropic({ apiKey });
    try {
      const messageCreateArgs = {
        model: params.model,
        messages: params.messages,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        stop_sequences: params.stop_sequences,
        top_p: params.top_p,
        top_k: params.top_k
      };
      const response = await anthropic.messages.create(messageCreateArgs);
      let content = response.content?.[0]?.text;
      const finishReason = response?.stop_reason;
      if (responseFormat === "json") {
        content = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content}`;
      }
      return { content, finishReason };
    } catch (error) {
      console$6.error("Error in componentLLMRequest in AnthropicAI: ", error);
      if (error instanceof Anthropic.APIError) {
        throw error;
      } else {
        throw new Error("Internal server error! Please try again later or contact support.");
      }
    }
  }
  async visionRequest(acRequest, prompt, params, agent) {
    params.messages = params?.messages || [];
    const fileSources = params?.fileSources || [];
    const agentId = agent instanceof Agent ? agent.id : agent;
    const agentCandidate = AccessCandidate.agent(agentId);
    const validFiles = await this.processValidFiles(fileSources, agentCandidate);
    if (validFiles?.length === 0) {
      throw new Error(`Unsupported file(s). Please make sure your file is one of the following types: ${this.validImageMimeTypes.join(", ")}`);
    }
    const fileObjectsArray = validFiles.map((file) => ({
      type: "image",
      source: {
        type: "base64",
        data: file.base64data,
        media_type: file.mimetype
      }
    }));
    const content = [{ type: "text", text: prompt }, ...fileObjectsArray];
    params.messages.push({ role: "user", content });
    const responseFormat = params?.responseFormat || "json";
    if (responseFormat === "json") {
      params.system = JSON_RESPONSE_INSTRUCTION;
      params.messages.push({ role: "assistant", content: PREFILL_TEXT_FOR_JSON_RESPONSE });
    }
    const apiKey = params?.apiKey;
    if (!apiKey) throw new Error("Please provide an API key for AnthropicAI");
    const anthropic = new Anthropic({ apiKey });
    try {
      const messageCreateArgs = {
        model: params.model,
        messages: params.messages,
        max_tokens: params.max_tokens,
        temperature: params.temperature,
        stop_sequences: params.stop_sequences,
        top_p: params.top_p,
        top_k: params.top_k
      };
      const response = await anthropic.messages.create(messageCreateArgs);
      let content2 = response?.content?.[0]?.text;
      const finishReason = response?.stop_reason;
      if (responseFormat === "json") {
        content2 = `${PREFILL_TEXT_FOR_JSON_RESPONSE}${content2}`;
      }
      return { content: content2, finishReason };
    } catch (error) {
      console$6.error("Error in componentLLMRequest in Calude: ", error);
      if (error instanceof Anthropic.APIError) {
        throw error;
      } else {
        throw new Error("Internal server error! Please try again later or contact support.");
      }
    }
  }
  async toolRequest(acRequest, { model = "claude-3-opus-20240229", messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    try {
      if (!apiKey) throw new Error("Please provide an API key for AnthropicAI");
      const anthropic = new Anthropic({ apiKey });
      const messageCreateArgs = {
        model,
        messages: [],
        // TODO (Forhad): Need to set max dynamically based on the model
        max_tokens: 4096
        // * max token is required
      };
      if (this.hasSystemMessage(messages)) {
        const { systemMessage, otherMessages } = this.separateSystemMessages(messages);
        messageCreateArgs.system = systemMessage?.content || "";
        messageCreateArgs.messages = otherMessages;
      }
      if (tools && tools.length > 0) messageCreateArgs.tools = tools;
      const result = await anthropic.messages.create(messageCreateArgs);
      const message = {
        role: result?.role || "user",
        content: result?.content || ""
      };
      const stopReason = result?.stop_reason;
      let toolsData = [];
      let useTool = false;
      if (stopReason === "tool_use") {
        const toolUseContentBlocks = result?.content?.filter((c) => c.type === "tool_use");
        if (toolUseContentBlocks?.length === 0) return;
        message.content = toolUseContentBlocks;
        toolUseContentBlocks.forEach((toolUseBlock, index) => {
          toolsData.push({
            index,
            id: toolUseBlock?.id,
            type: "function",
            // We call API only when the tool type is 'function' in `src/helpers/Conversation.helper.ts`. Even though Anthropic AI returns the type as 'tool_use', it should be interpreted as 'function'.
            name: toolUseBlock?.name,
            arguments: toolUseBlock?.input,
            role: "user"
          });
        });
        useTool = true;
      }
      const content = result?.content?.[0]?.text;
      return {
        data: {
          useTool,
          message,
          content,
          toolsData
        }
      };
    } catch (error) {
      throw error;
    }
  }
  // ! DEPRECATED METHOD
  async streamToolRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    throw new Error("streamToolRequest() is Deprecated!");
  }
  async streamRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    try {
      const emitter = new EventEmitter$1();
      if (!apiKey) throw new Error("Please provide an API key for AnthropicAI");
      const anthropic = new Anthropic({ apiKey });
      const messageCreateArgs = {
        model,
        messages: [],
        // TODO (Forhad): Need to set max dynamically based on the model
        max_tokens: 4096
        // * max token is required
      };
      if (this.hasSystemMessage(messages)) {
        const { systemMessage, otherMessages } = this.separateSystemMessages(messages);
        messageCreateArgs.system = systemMessage?.content || "";
        messageCreateArgs.messages = this.checkMessagesConsistency(otherMessages);
      } else {
        messageCreateArgs.messages = this.checkMessagesConsistency(messages);
      }
      if (tools && tools.length > 0) messageCreateArgs.tools = tools;
      const stream = anthropic.messages.stream(messageCreateArgs);
      stream.on("error", (error) => {
        emitter.emit("error", error);
      });
      let toolsData = [];
      stream.on("text", (text) => {
        emitter.emit("content", text);
      });
      stream.on("finalMessage", (finalMessage) => {
        const toolUseContentBlocks = finalMessage?.content?.filter((c) => c.type === "tool_use");
        if (toolUseContentBlocks?.length > 0) {
          toolUseContentBlocks.forEach((toolUseBlock, index) => {
            toolsData.push({
              index,
              id: toolUseBlock?.id,
              type: "function",
              // We call API only when the tool type is 'function' in `src/helpers/Conversation.helper.ts`. Even though Anthropic AI returns the type as 'tool_use', it should be interpreted as 'function'.
              name: toolUseBlock?.name,
              arguments: toolUseBlock?.input,
              role: "user"
            });
          });
          emitter.emit("toolsData", toolsData);
        }
        setTimeout(() => {
          emitter.emit("end", toolsData);
        }, 100);
      });
      return emitter;
    } catch (error) {
      throw error;
    }
  }
  checkMessagesConsistency(messages) {
    if (messages.length <= 0) return messages;
    if (messages[0].role === "user" && Array.isArray(messages[0].content)) {
      const hasToolResult = messages[0].content.find((content) => content.type === "tool_result");
      if (hasToolResult) {
        messages.shift();
      }
    }
    if (messages[0].role !== "user") {
      messages.unshift({ role: "user", content: "continue" });
    }
    return messages;
  }
  async extractVisionLLMParams(config) {
    const params = await super.extractVisionLLMParams(config);
    return params;
  }
  formatToolsConfig({ type = "function", toolDefinitions, toolChoice = "auto" }) {
    let tools = [];
    if (type === "function") {
      tools = toolDefinitions.map((tool) => {
        const { name, description, properties, requiredFields } = tool;
        return {
          name,
          description,
          input_schema: {
            type: "object",
            properties,
            required: requiredFields
          }
        };
      });
    }
    return tools?.length > 0 ? { tools } : {};
  }
  prepareInputMessageBlocks({
    messageBlock,
    toolsData
  }) {
    const messageBlocks = [];
    if (messageBlock) {
      const content = [];
      if (typeof messageBlock.content === "object") {
        content.push(messageBlock.content);
      } else {
        content.push({ type: "text", text: messageBlock.content });
      }
      if (messageBlock.tool_calls) {
        const calls = messageBlock.tool_calls.map((toolCall) => ({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall?.function?.name,
          input: toolCall?.function?.arguments
        }));
        content.push(...calls);
      }
      messageBlocks.push({
        role: messageBlock.role,
        content
      });
    }
    const transformedToolsData = toolsData.map((toolData) => ({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolData.id,
          content: toolData.result
        }
      ]
    }));
    return [...messageBlocks, ...transformedToolsData];
  }
  async processValidFiles(fileSources, candidate) {
    const fileProcessingTasks = fileSources.map((fileSource) => async () => {
      if (!fileSource) return null;
      if (typeof fileSource === "object" && fileSource.url && fileSource.mimetype) {
        return await this.processObjectFileSource(fileSource, candidate);
      }
      if (isValidString(fileSource)) {
        return await this.processStringFileSource(fileSource, candidate);
      }
      return null;
    });
    const validFiles = await processWithConcurrencyLimit(fileProcessingTasks);
    return validFiles;
  }
  async processObjectFileSource(fileSource, candidate) {
    const { mimetype } = fileSource;
    if (!this.validImageMimeTypes.includes(mimetype)) return null;
    const binaryInput = new BinaryInput(fileSource);
    const base64data = (await binaryInput.getBuffer()).toString("base64");
    return { base64data, mimetype };
  }
  async processStringFileSource(fileSource, candidate) {
    let mimetype = "";
    if (isUrl(fileSource)) {
      mimetype = await getMimeTypeFromUrl(fileSource);
    } else if (isDataUrl(fileSource) || isRawBase64(fileSource)) {
      const parsedBase64 = await parseBase64(fileSource);
      mimetype = parsedBase64.mimetype;
    }
    if (!this.validImageMimeTypes.includes(mimetype)) return null;
    const binaryInput = new BinaryInput(fileSource);
    const base64data = (await binaryInput.getBuffer()).toString("base64");
    return { base64data, mimetype };
  }
}

var __defProp$a = Object.defineProperty;
var __defNormalProp$a = (obj, key, value) => key in obj ? __defProp$a(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$a = (obj, key, value) => __defNormalProp$a(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$5 = Logger("GroqConnector");
class GroqConnector extends LLMConnector {
  constructor() {
    super(...arguments);
    __publicField$a(this, "name", "LLM:Groq");
  }
  async chatRequest(acRequest, prompt, params) {
    try {
      params.messages = params?.messages || [];
      if (this.hasSystemMessage(params.messages)) {
        const { systemMessage, otherMessages } = this.separateSystemMessages(params.messages);
        params.messages = [systemMessage, ...otherMessages];
      } else {
        params.messages.unshift({
          role: "system",
          content: JSON_RESPONSE_INSTRUCTION
        });
      }
      if (prompt) {
        params.messages.push({ role: "user", content: prompt });
      }
      const apiKey = params?.apiKey;
      if (!apiKey) throw new Error("Please provide an API key for Groq");
      const groq = new Groq({ apiKey });
      const response = await groq.chat.completions.create(params);
      const content = response.choices[0]?.message?.content;
      const finishReason = response.choices[0]?.finish_reason;
      return { content, finishReason };
    } catch (error) {
      console$5.error("Error in groq chatRequest", error);
      throw error;
    }
  }
  async visionRequest(acRequest, prompt, params, agent) {
    throw new Error("Vision requests are not supported by Groq");
  }
  async toolRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    throw new Error("Tool requests are not yet implemented for Groq");
  }
  async streamToolRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    throw new Error("Stream tool requests are not yet implemented for Groq");
  }
  async streamRequest(acRequest, { model = TOOL_USE_DEFAULT_MODEL$1, messages, toolsConfig: { tools, tool_choice }, apiKey = "" }) {
    throw new Error("Stream requests are not yet implemented for Groq");
  }
  async extractVisionLLMParams(config) {
    const params = await super.extractVisionLLMParams(config);
    return params;
  }
  formatToolsConfig({ type = "function", toolDefinitions, toolChoice = "auto" }) {
    throw new Error("Tool configuration is not yet implemented for Groq");
  }
  formatInputMessages(messages) {
    return messages.map((message) => {
      let textContent = "";
      if (Array.isArray(message.content)) {
        textContent = message.content.map((textBlock) => textBlock?.text || "").join(" ");
      } else if (typeof message.content === "string") {
        textContent = message.content;
      }
      return {
        role: message.role,
        content: textContent
      };
    });
  }
}

var __defProp$9 = Object.defineProperty;
var __defNormalProp$9 = (obj, key, value) => key in obj ? __defProp$9(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$9 = (obj, key, value) => __defNormalProp$9(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$4 = Logger("TogetherAIConnector");
class TogetherAIConnector extends LLMConnector {
  constructor() {
    super(...arguments);
    __publicField$9(this, "name", "LLM:TogetherAI");
  }
  async chatRequest(acRequest, prompt, params) {
    try {
      if (!params.messages) params.messages = [];
      if (params.messages[0]?.role !== "system") {
        params.messages.unshift({
          role: "system",
          content: JSON_RESPONSE_INSTRUCTION
        });
      }
      if (prompt) {
        params.messages.push({ role: "user", content: prompt });
      }
      params.messages = this.formatInputMessages(params.messages);
      const apiKey = params?.apiKey;
      delete params.apiKey;
      const openai = new OpenAI({
        apiKey: apiKey || process.env.TOGETHER_AI_API_KEY,
        baseURL: config.env.TOGETHER_AI_API_URL
      });
      const response = await openai.chat.completions.create(params);
      const content = response?.choices?.[0]?.text || response?.choices?.[0]?.message.content || response?.data?.choices?.[0]?.text || response?.data?.choices?.[0]?.message.content;
      const finishReason = response?.choices?.[0]?.finish_reason;
      return { content, finishReason };
    } catch (error) {
      console$4.error("Error in TogetherAI chatRequest", error);
      throw error;
    }
  }
  async visionRequest(acRequest, prompt, params, agent) {
    throw new Error("Vision requests are not supported by TogetherAI");
  }
  async toolRequest(acRequest, params) {
    throw new Error("Tool requests are not yet implemented for TogetherAI");
  }
  async streamToolRequest(acRequest, params) {
    throw new Error("Stream tool requests are not yet implemented for TogetherAI");
  }
  async streamRequest(acRequest, params) {
    throw new Error("Stream requests are not yet implemented for TogetherAI");
  }
  async extractVisionLLMParams(config2) {
    const params = await super.extractVisionLLMParams(config2);
    return params;
  }
  formatToolsConfig({ type = "function", toolDefinitions, toolChoice = "auto" }) {
    throw new Error("Tool configuration is not yet implemented for TogetherAI");
  }
  formatInputMessages(messages) {
    return messages.map((message) => {
      let textContent = "";
      if (Array.isArray(message.content)) {
        textContent = message.content.map((textBlock) => textBlock?.text || "").join(" ");
      } else if (typeof message.content === "string") {
        textContent = message.content;
      }
      return {
        role: message.role,
        content: textContent
      };
    });
  }
}

class LLMService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.LLM, "Echo", EchoConnector);
    ConnectorService.register(TConnectorService.LLM, "OpenAI", OpenAIConnector);
    ConnectorService.register(TConnectorService.LLM, "GoogleAI", GoogleAIConnector);
    ConnectorService.register(TConnectorService.LLM, "AnthropicAI", AnthropicAIConnector);
    ConnectorService.register(TConnectorService.LLM, "Groq", GroqConnector);
    ConnectorService.register(TConnectorService.LLM, "TogetherAI", TogetherAIConnector);
  }
  init() {
    ConnectorService.init(TConnectorService.LLM, "Echo");
    ConnectorService.init(TConnectorService.LLM, "OpenAI");
    ConnectorService.init(TConnectorService.LLM, "GoogleAI");
    ConnectorService.init(TConnectorService.LLM, "AnthropicAI");
    ConnectorService.init(TConnectorService.LLM, "Groq");
    ConnectorService.init(TConnectorService.LLM, "TogetherAI");
  }
}

class CacheConnector extends SecureConnector {
  user(candidate) {
    return {
      get: async (key) => {
        return await this.get(candidate.readRequest, key);
      },
      set: async (key, data, acl, metadata, ttl) => {
        return await this.set(candidate.writeRequest, key, data, acl, metadata, ttl);
      },
      delete: async (key) => {
        await this.delete(candidate.writeRequest, key);
      },
      exists: async (key) => {
        return await this.exists(candidate.readRequest, key);
      },
      getMetadata: async (key) => {
        return await this.getMetadata(candidate.readRequest, key);
      },
      setMetadata: async (key, metadata) => {
        await this.setMetadata(candidate.writeRequest, key, metadata);
      },
      updateTTL: async (key, ttl) => {
        await this.updateTTL(candidate.writeRequest, key, ttl);
      },
      getTTL: async (key) => {
        return await this.getTTL(candidate.readRequest, key);
      },
      getACL: async (key) => {
        return await this.getACL(candidate.readRequest, key);
      },
      setACL: async (key, acl) => {
        await this.setACL(candidate.writeRequest, key, acl);
      }
    };
  }
}

var __defProp$8 = Object.defineProperty;
var __getOwnPropDesc$3 = Object.getOwnPropertyDescriptor;
var __defNormalProp$8 = (obj, key, value) => key in obj ? __defProp$8(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __decorateClass$3 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$3(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$8(target, key, result);
  return result;
};
var __publicField$8 = (obj, key, value) => __defNormalProp$8(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$3 = Logger("RedisCache");
class RedisCache extends CacheConnector {
  constructor(settings) {
    super();
    __publicField$8(this, "name", "RedisCache");
    __publicField$8(this, "redis");
    __publicField$8(this, "_prefix", "smyth:cache");
    __publicField$8(this, "_mdPrefix", "smyth:metadata");
    const sentinels = parseSentinelHosts(settings.hosts);
    this.redis = new IORedis({
      sentinels,
      name: settings.name,
      password: settings.password
    });
    this.redis.on("error", (error) => {
      console$3.error("Redis Error:", error);
    });
    this.redis.on("connect", () => {
      console$3.log("Redis connected!");
    });
  }
  get client() {
    return this.redis;
  }
  get prefix() {
    return this._prefix;
  }
  get mdPrefix() {
    return this._mdPrefix;
  }
  async get(acRequest, key) {
    const value = await this.redis.get(`${this._prefix}:${key}`);
    return value;
  }
  async set(acRequest, key, data, acl, metadata, ttl) {
    const accessCandidate = acRequest.candidate;
    const promises = [];
    promises.push(this.redis.set(`${this._prefix}:${key}`, data));
    const newMetadata = metadata || {};
    newMetadata.acl = ACL.from(acl).addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
    promises.push(this.setMetadata(acRequest, key, newMetadata));
    if (ttl) {
      promises.push(this.updateTTL(acRequest, key, ttl));
    }
    await Promise.all(promises);
    return true;
  }
  async delete(acRequest, key) {
    await Promise.all([this.redis.del(`${this._prefix}:${key}`), this.redis.del(`${this._mdPrefix}:${key}`)]);
  }
  async exists(acRequest, key) {
    return !!await this.redis.exists(`${this._prefix}:${key}`);
  }
  async getMetadata(acRequest, key) {
    if (!this.exists(acRequest, key)) return void 0;
    try {
      const metadata = await this.redis.get(`${this._mdPrefix}:${key}`);
      return metadata ? this.deserializeRedisMetadata(metadata) : {};
    } catch (error) {
      return {};
    }
  }
  async setMetadata(acRequest, key, metadata) {
    await this.redis.set(`${this._mdPrefix}:${key}`, this.serializeRedisMetadata(metadata));
  }
  async updateTTL(acRequest, key, ttl) {
    if (ttl) {
      await Promise.all([this.redis.expire(`${this._prefix}:${key}`, ttl), this.redis.expire(`${this._mdPrefix}:${key}`, ttl)]);
    }
  }
  async getTTL(acRequest, key) {
    return this.redis.ttl(`${this._prefix}:${key}`);
  }
  async getResourceACL(resourceId, candidate) {
    const _metadata = await this.redis.get(`${this._mdPrefix}:${resourceId}`).catch((error) => {
    });
    const exists = _metadata !== void 0 && _metadata !== null;
    const metadata = exists ? this.deserializeRedisMetadata(_metadata) : {};
    if (!exists) {
      return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }
    return ACL.from(metadata?.acl);
  }
  async getACL(acRequest, key) {
    try {
      const metadata = await this.getMetadata(acRequest, key);
      return metadata?.acl || {};
    } catch (error) {
      console$3.error(`Error getting access rights in S3`, error.name, error.message);
      throw error;
    }
  }
  async setACL(acRequest, key, acl) {
    try {
      let metadata = await this.getMetadata(acRequest, key);
      if (!metadata) metadata = {};
      metadata.acl = ACL.from(acl).addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
      await this.setMetadata(acRequest, key, metadata);
    } catch (error) {
      console$3.error(`Error setting access rights in S3`, error);
      throw error;
    }
  }
  serializeRedisMetadata(redisMetadata) {
    if (!redisMetadata) return "";
    if (redisMetadata.acl) {
      const acl = redisMetadata.acl;
      if (acl) {
        redisMetadata.acl = ACL.from(acl).serializedACL;
      }
    }
    return JSON.stringify(redisMetadata);
  }
  deserializeRedisMetadata(strMetadata) {
    try {
      const redisMetadata = JSON.parse(strMetadata);
      if (redisMetadata.acl) {
        const acl = ACL.from(redisMetadata.acl).ACL;
        redisMetadata.acl = acl;
      }
      return redisMetadata;
    } catch (error) {
      console$3.warn(`Error deserializing metadata`, strMetadata);
      return {};
    }
  }
  async stop() {
    super.stop();
    await this.redis.quit();
  }
}
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "get", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "set", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "delete", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "exists", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "getMetadata", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "setMetadata", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "updateTTL", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "getTTL", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "getACL", 1);
__decorateClass$3([
  SecureConnector.AccessControl
], RedisCache.prototype, "setACL", 1);
function parseSentinelHosts(hosts) {
  if (typeof hosts === "string") {
    return hosts.split(",").map((host) => {
      const [hostName, port] = host.split(":");
      return {
        host: hostName,
        port: Number(port)
      };
    });
  } else if (Array.isArray(hosts)) {
    return hosts.map((host) => {
      if (typeof host === "string") {
        const [hostName, port] = host.split(":");
        return {
          host: hostName,
          port: Number(port)
        };
      } else {
        return host;
      }
    });
  } else {
    return [];
  }
}

class CacheService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.Cache, "Redis", RedisCache);
  }
}

class VaultConnector extends SecureConnector {
}

var __defProp$7 = Object.defineProperty;
var __getOwnPropDesc$2 = Object.getOwnPropertyDescriptor;
var __defNormalProp$7 = (obj, key, value) => key in obj ? __defProp$7(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __decorateClass$2 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$2(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$7(target, key, result);
  return result;
};
var __publicField$7 = (obj, key, value) => __defNormalProp$7(obj, typeof key !== "symbol" ? key + "" : key, value);
Logger("JSONFileVault");
class JSONFileVault extends VaultConnector {
  constructor(config) {
    super();
    this.config = config;
    __publicField$7(this, "name", "JSONFileVault");
    __publicField$7(this, "vaultData");
    __publicField$7(this, "index");
    if (!SmythRuntime.Instance) throw new Error("SRE not initialized");
    if (fs.existsSync(config.file)) {
      try {
        this.vaultData = JSON.parse(fs.readFileSync(config.file).toString());
      } catch (e) {
        this.vaultData = {};
      }
      for (let teamId in this.vaultData) {
        for (let resourceId in this.vaultData[teamId]) {
          if (!this.index) this.index = {};
          if (!this.index[resourceId]) this.index[resourceId] = {};
          const value = this.vaultData[teamId][resourceId];
          this.index[resourceId][teamId] = value;
        }
      }
    }
  }
  user(candidate) {
    return {
      get: async (keyId) => this.get(candidate.readRequest, keyId),
      set: async (keyId, value) => this.set(candidate.writeRequest, keyId, value),
      delete: async (keyId) => this.delete(candidate.writeRequest, keyId),
      exists: async (keyId) => this.exists(candidate.readRequest, keyId)
    };
  }
  async get(acRequest, keyId) {
    const accountConnector = ConnectorService.getAccountConnector();
    const teamId = await accountConnector.getCandidateTeam(acRequest.candidate);
    return this.vaultData?.[teamId]?.[keyId];
  }
  async set(acRequest, keyId, value) {
    throw new Error("JSONFileVault.set not allowed");
  }
  async delete(acRequest, keyId) {
    throw new Error("JSONFileVault.delete not allowed");
  }
  async exists(acRequest, keyId) {
    return false;
  }
  async getResourceACL(resourceId, candidate) {
    const accountConnector = ConnectorService.getAccountConnector();
    const teamId = await accountConnector.getCandidateTeam(candidate);
    const acl = new ACL();
    if (!this.vaultData?.[teamId]?.[resourceId]) return acl;
    acl.addAccess(TAccessRole.Team, teamId, TAccessLevel.Owner).addAccess(TAccessRole.Team, teamId, TAccessLevel.Read).addAccess(TAccessRole.Team, teamId, TAccessLevel.Write);
    return acl;
  }
}
__decorateClass$2([
  SecureConnector.AccessControl
], JSONFileVault.prototype, "get", 1);
__decorateClass$2([
  SecureConnector.AccessControl
], JSONFileVault.prototype, "set", 1);
__decorateClass$2([
  SecureConnector.AccessControl
], JSONFileVault.prototype, "delete", 1);
__decorateClass$2([
  SecureConnector.AccessControl
], JSONFileVault.prototype, "exists", 1);

class VaultService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.Vault, "JSONFileVault", JSONFileVault);
  }
}

var __defProp$6 = Object.defineProperty;
var __defNormalProp$6 = (obj, key, value) => key in obj ? __defProp$6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$6 = (obj, key, value) => __defNormalProp$6(obj, typeof key !== "symbol" ? key + "" : key, value);
class AccountConnector extends Connector {
  constructor() {
    super(...arguments);
    __publicField$6(this, "name", "Account");
  }
  isTeamMember(team, candidate) {
    return Promise.resolve(true);
  }
  getCandidateTeam(candidate) {
    if (candidate.role === TAccessRole.Team) {
      return Promise.resolve(candidate.id);
    }
    return Promise.resolve("default");
  }
}

class AccountService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.Account, "Account", AccountConnector);
  }
  init() {
    ConnectorService.init(TConnectorService.Account, "Account");
  }
}

var __defProp$5 = Object.defineProperty;
var __defNormalProp$5 = (obj, key, value) => key in obj ? __defProp$5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$5 = (obj, key, value) => __defNormalProp$5(obj, typeof key !== "symbol" ? key + "" : key, value);
const openapiTemplate = JSON.stringify({
  openapi: "3.0.1",
  info: {
    title: "{{model_name}}",
    description: "{{model_description}}",
    version: "{{version}}"
  },
  servers: [
    {
      url: "{{server_url}}"
    }
  ],
  paths: {},
  components: {
    schemas: {}
  }
});
const openapiEndpointTemplate = JSON.stringify({
  summary: "{{summary}}",
  operationId: "{{operationId}}",
  "x-openai-isConsequential": false,
  requestBody: {
    required: true,
    content: {}
  },
  responses: {
    "200": {
      description: "response",
      content: {
        "text/plain": {
          schema: {
            type: "string"
          }
        }
      }
    }
  }
});
class AgentDataConnector extends Connector {
  constructor() {
    super(...arguments);
    __publicField$5(this, "name", "AgentDataConnector");
  }
  /**
   * Loads openAPI JSON for the agent
   * @param source this represents either the agentId or the agent data
   * @param domain
   * @param version
   * @param aiOnly
   * @returns
   */
  async getOpenAPIJSON(source, server_url, version, aiOnly = false) {
    if (!source) {
      throw new Error("Agent not found");
    }
    const apiBasePath = version && version != "latest" ? `/v${version}/api` : "/api";
    const agentData = typeof source === "object" ? source : await this.getAgentData(source, version);
    const name = agentData.name;
    let description = aiOnly ? agentData.data.behavior : agentData.data.shortDescription;
    if (!description) description = agentData.data.description;
    const _version = agentData.data.version || "1.0.0";
    const openAPITpl = TemplateString(openapiTemplate).parse({
      model_name: escapeString(name),
      model_description: escapeString(description),
      server_url,
      version: _version
    }).clean().result;
    const openAPIObj = JSON.parse(openAPITpl);
    const components = agentData.data.components.filter((component) => component.name === "APIEndpoint");
    for (let component of components) {
      const ai_exposed = component.data.ai_exposed || typeof component.data.ai_exposed === "undefined";
      if (aiOnly && !ai_exposed) continue;
      let method = (component.data.method || "post").toLowerCase();
      let summary = aiOnly ? component.data.description || component.data.doc : component.data.doc || component.data.description;
      const openAPIEntry = JSON.parse(
        TemplateString(openapiEndpointTemplate).parse({
          summary,
          operationId: component.data.endpoint
        }).clean().result
      );
      if (!openAPIObj.paths[apiBasePath + "/" + component.data.endpoint]) openAPIObj.paths[apiBasePath + "/" + component.data.endpoint] = {};
      openAPIObj.paths[apiBasePath + "/" + component.data.endpoint][method] = openAPIEntry;
      if (component.inputs.length > 0) {
        if (method === "get") {
          delete openAPIEntry.requestBody;
          openAPIEntry.parameters = [];
          for (let input of component.inputs) {
            const parameter = {
              name: input.name,
              in: "query",
              description: input.description,
              required: !input.optional,
              schema: getOpenAPIInputSchema(input.type)
            };
            const { style, explode } = getOpenAPIParameterStyle(input.type);
            if (style) {
              parameter.style = style;
              parameter.explode = explode;
            }
            openAPIEntry.parameters.push(parameter);
          }
        } else {
          const requiredProps = [];
          const hasBinaryType = !aiOnly && component.inputs.some((input) => input.type.toLowerCase().trim() === "binary");
          const mimetype = hasBinaryType ? "multipart/form-data" : "application/json";
          openAPIEntry.requestBody.content[mimetype] = {};
          for (let input of component.inputs) {
            if (!input.optional) requiredProps.push(input.name);
            if (!openAPIEntry.requestBody.content[mimetype].schema)
              openAPIEntry.requestBody.content[mimetype].schema = { type: "object" };
            const schema = openAPIEntry.requestBody.content[mimetype].schema || {
              type: "object"
            };
            if (!schema.properties) schema.properties = {};
            schema.properties[input.name] = {
              ...getOpenAPIInputSchema(input.type),
              format: !aiOnly && input.type.toLowerCase().trim() === "binary" ? "binary" : void 0,
              description: input.description,
              default: input.defaultVal
            };
            schema.required = requiredProps;
            if (!openAPIEntry.requestBody.content[mimetype].schema) openAPIEntry.requestBody.content["application/json"].schema = schema;
          }
        }
      } else {
        delete openAPIEntry.requestBody;
      }
    }
    return openAPIObj;
  }
}
function getOpenAPIInputSchema(input_type) {
  switch (input_type?.toLowerCase()) {
    case "binary":
    case "string":
    case "any":
      return { type: "string" };
    case "number":
    case "float":
      return { type: "number" };
    case "integer":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    case "array":
      return { type: "array", items: {} };
    case "object":
      return { type: "object", additionalProperties: {} };
    default:
      return { type: "string" };
  }
}
function getOpenAPIParameterStyle(input_type) {
  switch (input_type.toLowerCase()) {
    case "array":
      return {
        style: "form",
        explode: false
        // results in `ids=1,2,3`
      };
    case "object":
      return {
        style: "deepObject",
        explode: true
        // results in `lat=value1&long=value2`
      };
    default:
      return { style: "", explode: false };
  }
}

var __defProp$4 = Object.defineProperty;
var __defNormalProp$4 = (obj, key, value) => key in obj ? __defProp$4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$4 = (obj, key, value) => __defNormalProp$4(obj, typeof key !== "symbol" ? key + "" : key, value);
class CLIAgentDataConnector extends AgentDataConnector {
  constructor(settings) {
    super();
    __publicField$4(this, "name", "CLIAgentDataConnector");
    __publicField$4(this, "argv");
    this.argv = settings.args || process.argv;
  }
  async getAgentData(agentId, version) {
    const cliConnector = ConnectorService.getCLIConnector();
    const params = cliConnector.get("agent");
    const __dirname = fs.realpathSync(process.cwd());
    const filePath = path.join(__dirname, params.agent);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return { data: JSON.parse(data), version: version || "1.0" };
    }
  }
  getAgentIdByDomain(domain) {
    return Promise.resolve("");
  }
  async getAgentSettings(agentId, version) {
    const cliConnector = ConnectorService.getCLIConnector();
    const params = cliConnector.get("settings");
    let settings;
    if (typeof params.settings === "string") {
      if (fs.existsSync(params.settings)) {
        settings = JSON.parse(fs.readFileSync(params.settings, "utf8"));
      }
    } else {
      settings = params.settings;
    }
    return settings;
  }
  async isDeployed(agentId) {
    return true;
  }
}

var __defProp$3 = Object.defineProperty;
var __defNormalProp$3 = (obj, key, value) => key in obj ? __defProp$3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$3 = (obj, key, value) => __defNormalProp$3(obj, typeof key !== "symbol" ? key + "" : key, value);
class LocalAgentDataConnector extends AgentDataConnector {
  constructor(settings) {
    super();
    __publicField$3(this, "name", "LocalAgentDataConnector");
    __publicField$3(this, "devDir");
    __publicField$3(this, "prodDir");
    __publicField$3(this, "agentsData", { dev: {}, prod: {} });
    __publicField$3(this, "agentSettings", { dev: {}, prod: {} });
    this.devDir = settings.devDir;
    this.prodDir = settings.prodDir;
  }
  indexDir(dir) {
    const agents = fs.readdirSync(dir);
    const agentsData = {};
    const agentSettings = {};
    for (const agent of agents) {
      const agentData = fs.readFileSync(path.join(dir, agent), "utf8");
      let jsonData;
      try {
        jsonData = JSON.parse(agentData);
        if (!jsonData.id) {
          console.warn(`Agent data for ${agent} does not contain an id, generating one...`);
          jsonData.id = "tmp-" + uid();
        }
      } catch (e) {
        console.warn(`Error parsing agent data for ${agent}: ${e.message}`);
      }
      if (jsonData.components) agentsData[jsonData.id] = jsonData;
      if (jsonData.settings) agentSettings[jsonData.id] = jsonData.settings;
    }
    return { agentsData, agentSettings };
  }
  indexAgentsData() {
    const { agentsData: devAgentsData, agentSettings: devAgentSettings } = this.indexDir(this.devDir);
    const { agentsData: prodAgentsData, agentSettings: prodAgentSettings } = this.indexDir(this.prodDir);
    this.agentsData = { dev: devAgentsData, prod: prodAgentsData };
    this.agentSettings = { dev: devAgentSettings, prod: prodAgentSettings };
  }
  async start() {
    super.start();
    this.started = false;
    this.indexAgentsData();
    this.started = true;
  }
  /**
   * returns the agent data for the provided agent ID
   * if the version is not provided, it defaults to the dev version
   * otherwise it loads the corresponding prod version
   * @param agentId
   * @param version
   * @returns
   */
  async getAgentData(agentId, version) {
    const ready = await this.ready();
    if (!ready) {
      throw new Error("Connector not ready");
    }
    const data = version ? this.agentsData.prod[agentId] : this.agentsData.dev[agentId];
    if (data) {
      return { data, version: version || "1.0" };
    } else {
      throw new Error(`Agent with id ${agentId} not found`);
    }
  }
  getAgentIdByDomain(domain) {
    return Promise.resolve("");
  }
  /**
   * returns the agent settings for the provided agent ID
   * if the version is not provided, it defaults to the dev version
   * otherwise it loads the corresponding prod version
   * @param agentId
   * @param version
   * @returns
   */
  async getAgentSettings(agentId, version) {
    const ready = await this.ready();
    if (!ready) {
      throw new Error("Connector not ready");
    }
    const settings = version ? this.agentSettings.prod[agentId] : this.agentSettings.dev[agentId];
    if (settings) {
      return settings;
    } else {
      throw new Error(`Settings for agent with id ${agentId} not found`);
    }
  }
  async isDeployed(agentId) {
    return !!this.agentsData.prod[agentId];
  }
}

class AgentDataService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.AgentData, "AgentData", AgentDataConnector);
    ConnectorService.register(TConnectorService.AgentData, "CLI", CLIAgentDataConnector);
    ConnectorService.register(TConnectorService.AgentData, "Local", LocalAgentDataConnector);
  }
}

var __defProp$2 = Object.defineProperty;
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __defNormalProp$2 = (obj, key, value) => key in obj ? __defProp$2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __decorateClass$1 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$1(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$2(target, key, result);
  return result;
};
var __publicField$2 = (obj, key, value) => __defNormalProp$2(obj, typeof key !== "symbol" ? key + "" : key, value);
const console$2 = Logger("Pinecone VectorDB");
class PineconeVectorDB extends VectorDBConnector {
  constructor(config) {
    super();
    this.config = config;
    __publicField$2(this, "name", "PineconeVectorDB");
    __publicField$2(this, "_client");
    __publicField$2(this, "indexName");
    __publicField$2(this, "nkv");
    __publicField$2(this, "redisCache");
    __publicField$2(this, "accountConnector");
    if (!SmythRuntime.Instance) throw new Error("SRE not initialized");
    if (!config.pineconeApiKey) throw new Error("Pinecone API key is required");
    if (!config.indexName) throw new Error("Pinecone index name is required");
    this._client = new Pinecone({
      apiKey: config.pineconeApiKey
    });
    console$2.info("Pinecone client initialized");
    console$2.info("Pinecone index name:", config.indexName);
    this.indexName = config.indexName;
    this.nkv = ConnectorService.getNKVConnector();
    this.accountConnector = ConnectorService.getAccountConnector();
    this.redisCache = ConnectorService.getCacheConnector("Redis");
  }
  get client() {
    return this._client;
  }
  async getResourceACL(resourceId, candidate) {
    const teamId = await this.accountConnector.getCandidateTeam(AccessCandidate.clone(candidate));
    const preparedNs = VectorDBConnector.constructNsName(teamId, resourceId);
    const acl = await this.getACL(AccessCandidate.clone(candidate), preparedNs);
    const exists = !!acl;
    if (!exists) {
      return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }
    return ACL.from(acl);
  }
  user(candidate) {
    return {
      search: async (namespace, query, options) => {
        return await this.search(candidate.readRequest, namespace, query, this.indexName, options);
      },
      insert: async (namespace, source) => {
        return this.insert(candidate.writeRequest, namespace, source, this.indexName);
      },
      delete: async (namespace, id) => {
        await this.delete(candidate.writeRequest, namespace, id, this.indexName);
      },
      createNamespace: async (namespace) => {
        await this.createNamespace(candidate.writeRequest, namespace, this.indexName);
      },
      deleteNamespace: async (namespace) => {
        await this.deleteNamespace(candidate.writeRequest, namespace, this.indexName);
      },
      listNamespaces: async () => {
        return await this.listNamespaces(candidate.readRequest);
      },
      namespaceExists: async (namespace) => {
        return await this.namespaceExists(candidate.readRequest, namespace);
      }
    };
  }
  async createNamespace(acRequest, namespace, indexName) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
    const candidate = AccessCandidate.clone(acRequest.candidate);
    const nsExists = await this.nkv.user(candidate).exists("vectorDB:pinecone", `namespace:${preparedNs}`);
    if (!nsExists) {
      const nsData = {
        namespace: preparedNs,
        displayName: namespace,
        indexName,
        teamId
      };
      await this.nkv.user(candidate).set("vectorDB:pinecone:namespaces", preparedNs, JSON.stringify(nsData));
    }
    const acl = new ACL().addAccess(acRequest.candidate.role, acRequest.candidate.id, TAccessLevel.Owner).ACL;
    await this.setACL(acRequest, preparedNs, acl);
    return new Promise((resolve) => resolve());
  }
  async namespaceExists(acRequest, namespace) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    return await this.nkv.user(AccessCandidate.clone(acRequest.candidate)).exists("vectorDB:pinecone:namespaces", VectorDBConnector.constructNsName(teamId, namespace));
  }
  async listNamespaces(acRequest) {
    const candidate = AccessCandidate.clone(acRequest.candidate);
    const nsKeys = await this.nkv.user(candidate).list("vectorDB:pinecone:namespaces");
    return nsKeys.map((k) => {
      const nsData = JSONContentHelper.create(k.data?.toString()).tryParse();
      return nsData?.displayName;
    });
  }
  async deleteNamespace(acRequest, namespace, indexName) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    await this._client.Index(indexName).namespace(VectorDBConnector.constructNsName(teamId, namespace)).deleteAll().catch((e) => {
      if (e?.name == "PineconeNotFoundError") {
        console$2.warn(`Namespace ${namespace} does not exist and was requested to be deleted`);
        return;
      }
      throw e;
    });
    const candidate = AccessCandidate.clone(acRequest.candidate);
    const preparedNs = VectorDBConnector.constructNsName(teamId, namespace);
    await this.nkv.user(candidate).delete("vectorDB:pinecone:namespaces", preparedNs);
    await this.deleteACL(AccessCandidate.clone(acRequest.candidate), namespace);
  }
  async search(acRequest, namespace, query, indexName, options = {}) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    const nsExists = await this.nkv.user(AccessCandidate.clone(acRequest.candidate)).exists("vectorDB:pinecone:namespaces", VectorDBConnector.constructNsName(teamId, namespace));
    if (!nsExists) {
      throw new Error("Namespace does not exist");
    }
    const pineconeIndex = this.client.Index(indexName).namespace(VectorDBConnector.constructNsName(teamId, namespace));
    let _vector = query;
    if (typeof query === "string") {
      _vector = await VectorsHelper.load().embedText(query);
    }
    const results = await pineconeIndex.query({
      topK: options?.topK || 10,
      vector: _vector,
      includeMetadata: true,
      includeValues: true
    });
    return results.matches.map((match) => ({
      id: match.id,
      values: match.values,
      metadata: match.metadata
    }));
  }
  async insert(acRequest, namespace, sourceWrapper, indexName) {
    sourceWrapper = Array.isArray(sourceWrapper) ? sourceWrapper : [sourceWrapper];
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    const nsExists = await this.nkv.user(AccessCandidate.clone(acRequest.candidate)).exists("vectorDB:pinecone:namespaces", VectorDBConnector.constructNsName(teamId, namespace));
    if (!nsExists) {
      throw new Error("Namespace does not exist");
    }
    if (sourceWrapper.some((s) => this.detectSourceType(s.source) !== this.detectSourceType(sourceWrapper[0].source))) {
      throw new Error("All sources must be of the same type");
    }
    const sourceType = this.detectSourceType(sourceWrapper[0].source);
    if (sourceType === "unknown" || sourceType === "url") throw new Error("Invalid source type");
    const transformedSource = await this.transformSource(sourceWrapper, sourceType);
    const preparedSource = transformedSource.map((s) => ({
      id: s.id,
      values: s.source,
      metadata: s.metadata
    }));
    await this._client.Index(indexName).namespace(VectorDBConnector.constructNsName(teamId, namespace)).upsert(preparedSource);
    const accessCandidate = acRequest.candidate;
    const isNewNs = await this.isNewNs(AccessCandidate.clone(accessCandidate), namespace);
    if (isNewNs) {
      let acl = new ACL().addAccess(accessCandidate.role, accessCandidate.id, TAccessLevel.Owner).ACL;
      await this.setACL(acRequest, namespace, acl);
    }
    return preparedSource.map((s) => s.id);
  }
  async delete(acRequest, namespace, id, indexName) {
    const _ids = Array.isArray(id) ? id : [id];
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    const nsExists = await this.nkv.user(AccessCandidate.clone(acRequest.candidate)).exists("vectorDB:pinecone:namespaces", VectorDBConnector.constructNsName(teamId, namespace));
    if (!nsExists) {
      throw new Error("Namespace does not exist");
    }
    await this._client.Index(indexName).namespace(VectorDBConnector.constructNsName(teamId, namespace)).deleteMany(_ids);
  }
  detectSourceType(source) {
    if (typeof source === "string") {
      return isUrl(source) ? "url" : "text";
    } else if (Array.isArray(source) && source.every((v) => typeof v === "number")) {
      return "vector";
    } else {
      return "unknown";
    }
  }
  transformSource(source, sourceType) {
    switch (sourceType) {
      case "text": {
        const texts = source.map((s) => s.source);
        return VectorsHelper.load().embedTexts(texts).then((vectors) => {
          return source.map((s, i) => ({
            ...s,
            source: vectors[i],
            metadata: { ...s.metadata, text: texts[i] }
          }));
        });
      }
      case "vector": {
        return source;
      }
    }
  }
  async setACL(acRequest, namespace, acl) {
    await this.redisCache.user(AccessCandidate.clone(acRequest.candidate)).set(`vectorDB:pinecone:namespace:${namespace}:acl`, JSON.stringify(acl));
  }
  async getACL(ac, namespace) {
    let aclRes = await this.redisCache.user(ac).get(`vectorDB:pinecone:namespace:${namespace}:acl`);
    const acl = JSONContentHelper.create(aclRes?.toString?.()).tryParse();
    return acl;
  }
  async deleteACL(ac, namespace) {
    this.redisCache.user(AccessCandidate.clone(ac)).delete(`vectorDB:pinecone:namespace:${namespace}:acl`);
  }
  async isNewNs(ac, namespace) {
    return !await this.nkv.user(AccessCandidate.clone(ac)).exists("vectorDB:pinecone", `namespace:${namespace}:acl`);
  }
}
__decorateClass$1([
  SecureConnector.AccessControl
], PineconeVectorDB.prototype, "createNamespace", 1);
__decorateClass$1([
  SecureConnector.AccessControl
], PineconeVectorDB.prototype, "namespaceExists", 1);
__decorateClass$1([
  SecureConnector.AccessControl
], PineconeVectorDB.prototype, "listNamespaces", 1);
__decorateClass$1([
  SecureConnector.AccessControl
], PineconeVectorDB.prototype, "deleteNamespace", 1);
__decorateClass$1([
  SecureConnector.AccessControl
], PineconeVectorDB.prototype, "search", 1);
__decorateClass$1([
  SecureConnector.AccessControl
], PineconeVectorDB.prototype, "insert", 1);
__decorateClass$1([
  SecureConnector.AccessControl
], PineconeVectorDB.prototype, "delete", 1);

class VectorDBService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.VectorDB, "Pinecone", PineconeVectorDB);
  }
}

var __defProp$1 = Object.defineProperty;
var __defNormalProp$1 = (obj, key, value) => key in obj ? __defProp$1(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField$1 = (obj, key, value) => __defNormalProp$1(obj, typeof key !== "symbol" ? key + "" : key, value);
class CLIConnector extends Connector {
  constructor() {
    super();
    __publicField$1(this, "name", "CLI");
    __publicField$1(this, "params");
    this.params = this.parse(process.argv);
  }
  /**
   * Parses the command line arguments, and returns the parsed arguments object
   * if args is provided, it will only parse the provided args
   * @param argv The command line arguments, usually process.argv
   * @param args The arguments to parse
   * @returns
   */
  parse(argv, args) {
    let _keys = args;
    if (_keys && !Array.isArray(_keys)) _keys = [_keys];
    const argsList = _keys || getMainArgs(argv);
    const params = parseCLIArgs(argsList, argv);
    return params;
  }
  /**
   * Get the parsed arguments as an object
   * @param args The arguments to get
   * @returns
   */
  get(args) {
    let _keys = args;
    if (!Array.isArray(_keys)) _keys = [_keys];
    const result = {};
    _keys.forEach((key) => {
      if (this.params[key]) {
        result[key] = this.params[key];
      }
    });
    return result;
  }
}

class CLIService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.CLI, "CLI", CLIConnector);
  }
}

class NKVConnector extends SecureConnector {
  user(candidate) {
    return {
      get: async (namespace, key) => this.get(candidate.readRequest, namespace, key),
      set: async (namespace, key, value) => this.set(candidate.writeRequest, namespace, key, value),
      delete: async (namespace, key) => this.delete(candidate.writeRequest, namespace, key),
      exists: async (namespace, key) => this.exists(candidate.readRequest, namespace, key),
      deleteAll: async (namespace) => this.deleteAll(candidate.writeRequest, namespace),
      list: async (namespace) => this.list(candidate.readRequest, namespace)
    };
  }
}

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const _NKVRedis = class _NKVRedis extends NKVConnector {
  constructor() {
    super();
    __publicField(this, "name", "Redis");
    __publicField(this, "redisCacheConnector");
    __publicField(this, "accountConnector");
    this.redisCacheConnector = ConnectorService.getCacheConnector("Redis");
    this.accountConnector = ConnectorService.getAccountConnector();
  }
  key(...parts) {
    return parts.join(":");
  }
  mdKey(...parts) {
    return parts.join(":");
  }
  async get(acRequest, namespace, key) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    return await this.redisCacheConnector.user(AccessCandidate.team(teamId)).get(this.key(`team_${teamId}`, namespace, key));
  }
  async set(acRequest, namespace, key, value) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    const setKey = this.key(`team_${teamId}`, namespace, key);
    await this.redisCacheConnector.user(AccessCandidate.team(teamId)).set(setKey, value);
    const isNewNs = !await this.redisCacheConnector.user(AccessCandidate.team(teamId)).exists(namespace);
    if (isNewNs) {
      await this.redisCacheConnector.user(AccessCandidate.team(teamId)).set(this.key(`team_${teamId}`, namespace), "", void 0, { ns: true });
    }
  }
  async delete(acRequest, namespace, key) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    await this.redisCacheConnector.user(AccessCandidate.team(teamId)).delete(this.key(`team_${teamId}`, namespace, key));
  }
  async exists(acRequest, namespace, key) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    return await this.redisCacheConnector.user(AccessCandidate.team(teamId)).exists(this.key(`team_${teamId}`, namespace, key));
  }
  async list(acRequest, namespace) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    let keys = await this.fetchKeysByPrefix(this.key(this.redisCacheConnector.prefix, `team_${teamId}`, namespace));
    keys = keys.filter(
      (key) => key !== this.key(this.redisCacheConnector.prefix, `team_${teamId}`, namespace)
      // if not the namespace sentinel key
    );
    if (keys.length <= 0) return [];
    const pipeline = this.redisCacheConnector.client.pipeline();
    keys.forEach((key) => {
      pipeline.get(key);
    });
    const results = await pipeline.exec();
    return keys.map((key, index) => {
      return {
        key: key.replace(`${this.key(this.redisCacheConnector.prefix, `team_${teamId}`, namespace)}:`, ""),
        data: results[index][1]
      };
    });
  }
  async deleteAll(acRequest, namespace) {
    const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
    let keys = await this.fetchKeysByPrefix(this.key(this.redisCacheConnector.prefix, `team_${teamId}`, namespace));
    keys = keys.filter((key) => {
      return ![this.key(this.redisCacheConnector.prefix, `team_${teamId}`, namespace)].includes(key);
    });
    await this.redisCacheConnector.client.del(keys);
  }
  async getResourceACL(resourceId, candidate) {
    return this.redisCacheConnector.getResourceACL(resourceId, candidate);
  }
  async fetchKeysByPrefix(prefix) {
    let cursor = "0";
    const keys = [];
    do {
      const result = await this.redisCacheConnector.client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 1e4);
      cursor = result[0];
      keys.push(...result[1]);
    } while (cursor !== "0");
    return keys;
  }
  static NamespaceAccessControl(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args) {
      let [acRequest, namespace, key] = args;
      const isNamespaceSearch = key === void 0;
      const teamId = await this.accountConnector.getCandidateTeam(acRequest.candidate);
      const resourceId = isNamespaceSearch ? namespace : `${namespace}:${key}`;
      const finalKey = this.key(this.redisCacheConnector.prefix, `team_${teamId}`, resourceId);
      const accessTicket = await this.getAccessTicket(finalKey, acRequest);
      if (accessTicket.access !== TAccessResult.Granted) throw new ACLAccessDeniedError("Access Denied");
      return originalMethod.apply(this, args);
    };
    return descriptor;
  }
  static Validate(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function(...args) {
      let [acRequest, namespace, key] = args;
      const schemaValidator = Joi.object().keys({
        namespace: Joi.string().min(1).required(),
        key: Joi.string().min(1).required()
      });
      const validationResult = schemaValidator.validate({ namespace, key });
      if (validationResult.error) {
        throw new Error(`Validation Error: ${validationResult.error.message}`);
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  }
};
__decorateClass([
  _NKVRedis.Validate,
  _NKVRedis.NamespaceAccessControl
], _NKVRedis.prototype, "get", 1);
__decorateClass([
  _NKVRedis.Validate,
  _NKVRedis.NamespaceAccessControl
], _NKVRedis.prototype, "set", 1);
__decorateClass([
  _NKVRedis.Validate,
  _NKVRedis.NamespaceAccessControl
], _NKVRedis.prototype, "delete", 1);
__decorateClass([
  _NKVRedis.Validate,
  _NKVRedis.NamespaceAccessControl
], _NKVRedis.prototype, "exists", 1);
__decorateClass([
  _NKVRedis.NamespaceAccessControl
], _NKVRedis.prototype, "list", 1);
__decorateClass([
  _NKVRedis.NamespaceAccessControl
], _NKVRedis.prototype, "deleteAll", 1);
let NKVRedis = _NKVRedis;

class NKVService extends ConnectorServiceProvider {
  register() {
    ConnectorService.register(TConnectorService.NKV, "Redis", NKVRedis);
  }
}

const console$1 = Logger("Boot");
function boot() {
  console$1.debug("SRE Boot sequence started");
  const service = {};
  service.NKV = new NKVService();
  service.Account = new AccountService();
  service.Storage = new StorageService();
  service.Cache = new CacheService();
  service.LLM = new LLMService();
  service.Vault = new VaultService();
  service.AgentData = new AgentDataService();
  service.CLI = new CLIService();
  service.VectorDB = new VectorDBService();
  SystemEvents.on("SRE:Initialized", () => {
    console$1.debug("SRE Initialized");
    for (let key in service) {
      service[key].init();
    }
    SystemEvents.emit("SRE:Booted", service);
    console$1.debug("SRE Boot sequence completed");
  });
}

boot();

export { Agent, AgentProcess, AgentRequest, AgentSettings, CLIAgentDataConnector, ConnectorService, Conversation, SmythRuntime, config };
//# sourceMappingURL=index.dev.js.map
