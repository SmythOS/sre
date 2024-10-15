import path from 'path';
import fs from 'fs';
import { VectorDB } from './VectorDB';
import { JSON2ADL } from './ADL';
import chokidar from 'chokidar';

const vectorDB = new VectorDB();

function reindexTemplates(templatesDir: string) {
    console.log('Reindexing templates...');
    const files = fs.readdirSync(templatesDir);
    const templates = files.filter((file) => file.endsWith('.smyth'));
    vectorDB.clear();
    templates.forEach((template) => {
        const templatePath = path.join(templatesDir, template);
        const templateData = fs.readFileSync(templatePath, 'utf8');
        const templateObject = JSON.parse(templateData);
        const name = templateObject?.name || templateObject?.templateInfo?.name;
        console.log('Indexing template', template, name);
        vectorDB.upsert(templateObject, { name, json: templateObject });
    });
}

export function searchTemplates(query: string, maxResults: number = 10) {
    return vectorDB.search(query, maxResults);
}

export function watchTemplates(templatesDir: string) {
    reindexTemplates(templatesDir);

    const debouncedReindex = debounce(
        () => {
            reindexTemplates(templatesDir);
        },
        1000,
        { leading: false, trailing: true, maxWait: 10000 }
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
