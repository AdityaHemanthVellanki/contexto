/**
 * Comprehensive End-to-End Test Suite for Contexto
 * 
 * This test suite simulates real user interactions from login through
 * multi-chat management, file upload, pipeline generation, deployment,
 * and live endpoint verification.
 */

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

interface TestUser {
  email: string;
  password: string;
  uid?: string;
  idToken?: string;
}

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class ContextoE2ETestSuite {
  private results: TestResult[] = [];
  private testUserA: TestUser = { email: 'test-user-a@contexto-test.com', password: 'TestPassword123!' };
  private testUserB: TestUser = { email: 'test-user-b@contexto-test.com', password: 'TestPassword123!' };

  async runFullTestSuite(): Promise<TestResult[]> {
    console.log('🚀 Starting Contexto Comprehensive End-to-End Test Suite');
    
    try {
      // 1. Setup & Preflight
      await this.runTest('Environment Setup', this.testEnvironmentSetup.bind(this));
      await this.runTest('Create Test Users', this.createTestUsers.bind(this));
      
      // 2. Multi-Chat Functionality Tests
      await this.runTest('Multi-Chat Management - User A', () => this.testMultiChatManagement(this.testUserA));
      
      // 3. Files Page & Integration Tests
      await this.runTest('Files Management Page - User A', () => this.testFilesManagement(this.testUserA));
      
      // 4. File Upload Tests (Multiple File Types)
      const fileTypes = ['.csv', '.txt', '.json', '.pdf'];
      for (const fileType of fileTypes) {
        await this.runTest(`File Upload ${fileType} - User A`, () => this.testFileUpload(this.testUserA, fileType));
      }
      
      // 5. Pipeline Generation & Ingestion
      await this.runTest('Pipeline Generation - User A', () => this.testPipelineGeneration(this.testUserA));
      
      // 6. Chat & RAG Query
      await this.runTest('RAG Query - User A', () => this.testRAGQuery(this.testUserA));
      
      // 7. Export ZIP Verification
      await this.runTest('Export ZIP - User A', () => this.testExportZIP(this.testUserA));
      
      // 8. Deploy Flow Tests
      await this.runTest('Deploy Vector Store - User A', () => this.testDeployVectorStore(this.testUserA));
      await this.runTest('Deploy MCP Server - User A', () => this.testDeployMCPServer(this.testUserA));
      
      // 9. Live Server Endpoint Tests
      await this.runTest('Live Endpoint Tests - User A', () => this.testLiveEndpoints(this.testUserA));
      
      // 10. Multi-User Isolation
      await this.runTest('Multi-User Isolation', this.testMultiUserIsolation.bind(this));
      
      // 11. Error & Edge-Case Scenarios
      await this.runTest('Edge Case Tests', this.testEdgeCases.bind(this));
      
      // 12. Cleanup
      await this.runTest('Cleanup Test Data', this.cleanupTestData.bind(this));
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }
    
    this.printTestResults();
    return this.results;
  }

  private async runTest(testName: string, testFunction: () => Promise<void>): Promise<void> {
    const startTime = Date.now();
    console.log(`🧪 Running: ${testName}`);
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      this.results.push({ testName, passed: true, duration });
      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ testName, passed: false, error: errorMessage, duration });
      console.error(`❌ ${testName} - FAILED: ${errorMessage} (${duration}ms)`);
    }
  }

  private async testEnvironmentSetup(): Promise<void> {
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'FIREBASE_PROJECT_ID',
      'CF_R2_BUCKET_NAME',
      'AZURE_OPENAI_API_KEY',
      'PINECONE_API_KEY',
      'HEROKU_API_KEY'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Test API endpoints availability
    const endpoints = ['/api/upload', '/api/processPipeline', '/api/deployVectorStore', '/api/deployServer'];
    for (const endpoint of endpoints) {
      const response = await fetch(`http://localhost:3006${endpoint}`, { method: 'OPTIONS' });
      if (!response.ok && response.status !== 405) { // 405 Method Not Allowed is acceptable for OPTIONS
        throw new Error(`API endpoint ${endpoint} not accessible`);
      }
    }
  }

  private async createTestUsers(): Promise<void> {
    const auth = getAuth();
    
    // Create or sign in test users
    for (const testUser of [this.testUserA, this.testUserB]) {
      try {
        // Try to create user
        const userCredential = await createUserWithEmailAndPassword(auth, testUser.email, testUser.password);
        testUser.uid = userCredential.user.uid;
        testUser.idToken = await userCredential.user.getIdToken();
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          // User exists, sign in instead
          const userCredential = await signInWithEmailAndPassword(auth, testUser.email, testUser.password);
          testUser.uid = userCredential.user.uid;
          testUser.idToken = await userCredential.user.getIdToken();
        } else {
          throw error;
        }
      }
    }

    // Clear existing data for test users
    await this.clearUserData(this.testUserA);
    await this.clearUserData(this.testUserB);
  }

  private async clearUserData(user: TestUser): Promise<void> {
    if (!user.uid) return;

    // Clear Firestore data
    const collections = ['uploads', 'conversations', 'pipelines', 'exports', 'deployments'];
    for (const collectionName of collections) {
      const q = query(collection(db, collectionName), where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    }

    // TODO: Clear R2 storage data for user
  }

  private async testMultiChatManagement(user: TestUser): Promise<void> {
    if (!user.idToken) throw new Error('User not authenticated');

    // Test creating new chat via API
    const createChatResponse = await fetch('http://localhost:3006/api/chats', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Test Chat 1' })
    });

    if (!createChatResponse.ok) {
      throw new Error('Failed to create chat via API');
    }

    const { chatId } = await createChatResponse.json();
    
    // Test renaming chat
    const renameChatResponse = await fetch(`http://localhost:3006/api/chats/${chatId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Renamed Test Chat' })
    });

    if (!renameChatResponse.ok) {
      throw new Error('Failed to rename chat');
    }

    // Test deleting chat
    const deleteChatResponse = await fetch(`http://localhost:3006/api/chats/${chatId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${user.idToken}`
      }
    });

    if (!deleteChatResponse.ok) {
      throw new Error('Failed to delete chat');
    }
  }

  private async testFilesManagement(user: TestUser): Promise<void> {
    // This would test the /files page functionality
    // For now, we'll test the underlying API endpoints
    
    if (!user.idToken) throw new Error('User not authenticated');

    // Test file list endpoint
    const listResponse = await fetch('http://localhost:3006/api/files', {
      headers: { 'Authorization': `Bearer ${user.idToken}` }
    });

    if (!listResponse.ok) {
      throw new Error('Failed to list files');
    }

    const files = await listResponse.json();
    if (!Array.isArray(files)) {
      throw new Error('Files list should be an array');
    }
  }

  private async testFileUpload(user: TestUser, fileType: string): Promise<void> {
    if (!user.idToken) throw new Error('User not authenticated');

    // Create a test file based on type
    const testContent = this.generateTestFileContent(fileType);
    const blob = new Blob([testContent], { type: this.getMimeType(fileType) });
    const file = new File([blob], `test${fileType}`, { type: this.getMimeType(fileType) });

    const formData = new FormData();
    formData.append('file', file);

    const uploadResponse = await fetch('http://localhost:3006/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${user.idToken}` },
      body: formData
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.json();
      throw new Error(`File upload failed: ${error.message}`);
    }

    const result = await uploadResponse.json();
    if (!result.fileId) {
      throw new Error('Upload response missing fileId');
    }
  }

  private async testPipelineGeneration(user: TestUser): Promise<void> {
    if (!user.idToken) throw new Error('User not authenticated');

    const pipelineRequest = {
      purpose: 'I want to search my document for keywords and get summaries',
      fileId: 'test-file-id' // This would be from a previous upload
    };

    const response = await fetch('http://localhost:3006/api/processPipeline', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pipelineRequest)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Pipeline generation failed: ${error.message}`);
    }

    const result = await response.json();
    if (!result.pipelineId || !result.downloadUrl) {
      throw new Error('Pipeline response missing required fields');
    }
  }

  private async testRAGQuery(user: TestUser): Promise<void> {
    if (!user.idToken) throw new Error('User not authenticated');

    const queryRequest = {
      question: 'What is the main topic of this document?',
      pipelineId: 'test-pipeline-id'
    };

    const response = await fetch('http://localhost:3006/api/query', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryRequest)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`RAG query failed: ${error.message}`);
    }

    const result = await response.json();
    if (!result.answer || typeof result.answer !== 'string') {
      throw new Error('Query response missing or invalid answer');
    }
  }

  private async testExportZIP(user: TestUser): Promise<void> {
    if (!user.idToken) throw new Error('User not authenticated');

    const exportRequest = { pipelineId: 'test-pipeline-id' };

    const response = await fetch('http://localhost:3006/api/exportPipeline', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(exportRequest)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Export failed: ${error.message}`);
    }

    const result = await response.json();
    if (!result.downloadUrl) {
      throw new Error('Export response missing downloadUrl');
    }

    // Test downloading the ZIP
    const downloadResponse = await fetch(result.downloadUrl);
    if (!downloadResponse.ok) {
      throw new Error('Failed to download exported ZIP');
    }

    const zipBuffer = await downloadResponse.arrayBuffer();
    if (zipBuffer.byteLength === 0) {
      throw new Error('Downloaded ZIP is empty');
    }
  }

  private async testDeployVectorStore(user: TestUser): Promise<void> {
    if (!user.idToken) throw new Error('User not authenticated');

    const deployRequest = { pipelineId: 'test-pipeline-id' };

    const response = await fetch('http://localhost:3006/api/deployVectorStore', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deployRequest)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Vector store deployment failed: ${error.message}`);
    }

    const result = await response.json();
    if (!result.vectorStoreType || !result.vectorStoreConfig) {
      throw new Error('Vector store deployment response missing required fields');
    }
  }

  private async testDeployMCPServer(user: TestUser): Promise<void> {
    if (!user.idToken) throw new Error('User not authenticated');

    const deployRequest = { 
      pipelineId: 'test-pipeline-id',
      vectorStoreConfig: { type: 'pinecone', indexName: 'test-index' }
    };

    const response = await fetch('http://localhost:3006/api/deployServer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(deployRequest)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`MCP server deployment failed: ${error.message}`);
    }

    const result = await response.json();
    if (!result.mcpUrl) {
      throw new Error('MCP server deployment response missing mcpUrl');
    }
  }

  private async testLiveEndpoints(user: TestUser): Promise<void> {
    const mcpUrl = 'https://test-pipeline.herokuapp.com'; // This would come from Heroku deployment

    // Test /ingest endpoint
    const ingestResponse = await fetch(`${mcpUrl}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrl: 'https://example.com/test.txt' })
    });

    if (!ingestResponse.ok) {
      throw new Error('Live ingest endpoint failed');
    }

    // Test /query endpoint
    const queryResponse = await fetch(`${mcpUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Test question?' })
    });

    if (!queryResponse.ok) {
      throw new Error('Live query endpoint failed');
    }

    // Test /delete endpoint
    const deleteResponse = await fetch(`${mcpUrl}/delete`, { method: 'DELETE' });

    if (!deleteResponse.ok) {
      throw new Error('Live delete endpoint failed');
    }
  }

  private async testMultiUserIsolation(): Promise<void> {
    // Test that User B cannot access User A's data
    if (!this.testUserB.idToken || !this.testUserA.uid) {
      throw new Error('Test users not properly set up');
    }

    // Try to access User A's files with User B's token
    const response = await fetch(`http://localhost:3006/api/files/${this.testUserA.uid}`, {
      headers: { 'Authorization': `Bearer ${this.testUserB.idToken}` }
    });

    if (response.ok) {
      throw new Error('User B should not be able to access User A\'s files');
    }

    if (response.status !== 403) {
      throw new Error('Expected 403 Forbidden for cross-user access');
    }
  }

  private async testEdgeCases(): Promise<void> {
    // Test invalid file type
    const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });
    const formData = new FormData();
    formData.append('file', invalidFile);

    const response = await fetch('http://localhost:3006/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.testUserA.idToken}` },
      body: formData
    });

    if (response.ok) {
      throw new Error('Should reject invalid file types');
    }

    // Test expired token
    const expiredTokenResponse = await fetch('http://localhost:3006/api/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer invalid-token' },
      body: formData
    });

    if (expiredTokenResponse.status !== 401) {
      throw new Error('Should return 401 for invalid token');
    }
  }

  private async cleanupTestData(): Promise<void> {
    await this.clearUserData(this.testUserA);
    await this.clearUserData(this.testUserB);
    
    // Sign out test users
    const auth = getAuth();
    await signOut(auth);
  }

  private generateTestFileContent(fileType: string): string {
    switch (fileType) {
      case '.csv':
        return 'name,age,city\nJohn,30,New York\nJane,25,San Francisco';
      case '.txt':
        return 'This is a test document with some sample content for testing purposes.';
      case '.json':
        return JSON.stringify({ message: 'Test JSON content', data: [1, 2, 3] });
      case '.pdf':
        return '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj'; // Minimal PDF
      default:
        return 'Test content';
    }
  }

  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      '.csv': 'text/csv',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.pdf': 'application/pdf'
    };
    return mimeTypes[fileType] || 'text/plain';
  }

  private printTestResults(): void {
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    console.log(`📈 Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);
    
    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.filter(r => !r.passed).forEach(result => {
        console.log(`  • ${result.testName}: ${result.error}`);
      });
    }
    
    console.log('\n🎯 Test Suite Complete!');
  }
}

// Export for use in other test files
export { ContextoE2ETestSuite };
export type { TestResult };

// Run the test suite if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  const testSuite = new ContextoE2ETestSuite();
  testSuite.runFullTestSuite().then(results => {
    process.exit(results.some(r => !r.passed) ? 1 : 0);
  });
}
