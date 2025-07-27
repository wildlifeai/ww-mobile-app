# File System Migration Examples - RNFS to Expo File System

## Complete Migration Reference

### 1. Basic File Operations

#### Writing Files
```javascript
// ❌ OLD - react-native-fs
import RNFS from 'react-native-fs';

const path = `${RNFS.DocumentDirectoryPath}/data.json`;
await RNFS.writeFile(path, JSON.stringify(data), 'utf8');

// ✅ NEW - expo-file-system  
import * as FileSystem from 'expo-file-system';

const path = `${FileSystem.documentDirectory}data.json`;
await FileSystem.writeAsStringAsync(path, JSON.stringify(data));
```

#### Reading Files
```javascript
// ❌ OLD
const content = await RNFS.readFile(path, 'utf8');
const data = JSON.parse(content);

// ✅ NEW
const content = await FileSystem.readAsStringAsync(path);
const data = JSON.parse(content);
```

#### Checking File Existence
```javascript
// ❌ OLD
const exists = await RNFS.exists(path);
if (exists) {
  // file exists
}

// ✅ NEW
const info = await FileSystem.getInfoAsync(path);
if (info.exists) {
  // file exists
}
```

### 2. Directory Operations

#### Creating Directories
```javascript
// ❌ OLD
await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/wildlife-data`);

// ✅ NEW
await FileSystem.makeDirectoryAsync(
  `${FileSystem.documentDirectory}wildlife-data`,
  { intermediates: true }
);
```

#### Reading Directory Contents
```javascript
// ❌ OLD
const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
files.forEach(file => {
  console.log(file.name, file.path, file.size);
});

// ✅ NEW
const files = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
// Note: Returns only filenames, need getInfoAsync for details
for (const filename of files) {
  const filePath = `${FileSystem.documentDirectory}${filename}`;
  const info = await FileSystem.getInfoAsync(filePath);
  console.log(filename, filePath, info.size);
}
```

### 3. File Management

#### Deleting Files
```javascript
// ❌ OLD
await RNFS.unlink(path);

// ✅ NEW
await FileSystem.deleteAsync(path, { idempotent: true });
```

#### Moving Files
```javascript
// ❌ OLD
await RNFS.moveFile(oldPath, newPath);

// ✅ NEW
await FileSystem.moveAsync({
  from: oldPath,
  to: newPath
});
```

#### Copying Files
```javascript
// ❌ OLD
await RNFS.copyFile(sourcePath, destPath);

// ✅ NEW
await FileSystem.copyAsync({
  from: sourcePath,
  to: destPath
});
```

### 4. Wildlife Watcher Specific Examples

#### Firmware File Management
```javascript
// ❌ OLD - Firmware download and storage
import RNFS from 'react-native-fs';

const downloadFirmware = async (url, version) => {
  const destPath = `${RNFS.DocumentDirectoryPath}/firmware/v${version}.zip`;
  
  const download = await RNFS.downloadFile({
    fromUrl: url,
    toFile: destPath,
    progress: (res) => {
      const progress = res.bytesWritten / res.contentLength;
      console.log(`Download progress: ${(progress * 100).toFixed(2)}%`);
    }
  }).promise;
  
  return destPath;
};

// ✅ NEW - Firmware download and storage
import * as FileSystem from 'expo-file-system';

const downloadFirmware = async (url, version) => {
  const destPath = `${FileSystem.documentDirectory}firmware/v${version}.zip`;
  
  // Ensure directory exists
  await FileSystem.makeDirectoryAsync(
    `${FileSystem.documentDirectory}firmware`,
    { intermediates: true }
  );
  
  const downloadResumable = FileSystem.createDownloadResumable(
    url,
    destPath,
    {},
    (downloadProgress) => {
      const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
      console.log(`Download progress: ${(progress * 100).toFixed(2)}%`);
    }
  );
  
  const { uri } = await downloadResumable.downloadAsync();
  return uri;
};
```

#### Device Logs Storage
```javascript
// ❌ OLD - BLE Communication logs
const saveDeviceLog = async (deviceId, logData) => {
  const logDir = `${RNFS.DocumentDirectoryPath}/logs/${deviceId}`;
  const logFile = `${logDir}/${new Date().toISOString()}.json`;
  
  // Create directory if not exists
  if (!(await RNFS.exists(logDir))) {
    await RNFS.mkdir(logDir);
  }
  
  await RNFS.writeFile(logFile, JSON.stringify(logData), 'utf8');
};

// ✅ NEW - BLE Communication logs
const saveDeviceLog = async (deviceId, logData) => {
  const logDir = `${FileSystem.documentDirectory}logs/${deviceId}`;
  const logFile = `${logDir}/${new Date().toISOString()}.json`;
  
  // Create directory
  await FileSystem.makeDirectoryAsync(logDir, { intermediates: true });
  
  await FileSystem.writeAsStringAsync(logFile, JSON.stringify(logData));
};
```

#### Deployment Data Export
```javascript
// ❌ OLD - Export deployment data
const exportDeploymentData = async (deployments) => {
  const exportPath = `${RNFS.DocumentDirectoryPath}/exports/deployments_${Date.now()}.csv`;
  
  // Create CSV content
  const csv = convertToCSV(deployments);
  
  await RNFS.writeFile(exportPath, csv, 'utf8');
  
  // Get file stats
  const stats = await RNFS.stat(exportPath);
  return {
    path: exportPath,
    size: stats.size,
    created: stats.ctime
  };
};

// ✅ NEW - Export deployment data  
const exportDeploymentData = async (deployments) => {
  const exportDir = `${FileSystem.documentDirectory}exports`;
  const exportPath = `${exportDir}/deployments_${Date.now()}.csv`;
  
  // Ensure export directory exists
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
  
  // Create CSV content
  const csv = convertToCSV(deployments);
  
  await FileSystem.writeAsStringAsync(exportPath, csv);
  
  // Get file info
  const info = await FileSystem.getInfoAsync(exportPath);
  return {
    path: exportPath,
    size: info.size,
    created: new Date(info.modificationTime * 1000)
  };
};
```

### 5. Path Constants Migration

```javascript
// ❌ OLD - Path constants
const PATHS = {
  DOCUMENTS: RNFS.DocumentDirectoryPath,
  CACHE: RNFS.CachesDirectoryPath,
  TEMP: RNFS.TemporaryDirectoryPath,
  EXTERNAL: RNFS.ExternalDirectoryPath, // Android only
};

// ✅ NEW - Path constants
const PATHS = {
  DOCUMENTS: FileSystem.documentDirectory,
  CACHE: FileSystem.cacheDirectory,
  TEMP: FileSystem.cacheDirectory, // Use cache for temp
  EXTERNAL: FileSystem.documentDirectory, // No direct equivalent
};
```

### 6. Error Handling

```javascript
// ❌ OLD
try {
  await RNFS.readFile(path, 'utf8');
} catch (error) {
  if (error.message.includes('No such file')) {
    // File doesn't exist
  }
}

// ✅ NEW
try {
  await FileSystem.readAsStringAsync(path);
} catch (error) {
  if (error.message.includes('could not be read')) {
    // File doesn't exist
  }
}
```

### 7. Binary File Handling

```javascript
// ❌ OLD - Read binary file
const base64Data = await RNFS.readFile(firmwarePath, 'base64');

// ✅ NEW - Read binary file
const base64Data = await FileSystem.readAsStringAsync(firmwarePath, {
  encoding: FileSystem.EncodingType.Base64
});
```

### 8. File Upload Preparation

```javascript
// ❌ OLD - Prepare file for upload
const prepareUpload = async (filePath) => {
  const stats = await RNFS.stat(filePath);
  const base64 = await RNFS.readFile(filePath, 'base64');
  
  return {
    name: stats.filename,
    type: 'application/octet-stream',
    size: stats.size,
    data: base64
  };
};

// ✅ NEW - Prepare file for upload
const prepareUpload = async (filePath) => {
  const info = await FileSystem.getInfoAsync(filePath);
  const base64 = await FileSystem.readAsStringAsync(filePath, {
    encoding: FileSystem.EncodingType.Base64
  });
  
  const filename = filePath.split('/').pop();
  
  return {
    name: filename,
    type: 'application/octet-stream',
    size: info.size,
    data: base64
  };
};
```

## Migration Checklist

When migrating file system code:

1. **Update imports**
   - Remove: `import RNFS from 'react-native-fs'`
   - Add: `import * as FileSystem from 'expo-file-system'`

2. **Update path constants**
   - `RNFS.DocumentDirectoryPath` → `FileSystem.documentDirectory`
   - Note: Expo paths include trailing slash

3. **Update method names**
   - Write: `writeFile` → `writeAsStringAsync`
   - Read: `readFile` → `readAsStringAsync`
   - Delete: `unlink` → `deleteAsync`
   - Check: `exists` → `getInfoAsync`

4. **Handle differences**
   - `readDir` returns full objects → `readDirectoryAsync` returns only names
   - No direct `stat` → use `getInfoAsync`
   - No streaming APIs → use download resumable for large files

5. **Test thoroughly**
   - File creation/reading
   - Directory operations
   - Error scenarios
   - Binary file handling

## Validation Commands

After migration, use these commands to verify changes:

```bash
# Check for remaining RNFS usage
grep -r "RNFS\." ./src && echo "❌ RNFS still found" || echo "✅ RNFS removed"

# Check for new FileSystem usage
grep -r "FileSystem\." ./src && echo "✅ FileSystem found" || echo "⚠️ No FileSystem usage"

# Check imports
grep -r "react-native-fs" ./src && echo "❌ Old imports found" || echo "✅ Imports updated"
grep -r "expo-file-system" ./src && echo "✅ New imports found" || echo "⚠️ No new imports"
```