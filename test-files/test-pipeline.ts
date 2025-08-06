import * as fs from 'fs';
import * as path from 'path';
import * as chalk from 'chalk';
import { AIDataPipeline, PipelineConfig, DocumentInput, QueryResult } from '../src/lib/services/pipeline';

// Configuration - Replace with actual API keys or load from .env
const config: PipelineConfig = {
  openaiApiKey: process.env.AZURE_OPENAI_API_KEY || '',
  pineconeApiKey: process.env.PINECONE_API_KEY || '',
  pineconeEnvironment: process.env.PINECONE_ENVIRONMENT || '',
  embeddingModel: process.env.AZURE_OPENAI_DEPLOYMENT_EMBEDDING || 'text-embedding-3-small',
  completionModel: process.env.AZURE_OPENAI_DEPLOYMENT_TURBO || 'gpt-4o',
  chunkSize: 800,
  chunkOverlap: 150,
  maxContextTokens: 3000
};

/**
 * Test function to run the full AI pipeline
 */
async function testPipeline() {
  console.log(chalk.magenta.bold('🧪 PIPELINE E2E TEST - Starting'));
  console.log(chalk.blue('├── Test case: Company handbook leave policy query'));
  
  try {
    // Validate configuration
    if (!config.openaiApiKey) {
      throw new Error('Missing OpenAI API key. Set AZURE_OPENAI_API_KEY environment variable.');
    }
    
    if (!config.pineconeApiKey || !config.pineconeEnvironment) {
      throw new Error('Missing Pinecone configuration. Set PINECONE_API_KEY and PINECONE_ENVIRONMENT variables.');
    }
    
    console.log(chalk.blue('├── Configuration validated'));
    
    // Step 1: Read the PDF file (simulating file upload)
    console.log(chalk.yellow('├── Step 1: Loading test document'));
    
    // For this test, we'll use a text version of the PDF content
    // In a real scenario, you would extract text from the PDF
    const pdfTextPath = path.join(__dirname, 'sample_company_handbook.txt');
    
    if (!fs.existsSync(pdfTextPath)) {
      throw new Error(`Test file not found: ${pdfTextPath}`);
    }
    
    const documentText = fs.readFileSync(pdfTextPath, 'utf-8');
    console.log(chalk.green(`├── ✅ Loaded document: ${documentText.length} characters`));
    
    // Step 2: Initialize the pipeline
    console.log(chalk.yellow('├── Step 2: Initializing AI pipeline'));
    const pipeline = new AIDataPipeline(config);
    
    // Generate a unique test index name to avoid conflicts
    const testIndexName = `test-index-${Date.now()}`;
    await pipeline.initializeVectorDB(testIndexName);
    console.log(chalk.green(`├── ✅ Pipeline initialized with index: ${testIndexName}`));
    
    // Step 3: Process the document
    console.log(chalk.yellow('├── Step 3: Processing document'));
    const docInput: DocumentInput = {
      text: documentText,
      docId: `test-doc-${Date.now()}`,
      docName: 'Sample Company Handbook'
    };
    
    const processingResult = await pipeline.processDocument(docInput);
    console.log(chalk.green('├── ✅ Document processing complete'));
    console.log(chalk.blue(`├── [Stats] Chunks: ${processingResult.chunksProcessed}, Vectors: ${processingResult.vectorsStored}`));
    console.log(chalk.blue(`├── [Stats] Processing time: ${processingResult.processingTime}ms`));
    
    // Step 4: Query the document
    console.log(chalk.yellow('├── Step 4: Querying document'));
    const testQuery = 'What is the leave policy for part-time employees?';
    console.log(chalk.blue(`├── Query: "${testQuery}"`));
    
    const queryResult = await pipeline.queryDocuments(testQuery, { filter: { docId: docInput.docId } });
    console.log(chalk.green('├── ✅ Query complete'));
    console.log(chalk.blue(`├── [Stats] Processing time: ${queryResult.processingTime}ms, Tokens: ${queryResult.tokensUsed}`));
    
    // Step 5: Validate the response
    console.log(chalk.yellow('├── Step 5: Validating response'));
    console.log(chalk.blue('├── Response:'));
    console.log(chalk.cyan(`\n${queryResult.response}\n`));
    
    console.log(chalk.blue('├── Retrieved sources:'));
    queryResult.sources.forEach((source: { relevanceScore: number; text: string }, index: number) => {
      console.log(chalk.gray(`├── Source ${index + 1} (score: ${source.relevanceScore.toFixed(2)}):`));
      console.log(chalk.gray(`├── ${source.text.substring(0, 100)}...`));
    });
    
    // Check if response contains expected keywords
    const expectedKeywords = ['part-time', 'leave', 'policy', 'vacation', 'sick'];
    const containsKeywords = expectedKeywords.every(keyword => 
      queryResult.response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (containsKeywords) {
      console.log(chalk.green('├── ✅ Response contains expected keywords'));
    } else {
      console.log(chalk.yellow('├── ⚠️ Response may not fully address the query'));
    }
    
    console.log(chalk.magenta.bold('🎉 PIPELINE E2E TEST - Complete'));
    return {
      success: true,
      response: queryResult.response,
      sources: queryResult.sources
    };
    
  } catch (error) {
    console.error(chalk.red(`❌ TEST FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`));
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(error.stack));
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run the test
if (require.main === module) {
  testPipeline()
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

export { testPipeline };
