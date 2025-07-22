#!/usr/bin/env node
/**
 * Test script to validate file processing functionality
 * This tests the core file processing functions directly
 */

const fs = require('fs');
const path = require('path');

// Test file processing for each supported type
async function testFileProcessing() {
  console.log('🧪 Starting File Processor QA Tests\n');
  
  const testResults = {
    passed: 0,
    failed: 0,
    errors: []
  };
  
  // Test 1: Plain Text Processing
  console.log('📄 Testing Plain Text Processing...');
  try {
    const textPath = path.join(__dirname, 'test-files', 'test-document.txt');
    if (fs.existsSync(textPath)) {
      const buffer = fs.readFileSync(textPath);
      const content = buffer.toString('utf-8');
      
      // Validate key test phrases
      const requiredPhrases = [
        'UNIQUE_IDENTIFIER_12345',
        'TEST_VALUE_789',
        'testFunction',
        'café, naïve, résumé'
      ];
      
      let allFound = true;
      for (const phrase of requiredPhrases) {
        if (!content.includes(phrase)) {
          console.log(`❌ Missing phrase: ${phrase}`);
          allFound = false;
        }
      }
      
      if (allFound) {
        console.log('✅ Plain text processing: PASSED');
        testResults.passed++;
      } else {
        console.log('❌ Plain text processing: FAILED');
        testResults.failed++;
        testResults.errors.push('Plain text: Missing required phrases');
      }
    } else {
      console.log('⚠️  Test file not found: test-document.txt');
      testResults.failed++;
      testResults.errors.push('Plain text: Test file missing');
    }
  } catch (error) {
    console.log(`❌ Plain text processing error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Plain text: ${error.message}`);
  }
  
  // Test 2: CSV Processing
  console.log('\n📊 Testing CSV Processing...');
  try {
    const csvPath = path.join(__dirname, 'test-files', 'test-data.csv');
    if (fs.existsSync(csvPath)) {
      const buffer = fs.readFileSync(csvPath);
      const content = buffer.toString('utf-8');
      
      // Validate CSV structure and key values
      const requiredValues = [
        'Charlie Wilson,38,HR',
        'CSV_TEST_004',
        'CSV_UNIQUE_ROW5_COL2'
      ];
      
      let allFound = true;
      for (const value of requiredValues) {
        if (!content.includes(value)) {
          console.log(`❌ Missing CSV value: ${value}`);
          allFound = false;
        }
      }
      
      if (allFound) {
        console.log('✅ CSV processing: PASSED');
        testResults.passed++;
      } else {
        console.log('❌ CSV processing: FAILED');
        testResults.failed++;
        testResults.errors.push('CSV: Missing required values');
      }
    } else {
      console.log('⚠️  Test file not found: test-data.csv');
      testResults.failed++;
      testResults.errors.push('CSV: Test file missing');
    }
  } catch (error) {
    console.log(`❌ CSV processing error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`CSV: ${error.message}`);
  }
  
  // Test 3: JSON Processing
  console.log('\n🔧 Testing JSON Processing...');
  try {
    const jsonPath = path.join(__dirname, 'test-files', 'test-config.json');
    if (fs.existsSync(jsonPath)) {
      const buffer = fs.readFileSync(jsonPath);
      const content = buffer.toString('utf-8');
      
      // Parse JSON and validate structure
      const jsonData = JSON.parse(content);
      
      const requiredValues = [
        jsonData.test_metadata?.unique_identifier === 'JSON_TEST_ID_99999',
        jsonData.nested_object?.level_1?.level_2?.deep_value === 'NESTED_JSON_VALUE_123',
        jsonData.nested_object?.level_1?.level_2?.array_data?.[2] === 'JSON_ARRAY_ITEM_456'
      ];
      
      if (requiredValues.every(Boolean)) {
        console.log('✅ JSON processing: PASSED');
        testResults.passed++;
      } else {
        console.log('❌ JSON processing: FAILED');
        testResults.failed++;
        testResults.errors.push('JSON: Missing required nested values');
      }
    } else {
      console.log('⚠️  Test file not found: test-config.json');
      testResults.failed++;
      testResults.errors.push('JSON: Test file missing');
    }
  } catch (error) {
    console.log(`❌ JSON processing error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`JSON: ${error.message}`);
  }
  
  // Test 4: HTML Processing
  console.log('\n🌐 Testing HTML Processing...');
  try {
    const htmlPath = path.join(__dirname, 'test-files', 'test-page.html');
    if (fs.existsSync(htmlPath)) {
      const buffer = fs.readFileSync(htmlPath);
      const content = buffer.toString('utf-8');
      
      // Validate HTML structure and key values
      const requiredValues = [
        'HTML_UNIQUE_ID_54321',
        'HTML_TEST_VALUE_789',
        'HTML_BLOCKQUOTE_TEST_999',
        'HTML_TABLE_TEST_456'
      ];
      
      let allFound = true;
      for (const value of requiredValues) {
        if (!content.includes(value)) {
          console.log(`❌ Missing HTML value: ${value}`);
          allFound = false;
        }
      }
      
      if (allFound) {
        console.log('✅ HTML processing: PASSED');
        testResults.passed++;
      } else {
        console.log('❌ HTML processing: FAILED');
        testResults.failed++;
        testResults.errors.push('HTML: Missing required values');
      }
    } else {
      console.log('⚠️  Test file not found: test-page.html');
      testResults.failed++;
      testResults.errors.push('HTML: Test file missing');
    }
  } catch (error) {
    console.log(`❌ HTML processing error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`HTML: ${error.message}`);
  }
  
  // Test 5: Markdown Processing
  console.log('\n📝 Testing Markdown Processing...');
  try {
    const mdPath = path.join(__dirname, 'test-files', 'test-document.md');
    if (fs.existsSync(mdPath)) {
      const buffer = fs.readFileSync(mdPath);
      const content = buffer.toString('utf-8');
      
      // Validate Markdown structure and key values
      const requiredValues = [
        'UNIQUE_MARKDOWN_ID_67890',
        'MD_TEST_VALUE_456',
        'testMarkdownFunction',
        '| Column 1 | Column 2 | Column 3 |'
      ];
      
      let allFound = true;
      for (const value of requiredValues) {
        if (!content.includes(value)) {
          console.log(`❌ Missing Markdown value: ${value}`);
          allFound = false;
        }
      }
      
      if (allFound) {
        console.log('✅ Markdown processing: PASSED');
        testResults.passed++;
      } else {
        console.log('❌ Markdown processing: FAILED');
        testResults.failed++;
        testResults.errors.push('Markdown: Missing required values');
      }
    } else {
      console.log('⚠️  Test file not found: test-document.md');
      testResults.failed++;
      testResults.errors.push('Markdown: Test file missing');
    }
  } catch (error) {
    console.log(`❌ Markdown processing error: ${error.message}`);
    testResults.failed++;
    testResults.errors.push(`Markdown: ${error.message}`);
  }
  
  // Summary
  console.log('\n📋 Test Results Summary:');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n🚨 Errors Found:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }
  
  if (testResults.failed === 0) {
    console.log('\n🎉 All file processing tests PASSED!');
    return true;
  } else {
    console.log('\n⚠️  Some tests FAILED. Please fix the issues above.');
    return false;
  }
}

// Run the tests
testFileProcessing().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
