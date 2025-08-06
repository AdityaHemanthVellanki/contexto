import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { AIDataPipeline, PipelineConfig, DocumentInput } from '../src/lib/services/pipeline';
import { v4 as uuidv4 } from 'uuid';

/**
 * Production-grade E2E test for the MCP creation flow
 * This test uses real APIs and credentials - NO MOCKS
 */
async function testMCPCreationFlow() {
  console.log(chalk.magenta.bold('🚀 PRODUCTION MCP CREATION FLOW TEST - Starting'));
  console.log(chalk.yellow('├── This test uses REAL APIs - ensure environment variables are set'));
  
  // Check for required environment variables
  const requiredEnvVars = [
    'AZURE_OPENAI_API_KEY',
    'AZURE_OPENAI_ENDPOINT',
    'AZURE_OPENAI_DEPLOYMENT_EMBEDDING',
    'AZURE_OPENAI_DEPLOYMENT_TURBO',
    'PINECONE_API_KEY',
    'PINECONE_ENVIRONMENT'
  ];
  
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missingEnvVars.length > 0) {
    console.error(chalk.red(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`));
    console.error(chalk.red('Please set these environment variables and try again'));
    return { success: false, error: `Missing environment variables: ${missingEnvVars.join(', ')}` };
  }
  
  try {
    // Generate unique test IDs
    const testId = uuidv4().substring(0, 8);
    const timestamp = Date.now();
    const userId = `test-user-${testId}`;
    const mcpId = `test-mcp-${testId}`;
    const indexName = `ctx-${userId}-${mcpId}`.replace(/[^a-z0-9-]/g, '-');
    
    console.log(chalk.blue(`├── 🔑 Test identifiers:`));
    console.log(chalk.gray(`├── ├── User ID: ${userId}`));
    console.log(chalk.gray(`├── ├── MCP ID: ${mcpId}`));
    console.log(chalk.gray(`├── ├── Index Name: ${indexName}`));
    
    // Load test document
    const documentPath = path.join(__dirname, 'sample_company_handbook.txt');
    const documentText = fs.readFileSync(documentPath, 'utf-8');
    console.log(chalk.blue(`├── 📄 Loaded test document: ${documentText.length} characters`));
    
    // Initialize pipeline with real API credentials
    const config: PipelineConfig = {
      openaiApiKey: process.env.AZURE_OPENAI_API_KEY!,
      pineconeApiKey: process.env.PINECONE_API_KEY!,
      pineconeEnvironment: process.env.PINECONE_ENVIRONMENT!,
      embeddingModel: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-3-small',
      completionModel: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-4o',
      chunkSize: 800,
      chunkOverlap: 150,
      maxContextTokens: 3000
    };
    
    console.log(chalk.yellow('\n├── 🔄 Initializing AI pipeline with real credentials'));
    const pipeline = new AIDataPipeline(config);
    
    // Initialize vector database
    console.log(chalk.yellow('\n├── 🗃️ Initializing vector database'));
    await pipeline.initializeVectorDB(indexName);
    
    // ===== STAGE 1: DOCUMENT PROCESSING =====
    console.log(chalk.magenta.bold('\n📝 [STAGE 1] DOCUMENT PROCESSING'));
    
    // Process document
    const documentInput: DocumentInput = {
      text: documentText,
      docId: `doc-${testId}`,
      docName: 'Sample Company Handbook'
    };
    
    console.time('document-processing');
    const processingResult = await pipeline.processDocument(documentInput);
    console.timeEnd('document-processing');
    
    console.log(chalk.green(`\n├── ✅ Document processing complete:`));
    console.log(chalk.blue(`├── ├── Success: ${processingResult.success}`));
    console.log(chalk.blue(`├── ├── Chunks processed: ${processingResult.chunksProcessed}`));
    console.log(chalk.blue(`├── ├── Vectors stored: ${processingResult.vectorsStored}`));
    console.log(chalk.blue(`├── ├── Processing time: ${processingResult.processingTime}ms`));
    console.log(chalk.blue(`├── ├── Index name: ${processingResult.indexName}`));
    
    if (!processingResult.success) {
      throw new Error('Document processing failed');
    }
    
    // ===== STAGE 2: QUERY TESTING =====
    console.log(chalk.magenta.bold('\n🔍 [STAGE 2] QUERY TESTING'));
    
    // Test query
    const testQuery = "What is the leave policy for part-time employees?";
    console.log(chalk.yellow(`├── Testing query: "${testQuery}"`));
    
    console.time('query-processing');
    const queryResult = await pipeline.queryDocuments(testQuery, { filter: { docId: documentInput.docId } });
    console.timeEnd('query-processing');
    
    console.log(chalk.green(`\n├── ✅ Query complete:`));
    console.log(chalk.blue(`├── ├── Processing time: ${queryResult.processingTime}ms`));
    console.log(chalk.blue(`├── ├── Tokens used: ${queryResult.tokensUsed}`));
    console.log(chalk.blue(`├── ├── Sources: ${queryResult.sources.length}`));
    
    // Display sources
    console.log(chalk.yellow('\n├── 📚 Retrieved sources:'));
    queryResult.sources.forEach((source: { relevanceScore: number; text: string }, i: number) => {
      console.log(chalk.blue(`├── ├── Source ${i+1} (score: ${source.relevanceScore.toFixed(4)}):`));
      console.log(chalk.gray(`├── ├── ${source.text.substring(0, 150)}...`));
    });
    
    // Display response
    console.log(chalk.yellow('\n├── 💬 Generated response:'));
    console.log(chalk.cyan(`\n${queryResult.response}\n`));
    
    // Validate response
    const expectedKeywords = ['part-time', 'leave', 'policy', 'vacation', 'sick', 'pro-rated'];
    const containsKeywords = expectedKeywords.every(keyword => 
      queryResult.response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (containsKeywords) {
      console.log(chalk.green('├── ✅ Response contains all expected keywords'));
    } else {
      console.log(chalk.yellow('├── ⚠️ Response may not fully address the query'));
      
      // Check which keywords are missing
      const missingKeywords = expectedKeywords.filter(keyword => 
        !queryResult.response.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (missingKeywords.length > 0) {
        console.log(chalk.yellow(`├── ⚠️ Missing keywords: ${missingKeywords.join(', ')}`));
      }
    }
    
    // ===== STAGE 3: MCP EXPORT =====
    console.log(chalk.magenta.bold('\n📦 [STAGE 3] MCP EXPORT SIMULATION'));
    
    // In a real scenario, we would call the MCP export API
    // For this test, we'll simulate the export process
    console.log(chalk.yellow('├── Simulating MCP export process'));
    
    // Generate MCP configuration
    const mcpConfig = {
      name: 'Company Handbook Assistant',
      description: 'An AI assistant that answers questions about company policies and procedures',
      indexName: indexName,
      namespace: userId,
      embeddingModel: config.embeddingModel,
      completionModel: config.completionModel,
      tools: [
        {
          name: 'queryHandbook',
          description: 'Query the company handbook for information',
          parameters: [
            {
              name: 'query',
              type: 'string',
              description: 'The question to ask about company policies',
              required: true
            }
          ]
        }
      ]
    };
    
    console.log(chalk.green('├── ✅ MCP configuration generated:'));
    console.log(chalk.blue(`├── ├── Name: ${mcpConfig.name}`));
    console.log(chalk.blue(`├── ├── Description: ${mcpConfig.description}`));
    console.log(chalk.blue(`├── ├── Index: ${mcpConfig.indexName}`));
    console.log(chalk.blue(`├── ├── Tools: ${mcpConfig.tools.length}`));
    
    // ===== STAGE 4: DEPLOYMENT SIMULATION =====
    console.log(chalk.magenta.bold('\n🚀 [STAGE 4] DEPLOYMENT SIMULATION'));
    
    // In a real scenario, we would call the deployment API
    // For this test, we'll simulate the deployment process
    console.log(chalk.yellow('├── Simulating MCP deployment process'));
    
    // Generate deployment configuration
    const deploymentConfig = {
      appName: `ctx-mcp-${userId}-${timestamp}`,
      environment: 'production',
      configVars: {
        AZURE_OPENAI_API_KEY: '***',
        AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_DEPLOYMENT_EMBEDDING: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING,
        AZURE_OPENAI_DEPLOYMENT_TURBO: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO,
        PINECONE_API_KEY: '***',
        PINECONE_ENVIRONMENT: process.env.PINECONE_ENVIRONMENT,
        MCP_INDEX_NAME: indexName,
        MCP_NAMESPACE: userId
      }
    };
    
    console.log(chalk.green('├── ✅ Deployment configuration generated:'));
    console.log(chalk.blue(`├── ├── App Name: ${deploymentConfig.appName}`));
    console.log(chalk.blue(`├── ├── Environment: ${deploymentConfig.environment}`));
    console.log(chalk.blue(`├── ├── Config Variables: ${Object.keys(deploymentConfig.configVars).length}`));
    
    console.log(chalk.magenta.bold('\n🎉 PRODUCTION MCP CREATION FLOW TEST - Complete'));
    return { success: true };
    
  } catch (error) {
    console.error(chalk.red(`❌ TEST FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`));
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(error.stack));
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Run the test if executed directly
if (require.main === module) {
  testMCPCreationFlow()
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { testMCPCreationFlow };
