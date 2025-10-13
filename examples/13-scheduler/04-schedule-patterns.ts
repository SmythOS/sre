import { Scheduler, Schedule, Job, Agent } from '@smythos/sdk';
import { ConnectorService } from '@smythos/sre';

/**
 * This example demonstrates various schedule patterns
 */

// Create a simple agent
const agent = new Agent({
    id: 'pattern-demo',
    name: 'Pattern Demo',
    model: 'gpt-4o-mini',
});

agent.addSkill({
    name: 'task',
    description: 'Execute a task',
    process: async (data: { name?: string }) => {
        console.log(`✨ ${data?.name || 'Task'} executed at ${new Date().toLocaleString()}`);
        return { success: true };
    },
});

await agent.ready;

// Save agent so scheduler can access it
const agentDataConnector = ConnectorService.getAgentDataConnector();
await agentDataConnector.saveAgent(agent.data.id, agent.data);

const scheduler = Scheduler.default();

console.log('📅 Demonstrating various schedule patterns...\n');

// 1. Interval patterns
const intervals = [
    { id: '30sec', interval: '30s', name: '30 seconds' },
    { id: '5min', interval: '5m', name: '5 minutes' },
    { id: '2hour', interval: '2h', name: '2 hours' },
    { id: '1day', interval: '1d', name: '1 day' },
    { id: '1week', interval: '1w', name: '1 week' },
];

console.log('⏱️  Interval Schedules:');
for (const { id, interval, name } of intervals) {
    await scheduler.add(
        id,
        Schedule.every(interval),
        new Job({
            type: 'skill',
            agentId: agent.data.id,
            skillName: 'task',
            args: { name },
            metadata: {
                name: `Every ${name}`,
                description: `Runs every ${name}`,
            },
        })
    );
    console.log(`  ✓ ${name}: ${interval}`);
}

// 2. Cron patterns
console.log('\n🕐 Cron Schedules:');
const cronJobs = [
    { id: 'hourly', cron: '0 * * * *', desc: 'Every hour at minute 0' },
    { id: 'daily-2am', cron: '0 2 * * *', desc: 'Every day at 2 AM' },
    { id: 'weekdays-9am', cron: '0 9 * * 1-5', desc: 'Weekdays at 9 AM' },
    { id: 'monthly', cron: '0 0 1 * *', desc: 'First day of month at midnight' },
];

for (const { id, cron, desc } of cronJobs) {
    await scheduler.add(
        id,
        Schedule.cron(cron),
        new Job({
            type: 'skill',
            agentId: agent.data.id,
            skillName: 'task',
            args: { name: desc },
            metadata: {
                name: desc,
                description: `Cron: ${cron}`,
            },
        })
    );
    console.log(`  ✓ ${desc}: ${cron}`);
}

// 3. Date range schedules
console.log('\n📆 Date Range Schedules:');

const now = new Date();
const in10Minutes = new Date(now.getTime() + 10 * 60 * 1000);
const in1Hour = new Date(now.getTime() + 60 * 60 * 1000);

await scheduler.add(
    'limited-time',
    Schedule.every('1m').starts(now).ends(in10Minutes),
    new Job({
        type: 'skill',
        agentId: agent.data.id,
        skillName: 'task',
        args: { name: 'Limited Time Task' },
        metadata: {
            name: 'Limited Time Task',
            description: 'Runs for 10 minutes only',
        },
    })
);
console.log(`  ✓ Limited time: Every 1m for 10 minutes`);

await scheduler.add(
    'delayed-start',
    Schedule.every('30s').starts(in10Minutes),
    new Job({
        type: 'skill',
        agentId: agent.data.id,
        skillName: 'task',
        args: { name: 'Delayed Start Task' },
        metadata: {
            name: 'Delayed Start',
            description: 'Starts in 10 minutes',
        },
    })
);
console.log(`  ✓ Delayed start: Begins in 10 minutes`);

// 4. Jobs with retry and timeout
console.log('\n⚙️  Advanced Configuration:');

await scheduler.add(
    'with-retry',
    Schedule.every('1m'),
    new Job({
        type: 'prompt',
        agentId: agent.data.id,
        prompt: 'Perform a critical operation that requires reliability',
        metadata: {
            name: 'Critical Task',
            description: 'Task with retry logic',
            retryOnFailure: true,
            maxRetries: 3,
            timeout: 30000, // 30 seconds
        },
    })
);
console.log(`  ✓ With retry: 3 retries, 30s timeout`);

// List all jobs
console.log('\n📋 Summary:');
const jobs = await scheduler.list();
console.log(`Total scheduled jobs: ${jobs.length}\n`);

const byType = jobs.reduce((acc, job) => {
    const type = job.schedule.interval ? 'Interval' : 'Cron';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
}, {} as Record<string, number>);

console.log('By schedule type:');
Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
});

console.log('\n💡 All schedules are active and will execute at their specified times');
console.log('Press Ctrl+C to stop\n');

process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
});
