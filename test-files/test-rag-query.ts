import chalk from 'chalk';
import { DocumentRetriever } from '../src/lib/services/retriever';
import { CompletionService } from '../src/lib/services/completion';

/**
 * Test the RAG (Retrieval-Augmented Generation) query process
 * This test uses mock implementations of retriever and completion services
 */
async function testRAGQuery() {
  console.log(chalk.magenta.bold('🧪 RAG QUERY COMPONENT TEST - Starting'));
  
  try {
    // Create test query
    const testQuery = "What is the leave policy for part-time employees?";
    console.log(chalk.blue(`├── Test query: "${testQuery}"`));
    
    // Create mock retrieved context
    const retrievedContext = [
      "Part-time employees who work at least 20 hours per week accrue vacation leave on a pro-rated basis. For example, an employee working 20 hours per week (50% of full-time) with 0-2 years of service would accrue 5 days per year.",
      "Part-time employees who work at least 20 hours per week receive sick leave on a pro-rated basis according to their standard hours. For example, an employee working 20 hours per week would receive 4 sick days per year.",
      "Part-time employees who work at least 20 hours per week are eligible for parental leave on a pro-rated basis according to their standard hours. For example, an employee working 20 hours per week would be eligible for 6 weeks of paid leave for birth parents and 3 weeks for non-birth parents.",
      "All employees, including part-time employees, are eligible for up to 3 days of paid bereavement leave in the event of the death of an immediate family member. Part-time employees will receive bereavement pay based on their scheduled hours during the bereavement period.",
      "For part-time employees, any leave of absence will be evaluated on a case-by-case basis, with consideration given to the employee's length of service, performance, and the company's needs."
    ];
    
    console.log(chalk.blue(`├── Retrieved ${retrievedContext.length} context chunks`));
    
    // Create a mock retriever
    const mockRetriever = {
      retrieveContext: async (query: string, docId: string, maxResults: number = 5) => {
        console.log(chalk.yellow(`├── Retrieving context for query: "${query}"`));
        console.log(chalk.yellow(`├── Document ID: ${docId}, Max results: ${maxResults}`));
        
        // Return mock context
        return {
          context: retrievedContext,
          sources: retrievedContext.map((text, i) => ({
            docId: 'test-doc-123',
            docName: 'Sample Company Handbook',
            relevanceScore: 0.9 - (i * 0.1),
            text
          })),
          processingTime: 50
        };
      }
    };
    
    // Create a mock completion service
    const mockCompletion = {
      generateCompletion: async (prompt: string, options: any = {}) => {
        console.log(chalk.yellow(`├── Generating completion for prompt (${prompt.length} chars)`));
        
        // Simulate thinking about the answer based on context
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Generate a mock response based on the retrieved context
        let response = "Based on the company handbook, part-time employees who work at least 20 hours per week have the following leave policies:\n\n";
        response += "1. Vacation Leave: Pro-rated based on hours worked. For example, an employee working 20 hours per week (50% of full-time) with 0-2 years of service would accrue 5 days per year.\n\n";
        response += "2. Sick Leave: Pro-rated based on standard hours. For example, an employee working 20 hours per week would receive 4 sick days per year.\n\n";
        response += "3. Parental Leave: Pro-rated based on standard hours. An employee working 20 hours per week would be eligible for 6 weeks of paid leave for birth parents and 3 weeks for non-birth parents.\n\n";
        response += "4. Bereavement Leave: Up to 3 days of paid leave, with pay based on scheduled hours during the bereavement period.\n\n";
        response += "5. Leave of Absence: Evaluated case-by-case, considering length of service, performance, and company needs.";
        
        return {
          response,
          promptTokens: Math.ceil(prompt.length / 4),
          completionTokens: Math.ceil(response.length / 4),
          totalTokens: Math.ceil(prompt.length / 4) + Math.ceil(response.length / 4),
          processingTime: 500
        };
      }
    };
    
    // Test the RAG query process
    console.log(chalk.yellow('\n├── Testing RAG query process'));
    
    // Step 1: Retrieve context
    console.time('retrieval');
    const retrievalResult = await mockRetriever.retrieveContext(testQuery, 'test-doc-123', 5);
    console.timeEnd('retrieval');
    
    console.log(chalk.green(`├── ✅ Retrieved ${retrievalResult.context.length} context chunks in ${retrievalResult.processingTime}ms`));
    
    // Step 2: Generate completion
    console.time('completion');
    
    // Build prompt with context
    const prompt = `
Answer the following question based on the provided context. If the answer is not in the context, say "I don't have enough information to answer this question."

Context:
${retrievalResult.context.join('\n\n')}

Question: ${testQuery}
    `.trim();
    
    const completionResult = await mockCompletion.generateCompletion(prompt);
    console.timeEnd('completion');
    
    console.log(chalk.green(`├── ✅ Generated completion in ${completionResult.processingTime}ms`));
    console.log(chalk.blue(`├── Tokens used: ${completionResult.totalTokens} (prompt: ${completionResult.promptTokens}, completion: ${completionResult.completionTokens})`));
    
    // Step 3: Validate response
    console.log(chalk.yellow('\n├── Validating response'));
    console.log(chalk.cyan(`\n${completionResult.response}\n`));
    
    // Check if response contains expected keywords
    const expectedKeywords = ['part-time', 'leave', 'policy', 'vacation', 'sick', 'pro-rated'];
    const containsKeywords = expectedKeywords.every(keyword => 
      completionResult.response.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (containsKeywords) {
      console.log(chalk.green('├── ✅ Response contains all expected keywords'));
    } else {
      console.log(chalk.yellow('├── ⚠️ Response may not fully address the query'));
      
      // Check which keywords are missing
      const missingKeywords = expectedKeywords.filter(keyword => 
        !completionResult.response.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (missingKeywords.length > 0) {
        console.log(chalk.yellow(`├── ⚠️ Missing keywords: ${missingKeywords.join(', ')}`));
      }
    }
    
    console.log(chalk.magenta.bold('\n🎉 RAG QUERY COMPONENT TEST - Complete'));
    return { success: true };
    
  } catch (error) {
    console.error(chalk.red(`❌ TEST FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`));
    if (error instanceof Error && error.stack) {
      console.error(chalk.red(error.stack));
    }
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Run the test
if (require.main === module) {
  testRAGQuery()
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

export { testRAGQuery };
