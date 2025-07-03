/**
 * Package Manager Detection Utility
 *
 * This utility helps in identifying the package manager (npm, pnpm, or yarn)
 * used in the current environment. This is crucial for providing the correct
 * install instructions to the user.
 */

/**
 * Detects the package manager used in the current environment.
 *
 * It checks the `npm_config_user_agent` environment variable first,
 * which is a standard way to detect the package manager.
 *
 * Falls back to checking the executed script path and common package manager
 * patterns.
 *
 * @returns {'npm' | 'pnpm' | 'yarn'} The detected package manager.
 */
export const getPackageManager = (): 'npm' | 'pnpm' | 'yarn' => {
    const userAgent = process.env.npm_config_user_agent;

    if (userAgent) {
        if (userAgent.startsWith('pnpm')) {
            return 'pnpm';
        }
        if (userAgent.startsWith('yarn')) {
            return 'yarn';
        }
        if (userAgent.startsWith('npm')) {
            return 'npm';
        }
    }

    // Fallback for global installs where user-agent is not set.
    // process.argv[1] is the path to the executed script.
    const scriptPath = process.argv[1] || '';
    if (scriptPath.includes('.pnpm')) {
        return 'pnpm';
    }

    // A simple check for yarn's global install path
    if (scriptPath.includes('yarn')) {
        return 'yarn';
    }

    return 'npm'; // Default to npm
};

/**
 * Gets the install command for the detected package manager.
 *
 * @param packageName - The name of the package to install
 * @returns The complete install command string
 */
export const getInstallCommand = (packageName: string): string => {
    const packageManager = getPackageManager();

    switch (packageManager) {
        case 'pnpm':
            return `pnpm add ${packageName}`;
        case 'yarn':
            return `yarn add ${packageName}`;
        case 'npm':
        default:
            return `npm install ${packageName}`;
    }
};
