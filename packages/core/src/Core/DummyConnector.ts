import { Logger } from '../helpers/Log.helper';
import { getFormattedStackTrace, printStackTrace } from '../utils';
import { TConnectorService } from '../types/SRE.types';

/**
 * DummyConnector is a placeholder for unimplemented connectors, it logs a warning when a method is called in order to help developers identify missing connectors
 */
export const DummyConnector: any = (name: TConnectorService) => {
    const logger = Logger(`DummyConnector<${name}>`);
    return new Proxy(
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
                        const argsString =
                            args.length > 0
                                ? args
                                      .map((arg) => {
                                          if (typeof arg === 'object') return JSON.stringify(arg, null, 0).slice(0, 50) + '...';
                                          if (typeof arg === 'string') return `"${arg.slice(0, 50)}..."`;
                                          if (typeof arg === 'number') return arg.toString();
                                          if (typeof arg === 'boolean') return arg.toString();
                                          if (typeof arg === 'function') return arg.toString();
                                          if (typeof arg === 'symbol') return arg.toString();
                                          if (typeof arg === 'undefined') return 'undefined';

                                          return String(arg);
                                      })
                                      .join(', ')
                                : '(no arguments)';

                        logger.warn(`[!!] Unimplemented Connector tried to call: ${name}.${prop.toString()}(${argsString})`);

                        printStackTrace(logger, 3, 1); //the argument 1 means that we skip one more strack element because we are calling printStackTrace from an anonymous function
                    };
                }
            },
        },
    );
};
