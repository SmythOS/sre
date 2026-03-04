import { Agent, Chat, TAgentMode, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import * as readline from 'readline';

/**
 * Worker Mode Example
 *
 * This example demonstrates the Worker mode, which allows an agent to dispatch
 * complex tasks to background "copy" agents while staying interactive.
 *
 * The agent will:
 * - Answer simple questions directly
 * - Dispatch complex tasks to background workers
 * - Auto-surface results when workers complete (no need to ask)
 * - Surface follow-up questions from workers back to you
 *
 * Try these prompts:
 *   "What is 2+2?"                          → answered directly (simple)
 *   "Research the top 5 AI frameworks and compare their features" → dispatched to worker
 *   "What's the status of my tasks?"        → checks worker status
 */

async function main() {
    console.clear();
    console.log(chalk.green('🚀 Worker Mode Demo'));
    console.log(chalk.yellow('Complex tasks are dispatched to background workers.'));
    console.log(chalk.yellow('Results are automatically surfaced when workers complete.'));
    console.log(chalk.gray('Type "exit" or "quit" to end the conversation.\n'));

    const agent = new Agent({
        id: 'worker-demo-agent',
        name: 'Worker Demo Agent',
        behavior: `You are a helpful assistant capable of handling both simple questions and complex research tasks.
For simple questions (math, facts, short answers), respond directly.
For complex multi-step tasks (research, analysis, code generation, comparisons), dispatch them to a background worker.`,
        model: 'claude-sonnet-4-5',
        mode: TAgentMode.WORKER,
    });

    // ── Add a sample skill that workers can use ─────────────────────
    agent.addSkill({
        name: 'WebSearch',
        description: 'Search the web for information on a given topic',
        process: async ({ query }) => {
            console.log(chalk.gray(`\n  [Skill] WebSearch called with: "${query}"`));
            return {
                results: [
                    { title: `Result 1 for "${query}"`, snippet: `This is a simulated search result about ${query}.` },
                    { title: `Result 2 for "${query}"`, snippet: `Another relevant finding about ${query}.` },
                ],
            };
        },
    });

    // ── Worker Event Listeners (optional, for visibility) ────────────
    agent.on('WorkerDispatched', ({ jobId, task }) => {
        console.log(chalk.cyan(`\n  ⚡ Worker dispatched: ${jobId}`));
        console.log(chalk.gray(`     Task: ${task.substring(0, 80)}...`));
    });

    agent.on('WorkerStatusChanged', ({ jobId, status }) => {
        const statusColors = {
            running: chalk.yellow,
            waiting_for_input: chalk.magenta,
            completed: chalk.green,
            failed: chalk.red,
            cancelled: chalk.gray,
        };
        const colorFn = statusColors[status] || chalk.white;
        console.log(chalk.gray(`  📊 ${jobId}: `) + colorFn(status));
    });

    agent.on('WorkerQuestion', ({ jobId, question }) => {
        console.log(chalk.magenta(`\n  ❓ Worker ${jobId} has a question:`));
        console.log(chalk.magenta(`     "${question}"`));
    });

    agent.on('WorkerCompleted', ({ jobId, result }) => {
        console.log(chalk.green(`\n  ✅ Worker ${jobId} completed!`));
        console.log(chalk.gray(`     Result preview: ${(result || '').substring(0, 100)}...`));
    });

    agent.on('WorkerFailed', ({ jobId, error }) => {
        console.log(chalk.red(`\n  ❌ Worker ${jobId} failed: ${error}`));
    });

    agent.on('WorkerCancelled', ({ jobId }) => {
        console.log(chalk.gray(`\n  🚫 Worker ${jobId} cancelled`));
    });

    // ── Create Chat Session ─────────────────────────────────────────
    const chat = agent.chat({ id: 'worker-demo-' + Date.now(), persist: false });

    // ── Interactive Loop ────────────────────────────────────────────
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: '),
    });

    // ── Listen on Chat for ALL streaming output ─────────────────────
    // ChatCommand.stream() emits Content/End/ToolCall on both the
    // per-prompt emitter AND the Chat object. By listening on the Chat
    // directly, we catch output from user-initiated prompts AND any
    // mode-injected prompts (e.g. Worker mode auto-surfacing results).
    // This is the same pattern for all agent modes — no special handling.
    let first = true;
    chat.on(TLLMEvent.Content, (content: string) => {
        if (first) {
            process.stdout.write(chalk.green('\n🤖 Assistant: '));
            first = false;
        }
        process.stdout.write(chalk.white(content));
    });

    chat.on(TLLMEvent.End, () => {
        if (!first) {
            first = true;
            console.log('\n');
            rl.prompt();
        }
    });

    chat.on(TLLMEvent.Error, (error: any) => {
        first = true;
        console.error(chalk.red('❌ Error:', error));
        rl.prompt();
    });

    chat.on(TLLMEvent.ToolCall, (toolCall: any) => {
        const name = toolCall?.tool?.name || '';
        if (name.startsWith('_sre_Worker_')) {
            const shortName = name.replace('_sre_Worker_', '');
            const args = typeof toolCall?.tool?.arguments === 'object' ? JSON.stringify(toolCall?.tool?.arguments) : toolCall?.tool?.arguments;
            console.log(chalk.cyan(`  [Worker:${shortName}]`), chalk.gray(args));
        } else {
            console.log(
                chalk.yellow('[Calling Tool]'),
                name,
                chalk.gray(typeof toolCall?.tool?.arguments === 'object' ? JSON.stringify(toolCall?.tool?.arguments) : toolCall?.tool?.arguments),
            );
        }
    });

    // ── Handle User Input ───────────────────────────────────────────
    rl.on('line', (input) => {
        if (input.toLowerCase().trim() === 'exit' || input.toLowerCase().trim() === 'quit') {
            console.log(chalk.green('👋 Goodbye!'));
            rl.close();
            return;
        }

        if (input.trim() === '') {
            rl.prompt();
            return;
        }

        console.log(chalk.gray('Thinking...'));

        // Just trigger the prompt — the chat-level listeners above
        // handle all output automatically (both user and injected).
        chat.prompt(input)
            .stream()
            .catch((error) => {
                console.error(chalk.red('❌ Error:', error));
                rl.prompt();
            });
    });

    rl.on('close', () => {
        console.log(chalk.gray('Chat session ended.'));
        process.exit(0);
    });

    rl.prompt();
}

main();
