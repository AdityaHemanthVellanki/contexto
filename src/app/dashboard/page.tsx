'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  doc,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Upload, 
  FileText, 
  Settings, 
  Rocket, 
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Search
} from 'lucide-react';
import { toast } from 'sonner';

interface MCPItem {
  id: string;
  title: string;
  description?: string;
  fileName?: string;
  status: 'processing' | 'complete' | 'error';
  createdAt: any;
  userId: string;
  fileUrl?: string;
  exportUrl?: string;
  deploymentUrl?: string;
  tools?: any[];
  context?: string;
}

interface MCPFormData {
  name: string;
  description: string;
  data: string;
  context: string;
  toolRules: string;
  autoGenerateTools: boolean;
}

export default function MCPDashboard() {
  const { user, isLoading: authLoading, signInWithGoogle } = useAuth();
  const [mcps, setMcps] = useState<MCPItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<MCPFormData>({
    name: '',
    description: '',
    data: '',
    context: '',
    toolRules: '',
    autoGenerateTools: true
  });
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const mcpsQuery = query(
      collection(db, 'mcps'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(mcpsQuery, (snapshot) => {
      const mcpData: MCPItem[] = [];
      snapshot.forEach((doc) => {
        mcpData.push({ id: doc.id, ...doc.data() } as MCPItem);
      });
      setMcps(mcpData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeleteMCP = async (mcpId: string) => {
    if (!confirm('Are you sure you want to delete this MCP?')) return;
    
    try {
      await deleteDoc(doc(db, 'mcps', mcpId));
      toast.success('MCP deleted successfully');
    } catch (error) {
      console.error('Error deleting MCP:', error);
      toast.error('Failed to delete MCP');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setFormData(prev => ({ ...prev, data: '' }));
    }
  };

  const validateStep1 = () => {
    return formData.name.trim() && (formData.description.trim() || formData.data.trim() || uploadedFile);
  };

  const handleNextStep = () => {
    if (currentStep === 1 && !validateStep1()) {
      toast.error('Please provide an MCP name and either a description or data/file');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleCreateMCP = async () => {
    setIsCreating(true);
    try {
      // Step 1: Handle file upload if present
      let fileIds: string[] = [];
      if (uploadedFile) {
        console.log('📤 Uploading file to R2:', uploadedFile.name);
        const formData = new FormData();
        formData.append('file', uploadedFile);
        
        const uploadResponse = await fetch('/api/uploads', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await user!.getIdToken()}`,
          },
          body: formData,
        });
        
        if (!uploadResponse.ok) {
          const error = await uploadResponse.text();
          throw new Error(`File upload failed: ${error}`);
        }
        
        const uploadResult = await uploadResponse.json();
        fileIds = [uploadResult.fileId];
        console.log('✅ File uploaded successfully:', uploadResult.fileId);
      }
      
      // Step 2: Create MCP document in Firestore
      const baseData: any = {
        userId: user!.uid,
        title: formData.name.trim(),
        autoGenerateTools: formData.autoGenerateTools,
        status: 'initializing',
        fileIds: fileIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Conditionally add optional fields only when provided
      if (formData.description && formData.description.trim()) {
        baseData.description = formData.description.trim();
      }
      if (formData.data && formData.data.trim()) {
        baseData.data = formData.data;
      }
      if (formData.context && formData.context.trim()) {
        baseData.context = formData.context.trim();
      }
      if (formData.toolRules && formData.toolRules.trim()) {
        baseData.toolRules = formData.toolRules.trim();
      }
      if (uploadedFile && uploadedFile.name) {
        baseData.fileName = uploadedFile.name;
      }

      const mcpDocRef = await addDoc(collection(db, 'mcps'), baseData);
      const mcpId = mcpDocRef.id;
      console.log('✅ MCP document created:', mcpId);
      
      // Step 3: Trigger pipeline processing
      console.log('🚀 Starting pipeline processing...');
      const pipelinePayload = {
        fileIds: fileIds,
        description: formData.description || formData.data || 'Process this MCP',
        tools: [],
        autoGenerateTools: formData.autoGenerateTools,
        name: formData.name.trim(),
        mcpId: mcpId
      };
      
      const pipelineResponse = await fetch('/api/processPipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user!.getIdToken()}`,
        },
        body: JSON.stringify(pipelinePayload),
      });
      
      if (!pipelineResponse.ok) {
        const error = await pipelineResponse.text();
        throw new Error(`Pipeline processing failed: ${error}`);
      }
      
      const pipelineResult = await pipelineResponse.json();
      console.log('✅ Pipeline started:', pipelineResult);
      
      const returnedPipelineId: string | undefined = pipelineResult?.pipelineId;
      if (!returnedPipelineId) {
        throw new Error('Pipeline API did not return pipelineId');
      }
      
      // Step 4: Update MCP document with pipeline ID
      await updateDoc(doc(db, 'mcps', mcpId), {
        pipelineId: returnedPipelineId,
        status: 'processing',
        updatedAt: serverTimestamp(),
      });
      
      toast.success('MCP creation started! Processing your data...');
      setShowOnboarding(false);
      setCurrentStep(1);
      setFormData({
        name: '',
        description: '',
        data: '',
        context: '',
        toolRules: '',
        autoGenerateTools: true
      });
      setUploadedFile(null);
    } catch (error) {
      console.error('Error creating MCP:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create MCP');
    } finally {
      setIsCreating(false);
    }
  };

  const resetOnboarding = () => {
    setShowOnboarding(false);
    setCurrentStep(1);
    setFormData({
      name: '',
      description: '',
      data: '',
      context: '',
      toolRules: '',
      autoGenerateTools: true
    });
    setUploadedFile(null);
  };

  const filteredMcps = mcps.filter(mcp => 
    mcp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (mcp.description && mcp.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Please sign in</h1>
          <p className="text-gray-400 mb-6">You need to be signed in to access the dashboard.</p>
          <Button onClick={signInWithGoogle} className="bg-white text-black hover:bg-gray-200">
            Continue with Google
          </Button>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold mb-2">Create New MCP</h1>
            <p className="text-gray-400">Follow the steps to create your Model Context Protocol server</p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-12">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                    ${currentStep >= step 
                      ? 'bg-white text-black border-white' 
                      : 'bg-transparent text-gray-400 border-gray-600'
                    }
                  `}>
                    {currentStep > step ? <Check className="w-5 h-5" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-16 h-0.5 mx-2 ${
                      currentStep > step ? 'bg-white' : 'bg-gray-600'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="max-w-2xl mx-auto">
            {currentStep === 1 && (
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">
                      1
                    </div>
                    <div>
                      <CardTitle className="text-white">MCP Details</CardTitle>
                      <CardDescription className="text-gray-400">
                        Name your MCP and provide either a description or data
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      MCP Name <span className="text-red-400">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter MCP name"
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description <span className="text-gray-500">(optional if providing data)</span>
                    </label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what your MCP should do"
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 min-h-[100px]"
                    />
                  </div>

                  <div className="text-center text-gray-400 font-medium">OR</div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Provide Data <span className="text-gray-500">(optional if providing description)</span>
                    </label>
                    <Textarea
                      value={formData.data}
                      onChange={(e) => setFormData(prev => ({ ...prev, data: e.target.value }))}
                      placeholder="Paste your data here"
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 min-h-[120px]"
                      disabled={!!uploadedFile}
                    />
                  </div>

                  <div className="text-center text-gray-400 font-medium">OR</div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Upload File <span className="text-gray-500">(optional)</span>
                    </label>
                    <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                        accept=".txt,.md,.pdf,.docx"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-400">
                          {uploadedFile ? uploadedFile.name : 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          Supports: TXT, MD, PDF, DOCX
                        </p>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">
                      2
                    </div>
                    <div>
                      <CardTitle className="text-white">Tools & Context</CardTitle>
                      <CardDescription className="text-gray-400">
                        Optional: Add context and define tool rules for your MCP
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Additional Context <span className="text-gray-500">(optional)</span>
                    </label>
                    <Textarea
                      value={formData.context}
                      onChange={(e) => setFormData(prev => ({ ...prev, context: e.target.value }))}
                      placeholder="Provide additional context to help design better tools"
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 min-h-[100px]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tool Rules <span className="text-gray-500">(optional)</span>
                    </label>
                    <Textarea
                      value={formData.toolRules}
                      onChange={(e) => setFormData(prev => ({ ...prev, toolRules: e.target.value }))}
                      placeholder="Describe specific rules or requirements for the tools"
                      className="bg-gray-800 border-gray-600 text-white placeholder-gray-400 min-h-[100px]"
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="auto-generate"
                      checked={formData.autoGenerateTools}
                      onChange={(e) => setFormData(prev => ({ ...prev, autoGenerateTools: e.target.checked }))}
                      className="w-4 h-4 text-white bg-gray-800 border-gray-600 rounded focus:ring-white"
                    />
                    <label htmlFor="auto-generate" className="text-gray-300">
                      Auto-generate tools using AI (recommended)
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && (
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-white text-black rounded-full flex items-center justify-center font-bold">
                      3
                    </div>
                    <div>
                      <CardTitle className="text-white">Deploy & Download</CardTitle>
                      <CardDescription className="text-gray-400">
                        Review and create your MCP server
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-white">MCP Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-gray-400">Name:</span> <span className="text-white">{formData.name}</span></div>
                      {formData.description && (
                        <div><span className="text-gray-400">Description:</span> <span className="text-white">{formData.description}</span></div>
                      )}
                      {formData.data && (
                        <div><span className="text-gray-400">Data:</span> <span className="text-white">{formData.data.substring(0, 100)}...</span></div>
                      )}
                      {uploadedFile && (
                        <div><span className="text-gray-400">File:</span> <span className="text-white">{uploadedFile.name}</span></div>
                      )}
                      {formData.context && (
                        <div><span className="text-gray-400">Context:</span> <span className="text-white">{formData.context.substring(0, 100)}...</span></div>
                      )}
                      <div><span className="text-gray-400">Auto-generate tools:</span> <span className="text-white">{formData.autoGenerateTools ? 'Yes' : 'No'}</span></div>
                    </div>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="font-medium text-white mb-3">What happens next?</h3>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        <span>MCP server code will be generated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>Tools will be created based on your data</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Rocket className="w-4 h-4" />
                        <span>Ready for deployment to Heroku</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        <span>VS Code extension will be available</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8">
            <div>
              {currentStep > 1 && (
                <Button
                  onClick={handlePrevStep}
                  variant="outline"
                  className="bg-transparent border-gray-600 text-white hover:bg-gray-800"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={resetOnboarding}
                variant="outline"
                className="bg-transparent border-gray-600 text-white hover:bg-gray-800"
              >
                Cancel
              </Button>
              
              {currentStep < 3 ? (
                <Button
                  onClick={handleNextStep}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={handleCreateMCP}
                  disabled={isCreating}
                  className="bg-white text-black hover:bg-gray-200"
                >
                  {isCreating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4 mr-2" />
                      Create MCP
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">MCP Dashboard</h1>
          <p className="mt-2 text-gray-400">
            Manage your Model Context Protocol servers
          </p>
        </div>

        {/* Search and Create */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Search MCPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
          <Button 
            onClick={() => setShowOnboarding(true)}
            className="bg-white text-black hover:bg-gray-200 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New MCP
          </Button>
        </div>

        {/* MCPs Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="mt-4 text-gray-400">Loading your MCPs...</p>
          </div>
        ) : filteredMcps.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {searchTerm ? 'No MCPs found' : 'No MCPs yet'}
            </h3>
            <p className="text-gray-400 mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms' 
                : 'Create your first MCP to get started'
              }
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setShowOnboarding(true)}
                className="bg-white text-black hover:bg-gray-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First MCP
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMcps.map((mcp) => (
              <Card key={mcp.id} className="bg-gray-900 border-gray-700 hover:bg-gray-800 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">{mcp.title}</CardTitle>
                      {mcp.description && (
                        <CardDescription className="text-gray-400 mt-1">
                          {mcp.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge 
                      variant={mcp.status === 'complete' ? 'default' : 
                              mcp.status === 'processing' ? 'secondary' : 'destructive'}
                      className="ml-2"
                    >
                      {mcp.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mcp.fileName && (
                      <p className="text-sm text-gray-400">
                        <FileText className="inline h-4 w-4 mr-1" />
                        {mcp.fileName}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2">
                      {mcp.exportUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(mcp.exportUrl, '_blank')}
                          className="bg-transparent border-gray-600 text-white hover:bg-gray-800"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      )}
                      
                      {mcp.deploymentUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(mcp.deploymentUrl, '_blank')}
                          className="bg-transparent border-gray-600 text-white hover:bg-gray-800"
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Deploy
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteMCP(mcp.id)}
                        className="bg-red-900 hover:bg-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
