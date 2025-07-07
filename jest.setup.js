// Add Jest extended matchers
import '@testing-library/jest-dom';

// Mock Firebase for testing
jest.mock('firebase/app', () => {
  return {
    getApps: jest.fn(() => []),
    initializeApp: jest.fn(),
    getApp: jest.fn(),
  };
});

jest.mock('firebase/auth', () => {
  return {
    getAuth: jest.fn(),
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    GoogleAuthProvider: jest.fn(),
    signInWithPopup: jest.fn(),
  };
});

jest.mock('firebase/firestore', () => {
  return {
    getFirestore: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    addDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    updateDoc: jest.fn(),
  };
});

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => ({ get: jest.fn() })),
}));

// Mock Azure OpenAI service
jest.mock('./src/utils/azure-openai', () => ({
  getEmbedding: jest.fn(),
  getChatCompletion: jest.fn(),
}));

// Global fetch mock
global.fetch = jest.fn();

// Mock window.alert
global.alert = jest.fn();

// Suppress console errors/warnings during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
