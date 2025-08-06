/**
 * File System utility with fallback for expo-file-system NativeModule issues
 * Provides backward compatibility and graceful degradation
 */

let FileSystem: any = null;
let fallbackMode = false;

interface FileSystemAPI {
  documentDirectory: string | null;
  writeAsStringAsync: (fileUri: string, contents: string) => Promise<void>;
  readAsStringAsync: (fileUri: string) => Promise<string>;
  deleteAsync: (fileUri: string) => Promise<void>;
  getInfoAsync: (fileUri: string) => Promise<{exists: boolean; size?: number}>;
  makeDirectoryAsync: (fileUri: string) => Promise<void>;
}

class FileSystemWrapper implements FileSystemAPI {
  private memoryStorage: Map<string, string> = new Map();
  
  get documentDirectory(): string | null {
    if (!fallbackMode && this.getFileSystem()) {
      try {
        return FileSystem.documentDirectory;
      } catch (e) {
        console.warn('documentDirectory access failed, using fallback:', e);
        fallbackMode = true;
      }
    }
    
    // Fallback: return a mock directory path
    return 'file:///mock/documents/';
  }

  private getFileSystem() {
    if (!FileSystem && !fallbackMode) {
      try {
        FileSystem = require('expo-file-system');
        if (!FileSystem || !FileSystem.documentDirectory) {
          throw new Error('FileSystem module not properly initialized');
        }
        return FileSystem;
      } catch (e) {
        console.warn('expo-file-system failed to load, using memory fallback:', e instanceof Error ? e.message : 'Unknown error');
        fallbackMode = true;
        return null;
      }
    }
    return fallbackMode ? null : FileSystem;
  }

  async writeAsStringAsync(fileUri: string, contents: string): Promise<void> {
    const fs = this.getFileSystem();
    
    if (!fallbackMode && fs) {
      try {
        await fs.writeAsStringAsync(fileUri, contents);
        return;
      } catch (e) {
        console.warn('FileSystem write failed, using memory fallback:', e);
        fallbackMode = true;
      }
    }
    
    // Fallback: store in memory
    this.memoryStorage.set(fileUri, contents);
    console.log(`[Memory FS] Wrote to ${fileUri}: ${contents.length} chars`);
  }

  async readAsStringAsync(fileUri: string): Promise<string> {
    const fs = this.getFileSystem();
    
    if (!fallbackMode && fs) {
      try {
        return await fs.readAsStringAsync(fileUri);
      } catch (e) {
        console.warn('FileSystem read failed, checking memory fallback:', e);
        fallbackMode = true;
      }
    }
    
    // Fallback: read from memory
    const content = this.memoryStorage.get(fileUri);
    if (content === undefined) {
      throw new Error(`File not found in memory storage: ${fileUri}`);
    }
    console.log(`[Memory FS] Read from ${fileUri}: ${content.length} chars`);
    return content;
  }

  async deleteAsync(fileUri: string): Promise<void> {
    const fs = this.getFileSystem();
    
    if (!fallbackMode && fs) {
      try {
        await fs.deleteAsync(fileUri);
        return;
      } catch (e) {
        console.warn('FileSystem delete failed, using memory fallback:', e);
        fallbackMode = true;
      }
    }
    
    // Fallback: delete from memory
    const existed = this.memoryStorage.delete(fileUri);
    console.log(`[Memory FS] Deleted ${fileUri}: ${existed ? 'existed' : 'not found'}`);
  }

  async getInfoAsync(fileUri: string): Promise<{exists: boolean; size?: number}> {
    const fs = this.getFileSystem();
    
    if (!fallbackMode && fs) {
      try {
        return await fs.getInfoAsync(fileUri);
      } catch (e) {
        console.warn('FileSystem getInfo failed, using memory fallback:', e);
        fallbackMode = true;
      }
    }
    
    // Fallback: check memory storage
    const content = this.memoryStorage.get(fileUri);
    return {
      exists: content !== undefined,
      size: content ? content.length : undefined
    };
  }

  async makeDirectoryAsync(fileUri: string): Promise<void> {
    const fs = this.getFileSystem();
    
    if (!fallbackMode && fs) {
      try {
        await fs.makeDirectoryAsync(fileUri);
        return;
      } catch (e) {
        console.warn('FileSystem makeDirectory failed, using memory fallback:', e);
        fallbackMode = true;
      }
    }
    
    // Fallback: no-op for memory storage
    console.log(`[Memory FS] Created directory ${fileUri} (no-op in memory mode)`);
  }

  /**
   * Check if currently using fallback mode
   */
  get isUsingFallback(): boolean {
    return fallbackMode;
  }

  /**
   * Get storage mode info for debugging
   */
  getStorageInfo(): {mode: string; filesInMemory: number} {
    return {
      mode: fallbackMode ? 'memory' : 'native',
      filesInMemory: this.memoryStorage.size
    };
  }

  /**
   * Clear memory storage (useful for testing)
   */
  clearMemoryStorage(): void {
    this.memoryStorage.clear();
    console.log('[Memory FS] Cleared all memory storage');
  }
}

// Create singleton instance
const fileSystemWrapper = new FileSystemWrapper();

// Export the wrapper as default
export default fileSystemWrapper;

// Named exports for compatibility
export { fileSystemWrapper as FileSystem };
export type { FileSystemAPI };

// Utility function to check if file system is available
export const isFileSystemAvailable = (): boolean => {
  return !fileSystemWrapper.isUsingFallback;
};