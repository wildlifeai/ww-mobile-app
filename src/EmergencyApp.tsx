import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Provider as ReduxProvider } from "react-redux";
import store from "./redux";

// Bulletproof validation app with safe error handling
export const EmergencyApp = () => {
  const [touchCount, setTouchCount] = useState(0);
  const [lastTouch, setLastTouch] = useState('Never');
  const [testResults, setTestResults] = useState<Array<{test: string, status: string, details: string, time: string}>>([]);

  const handleTouch = () => {
    const now = new Date().toLocaleTimeString();
    setTouchCount(prev => prev + 1);
    setLastTouch(now);
    console.log(`Touch ${touchCount + 1} at ${now}`);
  };

  const safeTest = async (testName, testFn) => {
    try {
      console.log(`Starting ${testName}...`);
      const result = await testFn();
      const successResult = { test: testName, status: '✅', details: result || 'Passed', time: new Date().toLocaleTimeString() };
      setTestResults(prev => [successResult, ...prev]);
      console.log(`${testName}: PASSED ✅`);
    } catch (error) {
      const errorResult = { test: testName, status: '❌', details: error.message || 'Unknown error', time: new Date().toLocaleTimeString() };
      setTestResults(prev => [errorResult, ...prev]);
      console.log(`${testName}: FAILED ❌`, error.message);
    }
  };

  const testFileSystem = () => safeTest('File System', async () => {
    // Use our new file system wrapper with fallback
    const FileSystem = require('./utils/fileSystem').default;
    
    // Check if documentDirectory is accessible
    const docDir = FileSystem.documentDirectory;
    if (!docDir) {
      throw new Error('documentDirectory not available');
    }
    
    const testFile = docDir + 'test.txt';
    await FileSystem.writeAsStringAsync(testFile, 'Test data');
    const content = await FileSystem.readAsStringAsync(testFile);
    
    if (content !== 'Test data') {
      throw new Error('File read/write mismatch');
    }
    
    const storageInfo = FileSystem.getStorageInfo();
    return `File ops work! Mode: ${storageInfo.mode} | Dir: ${docDir}`;
  });

  const testEnvironment = () => safeTest('Environment', async () => {
    const Config = require('./utils/environment').default;
    const apiBase = Config.API_BASE;
    const isDev = Config.IS_DEVELOPMENT;
    const bundleId = Config.BUNDLE_IDENTIFIER;
    
    if (!apiBase) {
      throw new Error('API_BASE not found after fallback');
    }
    
    return `API_BASE: ${apiBase} | Dev: ${isDev} | Bundle: ${bundleId}`;
  });

  const testBLE = () => safeTest('BLE Manager', async () => {
    const BleManager = require('react-native-ble-manager');
    
    // Just test import - don't try to use BLE functions that need permissions
    if (!BleManager) {
      throw new Error('BLE Manager not available');
    }
    
    return 'BLE Manager imported successfully';
  });

  const testMaps = () => safeTest('Maps', async () => {
    const Maps = require('react-native-maps');
    
    if (!Maps.default && !Maps.MapView) {
      throw new Error('Maps components not available');
    }
    
    return 'Maps components imported successfully';
  });

  return (
    <ReduxProvider store={store}>
      <View style={styles.container}>
        <Text style={styles.title}>Bulletproof Phase 1 Tests</Text>
        
        <View style={styles.statusBox}>
          <Text style={styles.status}>Touch Count: {touchCount}</Text>
          <Text style={styles.status}>Last Touch: {lastTouch}</Text>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleTouch}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>TEST TOUCH</Text>
        </TouchableOpacity>

        <View style={styles.testSection}>
          <TouchableOpacity style={styles.testButton} onPress={testFileSystem}>
            <Text style={styles.buttonText}>Test File System</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testEnvironment}>
            <Text style={styles.buttonText}>Test Environment</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testBLE}>
            <Text style={styles.buttonText}>Test BLE</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testMaps}>
            <Text style={styles.buttonText}>Test Maps</Text>
          </TouchableOpacity>
        </View>

        {testResults.length > 0 && (
          <View style={styles.resultsBox}>
            <Text style={styles.resultsTitle}>Test Results:</Text>
            {testResults.slice(0, 3).map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result.status} {result.test}: {result.details}
              </Text>
            ))}
          </View>
        )}

        <TouchableOpacity 
          style={[styles.button, styles.resetButton]} 
          onPress={() => {
            setTouchCount(0);
            setLastTouch('Reset');
            setTestResults([]);
            console.log('Reset all tests');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>RESET ALL</Text>
        </TouchableOpacity>
      </View>
    </ReduxProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  statusBox: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    minWidth: 200,
    alignItems: 'center',
  },
  status: {
    fontSize: 16,
    marginBottom: 5,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
    minWidth: 150,
    alignItems: 'center',
  },
  resetButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 16,
  },
  testSection: {
    width: '100%',
    marginVertical: 20,
  },
  testButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginBottom: 8,
    alignItems: 'center',
  },
  resultsBox: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  resultText: {
    fontSize: 12,
    marginBottom: 4,
    color: '#555',
  },
});