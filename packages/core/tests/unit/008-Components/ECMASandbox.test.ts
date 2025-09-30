import { Agent } from '@sre/AgentManager/Agent.class';
import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import { describe, expect, it, vi } from 'vitest';
import { ECMASandbox } from '@sre/Components/ECMASandbox.class';
import { setupSRE } from '../../utils/sre';
import { ConnectorService } from '@sre/Core/ConnectorsService';

setupSRE({
    Code: {
        Connector: 'ECMASandbox',
    },
});

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => ({
        id: 'agent-123456',
        agentRuntime: { debug: true }, // used inside createComponentLogger()
        teamId: 'Team2',
        isKilled: () => false,
        modelsProvider: ConnectorService.getModelsProviderConnector(),
    }));
    return { Agent: MockedAgent };
});

describe('Code Component', () => {
    it('runs code without vars', async () => {
        const code = `
        async function main() {
            const a = 1;
            const b = 2;
            const c = a + b;
            return { c };
        }
        `;

        const agent: any = new (Agent as any)();

        const codeComp = new ECMASandbox();
        const output = await codeComp.process(
            {},
            {
                data: {
                    code,
                },
            },
            agent
        );

        const result = output.Output;

        expect(result).toBeDefined();
        expect(result.c).toBe(3);
    });

    it('runs code with vars', async () => {
        const bo = true;
        const num = 1;
        const str = 'Hello World!';
        const letterObj = '{ a: 1, b: 2, c: 3 }';
        const numArr = '[1, 2, 3]';

        const code = `
        async function main(bo, num, str, letterObj, numArr) {
                return { bo, num, str, letterObj, numArr };
        }
            `;

        const agent: any = new (Agent as any)();

        const codeComp = new ECMASandbox();
        const output = await codeComp.process(
            { bo, num, str, letterObj, numArr }, // inputs
            {
                data: {
                    code,
                },
            },
            agent
        );

        const result = output.Output;

        expect(result).toBeDefined();
        expect(result.bo).toBe(bo);
        expect(result.num).toBe(num);
        expect(result.str).toBe(str);
        expect(result.letterObj).toStrictEqual(letterObj);
        expect(result.numArr).toStrictEqual(numArr);
    });

    it("rejects code with 'require' statement", async () => {
        const code = `        
            const fs = require('fs');
            async function main() {
                return { fs };
            }
        `;

        const agent: any = new (Agent as any)();

        const codeComp = new ECMASandbox();
        const output = await codeComp.process(
            {},
            {
                data: {
                    code,
                },
            },
            agent
        );

        const result = output.Output;

        expect(result).toBeUndefined();
        expect(output._error).toBeDefined();
    });

    // it('rejects code with infinite loop', async () => {
    //     const code = `
    //         async function main() {
    //             while (true) {}
    //         }
    //     `;

    //     const agent: any = new (Agent as any)();

    //     const codeComp = new ECMASandbox();
    //     const output = await codeComp.process(
    //         {},
    //         {
    //             data: {
    //                 code,
    //             },
    //         },
    //         agent
    //     );

    //     const result = output.Output;

    //     expect(result).toBeUndefined();
    //     expect(output._error).toBeDefined();
    // });
});
