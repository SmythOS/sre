export function help() {
  console.log(`
  SmythOS CLI v0.0.1 (beta)

  Syntax : ${process.argv[0]} --agent <path_to_agent> --endpoint <endpoint_name> --post/get <input>
  Example : ${process.argv[0]} --agent ./agents/myAgent.js --endpoint say --post message="Hello, world!"

  Options:
    --agent           Path to the agent file
    --endpoint <name> Call endpoint
    --post <params>   Make a POST call 
    --get <params>    Make a GET call 
    --vault           Path to the vault file
`);
};