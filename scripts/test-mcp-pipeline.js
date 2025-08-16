#!/usr/bin/env node

/**
 * End-to-End MCP Pipeline Test
 * Tests the complete MCP creation flow with real APIs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${timestamp}] ${message}${colors.reset}`);
}

async function getAuthToken() {
  // In a real test, you'd get this from Firebase Auth
  // For now, we'll use a placeholder
  log('⚠️  Using test authentication token', 'yellow');
  return 'test-token-replace-with-real-firebase-token';
}

async function testFileUpload(token) {
  log('📤 Testing file upload to R2...', 'cyan');
  
  const testContent = `# Test MCP Document

This is a test document for the MCP pipeline.

## Features
- Real-time processing
- Vector embeddings
- RAG capabilities

## Content
This document contains sample content that will be:
1. Chunked into smaller pieces
2. Embedded using Azure OpenAI
3. Stored in Pinecone vector database
4. Made available for retrieval

The pipeline should process this content without any mocks or simulations.`;

  const formData = new FormData();
  const file = new Blob([testContent], { type: 'text/markdown' });
  formData.append('file', file, 'test-document.md');

  try {
    const response = await fetch('http://localhost:3000/api/uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    log(`✅ File uploaded successfully: ${result.fileId}`, 'green');
    return result.fileId;
  } catch (error) {
    log(`❌ File upload failed: ${error.message}`, 'red');
    throw error;
  }
}

async function testPipelineProcessing(token, fileId) {
  log('🚀 Testing pipeline processing...', 'cyan');
  
  const payload = {
    fileIds: [fileId],
    description: 'Test MCP for vector processing and RAG capabilities',
    tools: [
      {
        name: 'search_knowledge',
        description: 'Search the knowledge base for relevant information',
        parameters: [
          {
            name: 'query',
            type: 'string',
            description: 'The search query',
            required: true
          }
        ]
      }
    ],
    autoGenerateTools: true,
    name: 'Test MCP Pipeline'
  };

  try {
    const response = await fetch('http://localhost:3000/api/processPipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Pipeline failed: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    log(`✅ Pipeline started: ${result.data.pipelineId}`, 'green');
    return result.data.pipelineId;
  } catch (error) {
    log(`❌ Pipeline processing failed: ${error.message}`, 'red');
    throw error;
  }
}

async function checkPipelineStatus(token, pipelineId) {
  log('📊 Checking pipeline status...', 'cyan');
  
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`http://localhost:3000/api/processPipeline/status?pipelineId=${pipelineId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const result = await response.json();
      const status = result.data.status;
      
      log(`Pipeline status: ${status}`, status === 'completed' ? 'green' : 'yellow');
      
      if (status === 'completed') {
        log('✅ Pipeline completed successfully!', 'green');
        return result.data;
      } else if (status === 'error') {
        throw new Error(`Pipeline failed: ${result.data.error}`);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      log(`❌ Status check error: ${error.message}`, 'red');
      throw error;
    }
  }
  
  throw new Error('Pipeline timeout - exceeded maximum attempts');
}

async function testRAGQuery(token, pipelineId) {
  log('🔍 Testing RAG query...', 'cyan');
  
  const query = 'What are the main features of this MCP?';
  
  try {
    const response = await fetch('http://localhost:3000/api/rag/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        pipelineId,
        query,
        maxResults: 5
      }),
    });

    if (!response.ok) {
      throw new Error(`RAG query failed: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    log(`✅ RAG query successful: Found ${result.results.length} relevant chunks`, 'green');
    return result;
  } catch (error) {
    log(`❌ RAG query failed: ${error.message}`, 'red');
    throw error;
  }
}

async function runFullPipelineTest() {
  log('🎯 Starting Full MCP Pipeline Test', 'bright');
  log('=' .repeat(50), 'blue');
  
  try {
    // Step 1: Get authentication token
    const token = await getAuthToken();
    
    // Step 2: Upload test file
    const fileId = await testFileUpload(token);
    
    // Step 3: Start pipeline processing
    const pipelineId = await testPipelineProcessing(token, fileId);
    
    // Step 4: Monitor pipeline status
    const pipelineResult = await checkPipelineStatus(token, pipelineId);
    
    // Step 5: Test RAG query
    const ragResult = await testRAGQuery(token, pipelineId);
    
    log('=' .repeat(50), 'blue');
    log('🎉 All tests passed successfully!', 'green');
    log('Pipeline Details:', 'cyan');
    log(`  - File ID: ${fileId}`, 'cyan');
    log(`  - Pipeline ID: ${pipelineId}`, 'cyan');
    log(`  - Chunks processed: ${pipelineResult.chunksCount}`, 'cyan');
    log(`  - Embeddings created: ${pipelineResult.embeddingsCount}`, 'cyan');
    log(`  - RAG results: ${ragResult.results.length}`, 'cyan');
    
  } catch (error) {
    log('=' .repeat(50), 'red');
    log(`❌ Test failed: ${error.message}`, 'red');
    log('Stack trace:', 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

// Check if server is running
fetch('http://localhost:3000/api/health')
  .then(() => {
    log('✅ Server is running', 'green');
    runFullPipelineTest();
  })
  .catch(() => {
    log('❌ Server is not running. Please start with: npm run dev', 'red');
    process.exit(1);
  });
