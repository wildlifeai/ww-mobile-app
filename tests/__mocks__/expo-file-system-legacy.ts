// Mock for expo-file-system/legacy subpath
// This prevents "TypeError: Super expression must either be null or a function"
// caused by the legacy shim trying to extend a native class unavailable in Jest.
const documentDirectory = '/mock/documents/'
const cacheDirectory = '/mock/cache/'

module.exports = {
    documentDirectory,
    cacheDirectory,
    downloadAsync: jest.fn(() => Promise.resolve({ uri: 'mock-uri', status: 200 })),
    readAsStringAsync: jest.fn(() => Promise.resolve('')),
    writeAsStringAsync: jest.fn(() => Promise.resolve()),
    deleteAsync: jest.fn(() => Promise.resolve()),
    getInfoAsync: jest.fn(() => Promise.resolve({ exists: true, isDirectory: false, size: 1000, uri: 'mock-uri' })),
    makeDirectoryAsync: jest.fn(() => Promise.resolve()),
    copyAsync: jest.fn(() => Promise.resolve()),
    moveAsync: jest.fn(() => Promise.resolve()),
    readDirectoryAsync: jest.fn(() => Promise.resolve([])),
    createDownloadResumable: jest.fn(() => ({
        downloadAsync: jest.fn(() => Promise.resolve({ uri: 'mock-uri' })),
        pauseAsync: jest.fn(),
        resumeAsync: jest.fn(),
        savable: jest.fn(),
    })),
}
