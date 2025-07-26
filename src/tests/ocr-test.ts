/**
 * OCR Test Script
 * 
 * This script tests the OCR functionality for image processing
 * by loading sample images and running them through the extractTextFromImage function.
 */

import fs from 'fs';
import path from 'path';
import { extractTextFromImage } from '../lib/image-ocr';

async function testOCR() {
  console.log('Starting OCR test...');
  
  // Create test directory if it doesn't exist
  const testDir = path.join(process.cwd(), 'test-images');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir);
    console.log(`Created test directory: ${testDir}`);
  }
  
  // Create a simple test image with text using Node Canvas
  // For this test, we'll use a pre-existing image if available
  // or provide instructions to create one
  
  const testImagePath = path.join(testDir, 'sample-text.png');
  
  if (!fs.existsSync(testImagePath)) {
    console.log(`Test image not found at ${testImagePath}`);
    console.log('Please create a test image with text content for OCR testing');
    console.log('You can use any image editing tool to create a PNG or JPEG with text');
    return;
  }
  
  try {
    // Read the test image
    const imageBuffer = fs.readFileSync(testImagePath);
    console.log(`Loaded test image: ${testImagePath} (${imageBuffer.byteLength} bytes)`);
    
    // Test PNG OCR
    console.log('Testing PNG OCR extraction...');
    const pngText = await extractTextFromImage(imageBuffer, 'image/png', 'sample-text.png');
    console.log('Extracted text from PNG:');
    console.log('-----------------------------------');
    console.log(pngText);
    console.log('-----------------------------------');
    
    // Test JPEG OCR (using same image but with JPEG mime type)
    console.log('Testing JPEG OCR extraction...');
    const jpegText = await extractTextFromImage(imageBuffer, 'image/jpeg', 'sample-text.jpg');
    console.log('Extracted text from JPEG:');
    console.log('-----------------------------------');
    console.log(jpegText);
    console.log('-----------------------------------');
    
    console.log('OCR test completed successfully!');
  } catch (error) {
    console.error('OCR test failed:', error);
  }
}

// Run the test
testOCR().catch(console.error);
