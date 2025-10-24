/**
 * Create Command - Oclif Implementation
 * Create a new SRE project
 */

import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import os from 'os';
import path from 'path';
import { banner } from '../../utils/banner';
import fs from 'fs';
import { execSync } from 'child_process';
import extract from 'extract-zip';
import dotenv from 'dotenv';

dotenv.config();

const normalizeProjectName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');

const vaultTemplate = {
    default: {
        echo: '',
        openai: '',
        anthropic: '',
        googleai: '',
        groq: '',
        togetherai: '',
        xai: '',
        deepseek: '',
        tavily: '',
        scrapfly: '',
    },
};

const detectApiKeys = () => {
    const keys: { [key: string]: string | undefined } = {
        openai: process.env.OPENAI_API_KEY ? '$env(OPENAI_API_KEY)' : undefined,
        anthropic: process.env.ANTHROPIC_API_KEY ? '$env(ANTHROPIC_API_KEY)' : undefined,
        googleai: process.env.GOOGLE_API_KEY ? '$env(GOOGLE_API_KEY)' : process.env.GEMINI_API_KEY ? '$env(GEMINI_API_KEY)' : undefined,
    };

    return Object.entries(keys).reduce((acc, [key, value]) => {
        if (value) {
            acc[key] = value;
        }
        return acc;
    }, {} as { [key: string]: string });
};

function prepareSmythDirectory(baseDir: string = os.homedir()) {
    //check and create ~/.smyth if it does not exist
    const smythDir = path.join(baseDir, '.smyth');
    if (!fs.existsSync(smythDir)) {
        fs.mkdirSync(smythDir, { recursive: true });
    }

    //check and create .smyth/.sre/ if it does not exist
    const sreDir = path.join(smythDir, '.sre');
    if (!fs.existsSync(sreDir)) {
        fs.mkdirSync(sreDir, { recursive: true });
    }

    //check and create .smyth/storage if it does not exist
    const storageDir = path.join(smythDir, 'storage');
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    //just check if a vault file exists in ~/.smyth/.sre/vault.json
    const vaultFile = path.join(sreDir, 'vault.json');
    const vaultExists = fs.existsSync(vaultFile);

    return {
        smythDir,
        sreDir,
        storageDir,
        vaultFile: vaultExists ? vaultFile : null,
    };
}

function copyDirectoryRecursiveSync(source: string, target: string) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }

    const files = fs.readdirSync(source);

    files.forEach((file) => {
        const sourcePath = path.join(source, file);
        const targetPath = path.join(target, file);
        const stat = fs.statSync(sourcePath);

        if (stat.isDirectory()) {
            copyDirectoryRecursiveSync(sourcePath, targetPath);
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    });
}

export default class CreateCmd extends Command {
    static override description = 'Create a new SmythOS project';

    static override examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> "My Awesome Project"'];

    static override flags = {
        help: Flags.help({ char: 'h' }),
    };

    static override args = {
        projectName: Args.string({
            name: 'projectName',
            description: 'Name of the new SmythOS project',
            required: false,
        }),
    };

    async run(): Promise<void> {
        const { args } = await this.parse(CreateCmd);
        await RunProject(args.projectName);
    }
}

async function RunProject(projectNameArg?: string) {
    console.log(
        banner(
            [],
            [
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                chalk.white('🚀 Welcome to the SRE Project Builder! ✨'),
                chalk.white("🧑‍💻 Let's build something amazing together..."),
            ]
        )
    );

    console.log(chalk.yellowBright(`===[ Let's configure your project ]===`));

    const { smythDir, sreDir, storageDir, vaultFile } = prepareSmythDirectory();

    const detectedKeys = detectApiKeys();
    const hasDetectedKeys = Object.keys(detectedKeys).length > 0;
    const detectedKeysInfo = Object.keys(detectedKeys)
        .map((k) => chalk.cyan(k))
        .join(', ');

    const existingVault = fs.existsSync(vaultFile) ? JSON.parse(fs.readFileSync(vaultFile, 'utf8')) : null;

    const initialAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name',
            validate: (input: string) => (input.trim().length > 0 ? true : 'Project name cannot be empty.'),
            when: !projectNameArg,
        },
    ]);

    const projectName = projectNameArg || initialAnswers.projectName;

    let answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetFolder',
            message: 'Project folder',
            default: path.join(process.cwd(), normalizeProjectName(projectName)),
            suffix: `\n${chalk.magenta('If it does not exist it will be created.')}\n`,
        },
        // {
        //     type: 'list',
        //     name: 'projectType',
        //     message: `Project type\n${chalk.grey('Choose the project type.')}`,
        //     choices: [
        //         { name: 'Build AI Agent with the SDK (simple)', value: 'sdk' },
        //         { name: 'Extend SRE with custom connectors', value: 'connectors' },
        //         { name: 'Extend SRE with custom components', value: 'components' },
        //         { name: 'Extend components and connectors', value: 'extend' },
        //     ],
        // },

        {
            type: 'list',
            name: 'templateType',
            message: `Project template`,
            suffix: `\n${chalk.magenta('Choose the project template. (Use arrow keys ↑↓)')}\n`,
            choices: [
                { name: 'Empty Project', value: 'sdk-empty' },
                { name: 'Minimal : Just the basics to get started', value: 'code-agent-minimal' },
                { name: 'Interactive : Chat with one agent', value: 'code-agent-book-assistant' },
                {
                    name: 'Interactive chat with agent selection',
                    value: 'interactive-chat-agent-select',
                },
                { name: 'Desktop App (Electron)', value: 'smythos-electron-starter-project' },
            ],
        },
    ]);

    answers.projectName = projectName;

    console.log(chalk.yellowBright(`\n===[ Now let's configure Smyth Resources folder ]===`));
    console.log(
        `${chalk.gray(
            'Some connectors in SmythOS might need to store data locally, in order to keep things clean, we store all SmythOS related data in a single place.\n'
        )}`
    );

    const resourcesAnswers = await inquirer.prompt([
        {
            type: 'list',
            name: 'smythResources',
            message: 'Smyth Resources Folder',
            suffix: `\n${chalk.magenta('Location where we can store data like logs, cache, etc. (Use arrow keys ↑↓)')}\n`,
            choices: [
                { name: `Shared folder in the ${chalk.underline('user home directory')} (~/.smyth)`, value: path.join(os.homedir(), '.smyth') },
                {
                    name: `Local folder under ${chalk.underline('project root')} (./${path.basename(answers.targetFolder)}/.smyth)`,
                    value: path.join(answers.targetFolder, '.smyth'),
                },
            ],
            default: 0,
        },
    ]);

    const isSharedResources = resourcesAnswers.smythResources === path.join(os.homedir(), '.smyth');
    let _useSharedVault = isSharedResources;

    let vault: { [key: string]: string } = {};

    //let _useSharedVault = false;

    console.log(chalk.yellowBright(`\n===[ Now let's set your secrets ]===`));
    console.log(
        `${chalk.gray(
            'SmythOS uses a vault to store your secrets. Set your secrets once, they’ll be securely stored and loaded by the SDK only when needed.This keeps LLM API keys out of your code.\n'
        )}`
    );
    if (_useSharedVault && vaultFile) {
        console.log(chalk.magenta(`  ℹ  We will use Vault file found in your shared folder ${vaultFile}`));
        const existingProviders = Object.keys(existingVault?.default).filter((p) => existingVault?.default[p]);
        if (existingProviders.length > 0) {
            console.log(chalk.magenta(`  ℹ  API keys already present in your shared vault: ${existingProviders.join(', ')}`));
        }
        vault = {
            openai: '#',
            anthropic: '#',
            googleai: '#',
            groq: '#',
            togetherai: '#',
            xai: '#',
            deepseek: '#',
            tavily: '#',
            scrapfly: '#',
            ...(existingVault?.default || {}),
        };
    }
    /*
    if (vaultFile) {
        console.log(chalk.magenta(`  ℹ  I found an existing shared vault file ${vaultFile}`));
        const { useSharedVault } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'useSharedVault',
                message: `Do you want to use the shared vault in this project ?`,
                default: true,
            },
        ]);
        _useSharedVault = useSharedVault;
        vault = {
            openai: '#',
            anthropic: '#',
            google: '#',
            groq: '#',
            togetherai: '#',
            xai: '#',
            deepseek: '#',
            tavily: '#',
            scrapfly: '#',
        };
    }
        */

    /*
    if (hasDetectedKeys && !_useSharedVault) {
        const { useDetectedKeys } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'useDetectedKeys',
                message: `We detected these API keys: ${detectedKeysInfo} in your environment. Do you want to use them in your project's vault?`,
                default: true,
            },
        ]);
        if (useDetectedKeys) {
            vault = { ...detectedKeys };
        }
    }
        */

    const allProviders = ['openai', 'anthropic', 'googleai'];
    const missingKeyQuestions = allProviders
        .filter((provider) => !vault[provider] || vault[provider] === '#')
        .map((provider) => {
            if (hasDetectedKeys && detectedKeys[provider]) {
                return {
                    type: 'confirm',
                    name: provider,
                    message: `We detected that ${provider} API Key is present in your environment variables. Do you want to use the environment variable in your project's vault?`,
                    default: true,
                };
            }
            return {
                type: 'input',
                name: provider,
                message: `Enter your ${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key (Enter value, or press Enter to skip)\n`,
            };
        });

    if (missingKeyQuestions.length > 0) {
        const keyAnswers = await inquirer.prompt(missingKeyQuestions);
        for (const [provider, key] of Object.entries(keyAnswers)) {
            if (key) {
                vault[provider] = key === true ? detectedKeys[provider] : (key as string);
            }
        }
    }

    answers = { ...answers, ...resourcesAnswers };

    const finalConfig = {
        projectName: answers.projectName,
        targetFolder: answers.targetFolder,
        projectType: answers.projectType,
        templateType: answers.templateType,
        smythResources: answers.smythResources,
        vault,
        useSharedVault: _useSharedVault,
    };

    try {
        const success = createProject(finalConfig);
        if (!success) {
            console.log(chalk.red('🚨 Error creating project.'));
            return;
        }

        console.log('\n🎉 Project created successfully! 🎊\n');

        // Inform user about vault file location
        const vaultLocation = finalConfig.useSharedVault
            ? path.join(os.homedir(), '.smyth', '.sre', 'vault.json')
            : path.join(finalConfig.smythResources, '.sre', 'vault.json');
        console.log(
            chalk.magentaBright(
                `\n🔐 Your vault file is located at: ${chalk.cyan(vaultLocation)}\nYou can edit it later if you want to add more keys.`
            )
        );

        console.log('\n\n🚀 Next steps :');
        console.log(`\n${chalk.green('cd')} ${chalk.underline(finalConfig.targetFolder)}`);
        console.log(`${chalk.green('npm install')}`);
        console.log(`${chalk.green('npm run build')}`);
        console.log(`${chalk.green('npm start')}\n\n`);
    } catch (error) {
        console.error(chalk.red('🚨 Error creating project:'), error);
    }
}

async function createProject(config: any) {
    let folderCreated = false;
    let projectFolder = '';
    try {
        console.log('Creating project...');
        const gitRepoUrl = 'https://github.com/SmythOS/sre-project-templates';
        const branch = config.templateType;

        //create project folder
        projectFolder = config.targetFolder;

        //if the folder already exists and is not empty, cancel the operation
        if (fs.existsSync(projectFolder) && fs.readdirSync(projectFolder).length > 0) {
            console.log(chalk.red('Project folder already exists and is not empty.'));
            return false;
        }

        if (!fs.existsSync(projectFolder)) {
            fs.mkdirSync(projectFolder, { recursive: true });
        }
        folderCreated = true;

        const projectId = path.basename(projectFolder);
        try {
            //clone the repo branch into the project folder
            const cloneCommand = `git clone --depth 1 --branch ${branch} ${gitRepoUrl} ${projectFolder}`;
            execSync(cloneCommand, { stdio: 'pipe' });
        } catch (error) {
            console.log(chalk.yellow('git clone failed, using alternative method.'));
            const zipUrl = `${gitRepoUrl}/archive/refs/heads/${branch}.zip`;
            const tempZipPath = path.join(os.tmpdir(), `${branch}.zip`);

            try {
                // Download the file
                const response = await fetch(zipUrl);
                if (!response.ok) throw new Error(`Failed to download zip: ${response.statusText}`);

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                fs.writeFileSync(tempZipPath, buffer);

                // Unzip the file
                await extract(tempZipPath, { dir: os.tmpdir() });

                // Move contents from the extracted folder to the target folder
                const extractedFolder = path.join(os.tmpdir(), `sre-project-templates-${branch}`);
                copyDirectoryRecursiveSync(extractedFolder, projectFolder);

                // Cleanup
                fs.unlinkSync(tempZipPath);
                fs.rmSync(extractedFolder, { recursive: true, force: true });
            } catch (zipError) {
                console.error(chalk.red('Error downloading or extracting project zip:'), zipError);
                if (folderCreated && projectFolder) {
                    fs.rmSync(projectFolder, { recursive: true, force: true });
                }
                return false;
            }
        }

        //ensure resources folder and .sre folder exists
        //ensure the .sre folder exists
        const sreFolder = path.join(config.smythResources, '.sre');
        if (!fs.existsSync(sreFolder)) {
            fs.mkdirSync(sreFolder, { recursive: true });
        }

        //Write vault file
        //if (!config.useSharedVault) {
        const vaultPath = path.join(config.smythResources, '.sre', 'vault.json');

        //always create a default vault even if no key is configured
        if (fs.existsSync(vaultPath)) {
            //make a backup
            const backupPath = path.join(config.smythResources, '.sre', 'vault.json.backup');
            fs.copyFileSync(vaultPath, backupPath);
        }

        const vaultData = {
            default: {
                ...vaultTemplate.default,
                ...config.vault,
            },
        };
        fs.writeFileSync(vaultPath, JSON.stringify(vaultData, null, 2));

        //}

        //update package.json with project name
        const packageJsonPath = path.join(projectFolder, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packageJson.name = projectId;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

        //update .env with project name
        const envPath = path.join(projectFolder, '.env');
        fs.writeFileSync(envPath, 'LOG_LEVEL=""\nLOG_FILTER=""\n');

        //delete .git folder
        const gitFolder = path.join(projectFolder, '.git');
        if (fs.existsSync(gitFolder)) {
            fs.rmSync(gitFolder, { recursive: true });
        }

        return true;
    } catch (error) {
        console.error(chalk.red('An unexpected error occurred:'), error);
        if (folderCreated && projectFolder) {
            fs.rmSync(projectFolder, { recursive: true, force: true });
        }
        return false;
    }
}
