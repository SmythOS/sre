import { Agent, Chat, TAgentMode, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import * as readline from 'readline';

/**
 * Combined Planner + Worker Mode Example
 *
 * Demonstrates the array mode syntax: mode: [TAgentMode.PLANNER, TAgentMode.WORKER]
 *
 * The agent will:
 * - Plan complex tasks into steps (Planner mode)
 * - Dispatch heavy subtasks to background workers (Worker mode)
 * - Track task progress visually
 * - Stay interactive while workers process in the background
 *
 * Try:
 *   "Build me a comprehensive comparison of React vs Vue vs Svelte"
 *   "What's the status?"
 */

async function main() {
    console.clear();
    console.log(chalk.green('🚀 Planner + Worker Combined Mode Demo'));
    console.log(chalk.yellow('The agent plans tasks AND dispatches complex work to background workers.'));
    console.log(chalk.gray('Type "exit" or "quit" to end.\n'));

    const agent = new Agent({
        id: 'planner-worker-demo',
        name: 'Research Assistant',
        behavior: `You are an expert research assistant. You plan your approach carefully and delegate complex research tasks to background workers when appropriate.`,
        model: 'gpt-4o',
        mode: [TAgentMode.PLANNER, TAgentMode.WORKER],
    });

    // ── Planner Events ──────────────────────────────────────────────
    agent.on('TasksAdded', (_tasksList: any, tasks: any) => {
        console.log(chalk.blue('\n  📋 Plan created:'));
        for (const [id, task] of Object.entries(tasks) as any) {
            console.log(chalk.blue(`     ${task.status === 'completed' ? '✅' : '📝'} ${task.summary || task.description}`));
        }
    });

    agent.on('TasksUpdated', (taskId: string, status: string) => {
        const icon = status === 'completed' ? '✅' : status === 'ongoing' ? '⏳' : '📝';
        console.log(chalk.blue(`  ${icon} Task ${taskId}: ${status}`));
    });

    agent.on('TasksCompleted', () => {
        console.log(chalk.green('  🎉 All planned tasks completed!'));
    });

    // ── Worker Events ───────────────────────────────────────────────
    agent.on('WorkerDispatched', ({ jobId, task }) => {
        console.log(chalk.cyan(`\n  ⚡ Worker dispatched: ${jobId}`));
        console.log(chalk.gray(`     Task: ${task.substring(0, 80)}...`));
    });

    agent.on('WorkerStatusChanged', ({ jobId, status }) => {
        const colors = {
            running: chalk.yellow,
            waiting_for_input: chalk.magenta,
            completed: chalk.green,
            failed: chalk.red,
            cancelled: chalk.gray,
        };
        console.log(chalk.gray(`  📊 ${jobId}: `) + (colors[status] || chalk.white)(status));
    });

    agent.on('WorkerQuestion', ({ jobId, question }) => {
        console.log(chalk.magenta(`\n  ❓ Worker ${jobId} asks: "${question}"`));
    });

    agent.on('WorkerCompleted', ({ jobId }) => {
        console.log(chalk.green(`  ✅ Worker ${jobId} completed!`));
    });

    // ── Chat ────────────────────────────────────────────────────────
    const chat = agent.chat({ id: 'combined-demo-' + Date.now(), persist: false });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: '),
    });

    // ── Listen on Chat for ALL streaming output ─────────────────────
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
        if (name.startsWith('_sre_')) {
            const shortName = name.replace('_sre_Worker_', 'W:').replace('_sre_Plan_', 'P:').replace('_sre_', '');
            console.log(chalk.gray(`  [${shortName}]`));
        } else {
            console.log(chalk.yellow(`  [Tool: ${name}]`));
        }
    });

    // ── Handle User Input ───────────────────────────────────────────
    rl.on('line', (input) => {
        if (['exit', 'quit'].includes(input.toLowerCase().trim())) {
            console.log(chalk.green('👋 Goodbye!'));
            rl.close();
            return;
        }

        if (!input.trim()) {
            rl.prompt();
            return;
        }

        console.log(chalk.gray('Thinking...'));
        chat.prompt(input).stream().catch((error) => {
            console.error(chalk.red('❌ Error:', error));
            rl.prompt();
        });
    });

    rl.on('close', () => {
        console.log(chalk.gray('Session ended.'));
        process.exit(0);
    });

    rl.prompt();
}

main();
