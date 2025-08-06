import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { AIDataPipeline, PipelineConfig, DocumentInput, QueryResult } from '../src/lib/services/pipeline';

/**
 * Production-grade E2E test for the AI pipeline
 * This test uses real APIs and credentials - NO MOCKS
 */
async function testRealPipeline() {
  console.log(chalk.magenta.bold('🚀 PRODUCTION AI PIPELINE E2E TEST - Starting'));
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
    // Load test document
    const documentPath = path.join(__dirname, 'sample_company_handbook.txt');
    const documentText = fs.readFileSync(documentPath, 'utf-8');
    console.log(chalk.blue(`├── 📄 Loaded test document: ${documentText.length} characters`));
    
    // Generate unique IDs for this test run
    const timestamp = Date.now();
    const docId = `test-doc-${timestamp}`;
    const docName = 'Sample Company Handbook';
    const indexName = `test-index-${timestamp}`;
    const namespace = `test-ns-${timestamp}`;
    
    console.log(chalk.blue(`├── 🔑 Test identifiers:`));
    console.log(chalk.gray(`├── ├── Document ID: ${docId}`));
    console.log(chalk.gray(`├── ├── Index Name: ${indexName}`));
    console.log(chalk.gray(`├── ├── Namespace: ${namespace}`));
    
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
    await pipeline.initializeVectorDB(indexName, namespace);
    
    // Process document
    console.log(chalk.yellow('\n├── 📝 Processing document'));
    const documentInput: DocumentInput = {
      text: documentText,
      docId,
      docName
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
    
    // Test query
    const testQuery = "What is the leave policy for part-time employees?";
    console.log(chalk.yellow(`\n├── 🔍 Testing query: "${testQuery}"`));
    
    console.time('query-processing');
    const queryResult = await pipeline.queryDocuments(testQuery, { filter: { docId } });
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
    
    console.log(chalk.magenta.bold('\n🎉 PRODUCTION AI PIPELINE E2E TEST - Complete'));
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
  testRealPipeline()
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

export { testRealPipeline };
