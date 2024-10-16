import minimist from 'minimist';

export function parseArgv(argv: string[]): {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: Record<string, any>;
} {
  const parsedArgs = minimist(argv.slice(2));

  const result: {
    method: string;
    path: string;
    query?: Record<string, string>;
    body?: Record<string, any>;
  } = {
    method: parsedArgs.method || 'GET',
    path: parsedArgs.path || '/',
  };

  if (parsedArgs.query) {
    try {
      result.query = JSON.parse(parsedArgs.query);
    } catch (error) {
      console.error('Error parsing query parameter. It should be a valid JSON string.');
    }
  }

  if (parsedArgs.body) {
    try {
      result.body = JSON.parse(parsedArgs.body);
    } catch (error) {
      console.error('Error parsing body parameter. It should be a valid JSON string.');
    }
  }

  return result;
}