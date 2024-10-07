import axios from 'axios';
import yaml from 'js-yaml';

import { REQUEST_METHODS } from '../constants';

// * We need a couple of packages to resolve references in the OpenAPI specification
//FIXME : YAML support temporarly disabled to allow executable packaging
//import SwaggerParser from '@apidevtools/swagger-parser';
//import $RefParser from '@apidevtools/json-schema-ref-parser';
import { JSONSchema } from '@apidevtools/json-schema-ref-parser/dist/lib/types';

//const swaggerParser = new SwaggerParser();

export class OpenAPIParser {
    static mapReqMethods(paths: Array<Record<string, any>>): Map<string, any> {
        const methods = new Map();

        for (const path in paths) {
            const pathData = paths[path];

            for (const method in pathData) {
                const data = pathData[method];

                if (REQUEST_METHODS.includes(method.toUpperCase())) {
                    methods.set(data?.operationId, method);
                }
            }
        }

        return methods;
    }
    static mapEndpoints(paths: Array<Record<string, any>>): Map<string, any> {
        const operationIds = new Map();

        for (const path in paths) {
            const pathData = paths[path];

            // it's possible we have multiple methods for a single path
            for (const method in pathData) {
                const data = pathData[method];

                if (REQUEST_METHODS.includes(method.toUpperCase())) {
                    operationIds.set(data?.operationId, path);
                }
            }
        }

        return operationIds;
    }

    static async yamlToJson(yamlData: string): Promise<JSONSchema> {
        const data = yaml.load(yamlData);
        //FIXME : YAML support temporarly disabled to allow executable packaging
        //const schema = await $RefParser.dereference(data);
        const schema: any = {};

        return schema;
    }
    static async getJson(data: string | Record<string, any>): Promise<Record<string, any>> {
        try {
            let _data = data;
            if (typeof data === 'string') {
                _data = JSON.parse(_data as string);
            }
            //FIXME : YAML support temporarly disabled to allow executable packaging
            //const result = swaggerParser.dereference(_data as any);
            const result: any = {};
            return result;
        } catch (error) {
            try {
                return OpenAPIParser.yamlToJson(data as string);
            } catch (error) {
                throw new Error('Invalid OpenAPI specification data format');
            }
        }
    }
    static async getJsonFromUrl(url: string): Promise<Record<string, any>> {
        const response = await axios.get(url);
        const data = response.data;

        return OpenAPIParser.getJson(data);
    }

    static isValidOpenAPI(data: Record<string, any>): boolean {
        return data?.openapi && data?.paths && data?.servers;
    }
}
