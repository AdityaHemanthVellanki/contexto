import { getFirestore } from 'firebase-admin/firestore';
import { getAuth, getFirebaseAdmin } from '@/lib/firebase-admin';
import { r2, R2_BUCKET } from '@/lib/r2';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Type guard to check if an unknown value is an Error
 */
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Helper function to safely extract error messages from unknown error types
 */
function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  return String(error) || 'Unknown error';
}

import { Buffer } from 'buffer';

interface FileData {
  fileUrl?: string;
  downloadUrl?: string;
  fileType: string;
  userId: string;
  presignedUrl?: string;
  signedUrl?: string;
  content?: string;
  [key: string]: any;
}

/**
 * Extract text from PDF buffer
 * 
 * @param buffer ArrayBuffer containing PDF data
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    // Use node-based PDF extraction from the pdf-extractor module
    console.log('Using node-based PDF text extraction with pdf-parse');
    
    // Extract text using pdf-parse library
    const { extractText } = await import('../lib/pdf-extractor');
    return await extractText(buffer);
  } catch (error: unknown) {
    console.error('PDF extraction failed:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a buffer based on file type
 */
async function extractTextFromBuffer(buffer: ArrayBuffer, fileType: string): Promise<string> {
  if (fileType === 'application/json' || fileType.startsWith('text/')) {
    // Handle text or JSON files
    return Buffer.from(buffer).toString('utf-8');
  } else if (fileType === 'application/pdf') {
    // Call PDF extractor
    return await extractPdfText(buffer);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Data Source node - Downloads and extracts text from files
 * 
 * @param fileId The file ID to process from Firestore
 * @param userIdToken Firebase ID token for user authentication
 * @returns Extracted text content from the file
 */
export async function runDataSource(fileId: string, userIdToken: string): Promise<string> {
  if (!fileId) {
    throw new Error('DataSource failed: Missing fileId parameter');
  }
  
  try {
    // 1. Verify Firebase ID token with force refresh to ensure valid token
    const auth = await Promise.resolve(getAuth());
    let decodedToken;
    
    try {
      // Force token refresh check to avoid using expired tokens
      decodedToken = await auth.verifyIdToken(userIdToken, true);
    } catch (tokenError: any) {
      // Provide detailed error for token issues
      const errorMessage = tokenError?.message || 'Unknown token error';
      if (errorMessage.includes('expired')) {
        throw new Error('Authentication error: Token expired. Please refresh the page and try again.');
      } else if (errorMessage.includes('revoked')) {
        throw new Error('Authentication error: Token revoked. Please sign out and sign in again.');
      } else {
        throw new Error(`Authentication error: ${errorMessage}. Please sign out and sign in again.`);
      }
    }
    
    const uid = decodedToken.uid;
    
    if (!uid) {
      throw new Error('Invalid authentication token: Missing user ID');
    }
    
    // Initialize buffer and text at the start of the function
    let buffer: ArrayBuffer = new ArrayBuffer(0);
    let text: string = '';
    
    // 2. Load metadata from Firestore
    const db = getFirestore();
    const fileDoc = await db.collection('uploads').doc(fileId).get();
    
    if (!fileDoc.exists) {
      throw new Error(`File with ID ${fileId} not found`);
    }
    
    const fileData = fileDoc.data() as FileData;
    
    if (!fileData) {
      throw new Error(`File data not available for ${fileId}`);
    }
    
    // Ensure user owns this file
    if (fileData.userId !== uid) {
      throw new Error('User not authorized to access this file');
    }
    
    // Extract the fields we need (type-safe because of the FileData interface)
    const { fileUrl, downloadUrl, fileType } = fileData;
    
    if (!fileUrl && !downloadUrl) {
      throw new Error('No download URL available for this file');
    }
    
    // 3. Download the file
    // Note: buffer and text are already initialized at the top of the function
    
    try {
      // Check for Cloudflare R2 storage URLs
      const isCloudflareR2 = (typeof fileUrl === 'string' && fileUrl.includes('cloudflarestorage.com')) || 
                           (typeof downloadUrl === 'string' && downloadUrl.includes('cloudflarestorage.com'));
      
      // Special handling for Cloudflare R2 URLs which need special authentication
      if (isCloudflareR2) {
        console.log('Detected Cloudflare R2 URL - attempting to get fresh signed URL from Firebase');
        
        try {
          // Try to get a fresh signed URL from Firebase storage
          const storageRef = fileData.storagePath || fileData.storagePath || `uploads/${fileId}`;
          if (storageRef) {
            console.log(`Attempting to get fresh signed URL for path: ${storageRef}`);
            
            // Use admin SDK to generate a new signed URL
            try {
              // Get URL from Firebase Admin or via a special endpoint
              const freshUrlDoc = await db.collection('_temporary_urls').add({
                path: storageRef,
                userId: fileData.userId,
                timestamp: new Date(),
                fileId: fileId
              });
              
              // Wait a moment for any background functions to generate the URL
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Get the result
              const freshUrlData = await freshUrlDoc.get();
              const freshData = freshUrlData.data();
              
              if (freshData && freshData.url) {
                console.log('Successfully obtained fresh signed URL');
                const freshResponse = await fetch(freshData.url);
                
                if (freshResponse.ok) {
                  console.log('Successfully downloaded file with fresh signed URL');
                  buffer = await freshResponse.arrayBuffer();
                  text = await extractTextFromBuffer(buffer, fileType);
                  return text;
                }
              }
            } catch (freshUrlError) {
              console.warn('Error getting fresh signed URL:', freshUrlError);
            }
          }
        } catch (storageError) {
          console.warn('Failed to get storage reference:', storageError);
        }
      }
      
      // If we have a file in Firestore Storage but our stored URL is possibly expired,
      // we may need to get a fresh download URL from Firebase
      if (isCloudflareR2) {
        console.log('Detected Cloudflare R2 storage URL - checking for presigned URLs in metadata');
        
        // Check if we have a presigned URL already stored
        const presignedUrl = fileData.presignedUrl || fileData.signedUrl;
        
        if (typeof presignedUrl === 'string') {
          console.log('Using presigned URL from metadata');
          try {
            const response = await fetch(presignedUrl);
          
            if (response.ok) {
              buffer = await response.arrayBuffer();
              text = await extractTextFromBuffer(buffer, fileType);
              return text; // Early successful return with extracted text
            } else {
              console.warn(`Presigned URL failed with status: ${response.status} ${response.statusText}`);
              // Continue to other methods if this fails
            }
          } catch (presignedUrlError) {
            console.warn('Error using presigned URL:', presignedUrlError);
          }
        }
        
        // Try to get file directly from Firestore reference if available
        console.log('Attempting to fetch file content directly from database');
        
        // Get file content field if it exists (this would be a base64 encoded string)
        const fileContent = fileData.content;
        if (typeof fileContent === 'string') {
          console.log('Found content field in document, decoding base64 content');
          // Decode base64 content
          try {
            const binaryContent = Buffer.from(fileContent, 'base64');
            buffer = binaryContent.buffer.slice(
              binaryContent.byteOffset,
              binaryContent.byteOffset + binaryContent.byteLength
            );
            text = await extractTextFromBuffer(buffer, fileType);
            return text; // Early return with extracted text
          } catch (base64Error) {
            console.warn('Failed to decode base64 content:', base64Error);
            // Continue to other methods if this fails
          }
        }
      }
      
      // Try primary URL first
      if (fileUrl) {
        console.log(`Attempting to download from primary URL: ${fileUrl as string}`); // We already checked fileUrl exists in the if condition
        
        // For R2, we may need custom headers or parameters
        const options: RequestInit = {};
        if (isCloudflareR2) {
          // If we're accessing R2, ensure we have the right headers and handle auth
          const headers: HeadersInit = {
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          };
          
          // Only add authorization if we have a token
          if (userIdToken) {
            headers['Authorization'] = `Bearer ${userIdToken}`;
          }
          
          options.headers = headers;
          
          // Some R2 implementations work better with no-cors mode
          options.mode = 'cors'; // Try with cors first
          options.credentials = 'omit';
        }
        
        try {
          // We know fileUrl is a string because we're inside the fileUrl condition
          const response = await fetch(fileUrl!, options);
          
          if (response.ok) {
            buffer = await response.arrayBuffer();
            text = await extractTextFromBuffer(buffer, fileType);
            return text; // Early return with extracted text
          } else {
            console.warn(`Failed to download from primary URL: ${response.status} ${response.statusText}`);
            
            // If cors mode failed with R2, try with no-cors
            if (isCloudflareR2 && options.mode === 'cors') {
              console.log('Retrying with no-cors mode');
              options.mode = 'no-cors';
              try {
                // We know fileUrl is a string due to the parent check
                const noCorsModeResponse = await fetch(fileUrl!, options);
                if (noCorsModeResponse.status === 0 || noCorsModeResponse.ok) {
                  buffer = await noCorsModeResponse.arrayBuffer();
                  text = await extractTextFromBuffer(buffer, fileType);
                  return text; // Early return with extracted text
                }
              } catch (noCorsModeError) {
                console.warn('No-cors mode also failed:', noCorsModeError);
              }
            }
          }
        } catch (fetchError) {
          console.warn(`Fetch error with primary URL:`, fetchError);
        }
      }
      
      // If primary URL fails and we have a downloadUrl, try that
      if (downloadUrl) {
        console.log(`Trying alternative download URL: ${downloadUrl}`); // We know downloadUrl exists inside this block
        try {
          // We know downloadUrl is a string because we're inside the downloadUrl condition
          const altResponse = await fetch(downloadUrl!);
          
          if (altResponse.ok) {
            buffer = await altResponse.arrayBuffer();
            text = await extractTextFromBuffer(buffer, fileType);
            return text; // Early return with extracted text
          } else {
            console.warn(`Alternative URL failed with status: ${altResponse.status} ${altResponse.statusText}`);
          }
        } catch (altFetchError) {
          console.warn(`Fetch error with alternative URL:`, altFetchError);
        }
      }
      
      // If we reach here, normal methods failed - throw an error
      throw new Error('Failed to download file: Primary download methods failed');
      
      if (isCloudflareR2) {
        // For R2 files, access directly through Cloudflare R2 S3 client
        console.log('Attempting direct Cloudflare R2 access');
        
        try {
          // Check that we have proper authorization - uid must match fileData.userId
          // This prevents one user from accessing another user's files
          if (uid !== fileData.userId) {
            console.error('User authorization failed: File ownership mismatch');
            throw new Error('You are not authorized to access this file');
          }
          
          // Try to determine the R2 key first - needed for direct access
          // Parse the original filename and timestamp if available
          const originalFilename = fileData.originalFilename || '';
          const timestamp = fileId.split('_')[1] || '';
          
          // Create an array of possible R2 key formats to try
          const possibleKeys = [
            // Try stored keys first if available
            fileData.r2Key,
            fileData.storagePath,
            // Common formats with userId
            `${fileData.userId}/uploads/${timestamp}_${originalFilename}`,
            `${fileData.userId}/uploads/${fileId}`,
            `${fileData.userId}/${fileId}`,
            `${fileData.userId}/${originalFilename}`,
            // Common formats without userId
            `uploads/${fileData.userId}/${fileId}`,
            `uploads/${fileId}`,
            `uploads/${originalFilename}`,
            // Bare formats
            `${fileId}`,
            `${originalFilename}`
          ].filter(Boolean); // Remove any undefined/null values
                       
          console.log(`Using R2 bucket: ${R2_BUCKET}`);
          console.log(`Will try ${possibleKeys.length} possible R2 keys`);
          
          let r2Response = null;
          let successfulKey = null;
          
          // Try each key until we find one that works
          for (const currentKey of possibleKeys) {
            console.log(`Attempting direct R2 access with key: ${currentKey}`);
            
            // Use direct R2 access via S3 client
            const getObjectCommand = new GetObjectCommand({
              Bucket: R2_BUCKET,
              Key: currentKey,
            });
            
            try {
              // Try to get the object from R2
              const response = await r2.send(getObjectCommand);
              
              // If we got a successful response with a body, use it
              if (response && response.Body) {
                r2Response = response;
                successfulKey = currentKey;
                console.log(`Successfully found file with key: ${currentKey}`);
                break;
              }
            } catch (error: unknown) {
              // Instead of just logging a warning, we should throw an error for this key attempt
              // This ensures strict error propagation but allows trying other keys
              const errorMessage = getErrorMessage(error);
              console.error(`Key ${currentKey} not found or access error:`, errorMessage);
              // We don't throw here to allow trying other keys, but we don't silently continue either
            }
          }
          
          // Check if we got a successful response
          if (r2Response && r2Response.Body) {
            console.log('File found in Cloudflare R2, downloading directly');
            
            // Convert the readable stream to buffer using Node.js streams approach with timeout
            const streamToBuffer = async (stream: any): Promise<Buffer> => {
              const chunks: Buffer[] = [];
              return new Promise((resolve, reject) => {
                // Set a timeout to prevent hanging on stream issues
                const timeout = setTimeout(() => {
                  reject(new Error('Stream processing timed out after 30 seconds'));
                }, 30000); // 30 second timeout
                
                stream.on('data', (chunk: any) => {
                  try {
                    chunks.push(Buffer.from(chunk));
                  } catch (chunkError) {
                    clearTimeout(timeout);
                    reject(new Error(`Error processing stream chunk: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`));
                  }
                });
                
                stream.on('error', (err: Error) => {
                  clearTimeout(timeout);
                  reject(err);
                });
                
                stream.on('end', () => {
                  clearTimeout(timeout);
                  if (chunks.length === 0) {
                    reject(new Error('Stream ended without providing any data'));
                  } else {
                    try {
                      resolve(Buffer.concat(chunks));
                    } catch (concatError) {
                      reject(new Error(`Error concatenating stream chunks: ${concatError instanceof Error ? concatError.message : 'Unknown error'}`));
                    }
                  }
                });
              });
            };
            
            try {
              // Process Node.js Readable stream from R2
              console.log('Processing R2 response stream...');
              const fileBuffer = await streamToBuffer(r2Response.Body);
              
              if (!fileBuffer || fileBuffer.length === 0) {
                throw new Error('Downloaded file buffer is empty');
              }
              
              console.log(`Successfully downloaded file from R2, size: ${fileBuffer.length} bytes`);
              
              // Use the Node.js Buffer directly with proper type casting
              buffer = fileBuffer.buffer.slice(
                fileBuffer.byteOffset, 
                fileBuffer.byteOffset + fileBuffer.byteLength
              ) as ArrayBuffer;
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error);
              console.error('Error processing R2 stream:', errorMessage);
              // Ensure strict error propagation with detailed error message
              throw new Error(`Failed to process R2 stream: ${errorMessage}`);
            }
            console.log('Successfully downloaded file from Cloudflare R2');
            
            // Extract text from the buffer and return it immediately
            text = await extractTextFromBuffer(buffer, fileType);
            return text;
          } else {
            // Hard failure if R2 response has no body
            throw new Error('R2 response received but no body');
          }
        } catch (r2Error) {
    }
  }
} catch (fetchError) {
  console.warn(`Fetch error with primary URL:`, fetchError);
}

// If primary URL fails and we have a downloadUrl, try that
if (downloadUrl) {
  console.log(`Trying alternative download URL: ${downloadUrl}`); // We know downloadUrl exists inside this block
  try {
    // We know downloadUrl is a string because we're inside the downloadUrl condition
    const altResponse = await fetch(downloadUrl!);
    
    if (altResponse.ok) {
      buffer = await altResponse.arrayBuffer();
      text = await extractTextFromBuffer(buffer, fileType);
      return text; // Early return with extracted text
    } else {
      console.warn(`Alternative URL failed with status: ${altResponse.status} ${altResponse.statusText}`);
    }
  } catch (altFetchError) {
    console.warn(`Fetch error with alternative URL:`, altFetchError);
  }
}

// If we reach here, normal methods failed - throw an error
throw new Error('Failed to download file: Primary download methods failed');
  } catch (e: unknown) {
    // 6. Error handling
    if (e instanceof Error) {
      throw new Error(`DataSource failed: ${e.message}`);
    }
    throw new Error('DataSource failed: Unknown error occurred');
  }
}

/**
 * Extract text from PDF buffer
 * 
 * @param buffer ArrayBuffer containing PDF data
 * @returns Extracted text
 */
// Note: The implementation of extractPdfText has been moved to the top of the file
