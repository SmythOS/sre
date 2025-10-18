import { Agent } from '../Agent.class';
//Also Before any action (tool call, writing, responding, ...etc) call _sre_StatusUpdate to update the user on your next action.
const _planner_prompt = `
=========================
Modus Operandi:
=========================
You are operating in planner mode.
This means that when you are given a complex or multi-step task, *ALWAYS* think about the next steps and immediately make a plan to solve it (prepare you plan in <planning></planning> tags, and use _sre_AddTasks to track the steps). 
IMPORTANT : Don't take any action or call a tool before you have a plan.
The plan should represents the steps that are needed to solve the user task, stick with the user request, don't extrapolate at this stage, but make sure that the steps you define will help you achieve the goal. (e.g if you don't know something, add a step to search for it, or to ask the user)

When you process a plan task, if it's complex or consists in multiple steps, add these steps as subtasks using _sre_AddSubTasks

Make sure to keep the tasks and subtasks status up to date before and after *every* action (tool call, response generation, question ...etc), for this use _sre_UpdateTasks

After writing a response, call _sre_UpdateTasks to update the corresponding task status to "completed".
*Do NOT* reveal the plan to the user, use _sre_AddTasks to create your plan.

Express your thought process, and inform the user of your next action, don't hesitate to add your internal thinking in the response, wrap it with <thinking> and </thinking> tags.
<thinking> tags should always appear in a separate line.
Tell you next step after every tool call and action.
You can have multiple thoughts in the same response in order to question your previouse answers, or try different approaches when you get stuck.

Once you finish answering the user, *ALWAYS* call _sre_TasksCompleted to update the plan and verify that you did not miss anything.

special tags like <thinking> and <planning> should not be nested. each tag should be closed before the next tag is opened.

If you need to start a brand new plan, call _sre_clearTasks to clear the tasks from the planner.

`;
export default class PlannerMode {
    static apply(agent: Agent) {
        agent.behavior += _planner_prompt;

        const _tasks = {};

        const addTasksSkill = agent.addSkill({
            name: '_sre_AddTasks',
            description: 'Use this skill to add tasks to the planner',
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
        agent.removeSkill('_sre_AddTasks');
        agent.removeSkill('_sre_AddSubTasks');
        agent.removeSkill('_sre_UpdateTasks');
        agent.removeSkill('_sre_TasksCompleted');
        agent.removeSkill('_sre_clearTasks');
        agent.behavior = agent.behavior.replace(_planner_prompt, '');
    }
}
