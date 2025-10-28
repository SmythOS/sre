/**
 * Example: Using @smythos/sdk/core to access full SRE capabilities
 * 
 * This example demonstrates how to use both the simplified SDK API
 * and the full SRE API through the /core subpath import.
 */

// Import simplified SDK API
import { Agent } from '@smythos/sdk';

// Import full SRE capabilities through /core
import { 
    SmythRuntime, 
    ACL, 
    TAccessLevel, 
    TAccessRole,
    type SREConfig,
    SecureConnector 
} from '@smythos/sdk/core';

async function main() {
    console.log('🚀 Demonstrating @smythos/sdk/core imports\n');

    // 1. Using the simplified SDK API
    console.log('1️⃣ Creating an agent with simplified SDK API:');
    const agent = new Agent({
        name: 'Helper Agent',
        description: 'A simple agent using SDK API',
        systemPrompt: 'You are a helpful assistant.',
        model: 'gpt-4o-mini' // Model is required for agent creation
    });

    console.log(`   ✅ Agent created successfully\n`);

    // 2. Working with Access Control Lists (ACLs) directly
    console.log('2️⃣ Creating custom ACL using SRE classes:');
    
    // Create ACL using the from() method and addAccess()
    const acl = ACL.from()
        .addAccess(TAccessRole.User, 'user-123', TAccessLevel.Owner)
        .addAccess(TAccessRole.Agent, 'agent-456', TAccessLevel.Read)
        .addAccess(TAccessRole.Team, 'team-789', TAccessLevel.Write);

    console.log('   ACL created with access levels:');
    console.log(`   - User (user-123): Owner`);
    console.log(`   - Agent (agent-456): Read`);
    console.log(`   - Team (team-789): Write\n`);

    // 3. Using SRE configuration types
    console.log('3️⃣ Using SRE configuration types:');
    
    const storageConfig: SREConfig = {
        Storage: {
            Connector: 'LocalStorage',
            Settings: {
                folder: './data'
            }
        }
    };
    
    console.log('   ✅ SRE config typed correctly\n');

    // 4. Access levels and roles from SRE
    console.log('4️⃣ Available Access Levels and Roles:');
    console.log(`   Access Levels: Read(${TAccessLevel.Read}), Write(${TAccessLevel.Write}), Owner(${TAccessLevel.Owner})`);
    console.log(`   Access Roles: User(${TAccessRole.User}), Agent(${TAccessRole.Agent}), Team(${TAccessRole.Team}), Public(${TAccessRole.Public})\n`);

    // 5. Access to runtime types
    console.log('5️⃣ SmythRuntime access:');
    const sre = SmythRuntime.Instance;
    console.log(`   ✅ SmythRuntime singleton: v${sre.version}`);
    console.log(`   ✅ Smyth directory: ${sre.smythDir}\n`);

    console.log('🎉 Demo complete!');
    console.log('\n💡 Key Takeaway:');
    console.log('   Use @smythos/sdk for simple use cases');
    console.log('   Use @smythos/sdk/core for advanced SRE features');
}

main().catch(console.error);

