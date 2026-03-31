// prettier-ignore-file
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// We test PlannerMode by applying it to a mock agent and extracting the
// process functions registered via addSkill().
// ---------------------------------------------------------------------------

vi.mock('@smythos/sre', () => ({
    DEFAULT_TEAM_ID: 'default',
    AccessCandidate: {
        team: (id: string) => ({ type: 'team', id }),
    },
    ConnectorService: {
        getModelsProviderConnector() { return null; },
        getLLMConnector() { return null; },
        getStorageConnector() { return null; },
        init() { return null; },
    },
    SRE: { init: vi.fn(), ready: vi.fn().mockResolvedValue(true), initializing: false },
}));

import PlannerMode from '../../../src/Agent/mode/Planner.mode';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockAgent() {
    const skills: Record<string, any> = {};
    const emitted: Array<{ event: string; args: any[] }> = [];
    let _behavior = '';

    const agent: any = {
        get behavior() { return _behavior; },
        set behavior(v: string) { _behavior = v; },
        emit(event: string, ...args: any[]) {
            emitted.push({ event, args });
        },
        on: vi.fn(),
        off: vi.fn(),
        addSkill(opts: any) {
            const skill: any = {
                data: { endpoint: opts.name },
                process: opts.process,
                in: vi.fn(),
            };
            skills[opts.name] = skill;
            return skill;
        },
        removeSkill(name: string) {
            delete skills[name];
        },
        structure: { components: [] },
    };

    return { agent, skills, emitted };
}

/** Helper to get the process function for a skill */
function getProcess(skills: Record<string, any>, name: string) {
    return skills[name]?.process;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PlannerMode', () => {
    let agent: any;
    let skills: Record<string, any>;
    let emitted: Array<{ event: string; args: any[] }>;

    beforeEach(() => {
        const mock = createMockAgent();
        agent = mock.agent;
        skills = mock.skills;
        emitted = mock.emitted;
    });

    // ── apply / remove ────────────────────────────────────────────────

    describe('apply()', () => {
        it('appends planner prompt to agent behavior', () => {
            agent.behavior = 'Base behavior';
            PlannerMode.apply(agent);
            expect(agent.behavior).toContain('Modus Operandi');
            expect(agent.behavior).toContain('Base behavior');
        });

        it('registers all 5 skills', () => {
            PlannerMode.apply(agent);
            expect(skills['_sre_Plan_Tasks']).toBeDefined();
            expect(skills['_sre_AddSubTasks']).toBeDefined();
            expect(skills['_sre_UpdateTasks']).toBeDefined();
            expect(skills['_sre_TasksCompleted']).toBeDefined();
            expect(skills['_sre_clearTasks']).toBeDefined();
        });

        it('calls .in() on skills to define inputs', () => {
            PlannerMode.apply(agent);
            expect(skills['_sre_Plan_Tasks'].in).toHaveBeenCalled();
            expect(skills['_sre_AddSubTasks'].in).toHaveBeenCalled();
        });
    });

    describe('remove()', () => {
        it('removes all 5 skills', () => {
            PlannerMode.apply(agent);
            PlannerMode.remove(agent);
            expect(skills['_sre_Plan_Tasks']).toBeUndefined();
            expect(skills['_sre_AddSubTasks']).toBeUndefined();
            expect(skills['_sre_UpdateTasks']).toBeUndefined();
            expect(skills['_sre_TasksCompleted']).toBeUndefined();
            expect(skills['_sre_clearTasks']).toBeUndefined();
        });

        it('strips planner prompt from behavior', () => {
            agent.behavior = 'Base behavior';
            PlannerMode.apply(agent);
            expect(agent.behavior).toContain('Modus Operandi');
            PlannerMode.remove(agent);
            expect(agent.behavior).not.toContain('Modus Operandi');
            expect(agent.behavior).toBe('Base behavior');
        });
    });

    // ── _sre_Plan_Tasks ──────────────────────────────────────────────

    describe('_sre_Plan_Tasks process', () => {
        beforeEach(() => PlannerMode.apply(agent));

        it('adds tasks from object', async () => {
            const process = getProcess(skills, '_sre_Plan_Tasks');
            const result = await process({
                tasksList: {
                    'task-1': { description: 'Do something', status: 'planned' },
                    'task-2': { description: 'Do more', status: 'planned' },
                },
            });
            expect(result).toHaveProperty('task-1');
            expect(result).toHaveProperty('task-2');
            expect(result['task-1'].description).toBe('Do something');
        });

        it('parses JSON string tasksList', async () => {
            const process = getProcess(skills, '_sre_Plan_Tasks');
            const result = await process({
                tasksList: JSON.stringify({ 't1': { description: 'Test', status: 'planned' } }),
            });
            expect(result['t1'].description).toBe('Test');
        });

        it('returns error on invalid JSON string', async () => {
            const process = getProcess(skills, '_sre_Plan_Tasks');
            const result = await process({ tasksList: 'not json{' });
            expect(result).toContain('Error parsing');
        });

        it('converts string task values to objects with status planned', async () => {
            const process = getProcess(skills, '_sre_Plan_Tasks');
            const result = await process({
                tasksList: { 't1': 'Simple description' },
            });
            expect(result['t1'].description).toBe('Simple description');
            expect(result['t1'].status).toBe('planned');
        });

        it('emits TasksAdded event', async () => {
            const process = getProcess(skills, '_sre_Plan_Tasks');
            const input = { 't1': { description: 'Test', status: 'planned' } };
            await process({ tasksList: input });
            const event = emitted.find(e => e.event === 'TasksAdded');
            expect(event).toBeDefined();
            expect(event!.args[0]).toEqual(input);
        });

        it('accumulates tasks across multiple calls', async () => {
            const process = getProcess(skills, '_sre_Plan_Tasks');
            await process({ tasksList: { 't1': 'First' } });
            const result = await process({ tasksList: { 't2': 'Second' } });
            expect(result).toHaveProperty('t1');
            expect(result).toHaveProperty('t2');
        });
    });

    // ── _sre_AddSubTasks ─────────────────────────────────────────────

    describe('_sre_AddSubTasks process', () => {
        beforeEach(async () => {
            PlannerMode.apply(agent);
            // Seed a parent task
            await getProcess(skills, '_sre_Plan_Tasks')({
                tasksList: { 'parent': { description: 'Parent task', status: 'planned' } },
            });
        });

        it('adds subtasks to existing parent', async () => {
            const process = getProcess(skills, '_sre_AddSubTasks');
            const result = await process({
                taskId: 'parent',
                subTasksList: {
                    'sub1': { description: 'Sub 1', status: 'planned' },
                },
            });
            expect(result['parent'].subtasks['sub1'].description).toBe('Sub 1');
            expect(result['parent'].subtasks['sub1'].parentTaskId).toBe('parent');
        });

        it('returns error when parent task does not exist', async () => {
            const process = getProcess(skills, '_sre_AddSubTasks');
            const result = await process({
                taskId: 'nonexistent',
                subTasksList: { 's1': 'Sub' },
            });
            expect(result).toContain('Error');
            expect(result).toContain('nonexistent');
        });

        it('parses JSON string subTasksList', async () => {
            const process = getProcess(skills, '_sre_AddSubTasks');
            const result = await process({
                taskId: 'parent',
                subTasksList: JSON.stringify({ 'sub1': { description: 'From JSON', status: 'planned' } }),
            });
            expect(result['parent'].subtasks['sub1'].description).toBe('From JSON');
        });

        it('returns error on invalid JSON string subtasks', async () => {
            const process = getProcess(skills, '_sre_AddSubTasks');
            const result = await process({
                taskId: 'parent',
                subTasksList: 'bad json{',
            });
            expect(result).toContain('Error parsing');
        });

        it('converts string subtask values to objects', async () => {
            const process = getProcess(skills, '_sre_AddSubTasks');
            const result = await process({
                taskId: 'parent',
                subTasksList: { 'sub1': 'Quick subtask' },
            });
            expect(result['parent'].subtasks['sub1'].description).toBe('Quick subtask');
            expect(result['parent'].subtasks['sub1'].status).toBe('planned');
            expect(result['parent'].subtasks['sub1'].parentTaskId).toBe('parent');
        });

        it('emits SubTasksAdded event', async () => {
            const process = getProcess(skills, '_sre_AddSubTasks');
            await process({
                taskId: 'parent',
                subTasksList: { 'sub1': 'test' },
            });
            const event = emitted.find(e => e.event === 'SubTasksAdded');
            expect(event).toBeDefined();
            expect(event!.args[0]).toBe('parent');
        });
    });

    // ── _sre_UpdateTasks ─────────────────────────────────────────────

    describe('_sre_UpdateTasks process', () => {
        beforeEach(async () => {
            PlannerMode.apply(agent);
            await getProcess(skills, '_sre_Plan_Tasks')({
                tasksList: { 't1': { description: 'Task 1', status: 'planned' } },
            });
            await getProcess(skills, '_sre_AddSubTasks')({
                taskId: 't1',
                subTasksList: { 's1': { description: 'Sub 1', status: 'planned' } },
            });
        });

        it('updates a top-level task status', async () => {
            const process = getProcess(skills, '_sre_UpdateTasks');
            const result = await process({ taskId: 't1', status: 'ongoing' });
            expect(result['t1'].status).toBe('ongoing');
        });

        it('updates a subtask status via dot notation', async () => {
            const process = getProcess(skills, '_sre_UpdateTasks');
            const result = await process({ taskId: 't1.s1', status: 'completed' });
            expect(result['t1'].subtasks['s1'].status).toBe('completed');
        });

        it('returns error for nonexistent task', async () => {
            const process = getProcess(skills, '_sre_UpdateTasks');
            const result = await process({ taskId: 'xxx', status: 'completed' });
            expect(result).toContain('Error');
            expect(result).toContain('xxx');
        });

        it('returns error for nonexistent subtask', async () => {
            const process = getProcess(skills, '_sre_UpdateTasks');
            const result = await process({ taskId: 't1.nonexistent', status: 'completed' });
            expect(result).toContain('Error');
            expect(result).toContain('nonexistent');
        });

        it('emits TasksUpdated event', async () => {
            const process = getProcess(skills, '_sre_UpdateTasks');
            await process({ taskId: 't1', status: 'completed' });
            const event = emitted.find(e => e.event === 'TasksUpdated');
            expect(event).toBeDefined();
            expect(event!.args[0]).toBe('t1');
            expect(event!.args[1]).toBe('completed');
        });
    });

    // ── _sre_TasksCompleted ──────────────────────────────────────────

    describe('_sre_TasksCompleted process', () => {
        beforeEach(() => PlannerMode.apply(agent));

        it('returns success when all tasks completed', async () => {
            await getProcess(skills, '_sre_Plan_Tasks')({
                tasksList: { 't1': { description: 'Done', status: 'completed' } },
            });
            const process = getProcess(skills, '_sre_TasksCompleted');
            const result = await process();
            expect(result).toBe('All tasks and subtasks are completed');
        });

        it('emits TasksCompleted event when all done', async () => {
            await getProcess(skills, '_sre_Plan_Tasks')({
                tasksList: { 't1': { description: 'Done', status: 'completed' } },
            });
            await getProcess(skills, '_sre_TasksCompleted')();
            const event = emitted.find(e => e.event === 'TasksCompleted');
            expect(event).toBeDefined();
        });

        it('reports incomplete tasks', async () => {
            await getProcess(skills, '_sre_Plan_Tasks')({
                tasksList: {
                    't1': { description: 'Done', status: 'completed' },
                    't2': { description: 'Not done', status: 'ongoing' },
                },
            });
            const result = await getProcess(skills, '_sre_TasksCompleted')();
            expect(result).toContain('Not all tasks');
            expect(result).toContain('t2');
        });

        it('reports incomplete subtasks', async () => {
            await getProcess(skills, '_sre_Plan_Tasks')({
                tasksList: { 't1': { description: 'Done', status: 'completed' } },
            });
            await getProcess(skills, '_sre_AddSubTasks')({
                taskId: 't1',
                subTasksList: { 's1': { description: 'Not done', status: 'planned' } },
            });
            const result = await getProcess(skills, '_sre_TasksCompleted')();
            expect(result).toContain('Not all tasks');
            expect(result).toContain('t1.s1');
        });

        it('returns success with no tasks', async () => {
            const result = await getProcess(skills, '_sre_TasksCompleted')();
            expect(result).toBe('All tasks and subtasks are completed');
        });
    });

    // ── _sre_clearTasks ──────────────────────────────────────────────

    describe('_sre_clearTasks process', () => {
        beforeEach(() => PlannerMode.apply(agent));

        it('clears all tasks', async () => {
            await getProcess(skills, '_sre_Plan_Tasks')({
                tasksList: { 't1': 'A task', 't2': 'Another' },
            });
            const result = await getProcess(skills, '_sre_clearTasks')();
            expect(result).toBe('Tasks cleared');

            // Verify tasks are actually cleared
            const completed = await getProcess(skills, '_sre_TasksCompleted')();
            expect(completed).toBe('All tasks and subtasks are completed');
        });

        it('emits TasksCleared event', async () => {
            await getProcess(skills, '_sre_clearTasks')();
            const event = emitted.find(e => e.event === 'TasksCleared');
            expect(event).toBeDefined();
        });
    });
});
