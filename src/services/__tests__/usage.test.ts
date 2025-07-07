import { logUsage } from '../usage';
import { collection, addDoc } from 'firebase/firestore';

// Mock Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn().mockResolvedValue({ id: 'mock-usage-id' }),
  getFirestore: jest.fn(),
}));

describe('Usage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('logUsage', () => {
    it('should log usage metrics correctly', async () => {
      // Arrange
      const callType = 'embedding';
      const usage = { promptTokens: 100, completionTokens: 50 };
      const userId = 'user123';
      
      // Act
      await logUsage(callType, usage, userId);
      
      // Assert
      expect(collection).toHaveBeenCalled();
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          callType,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          userId,
          timestamp: expect.any(Date)
        })
      );
    });
    
    it('should throw an error if call type is missing', async () => {
      // Arrange
      const callType = '';
      const usage = { promptTokens: 100, completionTokens: 50 };
      const userId = 'user123';
      
      // Act & Assert
      await expect(logUsage(callType, usage, userId))
        .rejects
        .toThrow('Call type is required for usage logging');
    });
    
    it('should throw an error if usage metrics are invalid', async () => {
      // Arrange
      const callType = 'embedding';
      const usage = { promptTokens: null, completionTokens: 50 } as any;
      const userId = 'user123';
      
      // Act & Assert
      await expect(logUsage(callType, usage, userId))
        .rejects
        .toThrow('Valid token usage metrics are required for usage logging');
    });
    
    it('should throw an error if user ID is missing', async () => {
      // Arrange
      const callType = 'embedding';
      const usage = { promptTokens: 100, completionTokens: 50 };
      const userId = '';
      
      // Act & Assert
      await expect(logUsage(callType, usage, userId))
        .rejects
        .toThrow('User ID is required for usage logging');
    });
  });
});
