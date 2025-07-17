import path from "path";
import fs from "fs";

type PathValidationResponse = {
    path: string | null;
    error?: string;
}

export function validateJSONFile(filePath: string): PathValidationResponse {

    // Check if the provided path is relative or absolute
    let absolutePath = null;
    if (path.isAbsolute(filePath)) {
        absolutePath = filePath;
    } else {
        // Convert relative path to absolute path
        absolutePath = path.resolve(filePath);
    }

    // Check if the file exists
    if (!fs.existsSync(absolutePath)) {

        return {
            path: null,
            error: `File not found: ${absolutePath}`
        };
    }

    // Check if it's a valid JSON file
    try {
        const fileContent = fs.readFileSync(absolutePath, 'utf8');
        JSON.parse(fileContent); // Validate JSON
    } catch (error) {
        return {
            path: null,
            error: `Invalid JSON in file: ${absolutePath}`
        };
    }

    return {
        path: absolutePath,
        error: null
    };
}