import { AgentProcess } from '@sre/Core/AgentProcess.helper';
import config from '@sre/config';
import { Agent, AgentSettings, CLIAgentDataConnector, ConnectorService, SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
import fs from 'fs';
import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import Code from '@sre/Components/Code.class';
const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
});

ConnectorService.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'CLI');

// Mock Agent class to keep the test isolated from the actual Agent implementation
vi.mock('@sre/AgentManager/Agent.class', () => {
    const MockedAgent = vi.fn().mockImplementation(() => {
        // Inherit Agent.prototype for proper instanceof Agent checks
        return Object.create(Agent.prototype, {
            id: { value: 1 }, // used inside inferBinaryType()
            agentRuntime: { value: { debug: true } }, // used inside createComponentLogger()
            teamId: { value: 'default' },
        });
    });
    return { default: MockedAgent };
});

describe('Code Component', () => {
    it('runs code without vars', async () => {
        const codeBody = `
            const a = 1;
            const b = 2;
            const c = a + b;
            _output = { c };
        `;

        //@ts-ignore
        const agent = new Agent();

        const codeComp = new Code();
        const output = await codeComp.process(
            {},
            {
                data: {
                    code_body: codeBody,
                    code_vars: '',
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

        const codeVars = `
                const _bo = {{bo}};
                const _num = {{num}};
                const _str = {{str}};
                const _letterObj = {{letterObj}};
                const _numArr = {{numArr}};

                let _output= undefined;
        `;

        const codeBody = `
                _output = { _bo, _num, _str, _letterObj, _numArr };
            `;

        //@ts-ignore
        const agent = new Agent();

        const codeComp = new Code();
        const output = await codeComp.process(
            { bo, num, str, letterObj, numArr },
            {
                data: {
                    code_body: codeBody,
                    code_vars: codeVars,
                },
            },
            agent
        );

        const result = output.Output;

        expect(result).toBeDefined();
        expect(result._bo).toBe(bo);
        expect(result._num).toBe(num);
        expect(result._str).toBe(str);
        expect(result._letterObj).toStrictEqual(letterObj);
        expect(result._numArr).toStrictEqual(numArr);
    });

    it("rejects code with 'require' statement", async () => {
        const codeBody = `
            const fs = require('fs');
            _output = { fs };
        `;

        //@ts-ignore
        const agent = new Agent();

        const codeComp = new Code();
        const output = await codeComp.process(
            {},
            {
                data: {
                    code_body: codeBody,
                    code_vars: '',
                },
            },
            agent
        );

        const result = output.Output;

        expect(result).toBeUndefined();
        expect(output._error).toBeDefined();
    });

    it('rejects code with infinite loop', async () => {
        const codeBody = `
            while (true) {}
        `;

        //@ts-ignore
        const agent = new Agent();

        const codeComp = new Code();
        const output = await codeComp.process(
            {},
            {
                data: {
                    code_body: codeBody,
                    code_vars: '',
                },
            },
            agent
        );

        const result = output.Output;

        expect(result).toBeUndefined();
        expect(output._error).toBeDefined();
    });
});
