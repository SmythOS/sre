import { Agent } from '../Agent.class';
//Also Before any action (tool call, writing, responding, ...etc) call _sre_StatusUpdate to update the user on your next action.
const _planner_prompt = `
=========================
Modus Operandi:
=========================
You are operating in planner mode, designed to handle complex tasks systematically and transparently.

## Core Planning Principles

When you receive a complex or multi-step task, you MUST:
1. **Plan first, act second**: Always create a plan before taking any action or calling tools, in this step you should break down the task into clear, actionable steps
2. **Stay focused**: Stick to the user's request without extrapolating unnecessarily
3. **Fill knowledge gaps**: If you lack information needed to complete a step, explicitly add a step to search for it or ask the user

## Planning Workflow

### Creating Plans
- Prepare your plan within <planning></planning> tags
- Use _sre_Plan_Tasks to formally track the steps that you planned
- Ensure each step is specific and contributes directly to achieving the user's goal
- *Do NOT* reveal the plan details to the user in your response, keep it inside <planning></planning> tags

### Managing Tasks
- **Breaking down complexity**: When processing a task that contains multiple steps, decompose it further using _sre_AddSubTasks
- **Maintaining status**: Update task and subtask status before and after *every* action (tool calls, responses, questions, etc.) using _sre_UpdateTasks
- **Marking completion**: After writing a response that completes a task, call _sre_UpdateTasks to mark that task as "completed"
- **Resetting**: If you need to start a completely new plan, call _sre_ClearTasks to clear existing tasks

### Verification
Once you finish answering the user, *ALWAYS* call _sre_TasksCompleted to:
- Update the plan status
- Verify that no steps were missed
- Ensure the user's request has been fully addressed

## Communication Guidelines

### Transparency
- **Express your reasoning**: Always share your thought process with the user inside <thinking> tags
- **Use thinking tags**: Wrap internal reasoning and any informations about the plan, the tasks and the tools that starts with _sre_* in <thinking></thinking> tags on separate lines
- **Announce actions**: Inform the user of your next step after every tool call that is not part of the _sre_* tools 
- **Iterate openly**: You can include multiple <thinking> blocks in a single response to question previous answers or explore alternative approaches when stuck

### Typical pattern after a user question:
\`\`\`
<thinking>
The user asked about .... so I need to ....
</thinking>
I will help you with that by ... 

<planning>
- Task 1: ...
- Task 2: ...
- Task 3: ...
</planning>


<thinking>
Before I start, I need to plan the tasks first 
</thinking>
(call _sre_Plan_Tasks)


<thinking>
Now I need to ... for that I will ...
</thinking>

Ok, now I need to search for the information ...

(e.g call search tool if needed)
(e.g call _sre_UpdateTasks to update the task status if needed)

Great, now I need to address ... 

<thinking>
humm it seems that this task is more complex than I thought, I need to break it down into smaller tasks
</thinking>
(call _sre_AddSubTasks)

(e.g call tools if needed)
(e.g call _sre_UpdateTasks to update the task status if needed)

<thinking>
I have now everything I need to answer the user's question, let me write the answer ...
</thinking>

(...write your answer...)

(*Never* say something like "Now I'll update the tasks" in a separate line, this kind of statement should be inside <thinking> tags)
(call _sre_TasksCompleted to verify that no steps were missed)

\`\`\`

### Tag Usage Rules
- Special tags like <thinking> and <planning> must NOT be nested
- Each tag must be properly closed before opening another tag of the same type
- Keep tags on separate lines for readability
- *Always* call _sre_Plan_Tasks after <planning> 
- *Never* call a tool before adding tasks to the planner using _sre_Plan_Tasks 


## Action Sequence Summary

For every user request:
1. **Think** aloud (in <thinking> tags) before and during actions. IMPORTANT: after *EVERY* user question, you should at least use <thinking> once before anything else.
2. **Analyze** the request complexity
3. **Plan** the approach (in <planning> tags)
4. **Add tasks** to the planner using _sre_Plan_Tasks
5. **Execute** each step sequentially
6. **Update** task status continuously (_sre_UpdateTasks, _sre_AddSubTasks, _sre_UpdateSubTasks)
7. **Communicate** your next action to the user
8. **Verify** completion (_sre_TasksCompleted)

## Remember
- Never act before planning
- Never call a tool before adding tasks to the planner using _sre_Plan_Tasks 
- Keep the user informed at every step
- Maintain accurate task status throughout
- Always verify completion before finishing
`;
export default class PlannerMode {
    static apply(agent: Agent) {
        agent.behavior += _planner_prompt;

        const _tasks = {};

        const addTasksSkill = agent.addSkill({
            name: '_sre_Plan_Tasks',
            description:
                'Use this skill to add tasks to the planner. This should *always* be called after <planning> tag to ensure that the tasks are added to the planner',
            process: async ({ tasksList }) => {
                //taskList structure :  {"task-id" : {description: "task description", summary:"concise task description in 10 words", status:<planned | ongoing | completed>} }

                if (typeof tasksList === 'string') {
                    try {
                        tasksList = JSON.parse(tasksList);
                    } catch (error) {
                        return `Error parsing tasks list, the tasks list is not a valid json object`;
                    }
                }

                for (const taskId in tasksList) {
                    const task = tasksList[taskId];
                    let _taskObj = {};
                    if (typeof task === 'string') {
                        _taskObj = { description: task, status: 'planned' };
                    } else {
                        _taskObj = task;
                    }

                    _tasks[taskId] = _taskObj;
                }

                //emit the tasks added event
                agent.emit('TasksAdded', tasksList, _tasks);

                return _tasks;
            },
        });
        addTasksSkill.in({
            tasksList: {
                type: 'Any',
                description:
                    'The tasks list to add to the planner, it should be a json object with the following structure: {"task-id" : {description: "task description", summary:"concise task description in 10 words", status:<planned | ongoing | completed>}, ... }',
            },
        });

        const addSubTasksSkill = agent.addSkill({
            name: '_sre_AddSubTasks',
            description:
                'Use this skill to add sub-tasks to a task in the planner, the sub-tasks list should be a json object with the following structure: {"sub-task-id" : {description: "sub-task description", summary:"concise sub-task description in 10 words", status:<planned | ongoing | completed>, parentTaskId: "the id of the parent task"}, ... }',
            process: async ({ taskId, subTasksList }) => {
                // Validate that parent task exists
                if (!_tasks[taskId]) {
                    return `Error: Parent task with ID "${taskId}" does not exist`;
                }

                if (typeof subTasksList === 'string') {
                    try {
                        subTasksList = JSON.parse(subTasksList);
                    } catch (error) {
                        return `Error parsing subtasks list, the subtasks list is not a valid json object`;
                    }
                }

                // Initialize subtasks object if it doesn't exist
                if (!_tasks[taskId].subtasks) {
                    _tasks[taskId].subtasks = {};
                }

                // Add each subtask
                for (const subTaskId in subTasksList) {
                    const subTask = subTasksList[subTaskId];
                    let _subTaskObj = {};
                    if (typeof subTask === 'string') {
                        _subTaskObj = {
                            description: subTask,
                            status: 'planned',
                            parentTaskId: taskId,
                        };
                    } else {
                        _subTaskObj = {
                            ...subTask,
                            parentTaskId: taskId,
                        };
                    }

                    _tasks[taskId].subtasks[subTaskId] = _subTaskObj;
                }

                //emit the subtasks added event
                agent.emit('SubTasksAdded', taskId, subTasksList, _tasks);
                return _tasks;
            },
        });
        addSubTasksSkill.in({
            taskId: {
                type: 'Text',
                description: 'The ID of the parent task to add subtasks to',
            },
            subTasksList: {
                type: 'Any',
                description:
                    'The subtasks list to add to the parent task, it should be a json object with the following structure: {"sub-task-id" : {description: "sub-task description", summary:"concise sub-task description in 10 words", status:<planned | ongoing | completed>}, ... }',
            },
        });

        const updateTasksSkill = agent.addSkill({
            name: '_sre_UpdateTasks',
            description: 'Use this skill to update the status of a task or subtask in the planner. For subtasks, use format "parentTaskId.subtaskId"',
            process: async ({ taskId, status }) => {
                // Check if this is a subtask (contains a dot)
                if (taskId.includes('.')) {
                    const [parentId, subTaskId] = taskId.split('.');
                    if (_tasks[parentId] && _tasks[parentId].subtasks && _tasks[parentId].subtasks[subTaskId]) {
                        _tasks[parentId].subtasks[subTaskId].status = status;
                    } else {
                        return `Error: Subtask "${subTaskId}" not found in parent task "${parentId}"`;
                    }
                } else {
                    // Regular task update
                    if (_tasks[taskId]) {
                        _tasks[taskId].status = status;
                    } else {
                        return `Error: Task "${taskId}" not found`;
                    }
                }

                // Update the sticky tasks panel
                agent.emit('TasksUpdated', taskId, status, _tasks);
                return _tasks;
            },
        });

        const tasksCompleted = agent.addSkill({
            name: '_sre_TasksCompleted',
            description: 'Call this skill when finish your current job',
            process: async () => {
                const missingTasks = [];
                let allCompleted = true;

                // Check main tasks and their subtasks
                for (const taskId in _tasks) {
                    const task = _tasks[taskId];

                    // Check main task
                    if (task.status !== 'completed') {
                        allCompleted = false;
                        missingTasks.push(taskId);
                    }

                    // Check subtasks if they exist
                    if (task.subtasks) {
                        for (const subTaskId in task.subtasks) {
                            const subTask = task.subtasks[subTaskId];
                            if (subTask.status !== 'completed') {
                                allCompleted = false;
                                missingTasks.push(`${taskId}.${subTaskId}`);
                            }
                        }
                    }
                }

                if (!allCompleted) {
                    return `Not all tasks are completed, the following tasks/subtasks are missing: ${missingTasks.join(', ')}`;
                }

                // Update the sticky tasks panel
                agent.emit('TasksCompleted', _tasks);
                return 'All tasks and subtasks are completed';
            },
        });

        const statusUpdate = agent.addSkill({
            name: '_sre_clearTasks',
            description:
                'Call this skill to clear the tasks from the planner, use this skill when you finish your current job and need to start a brand new plan',
            process: async () => {
                for (const taskId in _tasks) {
                    delete _tasks[taskId];
                }
                agent.emit('TasksCleared', _tasks);
                return 'Tasks cleared';
            },
        });

        // agent.addSkill({
        //     name: '_sre_StatusUpdate',
        //     description:
        //         "Call this skill to update the communicated status of the Agent, use this to tell the user what you'll be doing in the next step, it should be a very short summary of your next action",
        //     process: async ({ status }) => {
        //         agent.emit('StatusUpdated', status);
        //         return "Status updated, don't forget to update the tasks";
        //     },
        // });
    }

    static remove(agent: Agent) {
        agent.removeSkill('_sre_Plan_Tasks');
        agent.removeSkill('_sre_AddSubTasks');
        agent.removeSkill('_sre_UpdateTasks');
        agent.removeSkill('_sre_TasksCompleted');
        agent.removeSkill('_sre_clearTasks');
        agent.behavior = agent.behavior.replace(_planner_prompt, '');
    }
}
