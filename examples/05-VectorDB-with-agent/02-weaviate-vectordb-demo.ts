import { Agent, Doc, Model } from '@smythos/sdk';
import { SRE, ConnectorService } from '@smythos/sre';

const weaviateConfig = {
    url: 'http://localhost:8080',
    className: 'SmythVector',
    embeddings: Model.OpenAI('text-embedding-3-large'),
};
/**
 * Example demonstrating Weaviate VectorDB Connector usage
 * This example shows how to use the new Weaviate connector with SmythOS SRE
 */
async function main() {
    console.log('🚀 Starting Weaviate VectorDB Connector Demo');

    try {
        // Initialize SRE with Weaviate connector
        await SRE.init({
            VectorDB: {
                Connector: 'Weaviate',
                Settings: weaviateConfig,
            },
        });

        await SRE.ready();
        console.log('✅ SRE initialized with Weaviate connector');

        // Create an agent that uses Weaviate
        const agent = new Agent({
            id: 'WeaviateAgents',
            name: 'Weaviate Document Search Agent',
            model: 'gpt-4o',
            behavior: 'You are a helpful document search assistant that can find relevant information using vector search.',
        });

        // Access Weaviate through the agent - correct API usage
        const vectorDB = agent.vectorDB.Weaviate('WeaviateDocuments', weaviateConfig);

        console.log('📚 VectorDB instance created for namespace: WeaviateDocuments');

        console.log('📝 Adding sample documents...');

        // Add some sample documents using the correct insertDoc method
        const documents = [
            {
                text: 'Machine learning is a subset of artificial intelligence that focuses on algorithms that can learn from data.',
                metadata: { category: 'AI', topic: 'machine-learning', difficulty: 'beginner' },
            },
            {
                text: 'Deep learning uses neural networks with multiple layers to process complex patterns in data.',
                metadata: { category: 'AI', topic: 'deep-learning', difficulty: 'intermediate' },
            },
            {
                text: 'Natural language processing enables computers to understand and generate human language.',
                metadata: { category: 'AI', topic: 'nlp', difficulty: 'intermediate' },
            },
            {
                text: 'Computer vision allows machines to interpret and understand visual information from images.',
                metadata: { category: 'AI', topic: 'computer-vision', difficulty: 'intermediate' },
            },
        ];

        // Insert documents using the correct method
        for (let i = 0; i < documents.length; i++) {
            const doc = documents[i];
            await vectorDB.insertDoc(`doc_${i + 1}`, doc.text, doc.metadata);
            console.log(`✅ Inserted document ${i + 1}: ${doc.metadata.topic}`);
        }

        console.log('🔍 Performing vector search...');

        // Search for similar documents
        const searchQueries = ['What is artificial intelligence?', 'How do neural networks work?', 'Tell me about image processing'];

        for (const query of searchQueries) {
            console.log(`\n🔎 Searching for: "${query}"`);

            const results = await vectorDB.search(query, {
                topK: 3,
            });

            console.log(`📊 Found ${results.length} relevant documents:`);
            results.forEach((result, index) => {
                console.log(`  ${index + 1}. Text: ${result.text?.substring(0, 100)}...`);
                console.log(`     Category: ${result.metadata?.category}, Topic: ${result.metadata?.topic}`);
            });
        }

        console.log('\n🧹 Cleaning up...');
        await vectorDB.purge();

        console.log('✅ Weaviate VectorDB Connector Demo completed successfully!');
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
