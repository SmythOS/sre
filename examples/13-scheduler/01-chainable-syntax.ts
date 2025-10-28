import { Agent, Schedule, Job } from '@smythos/sdk';

/**
 * This example demonstrates the NEW chainable syntax for scheduling jobs.
 *
 * Instead of manually creating Job objects, you can use the chainable methods:
 * - .call() for skill execution
 * - .prompt() for sending prompts
 * - .trigger() for trigger execution
 *
 * All chainable methods require calling .every() or .cron() to complete scheduling.
 */

// Create an agent with a skill
const agent = new Agent({
    id: 'chainable-demo-agent',
    name: 'Chainable Scheduler Demo',
    model: 'gpt-4o-mini',
    behavior: 'You are a helpful assistant.',
});

// Add a skill to the agent
agent.addSkill({
    name: 'process_data',
    description: 'Process some data',
    process: async (data: { input?: string }) => {
        console.log(`🔄 Processing: ${data?.input || 'no input'} at ${new Date().toLocaleTimeString()}`);
        return {
            success: true,
            timestamp: new Date().toISOString(),
            processed: data?.input || 'no input',
        };
    },
});

// Wait for agent to be ready
await agent.ready;

// Get the scheduler (agent-scoped)
const scheduler = agent.scheduler.default();

console.log('🚀 Demonstrating new chainable syntax for scheduler\n');

// ===== Method 1: .call() - Schedule skill execution =====
console.log('1️⃣  Scheduling skill with .call()');
const job1 = await scheduler
    .call(
        'process_data',
        { input: 'test data' },
        {
            name: 'Data Processor',
            retryOnFailure: true,
        }
    )
    .every('5s');
console.log('   ✅ Scheduled: Data Processor (every 5s)\n');

// ===== Method 2: .prompt() - Schedule prompt execution =====
console.log('2️⃣  Scheduling prompt with .prompt()');
const job2 = await scheduler
    .prompt('Generate a random fun fact', {
        name: 'Fun Fact Generator',
    })
    .every('10s');
console.log('   ✅ Scheduled: Fun Fact Generator (every 10s)\n');

// ===== Comparison with traditional syntax =====
console.log('4️⃣  Traditional syntax (for comparison)');
await scheduler.add(
    'traditional-job',
    new Job({
        type: 'skill',
        agentId: agent.id,
        skillName: 'process_data',
        args: { input: 'traditional' },
        metadata: {
            name: 'Traditional Job',
        },
    }),
    Schedule.every('20s')
);
console.log('   ✅ Scheduled: Traditional Job (every 20s)\n');

// List all jobs
const jobs = await scheduler.list();
console.log(`📋 Total scheduled jobs: ${jobs.length}\n`);
jobs.forEach((job) => {
    console.log(`  📌 ${job.jobConfig.metadata.name || 'Unnamed'} (${job.id})`);
    console.log(`     Type: ${job.jobConfig.type}`);
    console.log(`     Schedule: ${job.schedule.interval || job.schedule.cron}`);
    console.log(`     Next run: ${job.nextRun || 'Calculating...'}\n`);
});

console.log('✨ All jobs are now running!\n');

// ===== Demonstrating job control =====
console.log('5️⃣  Demonstrating job control (pause/resume/delete)');
console.log('   Pausing job1 for 10 seconds...');
await job1.pause();

setTimeout(async () => {
    console.log('   Resuming job1...');
    await job1.resume();
}, 10000);

setTimeout(async () => {
    console.log('   Deleting job2...');
    await job2.delete();
    console.log('   ✅ job2 has been deleted\n');
}, 20000);

console.log('\n💡 Key benefits of chainable syntax:');
console.log('   - More concise and readable');
console.log('   - Automatic job ID generation');
console.log('   - Type-safe with TypeScript');
console.log('   - Job control (pause, resume, delete) via returned object');
console.log('   - Warning if .every() is not called\n');

console.log('⚠️  Demonstrating the warning when .every() is forgotten:');
// This will trigger a warning because we're awaiting without calling .every()
await scheduler.call('process_data', { input: 'oops' });

console.log('\nPress Ctrl+C to stop\n');

// Keep the process running
process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down gracefully...');
    process.exit(0);
});

//Block the process with a fake interval to keep it running

setInterval(() => {}, 1000);
