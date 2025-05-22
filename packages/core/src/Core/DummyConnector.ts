import { Logger } from '../helpers/Log.helper';
const logger = Logger('DummyConnector');
/**
 * DummyConnector is a placeholder for unimplemented connectors, it logs a warning when a method is called in order to help developers identify missing connectors
 */
export const DummyConnector: any = new Proxy(
    {},
    {
        get: function (target, prop, receiver) {
            //check if we are accessing the valid property
            if (prop === 'valid') {
                return false; //when DummyConnector is used it means that the main connector failed to load
            }

            // Check if the property being accessed is a function
            if (typeof target[prop] === 'function') {
                return target[prop];
            } else {
                // Return a function that logs "unavailable"
                return function (...args: any[]) {
                    logger.warn(`[!!] Unimplemented Connector tried to call : ${prop.toString()} with arguments:`, args);
                };
            }
        },
    },
);
