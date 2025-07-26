# Supported File Types in Contexto

Contexto supports a variety of file formats for processing and creating MCP pipelines. Below is a comprehensive list of supported file types and how they are processed.

## Text-Based Files
These files are processed directly as text:

- **Plain Text** (`.txt`) - UTF-8 encoded text files
- **CSV** (`.csv`) - Comma-separated values
- **JSON** (`.json`) - JSON data files
- **Markdown** (`.md`) - Markdown formatted text

## Document Files
These files are processed using specialized libraries to extract their text content:

- **PDF** (`.pdf`) - Processed using pdf-parse
- **Word Documents** (`.docx`) - Processed using mammoth

## Image Files (with OCR)
These files are processed using Tesseract.js OCR to extract text content from images:

- **PNG Images** (`.png`) 
- **JPEG Images** (`.jpg`, `.jpeg`)

## Processing Pipeline

1. **File Upload**: Files are uploaded through the UI or API
2. **MIME Type Detection**: System identifies the file type
3. **Text Extraction**: 
   - Text files are read directly
   - Documents are processed with specialized libraries
   - Images are processed with Tesseract OCR
4. **Chunking**: Extracted text is divided into appropriate chunks
5. **Embedding Generation**: Text chunks are converted to vector embeddings
6. **Indexing**: Embeddings are stored in the selected vector database
7. **MCP Pipeline Creation**: A complete MCP pipeline is created for retrieval and RAG applications

## Adding More File Types

The system is designed to be extensible. To add support for additional file types:

1. Update the `SupportedFileTypes` and `SupportedFileExtensions` constants in `src/lib/fileProcessor.ts`
2. Implement a specialized processing function if needed
3. Add the new file type to the switch case in the `processFile` function
4. Update the file upload components to accept the new file extensions
