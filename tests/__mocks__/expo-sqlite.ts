// Mock for expo-sqlite
export interface SQLiteDatabase {
  execAsync: jest.MockedFunction<any>;
  getAllAsync: jest.MockedFunction<any>;
  getFirstAsync: jest.MockedFunction<any>;
  runAsync: jest.MockedFunction<any>;
  prepareAsync: jest.MockedFunction<any>;
}

const createMockDatabase = (): SQLiteDatabase => ({
  execAsync: jest.fn(() => Promise.resolve()),
  getAllAsync: jest.fn(() => Promise.resolve([])),
  getFirstAsync: jest.fn(() => Promise.resolve(null)),
  runAsync: jest.fn(() => Promise.resolve({ lastInsertRowId: 1, changes: 1 })),
  prepareAsync: jest.fn(() => Promise.resolve({
    executeAsync: jest.fn(() => Promise.resolve()),
    finalizeAsync: jest.fn(() => Promise.resolve()),
  })),
});

export const openDatabaseAsync = jest.fn(() => Promise.resolve(createMockDatabase()));

export const deleteDatabaseAsync = jest.fn(() => Promise.resolve());

export default {
  openDatabaseAsync,
  deleteDatabaseAsync,
};