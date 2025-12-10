import { Logger } from '@sre/helpers/Log.helper';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate } from '@sre/types/ACL.types';
import { TelemetryConnector } from '../../TelemetryConnector';
import { AgentCallLog } from '@sre/types/AgentLogger.types';

import { trace, context, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { Logger as OTelLogger, logs, SeverityNumber } from '@opentelemetry/api-logs';
import { OTelContextRegistry } from './OTelContextRegistry';
import { HookService, THook } from '@sre/Core/HookService';

// OpenTelemetry SDK and Exporters
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { LoggerProvider, SimpleLogRecordProcessor, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { IAgent } from '@sre/types/Agent.types';
import { Conversation } from '@sre/helpers/Conversation.helper';
import { TLLMEvent } from '@sre/types/LLM.types';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

const outputLogger = Logger('OTel');

export type OTelLogConfig = {
    endpoint: string;
    headers: Record<string, string>;
    serviceName?: string;
    serviceVersion?: string;
    /**
     * Maximum size (in bytes) for full output in logs.
     * Outputs larger than this will be truncated with a note.
     * Default: 256KB (262144 bytes) - Safe for all backends (Loki, Elasticsearch, etc.)
     *
     * Common values:
     * - 256KB (262144) - Recommended, works with all backends
     * - 512KB (524288) - Works with most backends
     * - 1MB (1048576) - Only for backends that support it (CloudWatch, Datadog)
     */
    maxOutputSize?: number;
    /**
     * Only log full output on errors. Success cases will only log size/preview.
     * Default: false (log full output for both success and errors)
     */
    fullOutputOnErrorOnly?: boolean;
    /**
     * Fields to redact from outputs (e.g., ['password', 'token', 'apiKey'])
     * These will be replaced with '[REDACTED]' in logs
     */
    redactFields?: string[];
};
const OTEL_DEBUG_LOGS = true;
export class OTel extends TelemetryConnector {
    public name: string = 'OTel';
    public id: string;
    private tracer: Tracer;
    private logger: OTelLogger;
    private tracerProvider: NodeTracerProvider;
    private loggerProvider: LoggerProvider;

    constructor(protected _settings: OTelLogConfig) {
        super();
        if (!_settings.endpoint) {
            outputLogger.warn('OTel initialization skipped, endpoint is not set');
            return;
        }

        outputLogger.log(`Initializing Tracer ...`);

        // Initialize Trace Exporter and Provider
        const traceExporter = new OTLPTraceExporter({
            url: `${_settings.endpoint}/v1/traces`,
            headers: _settings.headers,
        });

        const spanProcessor = new BatchSpanProcessor(traceExporter);

        // Create resource with service information
        const resource = resourceFromAttributes({
            [ATTR_SERVICE_NAME]: _settings.serviceName || 'smythos',
            [ATTR_SERVICE_VERSION]: _settings.serviceVersion || '1.0.0',
        });

        // TypeScript definitions are incomplete, but this works at runtime
        this.tracerProvider = new NodeTracerProvider({
            resource,
            spanProcessors: [spanProcessor],
        } as any);

        this.tracerProvider.register();

        outputLogger.log(`Initializing Log Exporter ...`);
        // Initialize Log Exporter and Provider
        const logExporter = new OTLPLogExporter({
            url: `${_settings.endpoint}/v1/logs`,
            headers: _settings.headers,
        });

        //const logProcessor = new SimpleLogRecordProcessor(logExporter as any);
        const logProcessor = new BatchLogRecordProcessor(logExporter as any);

        // TypeScript definitions are incomplete, but this works at runtime
        this.loggerProvider = new LoggerProvider({
            resource,
            processors: [logProcessor],
        } as any);

        logs.setGlobalLoggerProvider(this.loggerProvider);

        // Now get tracer and logger from the initialized providers
        this.tracer = trace.getTracer('smythos.agent');
        this.logger = logs.getLogger('smythos.agent');

        this.id = `otel-${_settings.endpoint}`;
        this.setupHooks();
    }

    /**
     * Cleanup and shutdown exporters
     */
    public async stop(): Promise<void> {
        outputLogger.log(`Stopping ${this.name} connector ...`);
        // TypeScript definitions are incomplete for these methods
        await (this.tracerProvider as any).forceFlush?.().catch((error) => {
            outputLogger.error('Error forcing flush of tracer provider', error);
        });
        await (this.tracerProvider as any).shutdown?.().catch((error) => {
            outputLogger.error('Error shutting down tracer provider', error);
        });
        await this.loggerProvider.forceFlush().catch((error) => {
            outputLogger.error('Error forcing flush of logger provider', error);
        });
        await this.loggerProvider.shutdown().catch((error) => {
            outputLogger.error('Error shutting down logger provider', error);
        });
    }

    /**
     * Redact sensitive fields from an object
     */
    private redactSensitiveData(data: any, redactFields?: string[]): any {
        if (!redactFields || redactFields.length === 0) return data;
        if (typeof data !== 'object' || data === null) return data;

        const redacted = Array.isArray(data) ? [...data] : { ...data };

        for (const key in redacted) {
            if (redactFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
                redacted[key] = '[REDACTED]';
            } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
                redacted[key] = this.redactSensitiveData(redacted[key], redactFields);
            }
        }

        return redacted;
    }

    /**
     * Safely format output for logging with size limits and redaction
     */
    private formatOutputForLog(output: any, isError: boolean = false): string | undefined {
        const config = this._settings;
        const maxSize = config.maxOutputSize ?? 10 * 1024; // Default 10KB - safe for all backends
        const errorOnly = config.fullOutputOnErrorOnly ?? false;

        // If error-only mode and this is success, return undefined
        if (errorOnly && !isError) {
            return undefined;
        }

        // Redact sensitive fields
        const redacted = this.redactSensitiveData(output, config.redactFields);

        // Stringify
        const outputStr = JSON.stringify(redacted);

        // Check size limit
        if (outputStr && outputStr.length > maxSize) {
            const preview = outputStr.substring(0, maxSize);
            return `${preview}...[TRUNCATED: ${outputStr.length} bytes, limit: ${maxSize} bytes]`;
        }

        return outputStr;
    }
    public getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        return Promise.resolve(new ACL());
    }
    protected log(acRequest: AccessRequest, logData: AgentCallLog, callId?: string): Promise<any> {
        return Promise.resolve();
    }
    protected logTask(acRequest: AccessRequest, tasks: number, isUsingTestDomain: boolean): Promise<void> {
        return Promise.resolve();
    }

    private prepareComponentData(data, prefix?: string, maxEntryLength = 200) {
        const result = {};

        for (let key in data) {
            result[prefix ? `${prefix}.${key}` : key] = (typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key].toString()).substring(
                0,
                maxEntryLength
            );
        }

        return result;
    }
    protected setupHooks(): Promise<void> {
        const tracer = this.tracer;
        const logger = this.logger;
        const oTelInstance = this;

        const createToolInfoHandler = function (hookContext) {
            return function (toolInfo: any) {
                const accessCandidate = AccessCandidate.agent(hookContext?.agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('createToolInfoHandler started', accessCandidate);
                if (!hookContext.curLLMGenSpan || !hookContext.convSpan) return;

                const modelId = toolInfo.model;
                const contextWindow = toolInfo.contextWindow;
                const lastContext = contextWindow.filter((context) => context.role === 'user').slice(-2);

                const toolNames = toolInfo.map((tool) => tool.name + '(' + tool.arguments + ')');
                hookContext.curLLMGenSpan.addEvent('llm.gen.tool.calls', {
                    'tool.calls': toolNames.join(', '),
                    'llm.model': modelId || 'unknown',
                    'context.preview': JSON.stringify(lastContext).substring(0, 200),
                });

                const spanContext = trace.setSpan(context.active(), hookContext.curLLMGenSpan);
                context.with(spanContext, () => {
                    logger.emit({
                        severityNumber: SeverityNumber.INFO,
                        severityText: 'INFO',
                        body: `LLM tool calls: ${toolNames.join(', ')}`,
                        attributes: {
                            'agent.id': hookContext.agentId,
                            'conv.id': hookContext.processId,
                            'llm.model': modelId || 'unknown',
                            'context.preview': JSON.stringify(lastContext).substring(0, 5000),
                        },
                    });
                });

                hookContext.curLLMGenSpan.end();
                delete hookContext.curLLMGenSpan;
                if (OTEL_DEBUG_LOGS) outputLogger.debug('createToolInfoHandler completed', accessCandidate);
            };
        };

        const createDataHandler = function (hookContext) {
            return function (data: any, reqInfo: any) {
                if (!hookContext.convSpan) return;
                if (hookContext.curLLMGenSpan) return;
                const accessCandidate = AccessCandidate.agent(hookContext?.agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('createDataHandler started', reqInfo?.requestId, accessCandidate);

                const modelId = reqInfo.model;
                const contextWindow = reqInfo.contextWindow;

                const lastContext = contextWindow.filter((context) => context.role === 'user').slice(-2);
                // End TTFB span when first data arrives
                if (hookContext?.latencySpans?.[reqInfo.requestId]) {
                    const ttfbSpan = hookContext.latencySpans[reqInfo.requestId];

                    // Calculate actual TTFB duration and add as attribute
                    ttfbSpan.addEvent('llm.first.byte.received', {
                        'request.id': reqInfo.requestId,
                        'data.size': JSON.stringify(data || {}).length,
                        'llm.model': modelId || 'unknown',
                    });

                    ttfbSpan.setStatus({ code: SpanStatusCode.OK });
                    ttfbSpan.end();

                    delete hookContext.latencySpans[reqInfo.requestId];
                }

                const llmGenSpan = tracer.startSpan(
                    'Conv.GenAI',
                    {
                        attributes: {
                            'agent.id': hookContext.agentId,
                            'conv.id': hookContext.processId,
                            'llm.model': modelId || 'unknown',
                        },
                    },
                    trace.setSpan(context.active(), hookContext.convSpan)
                );
                llmGenSpan.addEvent('llm.gen.started', {
                    'request.id': reqInfo.requestId,
                    timestamp: Date.now(),
                    'llm.model': modelId || 'unknown',
                    'context.preview': JSON.stringify(lastContext).substring(0, 200),
                });
                hookContext.curLLMGenSpan = llmGenSpan;
                if (OTEL_DEBUG_LOGS) outputLogger.debug('createDataHandler completed', reqInfo?.requestId, accessCandidate);
            };
        };

        const createRequestedHandler = function (hookContext) {
            return function (reqInfo: any) {
                if (!hookContext.convSpan) return;
                const accessCandidate = AccessCandidate.agent(hookContext?.agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('createRequestedHandler started', reqInfo?.requestId, accessCandidate);
                if (!hookContext.latencySpans) hookContext.latencySpans = {};
                const contextWindow = reqInfo.contextWindow;

                const lastContext = contextWindow.filter((context) => context.role === 'user').slice(-2);

                const modelId = reqInfo.model;
                const llmGenLatencySpan = tracer.startSpan(
                    'Conv.GenAI.TTFB',
                    {
                        attributes: {
                            'agent.id': hookContext.agentId,
                            'conv.id': hookContext.processId,
                            'request.id': reqInfo.requestId,
                            'llm.model': modelId || 'unknown',
                            'metric.type': 'ttfb',
                        },
                    },
                    trace.setSpan(context.active(), hookContext.convSpan)
                );
                llmGenLatencySpan.addEvent('llm.requested', {
                    'request.id': reqInfo.requestId,
                    timestamp: Date.now(),
                    'context.preview': JSON.stringify(lastContext).substring(0, 200),
                });
                hookContext.latencySpans[reqInfo.requestId] = llmGenLatencySpan;
                if (OTEL_DEBUG_LOGS) outputLogger.debug('createRequestedHandler completed', reqInfo?.requestId, accessCandidate);
            };
        };
        HookService.register(
            'Conversation.streamPrompt',
            async function (additionalContext, args) {
                const conversation: Conversation = this.instance;
                const processId = conversation.id;
                const agentId = conversation.agentId;
                const message = typeof args === 'object' ? args?.message : args || null;
                const hookContext: any = this.context;
                if (message == null) {
                    //this is a conversation step, will be handled by createRequestedHandler

                    return;
                }
                const accessCandidate = AccessCandidate.agent(agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('Conversation.streamPrompt started', { processId, message }, accessCandidate);

                const modelId = typeof conversation?.model === 'string' ? conversation?.model : conversation?.model?.modelId;

                const convSpan = tracer.startSpan('Agent.Conv', {
                    attributes: {
                        // OTel standard attributes
                        'gen_ai.operation.name': 'chat',
                        'gen_ai.provider.name': conversation?.llmInference?.llmProviderName || 'unknown',
                        'gen_ai.conversation.id': processId,
                        'gen_ai.request.model': modelId || 'unknown',
                        ////////////////////////////////
                        'agent.id': agentId,
                        'conv.id': processId,
                        'llm.model': modelId || 'unknown',
                    },
                });
                hookContext.convSpan = convSpan;
                hookContext.agentId = agentId;
                hookContext.processId = processId;

                hookContext.dataHandler = createDataHandler(hookContext);
                conversation.on(TLLMEvent.Data, hookContext.dataHandler);

                hookContext.requestedHandler = createRequestedHandler(hookContext);
                conversation.on(TLLMEvent.Requested, hookContext.requestedHandler);

                hookContext.toolInfoHandler = createToolInfoHandler(hookContext);
                conversation.on(TLLMEvent.ToolInfo, hookContext.toolInfoHandler);

                // Add start event

                convSpan.addEvent('skill.process.started', {
                    'input.size': JSON.stringify(message || {}).length,
                    'input.preview': message.substring(0, 200),
                    'llm.model': modelId || 'unknown',
                });

                OTelContextRegistry.startProcess(agentId, processId, convSpan);

                const spanCtx = convSpan.spanContext();
                const spanContext = trace.setSpan(context.active(), convSpan);
                context.with(spanContext, () => {
                    logger.emit({
                        severityNumber: SeverityNumber.INFO,
                        severityText: 'INFO',
                        body: `Conversation.streamPrompt started: ${processId}`,
                        attributes: {
                            // Explicit trace correlation (some backends need these)
                            trace_id: spanCtx.traceId,
                            span_id: spanCtx.spanId,
                            trace_flags: spanCtx.traceFlags,

                            'agent.id': agentId,
                            'conv.id': processId,
                            'input.size': JSON.stringify(message || {}).length,
                            'input.preview': message.substring(0, 2000),
                        },
                    });
                });
            },
            THook.NonBlocking
        );

        HookService.registerAfter(
            'Conversation.streamPrompt',
            async function ({ result, args, error }) {
                const conversation: Conversation = this.instance;
                const processId = conversation.id;
                const agentId = conversation.agentId;
                const message = typeof args?.[0] === 'object' ? args?.[0]?.message : args?.[0] || null;
                const hookContext: any = this.context;
                if (message == null) {
                    return;
                }

                const ctx = OTelContextRegistry.get(agentId, processId);
                if (!ctx) return;

                const accessCandidate = AccessCandidate.agent(agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('Conversation.streamPrompt completed', { processId }, accessCandidate);

                if (hookContext.curLLMGenSpan) {
                    hookContext.curLLMGenSpan.addEvent('llm.gen.content', {
                        'content.size': JSON.stringify(result || {}).length,
                        'content.preview': result.substring(0, 200),
                    });
                    hookContext.curLLMGenSpan.end();

                    if (hookContext.toolInfoHandler) conversation.off(TLLMEvent.ToolInfo, hookContext.toolInfoHandler);
                    if (hookContext.dataHandler) conversation.off(TLLMEvent.Data, hookContext.dataHandler);
                    if (hookContext.requestedHandler) conversation.off(TLLMEvent.Requested, hookContext.requestedHandler);
                }

                const { rootSpan: convSpan } = ctx;

                const spanCtx = convSpan.spanContext();
                const spanContext = trace.setSpan(context.active(), convSpan);
                context.with(spanContext, () => {
                    logger.emit({
                        severityNumber: SeverityNumber.INFO,
                        severityText: 'INFO',
                        body: `Conversation.streamPrompt completed: ${processId}`,
                        attributes: {
                            'agent.id': agentId,
                            'conv.id': processId,
                            'output.size': JSON.stringify(result || {}).length,
                            'output.preview': result.substring(0, 2000),
                        },
                    });
                });

                convSpan.end();

                OTelContextRegistry.endProcess(agentId, processId);
            },
            THook.NonBlocking
        );

        HookService.register(
            'SREAgent.process',
            async function (endpointPath, inputData) {
                const agent: IAgent = this.instance;
                // nested process has a subID that needs to be removed
                // a process can be nested if it was called by a parent process : e.g conversation => agent  , agent => sub-agent, agent => forked process ....etc
                const agentProcessId = agent.agentRuntime.processID;
                const conversationId = agent.conversationId || agent.agentRequest?.header('X-CONVERSATION-ID');
                const processId = agentProcessId.split(':').shift();

                const agentId = agent.id;
                const agentRequest = agent.agentRequest;
                const teamId = agent.teamId;
                const _hookContext: any = this.context;

                const accessCandidate = AccessCandidate.agent(agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('SREAgent.process started', { processId, agentProcessId, endpointPath }, accessCandidate);

                const body = oTelInstance.prepareComponentData(agentRequest.body || {});
                const query = oTelInstance.prepareComponentData(agentRequest.query || {});
                const headers = oTelInstance.prepareComponentData(agentRequest.headers || {});
                const agentInput = oTelInstance.prepareComponentData(inputData || {});

                const input = { body, query, headers, processInput: agentInput };

                let convSpan;
                const ctx = OTelContextRegistry.get(agentId, processId) || OTelContextRegistry.get(agentId, conversationId);

                if (ctx) {
                    convSpan = ctx.rootSpan;
                    _hookContext.otelSpan = convSpan;
                }
                const agentSpan = tracer.startSpan(
                    'Agent.Skill',
                    {
                        attributes: {
                            'agent.id': agentId,
                            'team.id': teamId,
                            'process.id': agentProcessId,
                        },
                    },
                    convSpan ? trace.setSpan(context.active(), convSpan) : undefined
                );

                // Add start event
                const inputPreview = JSON.stringify(input || {}).substring(0, 200);
                agentSpan.addEvent('skill.process.started', {
                    endpoint: endpointPath,
                    'input.size': JSON.stringify(input || {}).length,
                    'input.preview': inputPreview,
                });

                OTelContextRegistry.startProcess(agentId, agentProcessId, agentSpan);

                // Set active span context for log correlation
                const spanCtx = agentSpan.spanContext();
                const spanContext = trace.setSpan(context.active(), agentSpan);
                context.with(spanContext, () => {
                    logger.emit({
                        severityNumber: SeverityNumber.INFO,
                        severityText: 'INFO',
                        body: `Agent Skill process started: ${processId}`,
                        attributes: {
                            // Explicit trace correlation (some backends need these)
                            trace_id: spanCtx.traceId,
                            span_id: spanCtx.spanId,
                            trace_flags: spanCtx.traceFlags,
                            agentId,
                            processId: agentProcessId,
                            input: agentInput,
                            body,
                            query,
                            headers,
                        },
                    } as any);
                });
            },
            THook.NonBlocking
        );

        HookService.registerAfter(
            'SREAgent.process',
            async function ({ result, error }) {
                const agent = this.instance;
                const agentProcessId = agent.agentRuntime.processID; // nested process has a subID that needs to be removed
                const agentId = agent.id;
                const _hookContext: any = this.context;

                const ctx = OTelContextRegistry.get(agentId, agentProcessId);
                if (!ctx) return;
                const agentSpan = ctx.rootSpan;

                if (!agentSpan) return;

                const accessCandidate = AccessCandidate.agent(agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('SREAgent.process completed', { agentProcessId }, accessCandidate);

                if (error) {
                    agentSpan.recordException(error);
                    agentSpan.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
                    agentSpan.addEvent('skill.process.error', {
                        'error.message': error.message,
                    });
                } else {
                    agentSpan.setStatus({ code: SpanStatusCode.OK });
                    agentSpan.addEvent('skill.process.completed', {
                        'output.size': JSON.stringify(result || {}).length,
                    });
                    agentSpan.setAttributes({
                        'output.size': JSON.stringify(result || {}).length,
                    });
                }

                // Emit log BEFORE ending span to ensure context is active
                const outputForLog = oTelInstance.formatOutputForLog(result, !!error);
                const spanCtx = agentSpan.spanContext();
                const logAttributes: Record<string, any> = {
                    // Explicit trace correlation (some backends need these)
                    trace_id: spanCtx.traceId,
                    span_id: spanCtx.spanId,
                    trace_flags: spanCtx.traceFlags,
                    agentId,
                    processId: agentProcessId,
                    hasError: !!error,
                    'error.message': error?.message,
                    'error.stack': error?.stack,
                };

                // Only include output if formatOutputForLog returns a value
                if (outputForLog !== undefined) {
                    logAttributes['agent.output'] = outputForLog;
                }

                // Set active span context for log correlation
                const spanContext = trace.setSpan(context.active(), agentSpan);
                context.with(spanContext, () => {
                    logger.emit({
                        severityNumber: error ? SeverityNumber.ERROR : SeverityNumber.INFO,
                        severityText: error ? 'ERROR' : 'INFO',
                        body: `Agent process ${error ? 'failed' : 'completed'}: ${agentProcessId}`,
                        attributes: logAttributes,
                    } as any);
                });

                // End span after log is emitted
                agentSpan.end();

                OTelContextRegistry.endProcess(agentId, agentProcessId);
            },
            THook.NonBlocking
        );

        // In setupHooks() - Enhanced Component.process hook
        HookService.register(
            'Component.process',
            async function (input, settings, agent) {
                const processId = agent.agentRuntime.processID;
                const agentId = agent.id;
                const component = this.instance; // Get the actual component instance
                const componentId = settings.id || 'unknown';
                const componentType = settings.name;
                const componentName = settings.displayName || settings.name;
                const eventId = settings.eventId; // specific event id attached to this component execution
                const accessCandidate = AccessCandidate.agent(agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('Component.process started', { componentId }, accessCandidate);

                const ctx = OTelContextRegistry.get(agentId, processId);
                const parentSpan = ctx?.rootSpan;

                const compSettingsData = oTelInstance.prepareComponentData(settings?.data || {}, 'cmp.settings');
                const spanName = `Component.${componentType}`;
                const span = tracer.startSpan(
                    spanName,
                    {
                        attributes: {
                            'agent.id': agentId,
                            'process.id': processId,
                            'event.id': eventId,
                            'cmp.id': componentId,
                            'cmp.type': componentType,
                            'cmp.name': componentName,
                            ...compSettingsData,
                        },
                    },
                    parentSpan ? trace.setSpan(context.active(), parentSpan) : undefined
                );

                // Add event: Component started
                const inputStr = JSON.stringify(input || {});

                const compInputData = oTelInstance.prepareComponentData(input || {});
                span.addEvent('cmp.call', {
                    'event.id': eventId,
                    'cmp.input.size': JSON.stringify(input || {}).length,
                    'cmp.input': JSON.stringify(compInputData),
                });

                // Emit structured log with full details
                const spanContext = trace.setSpan(context.active(), span);
                context.with(spanContext, () => {
                    logger.emit({
                        severityNumber: SeverityNumber.INFO,
                        severityText: 'INFO',
                        body: `Component ${componentType} started`,
                        attributes: {
                            'agent.id': agentId,
                            'process.id': processId,
                            'event.id': eventId,
                            'cmp.id': componentId,
                            'cmp.type': componentType,
                            'cmp.name': componentName,
                            'cmp.input': input,
                        },
                    });
                });

                // Store span in hook context (isolated per component execution, concurrency-safe)
                this.context.otelSpan = span;
            },
            THook.NonBlocking
        );

        HookService.registerAfter(
            'Component.process',
            async function ({ result, error, args }) {
                // Retrieve span from hook context (concurrency-safe)
                const span = this.context.otelSpan;
                if (!span) return;

                const agent = args[2];
                const settings = args[1];
                const eventId = settings.eventId;
                const processId = agent.agentRuntime.processID;
                const agentId = agent.id;
                const component = this.instance; // Get the actual component instance
                const componentId = settings.id || 'unknown';
                const componentType = settings.name;
                const componentName = settings.displayName || settings.name;

                const accessCandidate = AccessCandidate.agent(agentId);
                if (OTEL_DEBUG_LOGS) outputLogger.debug('Component.process completed', { componentId }, accessCandidate);

                if (error) {
                    // Capture error details
                    span.recordException(error);
                    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });

                    // Add error event
                    span.addEvent('cmp.call.error', {
                        'event.id': eventId,
                        'cmp.id': componentId,
                        'cmp.type': componentType,
                        'cmp.name': componentName,
                        'error.type': error.name,
                        'error.message': error.message,
                        'error.stack': error.stack?.substring(0, 500),
                    });

                    // Emit error log
                    const spanContext = trace.setSpan(context.active(), span);
                    context.with(spanContext, () => {
                        logger.emit({
                            severityNumber: SeverityNumber.ERROR,
                            severityText: 'ERROR',
                            body: `Component ${componentType} (${componentId}) failed: ${error.message}`,
                            attributes: {
                                'agent.id': agentId,
                                'process.id': processId,
                                'event.id': eventId,
                                'cmp.id': componentId,
                                'cmp.name': componentName,
                                'cmp.type': componentType,
                                'error.type': error.name,
                                'error.message': error.message,
                                'error.stack': error.stack, // ← Full stack in logs
                            },
                        });
                    });
                } else {
                    span.setStatus({ code: SpanStatusCode.OK });

                    // Add success event with output summary
                    const resultStr = JSON.stringify(result || {});
                    span.addEvent('cmp.call.result', {
                        'output.size': resultStr.length,
                        'output.preview': resultStr.substring(0, 200),
                    });

                    // Add output attributes to span
                    span.setAttributes({
                        'output.size': JSON.stringify(result || {}).length,
                        'output.has_error': !!result?._error,
                    });

                    // Emit success log with output (formatted safely)
                    const outputForLog = oTelInstance.formatOutputForLog(result, false);
                    const logAttributes: Record<string, any> = {
                        'agent.id': agentId,
                        'cmp.id': componentId,
                        'cmp.type': componentType,
                        'cmp.name': componentName,
                        'process.id': processId,
                        'event.id': eventId,
                        'cmp.output': result,
                    };

                    // Only include output if formatOutputForLog returns a value
                    // if (outputForLog !== undefined) {
                    //     logAttributes['cmp.output'] = outputForLog;
                    // }

                    const spanContext = trace.setSpan(context.active(), span);
                    context.with(spanContext, () => {
                        logger.emit({
                            severityNumber: SeverityNumber.INFO,
                            severityText: 'INFO',
                            body: `Component ${componentType} (${componentId}) completed successfully`,
                            attributes: logAttributes,
                        });
                    });
                }

                span.end();
            },
            THook.NonBlocking
        );
        return Promise.resolve();
    }
}
