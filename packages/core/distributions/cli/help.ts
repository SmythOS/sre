export function help() {
  console.log(`
  SmythOS | CLI

  Options:
    --agent     Path to the agent file
    --vault     Path to the vault file
    --method    HTTP method (GET, POST, PUT, DELETE)
    --path      Path to the API endpoint
    --body      Body of the request (JSON string) 
`);
};