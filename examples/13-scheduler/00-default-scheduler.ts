import { Scheduler, Schedule, Job, Agent } from '@smythos/sdk';

/**
 * This example demonstrates basic scheduler usage with the new Job API.
 *
 * Jobs can execute in two ways:
 * 1. Skill-based: Call a specific agent skill with arguments
 * 2. Prompt-based: Send a prompt to an agent
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
const scheduler = Scheduler.default();

console.log('🕐 Adding scheduled jobs...\n');

// Job 1: Skill-based job - calls the agent's skill
await scheduler.add(
    'report-job',
    Schedule.every('5s'),
    new Job({
        type: 'skill',
        agentId: agent.data.id,
        skillName: 'generate_report',
        args: { type: 'daily' },
        metadata: {
            name: 'Daily Report Generator',
            description: 'Generates daily reports every 30 seconds',
        },
    })
);

console.log('✅ Skill-based job added: Daily Report Generator');

// Job 2: Prompt-based job - sends a prompt to the agent
await scheduler.add(
    'insight-job',
    Schedule.every('10s'),
    new Job({
        type: 'prompt',
        agentId: agent.data.id,
        prompt: 'Generate a brief insight about system performance',
        metadata: {
            name: 'System Insights',
            description: 'AI-generated insights every 45 seconds',
        },
    })
);

console.log('✅ Prompt-based job added: System Insights\n');

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
