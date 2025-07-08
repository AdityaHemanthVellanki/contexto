import { NextRequest } from 'next/server';
import { POST } from '../[id]/run/route';
import { auth } from '@/utils/firebase-admin';
import { executePipeline } from '@/services/executePipeline';

// Mock Firebase admin auth
jest.mock('@/utils/firebase-admin', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

// Create mock functions directly
const mockGetPipelineById = jest.fn();
const mockExecutePipeline = jest.fn();

// Mock modules
jest.mock('@/utils/pipelineService', () => ({
  // Mock other functions from pipelineService if needed
}));

jest.mock('@/services/executePipeline', () => ({
  executePipeline: jest.fn().mockImplementation((...args) => mockExecutePipeline(...args))
}));

// Mock the function that would be imported from route.ts
jest.mock('../[id]/run/route', () => {
  // Store original implementation
  const originalModule = jest.requireActual('../[id]/run/route');
  
  return {
    ...originalModule,
    // Replace any internal functions that may use getPipelineById
    getPipelineById: jest.fn().mockImplementation((...args) => mockGetPipelineById(...args))
  };
});

describe('Pipeline Run API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should execute a pipeline successfully', async () => {
    // Arrange
    const userId = 'user123';
    const pipelineId = 'pipeline123';
    const prompt = 'Test prompt';
    
    const mockRequest = new NextRequest('http://localhost/api/pipelines/pipeline123/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({ prompt }),
    });
    
    // Mock the auth to return a valid userId
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: userId });
    
    // Mock getting pipeline by ID
    mockGetPipelineById.mockResolvedValue({
      id: pipelineId,
      userId,
      name: 'Test Pipeline',
      graph: { nodes: [], edges: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    // Mock pipeline execution
    mockExecutePipeline.mockResolvedValue({
      result: 'Pipeline execution result',
      usage: {
        total: { promptTokens: 100, completionTokens: 50 },
        nodes: {}
      },
      logs: ['Pipeline executed successfully'],
    });
    
    // Act
    const response = await POST(mockRequest, { params: { id: pipelineId } } as any);
    const responseData = await response.json();
    
    // Assert
    expect(response.status).toBe(200);
    expect(responseData).toEqual(expect.objectContaining({
      success: true,
      result: 'Pipeline execution result',
      usage: expect.objectContaining({
        total: expect.objectContaining({
          promptTokens: 100,
          completionTokens: 50,
        }),
      }),
    }));
    expect(auth.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(mockGetPipelineById).toHaveBeenCalledWith(pipelineId);
    expect(mockExecutePipeline).toHaveBeenCalledWith(
      expect.anything(),
      prompt,
      userId
    );
  });
  
  it('should return 401 when no auth token is provided', async () => {
    // Arrange
    const pipelineId = 'pipeline123';
    const mockRequest = new NextRequest('http://localhost/api/pipelines/pipeline123/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Test prompt' }),
    });
    
    // Act
    const response = await POST(mockRequest, { params: { id: pipelineId } } as any);
    const responseData = await response.json();
    
    // Assert
    expect(response.status).toBe(401);
    expect(responseData).toEqual(expect.objectContaining({
      error: expect.stringContaining('Unauthorized'),
    }));
  });
  
  it('should return 403 when user does not own the pipeline', async () => {
    // Arrange
    const userId = 'user123';
    const pipelineId = 'pipeline123';
    const mockRequest = new NextRequest('http://localhost/api/pipelines/pipeline123/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({ prompt: 'Test prompt' }),
    });
    
    // Mock the auth to return a valid userId
    (auth.verifyIdToken as jest.Mock).mockResolvedValue({ uid: userId });
    
    // Mock getting pipeline by ID with a different userId
    mockGetPipelineById.mockResolvedValue({
      id: pipelineId,
      userId: 'different-user',
      name: 'Test Pipeline',
      graph: { nodes: [], edges: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    // Act
    const response = await POST(mockRequest, { params: { id: pipelineId } } as any);
    const responseData = await response.json();
    
    // Assert
    expect(response.status).toBe(403);
    expect(responseData).toEqual(expect.objectContaining({
      error: expect.stringContaining('not authorized'),
    }));
  });
});
