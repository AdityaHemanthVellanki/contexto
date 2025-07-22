# QA Test Document - Markdown Format

This is a **comprehensive test document** for validating markdown extraction accuracy.

## Key Test Phrases:
- `UNIQUE_MARKDOWN_ID_67890` - This phrase should be extracted exactly
- Numbers: 42, 3.14159, -17
- *Italic text* and **bold text**
- [Link text](https://example.com)

### Content Sections:
1. **Introduction**: This document tests markdown processing
2. **Data validation**: Row 5, Column 2 contains value `MD_TEST_VALUE_456`
3. **Code snippet**: 
   ```javascript
   function testMarkdownFunction() { 
     return "markdown_success"; 
   }
   ```

> Blockquote: This should be extracted with proper formatting

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value A  | Value B  | Value C  |
| Test 1   | Test 2   | Test 3   |

**Expected chunk count**: approximately 2-3 chunks  
**Expected extraction**: 100% accuracy for markdown text with formatting preserved
