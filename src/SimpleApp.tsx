import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Provider as ReduxProvider } from "react-redux";
import store from "./redux";

// Validation test app with interactive buttons
export const SimpleApp = () => {
  const [testResults, setTestResults] = useState([]);
  
  const addTestResult = (testName, success, details = '') => {
    const result = {
      test: testName,
      status: success ? '✅' : '❌',
      details,
      timestamp: new Date().toLocaleTimeString()
    };
    setTestResults(prev => [...prev, result]);
  };

  const testTouch = () => {
    addTestResult('Touch Events', true, 'Button press detected!');
    console.log('Touch Test: PASSED ✅');
  };

  const testFileSystem = async () => {
    try {
      const { documentDirectory, writeAsStringAsync, readAsStringAsync } = require('expo-file-system');
      
      if (!documentDirectory) {
        throw new Error('DocumentDirectory not available');
      }
      
      const testFile = documentDirectory + 'test.txt';
      await writeAsStringAsync(testFile, 'Test data');
      const content = await readAsStringAsync(testFile);
      const success = content === 'Test data';
      addTestResult('File System', success, success ? 'Read/write works' : 'Read/write failed');
      // Use console.log instead of Alert to avoid modal issues
      console.log('File System Test:', success ? 'PASSED ✅' : 'FAILED ❌');
    } catch (e) {
      addTestResult('File System', false, e.message);
      console.log('File System Test FAILED:', e.message);
    }
  };

  const testEnvironment = () => {
    try {
      const Config = require('./utils/environment').default;
      const apiBase = Config.API_BASE;
      const hasApiBase = !!apiBase;
      addTestResult('Environment Config', hasApiBase, hasApiBase ? `API_BASE: ${apiBase}` : 'No API_BASE found');
      console.log('Environment Test:', hasApiBase ? `PASSED ✅ API_BASE: ${apiBase}` : 'FAILED ❌');
    } catch (e) {
      addTestResult('Environment Config', false, e.message);
      console.log('Environment Test FAILED:', e.message);
    }
  };

  const testBLE = async () => {
    try {
      // Test if BLE manager can be imported without crashing
      const BleManager = require('react-native-ble-manager');
      addTestResult('BLE Import', true, 'BLE Manager imported successfully');
      console.log('BLE Import: PASSED ✅');
      
      // Try to check BLE state (this might fail but shouldn't crash)
      try {
        await BleManager.checkState();
        addTestResult('BLE State Check', true, 'BLE state check successful');
        console.log('BLE State Check: PASSED ✅');
      } catch (stateError) {
        addTestResult('BLE State Check', false, stateError.message);
        console.log('BLE State Check: FAILED (expected in dev) ⚠️');
      }
    } catch (e) {
      addTestResult('BLE Import', false, e.message);
      console.log('BLE Import: FAILED ❌', e.message);
    }
  };

  const testMaps = () => {
    try {
      // Test if Maps can be imported
      const MapView = require('react-native-maps');
      addTestResult('Maps Import', true, 'react-native-maps imported successfully');
      console.log('Maps Import: PASSED ✅');
    } catch (e) {
      addTestResult('Maps Import', false, e.message);
      console.log('Maps Import: FAILED ❌', e.message);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <ReduxProvider store={store}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Wildlife Watcher Simple App</Text>
        <Text style={styles.subtitle}>Expo SDK 51 Migration</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.successText}>✅ React Native Loading</Text>
          <Text style={styles.successText}>✅ Redux Store Connected</Text>
          <Text style={styles.successText}>✅ Development Client Working</Text>
          <Text style={styles.successText}>✅ Metro Bundler Connected</Text>
          <Text style={styles.successText}>✅ NativeModule Errors Resolved</Text>
        </View>

        <View style={styles.testSection}>
          <Text style={styles.testTitle}>Phase 1 Validation Tests</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={testTouch}>
            <Text style={styles.buttonText}>Test Touch Events</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testFileSystem}>
            <Text style={styles.buttonText}>Test File System</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testEnvironment}>
            <Text style={styles.buttonText}>Test Environment Config</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testBLE}>
            <Text style={styles.buttonText}>Test BLE Manager</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testMaps}>
            <Text style={styles.buttonText}>Test Maps Import</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.testButton, styles.clearButton]} onPress={clearResults}>
            <Text style={styles.buttonText}>Clear Results</Text>
          </TouchableOpacity>
        </View>

        {testResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Test Results:</Text>
            {testResults.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <Text style={styles.resultText}>
                  {result.status} {result.test} ({result.timestamp})
                </Text>
                {result.details && (
                  <Text style={styles.resultDetails}>{result.details}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.nextStepsContainer}>
          <Text style={styles.nextStepsTitle}>Migration Status:</Text>
          <Text style={styles.nextStepsText}>
            Testing Phase 1 validation criteria before Phase 2 full app restoration.
          </Text>
        </View>
      </ScrollView>
    </ReduxProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2e7d32',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  statusContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  successText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#2e7d32',
  },
  nextStepsContainer: {
    backgroundColor: '#e3f2fd',
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
  },
  nextStepsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#1976d2',
  },
  nextStepsText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    color: '#333',
  },
  testSection: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    elevation: 2,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1976d2',
    textAlign: 'center',
  },
  testButton: {
    backgroundColor: '#2e7d32',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#f57c00',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  resultItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  resultText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  resultDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});