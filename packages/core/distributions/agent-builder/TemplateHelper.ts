import path from 'path';
import fs from 'fs';
import { VectorDB } from './VectorDB';
import { JSON2ADL } from './ADL';
import chokidar from 'chokidar';

const templatesVectorDB = new VectorDB();
const workflowsVectorDB = new VectorDB();

function reindexTemplates(templatesDir: string) {
    console.log('Reindexing templates...');
    const files = fs.readdirSync(templatesDir);
    const templates = files.filter((file) => file.endsWith('.smyth'));
    templatesVectorDB.clear();
    workflowsVectorDB.clear();
    templates.forEach(async (template) => {
        const templatePath = path.join(templatesDir, template);
        const templateData = fs.readFileSync(templatePath, 'utf8');
        const templateObject = JSON.parse(templateData);
        const name = templateObject?.name || templateObject?.templateInfo?.name;
        console.log('Indexing template', template, name);
        const result:any = await templatesVectorDB.upsert(templateObject, { name, json: templateObject });
        if (result === -1) {
            console.warn('Failed to index template', template);
        }

        const workflows = extractWorkflows(templateObject);
        workflows.forEach(async (workflow) => {
            const result:any = await workflowsVectorDB.upsert(workflow, { json: workflow });
            if (result === -1) {
                console.warn('Failed to index workflow', workflow);
            }
        });
    });
}

export function searchTemplates(query: string, maxResults: number = 10) {
    return templatesVectorDB.search(query, maxResults);
}

export function searchWorkflows(query: string, maxResults: number = 10) {
    return workflowsVectorDB.search(query, maxResults);
}

export function watchTemplates(templatesDir: string) {
    reindexTemplates(templatesDir);

    const debouncedReindex = debounce(
        () => {
            reindexTemplates(templatesDir);
        },
        5000,
        { leading: false, trailing: true, maxWait: 30000 }
    );

    const watcher = chokidar.watch(templatesDir, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 100,
        },
    });

    watcher
        .on('add', (path) => {
            console.log(`File ${path} has been added`);
            debouncedReindex();
        })
        .on('change', (path) => {
            console.log(`File ${path} has been changed`);
            debouncedReindex();
        })
        .on('unlink', (path) => {
            console.log(`File ${path} has been removed`);
            debouncedReindex();
        });

    console.log(`Watching for changes in ${templatesDir}`);
}
function extractWorkflows(data) {
    const { components, connections } = data;

    // Helper function to get all connected components and their connections starting from a componentId
    function getConnectedComponentsAndConnections(componentId) {
        let visited = new Set();
        let toVisit = [componentId];
        let workflowComponents:any[] = [];
        let workflowConnections:any[] = [];

        while (toVisit.length > 0) {
            const currentId = toVisit.pop();
            if (!visited.has(currentId)) {
                visited.add(currentId);

                // Find the component by id and add it to the workflow components
                const component = components.find(c => c.id === currentId);
                if (component) {
                    workflowComponents.push(component);

                    // Find all connections where this component is the source
                    const connectedConns = connections.filter(conn => conn.sourceId === currentId);
                    
                    connectedConns.forEach(conn => {
                        workflowConnections.push(conn);
                        toVisit.push(conn.targetId); // Continue traversing to the target component
                    });
                }
            }
        }

        return {
            components: workflowComponents,
            connections: workflowConnections
        };
    }

    // Extract workflows starting with APIEndpoint components
    const workflows:any[] = [];
    components.forEach(component => {
        if (component.name === 'APIEndpoint') {
            const workflow = getConnectedComponentsAndConnections(component.id);
            workflows.push(workflow);
        }
    });

    return workflows;
}
function debounce(func: Function, wait: number, options: { leading: boolean; trailing: boolean; maxWait?: number }) {
    let timeout: NodeJS.Timeout | null = null;
    let lastCall = 0;

    return function (this: any, ...args: any[]) {
        const now = Date.now();
        const later = () => {
            timeout = null;
            lastCall = now;
            func.apply(this, args);
        };

        if (timeout) {
            clearTimeout(timeout);
        }

        if (options.leading && !timeout) {
            func.apply(this, args);
            lastCall = now;
        }

        if (options.maxWait && now - lastCall >= options.maxWait) {
            func.apply(this, args);
            lastCall = now;
        }

        timeout = setTimeout(later, wait);
    };
}
