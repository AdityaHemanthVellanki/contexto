# Contexto Comprehensive QA Test Suite

## Overview
This document provides a systematic approach to test every supported file type and user flow in the Contexto application. Each test must be executed and validated for 100% accuracy.

## Test Environment Setup
- Server: http://localhost:3000
- Test Files Directory: `/test-files/`
- Authentication: Required for all API endpoints
- Browser: Windsurf Browser with accessibility testing

## 1. File Type Testing Matrix

### 1.1 Plain Text Files
**Test Files Created:**
- `test-document.txt` - Contains unique identifiers and test phrases
- `test-document.md` - Markdown with formatting and code blocks
- `test-page.html` - HTML with tags, tables, and structured content
- `test-data.csv` - Structured data with specific row/column values
- `test-config.json` - Nested JSON with arrays and objects

**Validation Criteria:**
- [ ] Upload via Files page shows correct filename, type, size
- [ ] Upload via ChatWindow shows progress and confirmation
- [ ] Text extraction preserves all content (UTF-8 accuracy: 100%)
- [ ] Unique identifiers are extracted exactly: `UNIQUE_IDENTIFIER_12345`
- [ ] Special characters preserved: @#$%^&*()
- [ ] Unicode characters preserved: café, naïve, résumé
- [ ] Numbers preserved: 42, 3.14159, -17

### 1.2 Document Files (Requires Creation)
**Test Files Needed:**
- [ ] `test-document.pdf` - Multi-page PDF with text, tables, images
- [ ] `test-presentation.pptx` - Slides with titles, bullet points, images
- [ ] `test-spreadsheet.xlsx` - Multiple sheets with formulas and data
- [ ] `test-document.docx` - Formatted document with headers, lists, tables

**Validation Criteria:**
- [ ] PDF: `pdf-parse` extracts text from all pages
- [ ] PPTX: `pptx-parser` extracts slide titles and content
- [ ] XLSX: SheetJS converts to readable text/CSV format
- [ ] DOCX: `mammoth` preserves document structure and content

### 1.3 Image Files (OCR Testing)
**Test Files Needed:**
- [ ] `test-image.png` - Clear text image for OCR testing
- [ ] `test-image.jpg` - JPEG with text and numbers
- [ ] `test-image-complex.png` - Image with mixed fonts and layouts

**Validation Criteria:**
- [ ] Tesseract OCR extracts text with >90% accuracy
- [ ] Unique identifiers extracted: `UNIQUE_OCR_ID_13579`
- [ ] Numbers extracted correctly: 42, 3.14159, -17
- [ ] Worker path configuration works in Next.js environment
- [ ] Fallback mechanism works if primary OCR fails

### 1.4 Audio Files (Speech-to-Text)
**Test Files Needed:**
- [ ] `test-audio.mp3` - Clear speech with specific phrases
- [ ] `test-audio.wav` - WAV format with test content

**Validation Criteria:**
- [ ] Whisper API transcription with >90% accuracy
- [ ] Azure OpenAI configuration working
- [ ] Specific phrases transcribed correctly
- [ ] Audio duration and quality handled properly

### 1.5 Video Files (Audio Extraction + Transcription)
**Test Files Needed:**
- [ ] `test-video.mp4` - Video with clear audio track
- [ ] `test-video.mov` - MOV format with speech content

**Validation Criteria:**
- [ ] ffmpeg extracts audio successfully
- [ ] Audio passed to Whisper for transcription
- [ ] Video metadata preserved
- [ ] Full audio content transcribed accurately

## 2. Upload Flow Testing

### 2.1 Files Page Upload
**Test Steps:**
1. Navigate to `/files` page
2. Click "Upload New File" button
3. Select test file from dialog
4. Verify progress bar appears and completes
5. Confirm file appears in table with correct metadata
6. Check Firestore `uploads` collection for file record

**Validation Points:**
- [ ] Progress bar shows accurate upload progress
- [ ] File table updates with correct filename, type, size, timestamp
- [ ] R2 storage contains uploaded file at correct path
- [ ] Firestore document created with proper user ownership
- [ ] File processing status updates correctly

### 2.2 ChatWindow Upload
**Test Steps:**
1. Navigate to `/dashboard`
2. Start new chat session
3. Use file upload dropdown or drag-and-drop
4. Select test file
5. Verify upload confirmation message
6. Check for "Using existing file" message on re-upload

**Validation Points:**
- [ ] Upload progress indicator works
- [ ] Confirmation message shows filename
- [ ] Duplicate file detection works
- [ ] Chat context includes file information
- [ ] File processing initiates automatically

## 3. File Processing Pipeline Testing

### 3.1 Extraction Accuracy
**For Each File Type:**
1. Upload file through either flow
2. Monitor server logs for processing messages
3. Check extracted content in Firestore or logs
4. Compare extracted text with original content
5. Verify unique identifiers are preserved exactly

**Validation Criteria:**
- [ ] Text files: 100% UTF-8 accuracy
- [ ] HTML files: Tags stripped, content preserved
- [ ] CSV files: Structured data readable
- [ ] JSON files: All nested values accessible
- [ ] PDF files: Multi-page text extraction
- [ ] Images: OCR text >90% accurate
- [ ] Audio: Transcription >90% accurate
- [ ] Video: Audio extraction + transcription working

### 3.2 Chunking and Embedding
**Test Steps:**
1. Process file through pipeline
2. Check chunk count matches expected range (500-1000 tokens)
3. Verify chunk overlap (~10%)
4. Confirm embeddings generated for each chunk
5. Test vector store upsert operations

**Validation Points:**
- [ ] Chunk sizes within token limits
- [ ] Proper overlap between chunks
- [ ] All chunks have embeddings
- [ ] Vector store operations succeed
- [ ] Metadata preserved in vector store

## 4. RAG Query Testing

### 4.1 Standard Queries
**Test Queries by File Type:**

**Text Files:**
- "What is the unique identifier in the document?" → `UNIQUE_IDENTIFIER_12345`
- "What numbers are mentioned?" → `42, 3.14159, -17`
- "What is the function name in the code snippet?" → `testFunction`

**CSV Files:**
- "What is the value in row 5, column 2?" → `38` (Charlie Wilson's age)
- "What is Alice Brown's Test_ID?" → `CSV_TEST_004`

**JSON Files:**
- "What is the unique_identifier value?" → `JSON_TEST_ID_99999`
- "What is the deep_value in the nested object?" → `NESTED_JSON_VALUE_123`

**HTML Files:**
- "What is the test value in the span element?" → `HTML_TEST_VALUE_789`
- "What is the blockquote test value?" → `HTML_BLOCKQUOTE_TEST_999`

### 4.2 Edge Case Queries
- Complex multi-step reasoning
- Numeric calculations from CSV data
- Code extraction from markdown/HTML
- Cross-reference queries spanning multiple chunks

**Validation Criteria:**
- [ ] Response time < 2 seconds
- [ ] Answers match expected values exactly
- [ ] No hallucinated content
- [ ] Proper source attribution
- [ ] Graceful handling of unanswerable queries

## 5. Export and Deployment Testing

### 5.1 MCP Pipeline Export
**Test Steps:**
1. Complete file processing pipeline
2. Click "Export MCP Pipeline" in chat
3. Download ZIP file
4. Extract and examine contents

**Validation Points:**
- [ ] ZIP downloads successfully
- [ ] `pipeline.json` contains correct configuration
- [ ] `server.js` has real vector store integration
- [ ] `package.json` is syntactically valid
- [ ] `Dockerfile` builds successfully
- [ ] `openapi.yaml` validates

### 5.2 Local Deployment Test
**Test Steps:**
1. Extract MCP pipeline ZIP
2. Run `npm install`
3. Start server with `npm start`
4. Test `/ingest` endpoint with file URL
5. Test `/query` endpoint with test questions
6. Test `/delete` endpoint

**Validation Points:**
- [ ] Server starts without errors
- [ ] Ingestion endpoint accepts files
- [ ] Query endpoint returns accurate answers
- [ ] Delete endpoint clears vector store
- [ ] All endpoints return proper HTTP status codes

### 5.3 Vercel Deployment
**Test Steps:**
1. Click "Deploy MCP Server" in chat
2. Monitor deployment progress
3. Test live endpoints at deployed URL
4. Verify vector store provisioning

**Validation Points:**
- [ ] Vercel deployment succeeds
- [ ] Live endpoints respond correctly
- [ ] Vector store (Pinecone/Qdrant/Supabase) created
- [ ] Environment variables configured
- [ ] Deployment logged in Firestore

## 6. Multi-User Isolation Testing

### 6.1 User A Testing
1. Sign in as User A
2. Upload and process test files
3. Create pipelines and deployments
4. Note all resource IDs

### 6.2 User B Testing
1. Sign in as User B
2. Attempt to access User A's resources
3. Upload different test files
4. Create separate pipelines

**Validation Points:**
- [ ] User B cannot see User A's files
- [ ] User B cannot access User A's pipelines
- [ ] User B cannot query User A's vector stores
- [ ] Firestore security rules enforce isolation
- [ ] API endpoints return 403 for unauthorized access

## 7. Error Handling and Recovery

### 7.1 Authentication Errors
- [ ] Expired Firebase token → 401 response
- [ ] Invalid token → 401 response
- [ ] Missing token → 401 response
- [ ] UI shows appropriate error message

### 7.2 Service Errors
- [ ] Azure OpenAI rate limit → 429 handling
- [ ] Vector store quota exceeded → graceful error
- [ ] R2 storage failure → retry mechanism
- [ ] Firestore write failure → error logging

### 7.3 File Processing Errors
- [ ] Corrupted file → error message
- [ ] Unsupported format → clear feedback
- [ ] Large file timeout → progress indication
- [ ] OCR failure → fallback mechanism

## 8. Accessibility and UX Testing

### 8.1 Keyboard Navigation
- [ ] All buttons accessible via Tab key
- [ ] File upload dialog keyboard accessible
- [ ] Chat input supports keyboard shortcuts
- [ ] Focus indicators visible

### 8.2 Screen Reader Support
- [ ] All buttons have proper `aria-label`s
- [ ] File upload progress announced
- [ ] Error messages read aloud
- [ ] Form fields properly labeled

### 8.3 Visual Accessibility
- [ ] High contrast in light mode
- [ ] High contrast in dark mode
- [ ] Text size adjustable
- [ ] Color not sole indicator of state

## 9. Performance and Monitoring

### 9.1 Performance Metrics
- [ ] File upload < 5 seconds for 10MB files
- [ ] Text extraction < 2 seconds
- [ ] RAG queries < 2 seconds
- [ ] Pipeline export < 10 seconds

### 9.2 Logging and Monitoring
- [ ] All errors logged with stack traces
- [ ] Client-side errors send telemetry
- [ ] Processing steps logged with timing
- [ ] User actions tracked for analytics

## Test Execution Checklist

### Pre-Test Setup
- [ ] Server running on http://localhost:3000
- [ ] Test files created in `/test-files/`
- [ ] Firebase authentication configured
- [ ] All environment variables set

### Test Execution Order
1. [ ] Authentication and user setup
2. [ ] File upload flows (Files page and ChatWindow)
3. [ ] File processing for each type
4. [ ] RAG query testing
5. [ ] Export and deployment testing
6. [ ] Multi-user isolation testing
7. [ ] Error handling testing
8. [ ] Accessibility testing
9. [ ] Performance validation

### Post-Test Validation
- [ ] All test files processed successfully
- [ ] All unique identifiers extracted correctly
- [ ] All RAG queries return expected answers
- [ ] All exports generate valid packages
- [ ] All deployments work in production
- [ ] All security boundaries enforced
- [ ] All errors handled gracefully

## Success Criteria

**100% Pass Rate Required:**
- Every supported file type processes accurately
- Every RAG query returns correct answers
- Every export generates valid MCP packages
- Every deployment works in production
- Every security boundary is enforced
- Every error is handled gracefully
- Every accessibility requirement is met

**If any test fails:**
1. Document the failure with full details
2. Fix the underlying issue immediately
3. Re-run the specific test to confirm fix
4. Re-run related tests to check for regressions
5. Update this test suite if needed

This comprehensive test suite ensures that Contexto works flawlessly for real users across all supported file types and user flows.
