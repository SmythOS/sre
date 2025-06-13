import { Help, Command } from '@oclif/core';

export default class CustomHelp extends Help {
    // Override the method that formats command help
    formatCommand(command: Command.Loadable): string {
        const originalOutput = super.formatCommand(command);

        // Replace "X FLAGS" with just "X" for any helpGroup
        return originalOutput.replace(/(\S+) FLAGS/g, '$1');
    }
}
