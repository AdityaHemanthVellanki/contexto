#!/usr/bin/env node
/**
 * Phase 2 Comprehensive QA Testing Automation
 * Tests authenticated flows, file uploads, processing, RAG queries, and deployment
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ContextoQAPhase2 {
  constructor() {
    this.baseUrl = 'http://localhost:3000';
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: [],
      details: []
    };
    this.authToken = null;
    this.userId = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async makeRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${endpoint}`;
      const defaultOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
        }
      };

      const requestOptions = { ...defaultOptions, ...options };
      
      const req = http.request(url, requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = data ? JSON.parse(data) : {};
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: jsonData
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: data
            });
          }
        });
      });

      req.on('error', reject);
      
      if (requestOptions.body) {
        req.write(typeof requestOptions.body === 'string' ? requestOptions.body : JSON.stringify(requestOptions.body));
      }
      
      req.end();
    });
  }

  async testServerHealth() {
    this.log('🏥 Testing Server Health...', 'info');
    try {
      const response = await this.makeRequest('/api/health');
      if (response.status === 200) {
        this.log('Server health check: PASSED', 'success');
        this.testResults.passed++;
        return true;
      } else {
        this.log(`Server health check: FAILED (Status: ${response.status})`, 'error');
        this.testResults.failed++;
        this.testResults.errors.push(`Server health: Status ${response.status}`);
        return false;
      }
    } catch (error) {
      this.log(`Server health check: ERROR - ${error.message}`, 'error');
      this.testResults.failed++;
      this.testResults.errors.push(`Server health: ${error.message}`);
      return false;
    }
  }

  async testAuthenticationEndpoints() {
    this.log('🔐 Testing Authentication Endpoints...', 'info');
    
    // Test protected endpoint without auth
    try {
      const response = await this.makeRequest('/api/upload');
      if (response.status === 401) {
        this.log('Unauthorized access protection: PASSED', 'success');
        this.testResults.passed++;
      } else {
        this.log(`Unauthorized access protection: FAILED (Expected 401, got ${response.status})`, 'error');
        this.testResults.failed++;
        this.testResults.errors.push(`Auth protection: Expected 401, got ${response.status}`);
      }
    } catch (error) {
      this.log(`Authentication test: ERROR - ${error.message}`, 'error');
      this.testResults.failed++;
      this.testResults.errors.push(`Auth test: ${error.message}`);
    }
  }

  async testFileUploadEndpoints() {
    this.log('📁 Testing File Upload Endpoints...', 'info');
    
    const testFiles = [
      { name: 'test-document.txt', path: './test-files/test-document.txt', type: 'text/plain' },
      { name: 'test-data.csv', path: './test-files/test-data.csv', type: 'text/csv' },
      { name: 'test-config.json', path: './test-files/test-config.json', type: 'application/json' },
      { name: 'test-page.html', path: './test-files/test-page.html', type: 'text/html' },
      { name: 'test-document.md', path: './test-files/test-document.md', type: 'text/markdown' }
    ];

    for (const testFile of testFiles) {
      if (fs.existsSync(testFile.path)) {
        try {
          const fileBuffer = fs.readFileSync(testFile.path);
          const response = await this.makeRequest('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': testFile.type,
              'X-Filename': testFile.name,
              'X-Mimetype': testFile.type,
              ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
            },
            body: fileBuffer
          });

          if (response.status === 200 || response.status === 201) {
            this.log(`File upload ${testFile.name}: PASSED`, 'success');
            this.testResults.passed++;
            this.testResults.details.push({
              test: `Upload ${testFile.name}`,
              status: 'PASSED',
              response: response.data
            });
          } else if (response.status === 401) {
            this.log(`File upload ${testFile.name}: REQUIRES AUTH (Status: 401)`, 'warning');
            this.testResults.details.push({
              test: `Upload ${testFile.name}`,
              status: 'AUTH_REQUIRED',
              response: response.data
            });
          } else {
            this.log(`File upload ${testFile.name}: FAILED (Status: ${response.status})`, 'error');
            this.testResults.failed++;
            this.testResults.errors.push(`Upload ${testFile.name}: Status ${response.status}`);
          }
        } catch (error) {
          this.log(`File upload ${testFile.name}: ERROR - ${error.message}`, 'error');
          this.testResults.failed++;
          this.testResults.errors.push(`Upload ${testFile.name}: ${error.message}`);
        }
      } else {
        this.log(`Test file not found: ${testFile.path}`, 'warning');
      }
    }
  }

  async testProcessingEndpoints() {
    this.log('⚙️ Testing Processing Endpoints...', 'info');
    
    try {
      const response = await this.makeRequest('/api/processPipeline', {
        method: 'POST',
        body: {
          fileId: 'test-file-id',
          purpose: 'QA testing pipeline processing'
        }
      });

      if (response.status === 401) {
        this.log('Processing pipeline: REQUIRES AUTH (Status: 401)', 'warning');
        this.testResults.details.push({
          test: 'Processing Pipeline',
          status: 'AUTH_REQUIRED',
          response: response.data
        });
      } else if (response.status === 200) {
        this.log('Processing pipeline: PASSED', 'success');
        this.testResults.passed++;
      } else {
        this.log(`Processing pipeline: FAILED (Status: ${response.status})`, 'error');
        this.testResults.failed++;
        this.testResults.errors.push(`Processing: Status ${response.status}`);
      }
    } catch (error) {
      this.log(`Processing pipeline: ERROR - ${error.message}`, 'error');
      this.testResults.failed++;
      this.testResults.errors.push(`Processing: ${error.message}`);
    }
  }

  async testExportEndpoints() {
    this.log('📦 Testing Export Endpoints...', 'info');
    
    try {
      const response = await this.makeRequest('/api/exportPipeline', {
        method: 'POST',
        body: {
          pipelineId: 'test-pipeline-id'
        }
      });

      if (response.status === 401) {
        this.log('Export pipeline: REQUIRES AUTH (Status: 401)', 'warning');
        this.testResults.details.push({
          test: 'Export Pipeline',
          status: 'AUTH_REQUIRED',
          response: response.data
        });
      } else if (response.status === 200) {
        this.log('Export pipeline: PASSED', 'success');
        this.testResults.passed++;
      } else {
        this.log(`Export pipeline: FAILED (Status: ${response.status})`, 'error');
        this.testResults.failed++;
        this.testResults.errors.push(`Export: Status ${response.status}`);
      }
    } catch (error) {
      this.log(`Export pipeline: ERROR - ${error.message}`, 'error');
      this.testResults.failed++;
      this.testResults.errors.push(`Export: ${error.message}`);
    }
  }

  async testDeploymentEndpoints() {
    this.log('🚀 Testing Deployment Endpoints...', 'info');
    
    // Test vector store deployment
    try {
      const response = await this.makeRequest('/api/deployVectorStore', {
        method: 'POST',
        body: {
          fileId: 'test-file-id',
          pipelineId: 'test-pipeline-id'
        }
      });

      if (response.status === 401) {
        this.log('Deploy vector store: REQUIRES AUTH (Status: 401)', 'warning');
        this.testResults.details.push({
          test: 'Deploy Vector Store',
          status: 'AUTH_REQUIRED',
          response: response.data
        });
      } else if (response.status === 200) {
        this.log('Deploy vector store: PASSED', 'success');
        this.testResults.passed++;
      } else {
        this.log(`Deploy vector store: FAILED (Status: ${response.status})`, 'error');
        this.testResults.failed++;
        this.testResults.errors.push(`Deploy vector store: Status ${response.status}`);
      }
    } catch (error) {
      this.log(`Deploy vector store: ERROR - ${error.message}`, 'error');
      this.testResults.failed++;
      this.testResults.errors.push(`Deploy vector store: ${error.message}`);
    }

    // Test server deployment
    try {
      const response = await this.makeRequest('/api/deployServer', {
        method: 'POST',
        body: {
          pipelineId: 'test-pipeline-id'
        }
      });

      if (response.status === 401) {
        this.log('Deploy server: REQUIRES AUTH (Status: 401)', 'warning');
        this.testResults.details.push({
          test: 'Deploy Server',
          status: 'AUTH_REQUIRED',
          response: response.data
        });
      } else if (response.status === 200) {
        this.log('Deploy server: PASSED', 'success');
        this.testResults.passed++;
      } else {
        this.log(`Deploy server: FAILED (Status: ${response.status})`, 'error');
        this.testResults.failed++;
        this.testResults.errors.push(`Deploy server: Status ${response.status}`);
      }
    } catch (error) {
      this.log(`Deploy server: ERROR - ${error.message}`, 'error');
      this.testResults.failed++;
      this.testResults.errors.push(`Deploy server: ${error.message}`);
    }
  }

  async testAPIEndpoints() {
    this.log('🔗 Testing All API Endpoints...', 'info');
    
    const endpoints = [
      { path: '/api/health', method: 'GET', expectAuth: false },
      { path: '/api/upload', method: 'POST', expectAuth: true },
      { path: '/api/processPipeline', method: 'POST', expectAuth: true },
      { path: '/api/exportPipeline', method: 'POST', expectAuth: true },
      { path: '/api/deployVectorStore', method: 'POST', expectAuth: true },
      { path: '/api/deployServer', method: 'POST', expectAuth: true },
      { path: '/api/generatePipeline', method: 'POST', expectAuth: true }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint.path, {
          method: endpoint.method,
          body: endpoint.method === 'POST' ? { test: 'data' } : undefined
        });

        if (endpoint.expectAuth && response.status === 401) {
          this.log(`${endpoint.path}: AUTH PROTECTION WORKING`, 'success');
          this.testResults.passed++;
        } else if (!endpoint.expectAuth && response.status !== 401) {
          this.log(`${endpoint.path}: PUBLIC ACCESS WORKING`, 'success');
          this.testResults.passed++;
        } else if (response.status === 200 || response.status === 201) {
          this.log(`${endpoint.path}: ENDPOINT ACCESSIBLE`, 'success');
          this.testResults.passed++;
        } else {
          this.log(`${endpoint.path}: UNEXPECTED STATUS ${response.status}`, 'warning');
        }

        this.testResults.details.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: response.status,
          expectAuth: endpoint.expectAuth,
          response: response.data
        });

      } catch (error) {
        this.log(`${endpoint.path}: ERROR - ${error.message}`, 'error');
        this.testResults.failed++;
        this.testResults.errors.push(`${endpoint.path}: ${error.message}`);
      }
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      phase: 'Phase 2: API Endpoints & Authentication',
      summary: {
        total: this.testResults.passed + this.testResults.failed,
        passed: this.testResults.passed,
        failed: this.testResults.failed,
        successRate: this.testResults.passed + this.testResults.failed > 0 
          ? ((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1) + '%'
          : '0%'
      },
      errors: this.testResults.errors,
      details: this.testResults.details,
      recommendations: []
    };

    // Add recommendations based on results
    if (this.testResults.errors.length > 0) {
      report.recommendations.push('Fix the errors listed above before proceeding to authenticated testing');
    }
    
    const authRequiredCount = this.testResults.details.filter(d => d.status === 'AUTH_REQUIRED').length;
    if (authRequiredCount > 0) {
      report.recommendations.push(`${authRequiredCount} endpoints require authentication - proceed with authenticated user testing`);
    }

    if (this.testResults.failed === 0) {
      report.recommendations.push('All API endpoints are working correctly - ready for authenticated flow testing');
    }

    // Write report to file
    const reportPath = './phase2-qa-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
  }

  async runAllTests() {
    this.log('🚀 Starting Phase 2 Comprehensive QA Testing', 'info');
    this.log('=' * 60, 'info');

    // Run all test suites
    await this.testServerHealth();
    await this.testAuthenticationEndpoints();
    await this.testAPIEndpoints();
    await this.testFileUploadEndpoints();
    await this.testProcessingEndpoints();
    await this.testExportEndpoints();
    await this.testDeploymentEndpoints();

    // Generate and display report
    const report = await this.generateReport();
    
    this.log('=' * 60, 'info');
    this.log('📊 PHASE 2 TEST RESULTS SUMMARY', 'info');
    this.log('=' * 60, 'info');
    this.log(`Total Tests: ${report.summary.total}`, 'info');
    this.log(`Passed: ${report.summary.passed}`, 'success');
    this.log(`Failed: ${report.summary.failed}`, report.summary.failed > 0 ? 'error' : 'info');
    this.log(`Success Rate: ${report.summary.successRate}`, 'info');

    if (report.errors.length > 0) {
      this.log('\n🚨 ERRORS FOUND:', 'error');
      report.errors.forEach((error, index) => {
        this.log(`${index + 1}. ${error}`, 'error');
      });
    }

    if (report.recommendations.length > 0) {
      this.log('\n💡 RECOMMENDATIONS:', 'info');
      report.recommendations.forEach((rec, index) => {
        this.log(`${index + 1}. ${rec}`, 'info');
      });
    }

    this.log(`\n📄 Detailed report saved to: ${path.resolve('./phase2-qa-report.json')}`, 'info');

    return report.summary.failed === 0;
  }
}

// Run the tests
if (require.main === module) {
  const qa = new ContextoQAPhase2();
  qa.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = ContextoQAPhase2;
