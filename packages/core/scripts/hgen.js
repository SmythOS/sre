import fs from 'fs';
import path from 'path';

function listFiles(dir, filelist = []) {
    const files = fs.readdirSync(dir);
    files.forEach((file) => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            filelist = listFiles(filepath, filelist);
        } else {
            filelist.push(filepath);
        }
    });
    return filelist;
}

const projectPath = './src'; // specify your project path here
const files = listFiles(projectPath);

console.log(JSON.stringify(files, null, 2));
