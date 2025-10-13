import { Agent, Schedule, Job, Scope } from '@smythos/sdk';
import { ConnectorService } from '@smythos/sre';

/**
 * This example demonstrates job isolation between agents and team-scoped sharing
 */

// Create two agents in the same team
const agentAlpha = new Agent({
    id: 'agent-alpha',
    teamId: 'operations-team',
    name: 'Agent Alpha',
    behavior: 'You handle database operations.',
    model: 'gpt-4o-mini',
});

// Add skills to Agent Alpha
agentAlpha.addSkill({
    name: 'backup_database',
    description: 'Backup the database',
    process: async () => {
        console.log('[Alpha] Running database backup...');
        return { success: true, timestamp: new Date().toISOString() };
    },
});

const agentBeta = new Agent({
    id: 'agent-beta',
    teamId: 'operations-team',
    name: 'Agent Beta',
    behavior: 'You handle API monitoring.',
    model: 'gpt-4o-mini',
});

// Add skills to Agent Beta
agentBeta.addSkill({
    name: 'monitor_api',
    description: 'Monitor API endpoints',
    process: async () => {
        console.log('[Beta] Monitoring API endpoints...');
        return { success: true, endpoints_checked: 15 };
    },
});

agentBeta.addSkill({
    name: 'cleanup',
    description: 'Cleanup temporary files',
    process: async () => {
        console.log('[Team] Running team-wide cleanup...');
        return { success: true, cleaned: '250MB' };
    },
});

agentBeta.addSkill({
    name: 'generate_report',
    description: 'Generate team report',
    process: async () => {
        console.log('[Team] Generating team report...');
        return { success: true, report_id: Date.now() };
    },
});

// Wait for both agents to be ready
await agentAlpha.ready;
await agentBeta.ready;

// Save both agents
const agentDataConnector = ConnectorService.getAgentDataConnector();
await agentDataConnector.saveAgent(agentAlpha.data.id, agentAlpha.data);
await agentDataConnector.saveAgent(agentBeta.data.id, agentBeta.data);

console.log('=== Part 1: Isolated Agent Schedulers ===\n');

// Each agent has its own isolated scheduler
const alphaScheduler = agentAlpha.scheduler.default();
const betaScheduler = agentBeta.scheduler.default();

// Agent Alpha adds a database backup job
await alphaScheduler.add(
    'db-backup',
    Schedule.every('2h'),
    new Job({
        type: 'skill',
        agentId: agentAlpha.data.id,
        skillName: 'backup_database',
        metadata: {
            name: 'Database Backup',
            description: 'Alpha backup job',
        },
    })
);

// Agent Beta adds an API monitoring job
await betaScheduler.add(
    'api-monitor',
    Schedule.every('5m'),
    new Job({
        type: 'skill',
        agentId: agentBeta.data.id,
        skillName: 'monitor_api',
        metadata: {
            name: 'API Monitor',
            description: 'Beta monitoring job',
        },
    })
);

// Agent Alpha tries to access its jobs - sees only its own
const alphaJobs = await alphaScheduler.list();
console.log(`Alpha sees ${alphaJobs.length} job(s):`);
alphaJobs.forEach((job) => console.log(`  - ${job.jobConfig.metadata.name} (${job.id})`));

// Agent Beta tries to access its jobs - sees only its own
const betaJobs = await betaScheduler.list();
console.log(`\nBeta sees ${betaJobs.length} job(s):`);
betaJobs.forEach((job) => console.log(`  - ${job.jobConfig.metadata.name} (${job.id})`));

// Alpha cannot see Beta's jobs
const betaJobFromAlpha = await alphaScheduler.get('api-monitor');
console.log(`\nAlpha trying to access Beta's job: ${betaJobFromAlpha ? 'Found' : 'Not found (isolated ✓)'}`);

console.log('\n=== Part 2: Team-Scoped Shared Scheduler ===\n');

// Create team-scoped schedulers (shared across team members)
const alphaTeamScheduler = agentAlpha.scheduler.default({ scope: Scope.TEAM });
const betaTeamScheduler = agentBeta.scheduler.default({ scope: Scope.TEAM });

// Alpha adds a team-wide job (using Beta's skill for cleanup)
await alphaTeamScheduler.add(
    'team-cleanup',
    Schedule.every('1d'),
    new Job({
        type: 'skill',
        agentId: agentBeta.data.id, // Alpha can schedule Beta's skill for team
        skillName: 'cleanup',
        metadata: {
            name: 'Team Cleanup',
            description: 'Shared team job created by Alpha',
        },
    })
);

// Beta adds another team-wide job
await betaTeamScheduler.add(
    'team-report',
    Schedule.cron('0 18 * * 5'), // Every Friday at 6 PM
    new Job({
        type: 'skill',
        agentId: agentBeta.data.id,
        skillName: 'generate_report',
        metadata: {
            name: 'Team Weekly Report',
            description: 'Shared team job created by Beta',
        },
    })
);

// Both agents see all team jobs
const alphaTeamJobs = await alphaTeamScheduler.list();
console.log(`Alpha sees ${alphaTeamJobs.length} team job(s):`);
alphaTeamJobs.forEach((job) => console.log(`  - ${job.jobConfig.metadata.name} (${job.id})`));

const betaTeamJobs = await betaTeamScheduler.list();
console.log(`\nBeta sees ${betaTeamJobs.length} team job(s):`);
betaTeamJobs.forEach((job) => console.log(`  - ${job.jobConfig.metadata.name} (${job.id})`));

// Beta can access and manage team jobs created by Alpha
const teamCleanupJob = await betaTeamScheduler.get('team-cleanup');
console.log(`\nBeta accessing Alpha's team job: ${teamCleanupJob ? 'Found ✓' : 'Not found'}`);

// Beta can pause Alpha's team job
await betaTeamScheduler.pause('team-cleanup');
console.log('Beta paused team cleanup job (created by Alpha)');

console.log('\n=== Summary ===');
console.log(`✓ Agent-scoped jobs are isolated per agent`);
console.log(`✓ Team-scoped jobs are shared across all team members`);
console.log(`Agents: Alpha (${alphaJobs.length} personal jobs), Beta (${betaJobs.length} personal jobs)`);
console.log(`Team: ${alphaTeamJobs.length} shared jobs`);

// Keep running to demonstrate
console.log('\nPress Ctrl+C to stop\n');

process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
});
