import { Agent, Schedule, Job } from '@smythos/sdk';
import { ConnectorService } from '@smythos/sre';

/**
 * This example demonstrates using scheduler directly from an agent
 * Jobs are scoped to the agent automatically
 */

// Create an agent with explicit ID
const agent = new Agent({
    id: 'data-processor',
    name: 'Data Processor',
    model: 'gpt-4o-mini',
    behavior: 'You are a data processing specialist.',
});

// Add skills
agent.addSkill({
    name: 'process_batch',
    description: 'Process a batch of data',
    process: async (data: { batch_id?: string }) => {
        const batchId = data?.batch_id || `batch-${Date.now()}`;
        console.log(`⚙️  Processing ${batchId} at ${new Date().toLocaleTimeString()}`);

        // Simulate processing
        const recordsProcessed = Math.floor(Math.random() * 1000) + 100;

        return {
            success: true,
            batch_id: batchId,
            records_processed: recordsProcessed,
            timestamp: new Date().toISOString(),
        };
    },
});

agent.addSkill({
    name: 'analyze_results',
    description: 'Analyze processing results',
    process: async () => {
        console.log(`📊 Analyzing results at ${new Date().toLocaleTimeString()}`);
        return {
            success: true,
            total_processed: Math.floor(Math.random() * 10000),
            avg_time: Math.floor(Math.random() * 5000) + 'ms',
        };
    },
});

await agent.ready;

// Save agent so scheduler can access it
const agentDataConnector = ConnectorService.getAgentDataConnector();
await agentDataConnector.saveAgent(agent.data.id, agent.data);

// Access scheduler from agent
const scheduler = agent.scheduler.default();

console.log('🤖 Setting up agent-scoped scheduler...\n');

// Add data processing job
await scheduler.add(
    'batch-processor',
    Schedule.every('30s'),
    new Job({
        type: 'skill',
        agentId: agent.data.id,
        skillName: 'process_batch',
        args: { batch_id: 'auto' },
        metadata: {
            name: 'Batch Processor',
            description: 'Processes data batches every 30 seconds',
            retryOnFailure: true,
            maxRetries: 2,
        },
    })
);

// Add analysis job
await scheduler.add(
    'analyzer',
    Schedule.every('1m'),
    new Job({
        type: 'skill',
        agentId: agent.data.id,
        skillName: 'analyze_results',
        metadata: {
            name: 'Results Analyzer',
            description: 'Analyzes processing results every minute',
        },
    })
);

// Add AI-powered insights job
await scheduler.add(
    'ai-insights',
    Schedule.every('2m'),
    new Job({
        type: 'prompt',
        agentId: agent.data.id,
        prompt: 'Analyze the data processing trends and provide optimization suggestions',
        metadata: {
            name: 'AI Optimization Insights',
            description: 'AI-generated optimization recommendations',
        },
    })
);

// Add quality check job
await scheduler.add(
    'quality-check',
    Schedule.every('90s'),
    new Job({
        type: 'prompt',
        agentId: agent.data.id,
        prompt: 'Check data quality metrics and report any anomalies',
        metadata: {
            name: 'Quality Monitor',
            description: 'Monitors data quality',
        },
    })
);

console.log('✅ All agent jobs scheduled\n');

// List jobs
const jobs = await scheduler.list();
console.log(`📋 Agent has ${jobs.length} scheduled jobs:\n`);

jobs.forEach((job) => {
    const config = job.jobConfig;
    console.log(`• ${config.metadata.name}`);
    console.log(`  Type: ${config.type === 'skill' ? `Skill (${config.type === 'skill' ? config.skillName : ''})` : 'AI Prompt'}`);
    console.log(`  Interval: ${job.schedule.interval}`);
    console.log(`  Status: ${job.status}`);
    console.log('');
});

console.log('💡 All jobs are agent-scoped and fully serializable');
console.log('🔄 They will resume after restart automatically\n');
console.log('Press Ctrl+C to stop\n');

process.on('SIGINT', () => {
    console.log('\n👋 Stopping scheduler...');
    process.exit(0);
});
