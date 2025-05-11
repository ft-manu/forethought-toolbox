import '@testing-library/jest-dom';

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: undefined,
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  bookmarks: {
    create: jest.fn(),
    remove: jest.fn(),
    getTree: jest.fn(),
  },
} as unknown as typeof chrome;

// Mock crypto API
global.crypto = {
  randomUUID: () => 'mock-uuid',
} as unknown as Crypto; 