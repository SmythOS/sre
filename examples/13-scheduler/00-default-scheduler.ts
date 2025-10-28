import { Scheduler, Schedule, Job, Agent, AccessCandidate } from '@smythos/sdk';

/**
 * This example demonstrates basic scheduler usage with the new Job API.
 *
 * All jobs are fully serializable and work after restart!
 */

// Create an agent with a skill
const agent = new Agent({
    id: 'scheduler-demo-agent',
    name: 'Scheduler Demo',
    model: 'gpt-4o-mini',
    behavior: 'You are a helpful assistant that generates reports.',
});

const externalAgent = new Agent({
    id: 'external-agent',
    name: 'External Agent',
    model: 'gpt-4o-mini',
    behavior: 'You are a helpful assistant that generates external reports.',
    teamId: 'external-team',
});

// Add a skill to the agent
agent.addSkill({
    name: 'generate_report',
    description: 'Generate a system report',
    process: async (data: { type?: string }) => {
        const reportType = data?.type || 'standard';
        console.log(`📊 Generating ${reportType} report at ${new Date().toLocaleTimeString()}...`);
        return {
            success: true,
            timestamp: new Date().toISOString(),
            type: reportType,
            message: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} report generated successfully`,
        };
    },
});

// Wait for agent to be ready
await agent.ready;

// Get the default scheduler
const scheduler = agent.scheduler.default();
//or const scheduler = Scheduler.default() - the jobs will be scheduled for the default team

scheduler.on('executed', (info) => {
    console.log(`🔄 Job executed`, info);
});

scheduler.on('executing', (info) => {
    console.log(`🔄 Job executing`, info);
});

console.log('🕐 Adding scheduled jobs...\n');

// Job 1: Skill-based job - calls the agent's skill
await scheduler.add(
    'report-job',
    new Job({
        type: 'skill',
        agentId: externalAgent.data.id,
        skillName: 'generate_report',
        args: { type: 'daily' },
        metadata: {
            name: 'Daily Report Generator',
            description: 'Generates daily reports every 30 seconds',
        },
    }),
    Schedule.every('5s')
);

console.log('✅ Skill-based job added: Daily Report Generator');

// // Job 2: Prompt-based job - sends a prompt to the agent
// await scheduler.add(
//     'insight-job',
//     new Job({
//         type: 'prompt',
//         agentId: agent.data.id,
//         prompt: 'Generate a brief insight about system performance',
//         metadata: {
//             name: 'System Insights',
//             description: 'AI-generated insights every 45 seconds',
//         },
//     }),
//     Schedule.every('10s')
// );

console.log('✅ Prompt-based job added: System Insights\n');

// DEMONSTRATION: New chainable syntax (requires agent in scheduler instance)
console.log('🔗 Demonstrating new chainable syntax...\n');

// Job 3: Using .call() - shorter syntax for skill execution
await scheduler.call('generate_report', { type: 'weekly' }, { name: 'Weekly Report' }).every('7s');
console.log('✅ Chainable skill job added: Weekly Report (using .call())');

// Job 4: Using .prompt() - shorter syntax for prompts
await scheduler.prompt('What are the top 3 system priorities?', { name: 'Priority Check' }).every('13s');
console.log('✅ Chainable prompt job added: Priority Check (using .prompt())\n');
// NOTE: If you forget to call .every() or .cron(), you'll get a warning:
// await scheduler.call('generate_report', {});  // ⚠️ Warning detected via then() override!

// List all jobs
const jobs = await scheduler.list();
console.log(`📋 Active jobs: ${jobs.length}`);
jobs.forEach((job) => {
    console.log(`  - ${job.jobConfig.metadata.name} (${job.id})`);
    console.log(`    Type: ${job.jobConfig.type}`);
    if (job.jobConfig.type === 'skill') {
        console.log(`    Skill: ${job.jobConfig.skillName}`);
    } else if (job.jobConfig.type === 'prompt') {
        console.log(`    Prompt: ${job.jobConfig.prompt.substring(0, 40)}...`);
    } else if (job.jobConfig.type === 'trigger') {
        console.log(`    Trigger: ${job.jobConfig.triggerName}`);
    }
    console.log(`    Schedule: ${job.schedule.interval || job.schedule.cron}`);
    console.log(`    Next run: ${job.nextRun || 'Calculating...'}`);
    console.log('');
});

console.log('🎯 Jobs are now running and will execute at scheduled intervals');
console.log('💡 All job data is fully serializable - they will work after restart!');
console.log('\nPress Ctrl+C to stop\n');

// Keep the process running
process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    process.exit(0);
});

//Block the process with a fake interval to keep it running

setInterval(() => {}, 1000);
