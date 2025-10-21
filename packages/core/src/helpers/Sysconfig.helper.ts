import path from 'path';
import fs from 'fs';
import os from 'os';

export function findSmythPath(_path: string = '', callback?: (smythDir: string, success?: boolean, nextDir?: string) => void) {
    //TODO : also search for a local sre configuration file indicating .smyth folder explicitly

    let _smythDir = '';

    if (_path) {
        _smythDir = findSmythPath('');
    }

    const searchDirectories = [];

    if (process.env.SMYTH_PATH) {
        if (!fs.existsSync(process.env.SMYTH_PATH)) {
            console.error('CRITICAL : SMYTH_PATH environment variable is not a valid directory');
            process.exit(1);
        }

        const envDir = path.resolve(process.env.SMYTH_PATH, _path);
        //check if the directory exists
        if (!fs.existsSync(envDir)) {
            callback?.(envDir, false, null);
            console.error(`CRITICAL : missing directory (${envDir}) under SMYTH_PATH `);
            //process.exit(1);
        } else {
            callback?.(envDir, true, null);
        }
        return envDir;
    }

    const isElectron = !!process.versions.electron;
    let execPath = '';
    if (isElectron) {
        // In packaged Electron apps, use resourcesPath if available
        if ((process as any).resourcesPath) {
            // process.resourcesPath points to the 'resources' folder in packaged app
            // Go up one level to get the app directory
            execPath = path.dirname((process as any).resourcesPath);
        } else {
            // Development mode or fallback
            execPath = path.dirname(process.execPath);
        }
    } else {
        execPath = process.cwd();
    }
    // 1. Try to find in local directory (the directory from which the program was run)
    const localDir = path.resolve(execPath, '.smyth', _path);
    searchDirectories.push(localDir);

    // 2. Try to find from main script's directory (entry point)
    const mainScriptPath = process.argv[1];
    const mainScriptDir = mainScriptPath ? path.dirname(path.resolve(mainScriptPath)) : null;
    if (mainScriptDir) {
        const mainScriptSmythDir = path.resolve(mainScriptDir, '.smyth', _path);
        searchDirectories.push(mainScriptSmythDir);
    }

    // 3. Try to find it in current package root directory (where package.json is)
    const packageRootDir = findPackageRoot();
    if (packageRootDir) {
        const packageSmythDir = path.resolve(packageRootDir, '.smyth', _path);
        searchDirectories.push(packageSmythDir);
    }

    // 4. Try to find it in current package root directory from main script's directory
    const packageMainRootDir = findPackageRoot(mainScriptDir);
    if (packageMainRootDir) {
        const packageSmythDir = path.resolve(packageMainRootDir, '.smyth', _path);
        searchDirectories.push(packageSmythDir);
    }

    // 5. Try to find it in user home directory
    const homeDir = path.resolve(os.homedir(), '.smyth', _path);
    searchDirectories.push(homeDir);

    const deduplicatedSearchDirectories = Array.from(new Set(searchDirectories));
    //check if any of the directories exist
    for (let i = 0; i < deduplicatedSearchDirectories.length; i++) {
        const dir = deduplicatedSearchDirectories[i];
        const nextDir = deduplicatedSearchDirectories[i + 1];
        if (!fs.existsSync(dir)) {
            callback?.(dir, false, nextDir);
            continue;
        }
        callback?.(dir, true, null);
        return dir;
    }

    if (_smythDir && _path) {
        return path.resolve(_smythDir, _path);
    }

    return homeDir;
}

export function findValidResourcePath(listOfLocations: string[], callback?: (dir: string, success?: boolean, nextDir?: string) => void) {
    let found = '';
    const deduplicatedLocations = Array.from(new Set(listOfLocations));
    for (let location of deduplicatedLocations) {
        findSmythPath(location, (dir, success, nextDir) => {
            callback?.(dir, success, nextDir);
            if (success) {
                found = dir;
            }
        });
        if (found) return found;
    }
    return found;
}
function findPackageRoot(startDir?) {
    try {
        if (!startDir) {
            const isElectron = !!process.versions.electron;
            let execPath = '';
            if (isElectron) {
                // In packaged Electron apps, use resourcesPath if available
                if ((process as any).resourcesPath) {
                    // process.resourcesPath points to the 'resources' folder in packaged app
                    // Go up one level to get the app directory
                    execPath = path.dirname((process as any).resourcesPath);
                } else {
                    // Development mode or fallback
                    execPath = path.dirname(process.execPath);
                }
            } else {
                execPath = process.cwd();
            }
            startDir = execPath;
        }
        let currentDir = startDir;

        while (currentDir !== path.dirname(currentDir)) {
            const packageJsonPath = path.resolve(currentDir, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
    } catch (error) {}
    return null;
}
