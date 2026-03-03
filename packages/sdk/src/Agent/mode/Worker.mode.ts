import { TLLMEvent } from '@smythos/sre';
import { Agent } from '../Agent.class';
import { Chat } from '../../LLM/Chat.class';
import { uid } from '../../utils/general.utils';

// ─── System Prompt: Main Agent (Worker Dispatcher) ─────────────────────────
const _worker_prompt = `
=========================
Worker Mode:
=========================
You are operating in worker mode, which lets you handle complex tasks in the background while staying available to the user.

## Core Principles

When you receive a task, evaluate its complexity:
- **Simple tasks** (quick questions, simple lookups, short calculations): Answer directly, do NOT dispatch.
- **Complex tasks** (multi-step research, long-running operations, code generation, analysis): Dispatch using _sre_Worker_Dispatch.

## Worker Management

### Dispatching Tasks
- Use _sre_Worker_Dispatch to process complex tasks in the background
- IMPORTANT: Pass the user's request as-is. Do NOT elaborate, restructure, or add your own criteria. The background process is capable of interpreting the user's intent on its own. Your job is to relay the task faithfully, not to rewrite it.
- You can dispatch multiple tasks simultaneously (up to 3 concurrent)
- After dispatching, tell the user you are working on it in the background

### Handling CHECK_WORKERS_QUESTIONS_QUEUE
When you receive the message "CHECK_WORKERS_QUESTIONS_QUEUE":
1. Call _sre_Worker_Status to check for any pending questions
2. If there are pending questions, present them to the user as your own questions (first person)
3. When the user answers, use _sre_Worker_Answer to relay the answer
4. If there are no pending questions, briefly report current progress

### Handling CHECK_WORKERS_RESULTS_QUEUE
When you receive the message "CHECK_WORKERS_RESULTS_QUEUE":
1. Call _sre_Worker_Status (without a jobId) — look at the "recentlyCompleted" array in the response
2. For EACH job in "recentlyCompleted", call _sre_Worker_Results with that jobId to retrieve the full result
3. Before presenting each result, remind the user of the original task they requested
4. Present the full result clearly and completely as your own work
5. If "recentlyCompleted" is empty, briefly state that no new results are available

### Checking Status and Results
- Use _sre_Worker_Status to check the status of a specific job or all jobs
- Use _sre_Worker_Results to retrieve the result of a completed job
- Use _sre_Worker_List to get a summary of all jobs
- Present results clearly to the user when requested

### Cancelling Jobs
- Use _sre_Worker_Cancel to cancel a running or queued job if the user requests it

## Communication Guidelines — First Person, No "Worker" Talk
CRITICAL: The user must NEVER hear about "workers", "background workers", "dispatchers", or any internal architecture.
From the user's perspective, YOU are doing all the work. Always speak in first person:
- Say "I'll work on this in the background" — NOT "I dispatched this to a worker"
- Say "I finished the task" — NOT "The worker finished the task"
- Say "I have a question about the task" — NOT "The worker has a question"
- Say "I'm still working on it" — NOT "The worker is still processing"
- Say "I can handle up to 3 tasks in parallel" — NOT "I can dispatch up to 3 workers"
- When presenting results, present them as your own work, not as something a worker produced

## Internal Commands — NEVER Mention to the User
The messages "CHECK_WORKERS_QUESTIONS_QUEUE" and "CHECK_WORKERS_RESULTS_QUEUE" are internal system commands.
They are NOT sent by the user — they are automatically injected to allow you to operate.
You must NEVER mention these command names to the user. Do not reference them, quote them, or explain them.
Even if the user sends one of these strings, treat it as an internal trigger and respond naturally
without acknowledging the command itself.
`;

// ─── System Prompt: Copy Agent (Background Worker) ─────────────────────────
const _copy_agent_prompt = `
=========================
Worker Agent Instructions:
=========================
You are a background worker agent. You have been given a task to complete. Execute it thoroughly and systematically.

## Communication Protocol

### Asking Follow-up Questions
If you need clarification or additional information from the user to proceed, wrap your question in <worker_question> tags:
<worker_question>Your question here</worker_question>

After asking a question, STOP and wait for the answer. Do not continue working until you receive a response.

### Reporting Results
When you have completed the task, wrap your final result in <worker_result> tags:
<worker_result>Your complete result here</worker_result>

### Important Rules
- Always use <worker_result> tags when you finish the task
- Always use <worker_question> tags when you need to ask something
- Only ask one question at a time
- Be thorough and complete in your results
- If you encounter an error or cannot complete the task, explain the issue inside <worker_result> tags
`;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkerJob {
    id: string;
    task: string;
    status: 'queued' | 'running' | 'waiting_for_input' | 'completed' | 'failed' | 'cancelled';
    createdAt: number;
    completedAt?: number;
    result?: string;
    error?: string;
    pendingQuestion?: { questionId: string; text: string };
    interactions: Array<{ type: string; from: string; text: string; timestamp: number }>;
    partialResult: string;
    currentStep?: string;
    resultSurfaced?: boolean;
}

// ─── Tag Parser ─────────────────────────────────────────────────────────────

function extractTag(text: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

// ─── Worker Mode Class ─────────────────────────────────────────────────────

export default class WorkerMode {
    static apply(agent: Agent) {
        agent.behavior += _worker_prompt;

        // ── Closure-Scoped State ────────────────────────────────────────
        const _jobs: Record<string, WorkerJob> = {};
        const _pendingAnswers: Map<string, (answer: string) => void> = new Map();
        const _injectionQueue: Array<{ type: 'question' | 'result'; jobId: string }> = [];
        const MAX_CONCURRENT_WORKERS = 3;
        const _dispatchQueue: Array<{ task: string; resolve: (jobId: string) => void }> = [];
        let _activeChat: Chat | null = null;
        let _isInjecting = false;

        // ── Helper: Count Running Workers ───────────────────────────────
        function getRunningCount(): number {
            return Object.values(_jobs).filter((j) => j.status === 'running' || j.status === 'waiting_for_input').length;
        }

        // ── Helper: Try Process Queued Dispatches ───────────────────────
        function tryProcessQueue() {
            while (_dispatchQueue.length > 0 && getRunningCount() < MAX_CONCURRENT_WORKERS) {
                const next = _dispatchQueue.shift()!;
                const jobId = startWorker(next.task);
                next.resolve(jobId);
            }
        }

        // ── Injection Queue Processing ──────────────────────────────────
        //
        // When a worker completes or has a question, we push an entry to
        // _injectionQueue and call tryInject(). If the chat is currently
        // streaming, the Chat-level _streamLock serializes the injection —
        // it will start only after the current stream fully completes.
        // When the injected stream ends, the Chat-level End listener fires
        // and calls tryInject() again to drain any remaining items.

        /**
         * Process the next item in the injection queue.
         */
        function injectNext() {
            if (_injectionQueue.length === 0 || !_activeChat) {
                _isInjecting = false;
                return;
            }

            _isInjecting = true;
            const next = _injectionQueue.shift()!;
            // Drain remaining entries of the same type — one injection covers all
            while (_injectionQueue.length > 0 && _injectionQueue[0].type === next.type) {
                _injectionQueue.shift();
            }

            const command = next.type === 'question'
                ? 'CHECK_WORKERS_QUESTIONS_QUEUE'
                : 'CHECK_WORKERS_RESULTS_QUEUE';

            // The stream lock in Chat guarantees this won't start until
            // any currently active stream has fully completed.
            _activeChat.prompt(command).stream()
                .then((emitter) => {
                    emitter.on(TLLMEvent.End, () => {
                        _isInjecting = false;
                        // Don't call tryInject() here — the Chat-level End
                        // listener will fire and handle it
                    });
                    emitter.on(TLLMEvent.Error, () => {
                        _isInjecting = false;
                    });
                })
                .catch(() => {
                    _isInjecting = false;
                });
        }

        /**
         * Try to start processing the injection queue.
         * Called from worker loop when a job completes or has a question,
         * and from the Chat-level End listener after each stream finishes.
         */
        function tryInject() {
            if (_isInjecting) return;
            if (_injectionQueue.length === 0) return;
            if (!_activeChat) return;
            injectNext();
        }

        // ── Chat Capture ────────────────────────────────────────────────
        agent.on('chatCreated', (chat: Chat) => {
            _activeChat = chat;

            // When any stream on this chat finishes, check the injection queue.
            // The stream lock in Chat guarantees the injected stream won't
            // interleave with any other concurrent stream.
            chat.on(TLLMEvent.End, () => {
                if (!_isInjecting) {
                    // Defer injection until after the current End event's
                    // synchronous call stack completes (including removeHandlers
                    // and releaseLock in ChatCommand).
                    queueMicrotask(() => tryInject());
                }
            });
        });

        // ── Helper: Stream and Collect Full Response ────────────────────
        function streamAndCollect(chat: Chat, message: string, job: WorkerJob): Promise<string> {
            return new Promise<string>((resolve, reject) => {
                const streamPromise = chat.prompt(message).stream();
                let fullResponse = '';

                streamPromise
                    .then((emitter) => {
                        emitter.on(TLLMEvent.Content, (content: string) => {
                            fullResponse += content;
                            job.partialResult = fullResponse;
                        });

                        emitter.on(TLLMEvent.ToolCall, (toolCall: any) => {
                            job.currentStep = `Calling: ${toolCall?.name || 'tool'}`;
                        });

                        emitter.on(TLLMEvent.End, () => {
                            resolve(fullResponse);
                        });

                        emitter.on(TLLMEvent.Error, (error: any) => {
                            reject(error);
                        });
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
        }

        // ── Helper: Create Copy Agent ───────────────────────────────────
        function createCopyAgent(): Agent {
            const agentData = agent.data;

            // Build behavior: original behavior without _worker_prompt, plus _copy_agent_prompt
            let copyBehavior = (agent.behavior || '').replace(_worker_prompt, '');
            copyBehavior += _copy_agent_prompt;

            const copyAgent = new Agent({
                name: `${agentData.name || 'Agent'}-worker-${uid()}`,
                model: agentData.defaultModel as any,
                behavior: copyBehavior,
                id: `worker-${uid()}`,
                teamId: agentData.teamId,
            });

            // Copy components by reference, excluding _sre_* prefixed skills
            const originalComponents = agent.structure.components;
            for (const component of originalComponents) {
                const endpoint = component?.data?.data?.endpoint || '';
                if (!endpoint.startsWith('_sre_')) {
                    copyAgent.structure.components.push(component);
                }
            }
            copyAgent.sync();

            return copyAgent;
        }

        // ── Worker Loop ─────────────────────────────────────────────────
        function startWorker(task: string): string {
            const jobId = `job-${uid()}`;
            const job: WorkerJob = {
                id: jobId,
                task,
                status: 'running',
                createdAt: Date.now(),
                interactions: [],
                partialResult: '',
            };
            _jobs[jobId] = job;

            agent.emit('WorkerDispatched', { jobId, task });
            agent.emit('WorkerStatusChanged', { jobId, status: 'running' });

            // Run the worker loop asynchronously
            runWorkerLoop(job).catch((error) => {
                job.status = 'failed';
                job.error = error?.message || String(error);
                job.completedAt = Date.now();
                agent.emit('WorkerFailed', { jobId, error: job.error });
                agent.emit('WorkerStatusChanged', { jobId, status: 'failed' });
                tryProcessQueue();
            });

            return jobId;
        }

        async function runWorkerLoop(job: WorkerJob) {
            const copyAgent = createCopyAgent();
            const copyChat = copyAgent.chat({ persist: false });

            let currentMessage = job.task;

            while (true) {
                // Check for cancellation (status may be set externally by _sre_Worker_Cancel)
                if ((job.status as string) === 'cancelled') {
                    break;
                }

                job.interactions.push({
                    type: 'prompt',
                    from: 'dispatcher',
                    text: currentMessage,
                    timestamp: Date.now(),
                });

                let fullResponse: string;
                try {
                    fullResponse = await streamAndCollect(copyChat, currentMessage, job);
                } catch (error) {
                    job.status = 'failed';
                    job.error = error?.message || String(error);
                    job.completedAt = Date.now();
                    agent.emit('WorkerFailed', { jobId: job.id, error: job.error });
                    agent.emit('WorkerStatusChanged', { jobId: job.id, status: 'failed' });
                    tryProcessQueue();
                    return;
                }

                job.interactions.push({
                    type: 'response',
                    from: 'worker',
                    text: fullResponse,
                    timestamp: Date.now(),
                });

                // Check for cancellation after receiving response (status may be set externally)
                if ((job.status as string) === 'cancelled') {
                    break;
                }

                // Parse tags
                const result = extractTag(fullResponse, 'worker_result');
                const question = extractTag(fullResponse, 'worker_question');

                if (result) {
                    // Worker completed
                    job.status = 'completed';
                    job.result = result;
                    job.completedAt = Date.now();
                    agent.emit('WorkerCompleted', { jobId: job.id, result });
                    agent.emit('WorkerStatusChanged', { jobId: job.id, status: 'completed' });
                    tryProcessQueue();

                    // Queue injection to auto-surface the result to the user
                    _injectionQueue.push({ type: 'result', jobId: job.id });
                    tryInject();
                    return;
                } else if (question) {
                    // Worker has a question
                    const questionId = `q-${uid()}`;
                    job.status = 'waiting_for_input';
                    job.pendingQuestion = { questionId, text: question };

                    agent.emit('WorkerQuestion', { jobId: job.id, questionId, question });
                    agent.emit('WorkerStatusChanged', { jobId: job.id, status: 'waiting_for_input' });

                    // Queue injection to surface the question to the user
                    _injectionQueue.push({ type: 'question', jobId: job.id });
                    tryInject();

                    // Wait for the user's answer
                    const answer = await new Promise<string>((resolve) => {
                        _pendingAnswers.set(job.id, resolve);
                    });

                    // Check for cancellation sentinel
                    if (answer === '__CANCELLED__') {
                        break;
                    }

                    job.pendingQuestion = undefined;
                    job.status = 'running';
                    agent.emit('WorkerAnswered', { jobId: job.id, answer });
                    agent.emit('WorkerStatusChanged', { jobId: job.id, status: 'running' });

                    currentMessage = answer;
                    continue;
                } else {
                    // No tags found — treat the full response as the result
                    job.status = 'completed';
                    job.result = fullResponse;
                    job.completedAt = Date.now();
                    agent.emit('WorkerCompleted', { jobId: job.id, result: fullResponse });
                    agent.emit('WorkerStatusChanged', { jobId: job.id, status: 'completed' });
                    tryProcessQueue();

                    // Queue injection to auto-surface the result to the user
                    _injectionQueue.push({ type: 'result', jobId: job.id });
                    tryInject();
                    return;
                }
            }

            // If we broke out of the loop (cancellation)
            tryProcessQueue();
        }

        // ── Skill 1: Dispatch ───────────────────────────────────────────
        const dispatchSkill = agent.addSkill({
            name: '_sre_Worker_Dispatch',
            description:
                'Dispatch a task to a background worker agent. Returns a job ID for tracking.',
            process: async ({ task }) => {
                if (getRunningCount() >= MAX_CONCURRENT_WORKERS) {
                    // Queue the dispatch
                    return new Promise<string>((resolve) => {
                        _dispatchQueue.push({
                            task,
                            resolve: (jobId: string) => {
                                resolve(
                                    JSON.stringify({
                                        jobId,
                                        status: 'running',
                                        message: `Task dispatched to worker (was queued, now running). Job ID: ${jobId}`,
                                    })
                                );
                            },
                        });
                    }).then((result) => result);
                }

                const jobId = startWorker(task);
                return JSON.stringify({
                    jobId,
                    status: 'running',
                    message: `Task dispatched to background worker. Job ID: ${jobId}`,
                });
            },
        });
        dispatchSkill.in({
            task: {
                type: 'Text',
                description: "The user's request to forward to the worker. Pass it verbatim — do not elaborate or restructure.",
            },
        });

        // ── Skill 2: Status ─────────────────────────────────────────────
        const statusSkill = agent.addSkill({
            name: '_sre_Worker_Status',
            description:
                'Check the status of a specific worker job, or all jobs if no jobId is provided. Returns current status, pending questions, and partial results.',
            process: async ({ jobId }) => {
                if (jobId && _jobs[jobId]) {
                    const job = _jobs[jobId];
                    return JSON.stringify({
                        jobId: job.id,
                        task: job.task,
                        status: job.status,
                        pendingQuestion: job.pendingQuestion || null,
                        partialResult: job.partialResult ? job.partialResult.substring(0, 500) : null,
                        result: job.result ? job.result.substring(0, 500) : null,
                        currentStep: job.currentStep || null,
                    });
                }

                // Return all jobs summary with emphasis on pending questions and unsurfaced results
                const allJobs = Object.values(_jobs).map((job) => ({
                    jobId: job.id,
                    task: job.task.substring(0, 100),
                    status: job.status,
                    pendingQuestion: job.pendingQuestion || null,
                    hasResult: !!job.result,
                    resultSurfaced: !!job.resultSurfaced,
                }));

                const pendingQuestions = allJobs.filter((j) => j.pendingQuestion);
                const recentlyCompleted = allJobs.filter((j) => j.status === 'completed' && j.hasResult && !j.resultSurfaced);

                return JSON.stringify({
                    totalJobs: allJobs.length,
                    pendingQuestions,
                    recentlyCompleted,
                    jobs: allJobs,
                });
            },
        });
        statusSkill.in({
            jobId: {
                type: 'Text',
                description: 'Optional: The job ID to check status for. If not provided, returns status of all jobs.',
            },
        });

        // ── Skill 3: Results ────────────────────────────────────────────
        const resultsSkill = agent.addSkill({
            name: '_sre_Worker_Results',
            description: 'Retrieve the full result of a completed worker job. If the job is not yet completed, returns partial results. Marks the result as surfaced.',
            process: async ({ jobId }) => {
                if (!_jobs[jobId]) {
                    return JSON.stringify({ error: `Job ${jobId} not found` });
                }

                const job = _jobs[jobId];

                // Mark as surfaced so we know this result has been presented
                if (job.status === 'completed') {
                    job.resultSurfaced = true;
                }

                return JSON.stringify({
                    jobId: job.id,
                    task: job.task,
                    status: job.status,
                    result: job.result || null,
                    partialResult: job.status !== 'completed' ? job.partialResult : null,
                    error: job.error || null,
                    completedAt: job.completedAt || null,
                    interactions: job.interactions.length,
                });
            },
        });
        resultsSkill.in({
            jobId: {
                type: 'Text',
                description: 'The job ID to retrieve results for',
            },
        });

        // ── Skill 4: Answer ─────────────────────────────────────────────
        const answerSkill = agent.addSkill({
            name: '_sre_Worker_Answer',
            description:
                "Relay the user's answer to a worker that is waiting for input. The worker will resume processing with the provided answer.",
            process: async ({ jobId, answer }) => {
                if (!_jobs[jobId]) {
                    return JSON.stringify({ error: `Job ${jobId} not found` });
                }

                const job = _jobs[jobId];
                if (job.status !== 'waiting_for_input') {
                    return JSON.stringify({
                        error: `Job ${jobId} is not waiting for input (current status: ${job.status})`,
                    });
                }

                const resolver = _pendingAnswers.get(jobId);
                if (!resolver) {
                    return JSON.stringify({ error: `No pending answer handler found for job ${jobId}` });
                }

                _pendingAnswers.delete(jobId);
                resolver(answer);

                return JSON.stringify({
                    jobId,
                    message: 'Answer relayed to worker. The worker will resume processing.',
                });
            },
        });
        answerSkill.in({
            jobId: {
                type: 'Text',
                description: 'The job ID of the worker waiting for input',
            },
            answer: {
                type: 'Text',
                description: "The user's answer to relay to the worker",
            },
        });

        // ── Skill 5: Cancel ─────────────────────────────────────────────
        const cancelSkill = agent.addSkill({
            name: '_sre_Worker_Cancel',
            description: 'Cancel a running or queued worker job.',
            process: async ({ jobId }) => {
                if (!_jobs[jobId]) {
                    return JSON.stringify({ error: `Job ${jobId} not found` });
                }

                const job = _jobs[jobId];
                if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
                    return JSON.stringify({
                        error: `Job ${jobId} is already ${job.status} and cannot be cancelled`,
                    });
                }

                job.status = 'cancelled';
                job.completedAt = Date.now();

                // If the worker is waiting for input, resolve with cancellation sentinel
                const resolver = _pendingAnswers.get(jobId);
                if (resolver) {
                    _pendingAnswers.delete(jobId);
                    resolver('__CANCELLED__');
                }

                agent.emit('WorkerCancelled', { jobId });
                agent.emit('WorkerStatusChanged', { jobId, status: 'cancelled' });
                tryProcessQueue();

                return JSON.stringify({
                    jobId,
                    message: 'Job cancelled successfully.',
                });
            },
        });
        cancelSkill.in({
            jobId: {
                type: 'Text',
                description: 'The job ID to cancel',
            },
        });

        // ── Skill 6: List ───────────────────────────────────────────────
        agent.addSkill({
            name: '_sre_Worker_List',
            description: 'List all worker jobs with their current status summary.',
            process: async () => {
                const jobs = Object.values(_jobs).map((job) => ({
                    jobId: job.id,
                    task: job.task.substring(0, 100),
                    status: job.status,
                    createdAt: job.createdAt,
                    completedAt: job.completedAt || null,
                    hasPendingQuestion: !!job.pendingQuestion,
                }));

                const summary = {
                    total: jobs.length,
                    running: jobs.filter((j) => j.status === 'running').length,
                    waiting: jobs.filter((j) => j.status === 'waiting_for_input').length,
                    completed: jobs.filter((j) => j.status === 'completed').length,
                    failed: jobs.filter((j) => j.status === 'failed').length,
                    cancelled: jobs.filter((j) => j.status === 'cancelled').length,
                    queued: _dispatchQueue.length,
                };

                return JSON.stringify({ summary, jobs });
            },
        });
    }

    // ── Remove Worker Mode ──────────────────────────────────────────────
    static remove(agent: Agent) {
        agent.removeSkill('_sre_Worker_Dispatch');
        agent.removeSkill('_sre_Worker_Status');
        agent.removeSkill('_sre_Worker_Results');
        agent.removeSkill('_sre_Worker_Answer');
        agent.removeSkill('_sre_Worker_Cancel');
        agent.removeSkill('_sre_Worker_List');
        agent.behavior = agent.behavior.replace(_worker_prompt, '');
    }
}
