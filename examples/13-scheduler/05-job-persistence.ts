import { Scheduler, Schedule, Job, Agent } from '@smythos/sdk';
import { ConnectorService } from '@smythos/sre';

/**
 * This example demonstrates how job persistence works with the new Job API.
 *
 * KEY DIFFERENCE FROM OLD API:
 * - Jobs are now FULLY SERIALIZABLE (no more function serialization issues!)
 * - Job execution is based on agent skills or prompts
 * - Everything persists automatically
 * - Agents must be saved so jobs can access them
 */

// Define your agent with skills
const agent = new Agent({
    id: 'persistent-worker',
    name: 'Persistent Worker',
    model: 'gpt-4o-mini',
    behavior: 'You are a reliable system worker.',
});

// Add skills that jobs will use
agent.addSkill({
    name: 'system_monitor',
    description: 'Monitor system health',
    process: async () => {
        console.log('[Monitor] Checking system health...');
        return {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            timestamp: new Date().toISOString(),
        };
    },
});

agent.addSkill({
    name: 'cleanup',
    description: 'Clean up temporary files',
    process: async () => {
        console.log('[Cleanup] Running cleanup...');
        return {
            cleaned: Math.floor(Math.random() * 100) + 'MB',
            timestamp: new Date().toISOString(),
        };
    },
});

await agent.ready;

// IMPORTANT: Save agent so scheduler can access it
const agentDataConnector = ConnectorService.getAgentDataConnector();
await agentDataConnector.saveAgent(agent.data.id, agent.data);

// Function to set up jobs (call this on startup)
async function setupJobs(scheduler: any) {
    console.log('🔧 Setting up persistent jobs...\n');

    // Skill-based jobs
    await scheduler.add(
        'system-monitor',
        Schedule.every('5m'),
        new Job({
            type: 'skill',
            agentId: agent.data.id,
            skillName: 'system_monitor',
            metadata: {
                name: 'System Monitor',
                description: 'Monitors system health every 5 minutes',
            },
        })
    );
    console.log('✓ System Monitor');

    await scheduler.add(
        'daily-cleanup',
        Schedule.cron('0 2 * * *'), // 2 AM daily
        new Job({
            type: 'skill',
            agentId: agent.data.id,
            skillName: 'cleanup',
            metadata: {
                name: 'Daily Cleanup',
                description: 'Cleans up temporary files daily',
                retryOnFailure: true,
                maxRetries: 3,
            },
        })
    );
    console.log('✓ Daily Cleanup');

    // AI-powered jobs
    await scheduler.add(
        'health-ping',
        Schedule.every('30s'),
        new Job({
            type: 'prompt',
            agentId: agent.data.id,
            prompt: 'Report system status',
            metadata: {
                name: 'Health Ping',
                description: 'Quick AI-powered health check',
            },
        })
    );
    console.log('✓ Health Ping');

    await scheduler.add(
        'performance-analysis',
        Schedule.every('15m'),
        new Job({
            type: 'prompt',
            agentId: agent.data.id,
            prompt: 'Analyze system performance trends and suggest optimizations',
            metadata: {
                name: 'Performance Analysis',
                description: 'AI-powered performance insights',
            },
        })
    );
    console.log('✓ Performance Analysis');

    console.log('\n✅ All jobs configured!\n');
}

// Main application startup
async function startup() {
    const scheduler = Scheduler.default();

    // Set up jobs (can be called multiple times safely - upsert behavior)
    await setupJobs(scheduler);

    // List all active jobs
    const jobs = await scheduler.list();
    console.log(`📋 Active jobs: ${jobs.length}\n`);

    jobs.forEach((job) => {
        console.log(`  • ${job.jobConfig.metadata.name}`);
        console.log(`    Type: ${job.jobConfig.type}`);
        if (job.jobConfig.type === 'skill') {
            console.log(`    Skill: ${job.jobConfig.skillName}`);
        } else {
            console.log(`    Prompt: "${job.jobConfig.prompt.substring(0, 40)}..."`);
        }
        console.log(`    Schedule: ${job.schedule.interval || job.schedule.cron}`);
        console.log(`    Status: ${job.status}`);
        console.log(`    Executions: ${job.executionHistory?.length || 0}`);
        console.log('');
    });
}

// Simulate application startup
console.log('=== Application Starting ===\n');
await startup();

console.log('🎯 KEY BENEFITS OF NEW JOB API:');
console.log('  ✅ Jobs are fully serializable (agentId + skill/prompt)');
console.log('  ✅ No need to re-register after restart');
console.log('  ✅ Jobs execute automatically when scheduler loads');
console.log('  ✅ Perfect for production deployments\n');

console.log('💾 Job data stored in: ~/.smyth/scheduler/');
console.log('  📁 jobs/<owner>/ - Job configurations');
console.log('  📁 .jobs.runtime/<owner>/ - Execution history\n');

console.log('🔄 To test persistence:');
console.log('  1. Stop this script (Ctrl+C)');
console.log('  2. Run it again');
console.log('  3. Jobs will resume automatically!\n');

console.log('Jobs are running... (Press Ctrl+C to stop)\n');

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    console.log('💡 Jobs are saved and will resume on next startup');
    process.exit(0);
});
