import { Scheduler, Schedule, Job, Agent } from '@smythos/sdk';
import { ConnectorService } from '@smythos/sre';

/**
 * This example demonstrates LocalScheduler with custom settings
 */

// Create an agent
const agent = new Agent({
    id: 'local-scheduler-demo',
    name: 'Local Scheduler Demo',
    model: 'gpt-4o-mini',
    behavior: 'You are a maintenance assistant.',
});

// Add skills
agent.addSkill({
    name: 'cleanup',
    description: 'Perform cleanup operations',
    process: async () => {
        console.log(`🧹 Cleanup executed at ${new Date().toLocaleTimeString()}`);
        return { success: true, cleaned: Math.floor(Math.random() * 100) + 'MB' };
    },
});

agent.addSkill({
    name: 'backup',
    description: 'Perform backup operations',
    process: async (data: { target?: string }) => {
        console.log(`💾 Backing up ${data?.target || 'system'} at ${new Date().toLocaleTimeString()}`);
        return { success: true, backed_up: data?.target || 'system' };
    },
});

await agent.ready;

// Save agent so scheduler can access it
const agentDataConnector = ConnectorService.getAgentDataConnector();
await agentDataConnector.saveAgent(agent.data.id, agent.data);

// Use LocalScheduler with custom settings
const scheduler = Scheduler.LocalScheduler({
    persistExecutionHistory: true,
    maxHistoryEntries: 50,
});

console.log('🕐 Setting up local scheduler with custom config...\n');

// Add cleanup job
await scheduler.add(
    'cleanup-job',
    Schedule.every('1m'),
    new Job({
        type: 'skill',
        agentId: agent.data.id,
        skillName: 'cleanup',
        metadata: {
            name: 'Cleanup Task',
            description: 'Periodic cleanup every minute',
            retryOnFailure: true,
            maxRetries: 3,
        },
    })
);

// Add backup job
await scheduler.add(
    'backup-job',
    Schedule.every('2m'),
    new Job({
        type: 'skill',
        agentId: agent.data.id,
        skillName: 'backup',
        args: { target: 'database' },
        metadata: {
            name: 'Database Backup',
            description: 'Backs up database every 2 minutes',
            timeout: 120000, // 2 minutes timeout
        },
    })
);

// Add AI-powered maintenance check
await scheduler.add(
    'ai-check',
    Schedule.every('3m'),
    new Job({
        type: 'prompt',
        agentId: agent.data.id,
        prompt: 'Check system health and suggest maintenance actions',
        metadata: {
            name: 'AI Health Check',
            description: 'AI-powered system health analysis',
        },
    })
);

console.log('✅ All jobs scheduled\n');

// List all jobs
const jobs = await scheduler.list();
console.log(`📋 Total jobs: ${jobs.length}\n`);

jobs.forEach((job, index) => {
    console.log(`${index + 1}. ${job.jobConfig.metadata.name}`);
    console.log(`   Type: ${job.jobConfig.type}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Schedule: ${job.schedule.interval}`);
    console.log(`   Executions: ${job.executionHistory?.length || 0}`);
    console.log('');
});

console.log('💡 Jobs persist to disk and will resume after restart');
console.log('📝 Execution history is tracked separately\n');
console.log('Press Ctrl+C to stop\n');

process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
});
