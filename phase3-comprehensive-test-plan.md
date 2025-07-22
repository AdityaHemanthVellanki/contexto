# Phase 3 Comprehensive QA Testing Plan

## Overview
Phase 3 focuses on testing all authenticated user flows end-to-end, including the complete pipeline from file upload to MCP deployment. This phase validates the entire user experience for real-world usage.

## Test Environment Status ✅
- **Server**: http://localhost:3000 ✅ Running
- **Firebase Auth**: ✅ Working (signin page loads correctly)
- **Build Status**: ✅ All import errors fixed
- **Test Files**: ✅ Created in `/test-files/` directory

## Phase 3 Test Execution Plan

### 1. Authentication Flow Testing ✅ READY
**Test Scenarios:**
- [ ] **Google OAuth Sign-in**: Test Google authentication flow
- [ ] **Email/Password Sign-in**: Test email authentication
- [ ] **Sign-up Flow**: Test new user registration
- [ ] **Dashboard Redirect**: Verify authenticated users reach dashboard
- [ ] **Protected Route Access**: Confirm auth-protected pages work

### 2. Dashboard & Chat Interface Testing
**Test Scenarios:**
- [ ] **Dashboard Load**: Verify dashboard loads with chat interface
- [ ] **Chat Window**: Test SimpleChatWindow component functionality
- [ ] **File Upload Prompt**: Verify AI welcomes user and requests file upload
- [ ] **File Selection**: Test file picker and drag-and-drop functionality
- [ ] **Progress Indicators**: Validate upload progress bars

### 3. File Upload & Processing Pipeline Testing
**Test Files to Upload:**
- [ ] **Plain Text** (`test-document.txt`) - Unique identifier: `UNIQUE_IDENTIFIER_12345`
- [ ] **CSV Data** (`test-data.csv`) - Test query: "What is the value in row 5, column 2?"
- [ ] **JSON Config** (`test-config.json`) - Test query: "What is the unique_identifier value?"
- [ ] **HTML Page** (`test-page.html`) - Test query: "What is the test value in the span element?"
- [ ] **Markdown** (`test-document.md`) - Test query: "What is the unique markdown ID?"

**Validation Points:**
- [ ] **Upload Success**: File appears in chat with confirmation
- [ ] **Processing Status**: Real-time processing updates shown
- [ ] **Extraction Accuracy**: All unique identifiers extracted correctly
- [ ] **Chunking Logic**: Proper 500-1000 token chunks with overlap
- [ ] **Embedding Generation**: Azure OpenAI embeddings created
- [ ] **Vector Store**: Files indexed in selected vector store backend

### 4. RAG Query Testing (Critical Accuracy Validation)
**Standard Queries:**
- [ ] **Text File**: "What is the unique identifier in the document?" → `UNIQUE_IDENTIFIER_12345`
- [ ] **CSV File**: "What is the value in row 5, column 2?" → `38` (Charlie Wilson's age)
- [ ] **JSON File**: "What is the unique_identifier value?" → `JSON_TEST_ID_99999`
- [ ] **HTML File**: "What is the test value in the span element?" → `HTML_TEST_VALUE_789`
- [ ] **Markdown File**: "What is the unique markdown ID?" → `UNIQUE_MARKDOWN_ID_67890`

**Edge Case Queries:**
- [ ] **Multi-step Reasoning**: Complex questions requiring multiple chunks
- [ ] **Numeric Calculations**: Math operations on CSV data
- [ ] **Code Extraction**: Function names from markdown/HTML code blocks
- [ ] **Cross-reference**: Questions spanning multiple file types

**Success Criteria:**
- [ ] **Response Time**: < 2 seconds per query
- [ ] **Accuracy**: 100% match for known test values
- [ ] **No Hallucination**: Answers only from uploaded content
- [ ] **Source Attribution**: Proper citation of source material

### 5. MCP Pipeline Export Testing
**Export Validation:**
- [ ] **Export Trigger**: "Export MCP Pipeline" button appears after processing
- [ ] **ZIP Generation**: Download ZIP file successfully
- [ ] **Archive Contents**: Verify all required files present
  - [ ] `pipeline.json` - Contains correct pipeline configuration
  - [ ] `server.js` - Real vector store integration code
  - [ ] `package.json` - Valid Node.js dependencies
  - [ ] `Dockerfile` - Container build configuration
  - [ ] `openapi.yaml` - API specification

**Local Deployment Test:**
- [ ] **Extract ZIP**: Unzip to test directory
- [ ] **Install Dependencies**: `npm install` completes successfully
- [ ] **Start Server**: `npm start` runs without errors
- [ ] **Test Endpoints**: 
  - [ ] `/ingest` - Accepts file uploads
  - [ ] `/query` - Returns accurate answers
  - [ ] `/delete` - Clears vector store

### 6. Vercel Deployment Testing
**Deployment Flow:**
- [ ] **Deploy Button**: "Deploy MCP Server" appears in chat
- [ ] **Vector Store Provisioning**: Intelligent backend selection
- [ ] **Vercel API Integration**: Direct deployment to Vercel
- [ ] **Environment Variables**: Proper configuration injection
- [ ] **Live Endpoints**: Deployed URLs respond correctly

**Live Testing:**
- [ ] **Ingest Endpoint**: POST to live `/ingest` with test file
- [ ] **Query Endpoint**: POST to live `/query` with test questions
- [ ] **Delete Endpoint**: POST to live `/delete` clears data
- [ ] **Performance**: Live endpoints respond within SLA

### 7. Multi-User Isolation Testing
**User A Testing:**
- [ ] **Sign in as User A**: Complete authentication
- [ ] **Upload Files**: Process test files for User A
- [ ] **Create Pipeline**: Generate and export MCP pipeline
- [ ] **Deploy Service**: Create live deployment
- [ ] **Record Resources**: Note all User A resource IDs

**User B Testing:**
- [ ] **Sign in as User B**: Use different authentication
- [ ] **Access Isolation**: Cannot see User A's files/pipelines
- [ ] **API Isolation**: 403 errors when accessing User A's resources
- [ ] **Vector Store Isolation**: Cannot query User A's data
- [ ] **Independent Operation**: User B can create own resources

**Security Validation:**
- [ ] **Firestore Rules**: User data properly isolated
- [ ] **API Endpoints**: Proper user ownership verification
- [ ] **Vector Stores**: Namespace isolation working
- [ ] **Deployment Isolation**: User-specific deployments

### 8. Error Handling & Recovery Testing
**Authentication Errors:**
- [ ] **Expired Token**: 401 response with proper UI feedback
- [ ] **Invalid Token**: Clear error message and re-auth prompt
- [ ] **Network Failure**: Retry mechanisms and user guidance

**Service Errors:**
- [ ] **Azure OpenAI Rate Limit**: 429 handling with backoff
- [ ] **Vector Store Quota**: Graceful degradation to fallback
- [ ] **R2 Storage Failure**: Upload retry with error feedback
- [ ] **Firestore Write Failure**: Transaction rollback and logging

**File Processing Errors:**
- [ ] **Corrupted File**: Clear error message and recovery options
- [ ] **Unsupported Format**: Helpful guidance on supported types
- [ ] **Large File Timeout**: Progress indication and chunked processing
- [ ] **OCR/Transcription Failure**: Fallback mechanisms working

### 9. Accessibility & UX Testing
**Keyboard Navigation:**
- [ ] **Tab Order**: Logical navigation through all interactive elements
- [ ] **File Upload**: Keyboard-accessible file selection
- [ ] **Chat Interface**: Keyboard shortcuts and navigation
- [ ] **Form Controls**: All inputs accessible via keyboard

**Screen Reader Support:**
- [ ] **ARIA Labels**: All buttons and inputs properly labeled
- [ ] **Status Updates**: Processing states announced to screen readers
- [ ] **Error Messages**: Failures communicated accessibly
- [ ] **Dynamic Content**: Chat messages properly announced

**Visual Accessibility:**
- [ ] **High Contrast**: Text readable in both light/dark modes
- [ ] **Color Independence**: No information conveyed by color alone
- [ ] **Text Scaling**: Interface works with browser zoom
- [ ] **Focus Indicators**: Clear visual focus states

### 10. Performance & Monitoring Testing
**Performance Metrics:**
- [ ] **File Upload**: < 5 seconds for 10MB files
- [ ] **Text Extraction**: < 2 seconds per file
- [ ] **RAG Queries**: < 2 seconds response time
- [ ] **Pipeline Export**: < 10 seconds for ZIP generation
- [ ] **Deployment**: < 60 seconds for Vercel deployment

**Monitoring & Logging:**
- [ ] **Error Logging**: All failures logged with stack traces
- [ ] **Client Telemetry**: User actions tracked for analytics
- [ ] **Processing Metrics**: Timing data for optimization
- [ ] **Usage Analytics**: Feature usage patterns captured

## Success Criteria for Phase 3

### Critical Requirements (Must Pass 100%)
1. **Authentication**: All sign-in methods work correctly
2. **File Processing**: 100% accuracy for all test file extractions
3. **RAG Queries**: All test queries return exact expected answers
4. **Export Functionality**: Generated MCP packages work locally
5. **Deployment**: Live endpoints respond correctly
6. **Security**: Multi-user isolation enforced completely
7. **Accessibility**: All WCAG 2.1 AA requirements met

### Performance Requirements
1. **Response Times**: All operations within specified SLA
2. **Error Handling**: Graceful recovery from all failure scenarios
3. **User Experience**: Intuitive, accessible interface
4. **Production Readiness**: Comprehensive logging and monitoring

## Test Execution Strategy

### Phase 3A: Core User Flows (Priority 1)
1. Authentication and dashboard access
2. File upload and processing pipeline
3. RAG query accuracy validation
4. MCP export and local testing

### Phase 3B: Advanced Features (Priority 2)
1. Vercel deployment and live testing
2. Multi-user isolation validation
3. Error handling and recovery
4. Performance and accessibility testing

### Phase 3C: Production Readiness (Priority 3)
1. Monitoring and logging validation
2. Security penetration testing
3. Load testing and optimization
4. Documentation and user guides

## Expected Outcomes

Upon successful completion of Phase 3 testing:

1. **100% Functional**: All user flows work correctly end-to-end
2. **Production Ready**: Application ready for real user deployment
3. **Fully Validated**: All file types, queries, and deployments tested
4. **Security Verified**: Multi-user isolation and auth protection confirmed
5. **Accessibility Compliant**: WCAG 2.1 AA standards met
6. **Performance Optimized**: All operations within acceptable limits

This comprehensive Phase 3 testing plan ensures that Contexto is fully validated and ready for production use with real users across all supported file types and deployment scenarios.
