'use client';

import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { Upload, Download, Loader2, Rocket, ChevronDown, AlertCircle } from 'lucide-react';
import { DeploymentStatus } from '@/components/deployment/DeploymentStatus';

interface UploadedFile {
  fileId: string;
  fileName: string;
  fileType: string;
  uploadedAt: Date;
  status: string;
}

interface Message {
  id: string;
  type: 'ai' | 'user';
  content: string;
  timestamp: Date;
  metadata?: {
    fileId?: string;
    fileName?: string;
    downloadUrl?: string;
    pipelineId?: string;
    mcpUrl?: string;
    vsixUrl?: string;
    vectorStoreEndpoint?: string;
    storeType?: string;
    serviceId?: string;
    deploymentId?: string;
  };
}

type ChatState = 'welcome' | 'file-upload' | 'purpose-input' | 'processing' | 'complete' | 'deploying';

const SUPPORTED_EXTENSIONS = [
  '.txt', '.csv', '.json', '.md', '.html',
  '.pdf', '.docx', '.pptx', '.xlsx',
  '.png', '.jpg', '.jpeg',
  '.mp3', '.wav',
  '.mp4', '.mov'
];

const WELCOME_MESSAGE = `👋 Welcome to Contexto! To start, please upload your data file.

**Supported formats:**
• Text: \`.txt\`, \`.csv\`, \`.json\`, \`.md\`, \`.html\`
• Documents: \`.pdf\`, \`.docx\`, \`.pptx\`, \`.xlsx\`
• Images: \`.png\`, \`.jpg\`, \`.jpeg\` (via OCR)
• Audio: \`.mp3\`, \`.wav\` (via speech-to-text)
• Video: \`.mp4\`, \`.mov\` (extract audio + speech-to-text)`;

interface SimpleChatWindowProps {
  chatId?: string | null;
}

export default function SimpleChatWindow({ chatId }: SimpleChatWindowProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatState, setChatState] = useState<ChatState>('welcome');
  const [purposeInput, setPurposeInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [currentPipelineId, setCurrentPipelineId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    // Load messages for the current chat from Firestore or show welcome message
    if (chatId && user?.uid) {
      // TODO: Load messages from Firestore for this specific chat
      // For now, just show welcome message
      setMessages([{
        id: uuidv4(),
        type: 'ai',
        content: WELCOME_MESSAGE,
        timestamp: new Date()
      }]);
    } else if (messages.length === 0) {
      // Add welcome message on mount for new chats
      setMessages([{
        id: uuidv4(),
        type: 'ai',
        content: WELCOME_MESSAGE,
        timestamp: new Date()
      }]);
    }
  }, [chatId, user?.uid, messages.length]);
  
  // Fetch user's previously uploaded files
  useEffect(() => {
    const fetchUploadedFiles = async () => {
      if (!user) return;
      
      try {
        setIsLoadingFiles(true);
        setFileError(null);
        
        const auth = getAuth(app);
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) throw new Error('No authenticated user found');
        const token = await firebaseUser.getIdToken();
        
        const response = await fetch('/api/uploads', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Session expired, please sign in again.');
          }
          throw new Error('Could not load your files. Please try again.');
        }
        
        const data = await response.json();
        
        if (data.uploads && Array.isArray(data.uploads)) {
          // Convert uploadedAt string to Date object
          const files = data.uploads.map((file: any) => ({
            ...file,
            uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date()
          }));
          
          // Sort by uploadedAt descending
          files.sort((a: UploadedFile, b: UploadedFile) => 
            b.uploadedAt.getTime() - a.uploadedAt.getTime()
          );
          
          setUploadedFiles(files);
        }
      } catch (error) {
        console.error('Error fetching uploaded files:', error);
        setFileError(
          error instanceof Error 
            ? error.message 
            : 'Could not load your files. Please try again.'
        );
      } finally {
        setIsLoadingFiles(false);
      }
    };
    
    fetchUploadedFiles();
  }, [user]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (type: 'ai' | 'user', content: string, metadata?: Message['metadata']) => {
    const newMessage: Message = {
      id: uuidv4(), // Generate a unique UUID instead of using timestamp
      type,
      content,
      timestamp: new Date(),
      metadata
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const selectExistingFile = (fileId: string, fileName: string) => {
    if (!fileId || !user) return;
    
    setSelectedFileId(fileId);
    setCurrentFileId(fileId);
    setIsDropdownOpen(false);
    
    // Add user message showing file selection
    addMessage('user', `Using existing file: ${fileName}`);
    
    // Move to purpose input state
    setChatState('purpose-input');
    
    // Add AI response asking for purpose
    setTimeout(() => {
      addMessage('ai', '✅ File selected! Now please describe what kind of MCP pipeline you need—what problem are you solving or what insight you want?');
    }, 500);
  };
  
  const handleFileUpload = async (file: File) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setUploadProgress(0);

      // Add user message showing file upload
      addMessage('user', `Uploaded: ${file.name}`);

      // Get Firebase ID token from Firebase Auth
      const auth = getAuth(app);
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('No authenticated user found');
      const token = await firebaseUser.getIdToken();

      // Create FormData or use ArrayBuffer based on file type
      const buffer = await file.arrayBuffer();

      // Upload file with progress tracking
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-filename': file.name,
          'x-mimetype': file.type
        },
        body: buffer
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const { fileId } = await response.json();
      setCurrentFileId(fileId);

      // Add the newly uploaded file to the uploadedFiles list
      const newFile: UploadedFile = {
        fileId,
        fileName: file.name,
        fileType: file.type,
        uploadedAt: new Date(),
        status: 'ready'
      };
      
      setUploadedFiles(prevFiles => [newFile, ...prevFiles]);
      setSelectedFileId(fileId);

      // Move to purpose input state
      setChatState('purpose-input');
      
      // Add AI response asking for purpose
      setTimeout(() => {
        addMessage('ai', '✅ File received! Now please describe what kind of MCP pipeline you need—what problem are you solving or what insight you want?');
      }, 500);

    } catch (error) {
      console.error('Upload error:', error);
      addMessage('ai', `❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handlePurposeSubmit = async () => {
    if (!purposeInput.trim() || !currentFileId || !user) return;

    try {
      setIsLoading(true);
      setChatState('processing');

      // Add user message
      addMessage('user', purposeInput);
      
      // Add processing message
      addMessage('ai', '⚙️ Processing your pipeline…');

      // Get Firebase ID token from Firebase Auth
      const auth = getAuth(app);
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('No authenticated user found');
      const token = await firebaseUser.getIdToken();

      // Call processing API
      const response = await fetch('/api/processPipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fileIds: currentFileId ? [currentFileId] : [],
          description: purposeInput,
          tools: [],
          autoGenerateTools: true,
          name: ''
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      const json = await response.json();
      const pipelineId: string | undefined = json?.pipelineId;
      if (!pipelineId) {
        throw new Error('Pipeline API did not return pipelineId');
      }
      setCurrentPipelineId(pipelineId);

      // Update state and show message; export URL may be available later via status updates
      setChatState('complete');
      addMessage('ai', '🎉 Your MCP pipeline has started processing!', { fileId: currentFileId, pipelineId });

    } catch (error) {
      console.error('Processing error:', error);
      addMessage('ai', `❌ Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setChatState('purpose-input'); // Allow retry
    } finally {
      setIsLoading(false);
    }
  };

  const deployPipeline = async (fileId: string, pipelineId: string) => {
    if (!user || isDeploying) return;

    try {
      setIsDeploying(true);
      setChatState('deploying');

      // Add deployment start message
      addMessage('ai', '🚀 Deploying your MCP server...');

      // Get Firebase ID token
      const auth = getAuth(app);
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('No authenticated user found');
      const token = await firebaseUser.getIdToken();

      // Step 1: Deploy Vector Store
      addMessage('ai', '📊 Provisioning vector store...');
      const vectorStoreResponse = await fetch('/api/deployVectorStore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ fileId, pipelineId })
      });

      if (!vectorStoreResponse.ok) {
        const error = await vectorStoreResponse.json();
        throw new Error(error.error || 'Vector store deployment failed');
      }

      const { vectorStoreEndpoint, storeType } = await vectorStoreResponse.json();

      // Step 2: Deploy MCP server (returns deploymentId we will use for polling)
      const serverResponse = await fetch('/api/deployMCP', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ pipelineId })
      });

      if (!serverResponse.ok) {
        const error = await serverResponse.json();
        throw new Error(error.error || 'Server deployment failed');
      }

      const serverJson = await serverResponse.json();
      const returnedDeploymentId: string | undefined = serverJson?.deploymentId || serverJson?.deployment?.deploymentId;
      const mcpUrl: string | undefined = serverJson?.deployment?.appUrl || serverJson?.appUrl;

      // Success message with deployment details and deployment status tracker
      setChatState('complete');
      addMessage('ai', `✅ MCP deployment complete!`, {
        mcpUrl,
        vectorStoreEndpoint,
        storeType,
        deploymentId: returnedDeploymentId
      });

    } catch (error) {
      console.error('Deployment error:', error);
      addMessage('ai', `❌ Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setChatState('complete'); // Allow retry
    } finally {
      setIsDeploying(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const renderMessage = (message: Message) => (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          message.type === 'user'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>
        
        {message.metadata?.downloadUrl && (
          <div className="mt-3 space-y-2">
            <a
              href={message.metadata.downloadUrl}
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors mr-2"
            >
              <Download size={16} />
              Download ZIP
            </a>
            
            {message.metadata.fileId && message.metadata.pipelineId && !message.metadata.mcpUrl && (
              <button
                onClick={() => deployPipeline(message.metadata!.fileId!, message.metadata!.pipelineId!)}
                disabled={isDeploying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {isDeploying ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Rocket size={16} />
                )}
                {isDeploying ? 'Deploying...' : 'Deploy to Heroku'}
              </button>
            )}
          </div>
        )}

        {/* Show Deploy button even if there's no downloadUrl, as long as we have fileId and pipelineId */}
        {!message.metadata?.downloadUrl && message.metadata?.fileId && message.metadata?.pipelineId && !message.metadata?.mcpUrl && (
          <div className="mt-3">
            <button
              onClick={() => deployPipeline(message.metadata!.fileId!, message.metadata!.pipelineId!)}
              disabled={isDeploying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
            >
              {isDeploying ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Rocket size={16} />
              )}
              {isDeploying ? 'Deploying...' : 'Deploy to Heroku'}
            </button>
          </div>
        )}
        
        {message.metadata?.mcpUrl && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">🚀 Heroku Deployment Complete!</h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="font-medium">MCP Server:</span>{' '}
                <a 
                  href={message.metadata.mcpUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {message.metadata.mcpUrl}
                </a>
              </div>
              {message.metadata.vectorStoreEndpoint && (
                <div>
                  <span className="font-medium">Vector Store:</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">
                    {message.metadata.storeType} ({message.metadata.vectorStoreEndpoint})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {message.metadata?.deploymentId && (
          <div className="mt-3">
            <DeploymentStatus deploymentId={message.metadata.deploymentId} />
          </div>
        )}
        
        <div className="text-xs opacity-70 mt-2">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );

  const deployVectorStore = async (fileId: string, storeType: string) => {
    if (!user) return;

    try {
      const result = await fetch('/api/deployVectorStore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuth(app).currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({ fileId, storeType }),
      });

      if (!result.ok) {
        throw new Error((await result.json()).error || 'Vector store deployment failed');
      }

      return await result.json();
    } catch (error) {
      console.error('Vector store deployment error:', error);
      throw error;
    }
  };

  const handleVectorStoreDeployment = async (fileId: string, storeType: string) => {
    try {
      const result = await deployVectorStore(fileId, storeType);

      if (result.success) {
        setMessages(prev => [
          ...prev,
          {
            id: `vector-store-${Date.now()}`,
            type: 'ai',
            content: `Vector store created successfully!\n\n**Index Name**: ${result.indexName}`,
            timestamp: new Date(),
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `vector-store-error-${Date.now()}`,
            type: 'ai',
            content: `Vector store creation failed: ${result.error}`,
            timestamp: new Date(),
          }
        ]);
      }
    } catch (error) {
      setMessages(prev => [
        ...prev,
        {
          id: `vector-store-error-${Date.now()}`,
          type: 'ai',
          content: `Vector store creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date(),
        }
      ]);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Contexto MCP Builder
        </h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence>
          {messages.map(renderMessage)}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        {chatState === 'welcome' || chatState === 'file-upload' ? (
          <div className="flex flex-col justify-center items-center space-y-4">
            <div className="flex space-x-4">
              {/* Select Existing File Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isLoading || isLoadingFiles || uploadedFiles.length === 0}
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                  aria-label="Select an existing file"
                  className={`inline-flex items-center justify-between gap-2 px-4 py-3 min-w-[220px] border rounded-lg font-medium transition-colors ${isLoading || isLoadingFiles || uploadedFiles.length === 0 ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500' : 'bg-white border-gray-300 text-gray-800 hover:border-blue-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:border-blue-500'}`}
                >
                  <span className="truncate">
                    {isLoadingFiles ? 'Loading files...' : 
                     uploadedFiles.length === 0 ? 'No files uploaded yet' : 
                     selectedFileId ? uploadedFiles.find(f => f.fileId === selectedFileId)?.fileName : 
                     '– Select a previously uploaded file –'}
                  </span>
                  <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isDropdownOpen && uploadedFiles.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-gray-300 bg-white shadow-lg dark:bg-gray-800 dark:border-gray-700">
                    <ul role="listbox" className="py-1">
                      {uploadedFiles.map(file => (
                        <li 
                          key={file.fileId}
                          role="option"
                          aria-selected={selectedFileId === file.fileId}
                          onClick={() => selectExistingFile(file.fileId, file.fileName)}
                          className={`px-4 py-2 cursor-pointer text-sm hover:bg-blue-100 dark:hover:bg-blue-900/30 ${selectedFileId === file.fileId ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}
                        >
                          <div className="truncate font-medium">{file.fileName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(file.uploadedAt).toLocaleDateString()} {new Date(file.uploadedAt).toLocaleTimeString()}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Upload New File Button */}
              <button
                onClick={handleFileSelect}
                disabled={isLoading}
                aria-label="Upload a new file"
                className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Upload size={20} />
                )}
                {isLoading ? 'Uploading...' : 'Upload New File'}
              </button>
            </div>
            
            {/* File Error Message */}
            {fileError && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={16} />
                <span>{fileError}</span>
              </div>
            )}
            
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept={SUPPORTED_EXTENSIONS.join(',')}
              className="hidden"
              disabled={isLoading}
            />
          </div>
        ) : chatState === 'purpose-input' ? (
          <div className="flex gap-3">
            <input
              type="text"
              value={purposeInput}
              onChange={(e) => setPurposeInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePurposeSubmit()}
              placeholder="Describe what you want to achieve with your data..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handlePurposeSubmit}
              disabled={isLoading || !purposeInput.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Submit'}
            </button>
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400">
            {chatState === 'processing' ? 'Processing your pipeline...' : 
             chatState === 'deploying' ? 'Deploying your MCP server...' : 
             'Pipeline complete!'}
          </div>
        )}

        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <motion.div
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Uploading... {uploadProgress}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
