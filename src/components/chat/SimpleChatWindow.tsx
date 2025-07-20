'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { Upload, Download, Loader2, Rocket } from 'lucide-react';

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
    vectorStoreEndpoint?: string;
    storeType?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load messages for the current chat from Firestore or show welcome message
    if (chatId && user?.uid) {
      // TODO: Load messages from Firestore for this specific chat
      // For now, just show welcome message
      setMessages([{
        id: '1',
        type: 'ai',
        content: WELCOME_MESSAGE,
        timestamp: new Date()
      }]);
    } else if (messages.length === 0) {
      // Add welcome message on mount for new chats
      setMessages([{
        id: '1',
        type: 'ai',
        content: WELCOME_MESSAGE,
        timestamp: new Date()
      }]);
    }
  }, [chatId, user?.uid, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (type: 'ai' | 'user', content: string, metadata?: Message['metadata']) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
      metadata
    };
    setMessages(prev => [...prev, newMessage]);
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
          fileId: currentFileId,
          purpose: purposeInput
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      const { downloadUrl, pipelineId } = await response.json();
      setCurrentPipelineId(pipelineId);

      // Update state and show completion message
      setChatState('complete');
      addMessage('ai', '🎉 Your MCP pipeline is ready!', { downloadUrl, fileId: currentFileId, pipelineId });

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
      addMessage('ai', `✅ Vector store deployed: ${storeType}`);

      // Step 2: Deploy MCP Server
      addMessage('ai', '⚙️ Deploying MCP server to Vercel...');
      const serverResponse = await fetch('/api/deployServer', {
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

      const { mcpUrl, deploymentId } = await serverResponse.json();

      // Success message with deployment details
      setChatState('complete');
      addMessage('ai', '🎉 Deployment complete!', {
        mcpUrl,
        vectorStoreEndpoint,
        storeType,
        deploymentId
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
                {isDeploying ? 'Deploying...' : 'Deploy MCP Server'}
              </button>
            )}
          </div>
        )}
        
        {message.metadata?.mcpUrl && (
          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">🚀 Deployment Complete!</h4>
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
        
        <div className="text-xs opacity-70 mt-2">
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </motion.div>
  );

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
          <div className="flex justify-center">
            <button
              onClick={handleFileSelect}
              disabled={isLoading}
              className="inline-flex items-center gap-3 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Upload size={20} />
              )}
              {isLoading ? 'Uploading...' : 'Upload File'}
            </button>
            
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
