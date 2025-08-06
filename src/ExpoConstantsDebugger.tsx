import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Provider as ReduxProvider } from 'react-redux';
import store from './redux';

/**
 * Deep debugging screen for expo-constants NativeModule issues
 * Systematic investigation of initialization, timing, and module state
 */
export const ExpoConstantsDebugger = () => {
  const [debugResults, setDebugResults] = useState<Array<{step: string, status: string, details: string, timestamp: string}>>([]);
  const [moduleState, setModuleState] = useState<any>({});

  const addResult = (step: string, status: 'PASS' | 'FAIL' | 'INFO', details: string) => {
    const result = {
      step,
      status: status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : 'ℹ️',
      details,
      timestamp: new Date().toLocaleTimeString()
    };
    setDebugResults(prev => [result, ...prev]);
    console.log(`[Constants Debug] ${step}: ${status} - ${details}`);
  };

  const safeDebugStep = async (stepName: string, debugFn: () => Promise<any> | any) => {
    try {
      const result = await debugFn();
      addResult(stepName, 'PASS', typeof result === 'string' ? result : JSON.stringify(result));
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addResult(stepName, 'FAIL', errorMsg);
      throw error;
    }
  };

  // Step 1: Check if expo-constants module exists in node_modules
  const checkModuleExists = () => safeDebugStep('Module Exists Check', () => {
    try {
      const packageJson = require('expo-constants/package.json');
      return `Found expo-constants v${packageJson.version}`;
    } catch (e) {
      throw new Error('expo-constants package not found in node_modules');
    }
  });

  // Step 2: Check React Native bridge availability
  const checkBridge = () => safeDebugStep('React Native Bridge Check', () => {
    const { NativeModules, Platform } = require('react-native');
    
    if (!NativeModules) {
      throw new Error('NativeModules not available');
    }
    
    const moduleNames = Object.keys(NativeModules);
    return `Platform: ${Platform.OS}, NativeModules count: ${moduleNames.length}`;
  });

  // Step 3: List all available native modules
  const listNativeModules = () => safeDebugStep('Native Modules Inventory', () => {
    const { NativeModules } = require('react-native');
    const moduleNames = Object.keys(NativeModules);
    
    const expoModules = moduleNames.filter(name => 
      name.toLowerCase().includes('expo') || 
      name.toLowerCase().includes('constants')
    );
    
    return `Total: ${moduleNames.length}, Expo-related: ${expoModules.join(', ') || 'None'}`;
  });

  // Step 4: Direct NativeModule access attempt
  const checkDirectNativeModule = () => safeDebugStep('Direct NativeModule Access', () => {
    const { NativeModules } = require('react-native');
    
    // Check for various possible expo-constants native module names
    const possibleNames = [
      'ExponentConstants',
      'ExpoConstants', 
      'Constants',
      'ExpConstants',
      'RNCConstants'
    ];
    
    for (const name of possibleNames) {
      if (NativeModules[name]) {
        setModuleState(prev => ({...prev, nativeModuleName: name, nativeModule: NativeModules[name]}));
        return `Found native module: ${name}`;
      }
    }
    
    throw new Error(`No constants native module found. Checked: ${possibleNames.join(', ')}`);
  });

  // Step 5: Import expo-constants with detailed error tracking
  const importExpoConstants = () => safeDebugStep('Import expo-constants', () => {
    let ExpoConstants;
    
    try {
      // Try different import methods
      ExpoConstants = require('expo-constants');
      setModuleState(prev => ({...prev, rawImport: ExpoConstants}));
      
      if (!ExpoConstants) {
        throw new Error('require() returned null/undefined');
      }
      
      return `Import successful, type: ${typeof ExpoConstants}`;
    } catch (e) {
      throw new Error(`Import failed: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  });

  // Step 6: Access .default export
  const accessDefaultExport = () => safeDebugStep('Access .default Export', () => {
    const ExpoConstants = require('expo-constants');
    
    if (!ExpoConstants.default) {
      throw new Error('.default export not available');
    }
    
    const defaultExport = ExpoConstants.default;
    setModuleState(prev => ({...prev, defaultExport}));
    
    return `Default export type: ${typeof defaultExport}, keys: ${Object.keys(defaultExport).join(', ')}`;
  });

  // Step 7: Access common properties with timing
  const accessProperties = () => safeDebugStep('Access Properties', async () => {
    const Constants = require('expo-constants').default;
    
    // Add delays to test timing issues
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const props = ['expoConfig', 'manifest', 'appOwnership', 'deviceName', 'platform'];
    const results: string[] = [];
    
    for (const prop of props) {
      try {
        const value = Constants[prop];
        results.push(`${prop}: ${typeof value}`);
        
        if (prop === 'expoConfig' && value) {
          setModuleState(prev => ({...prev, expoConfig: value}));
        }
      } catch (e) {
        results.push(`${prop}: ERROR - ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }
    
    return results.join(', ');
  });

  // Step 8: Deep dive into expoConfig.extra
  const accessExtraConfig = () => safeDebugStep('Access expoConfig.extra', () => {
    const Constants = require('expo-constants').default;
    
    if (!Constants.expoConfig) {
      throw new Error('expoConfig not available');
    }
    
    if (!Constants.expoConfig.extra) {
      throw new Error('expoConfig.extra not available');
    }
    
    const extra = Constants.expoConfig.extra;
    setModuleState(prev => ({...prev, extra}));
    
    const keys = Object.keys(extra);
    return `Extra config keys: ${keys.join(', ')}`;
  });

  // Step 9: Test with different timing delays
  const testWithDelays = () => safeDebugStep('Test with Delays', async () => {
    const delays = [0, 50, 100, 200, 500, 1000];
    const results: string[] = [];
    
    for (const delay of delays) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay));
        const Constants = require('expo-constants').default;
        const apiBase = Constants.expoConfig?.extra?.apiBase;
        results.push(`${delay}ms: ${apiBase ? 'SUCCESS' : 'NO_API_BASE'}`);
      } catch (e) {
        results.push(`${delay}ms: ERROR`);
      }
    }
    
    return results.join(', ');
  });

  // Step 10: Environment variables investigation
  const checkEnvironmentVars = () => safeDebugStep('Environment Variables', () => {
    const env = process.env;
    const expoVars = Object.keys(env).filter(key => 
      key.includes('EXPO') || key.includes('API') || key.includes('GOOGLE')
    );
    
    const varInfo = expoVars.map(key => `${key}=${env[key] ? '***SET***' : 'UNSET'}`);
    return `Found ${expoVars.length} relevant vars: ${varInfo.join(', ')}`;
  });

  const runAllTests = async () => {
    setDebugResults([]);
    setModuleState({});
    
    addResult('Starting Diagnostic', 'INFO', 'Beginning comprehensive expo-constants investigation');
    
    try {
      await checkModuleExists();
      await checkBridge();
      await listNativeModules();
      await checkDirectNativeModule();
      await importExpoConstants();
      await accessDefaultExport();
      await accessProperties();
      await accessExtraConfig();
      await testWithDelays();
      await checkEnvironmentVars();
      
      addResult('Diagnostic Complete', 'PASS', 'All tests completed - check individual results');
    } catch (error) {
      addResult('Diagnostic Failed', 'FAIL', `Stopped at error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  const clearResults = () => {
    setDebugResults([]);
    setModuleState({});
  };

  return (
    <ReduxProvider store={store}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>expo-constants Deep Debugger</Text>
        <Text style={styles.subtitle}>Systematic NativeModule Investigation</Text>
        
        <View style={styles.controlSection}>
          <TouchableOpacity style={styles.runButton} onPress={runAllTests}>
            <Text style={styles.buttonText}>Run Full Diagnostic</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
            <Text style={styles.buttonText}>Clear Results</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.individualTests}>
          <Text style={styles.sectionTitle}>Individual Tests:</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={checkModuleExists}>
            <Text style={styles.testButtonText}>1. Module Exists</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={checkBridge}>
            <Text style={styles.testButtonText}>2. RN Bridge</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={listNativeModules}>
            <Text style={styles.testButtonText}>3. List Modules</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={checkDirectNativeModule}>
            <Text style={styles.testButtonText}>4. Direct Access</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={importExpoConstants}>
            <Text style={styles.testButtonText}>5. Import Module</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={accessDefaultExport}>
            <Text style={styles.testButtonText}>6. Default Export</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={accessProperties}>
            <Text style={styles.testButtonText}>7. Properties</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={accessExtraConfig}>
            <Text style={styles.testButtonText}>8. Extra Config</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={testWithDelays}>
            <Text style={styles.testButtonText}>9. Timing Test</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.testButton} onPress={checkEnvironmentVars}>
            <Text style={styles.testButtonText}>10. Env Vars</Text>
          </TouchableOpacity>
        </View>

        {Object.keys(moduleState).length > 0 && (
          <View style={styles.stateSection}>
            <Text style={styles.sectionTitle}>Module State:</Text>
            <Text style={styles.stateText}>{JSON.stringify(moduleState, null, 2)}</Text>
          </View>
        )}

        {debugResults.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Debug Results:</Text>
            {debugResults.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <Text style={styles.resultHeader}>
                  {result.status} {result.step} ({result.timestamp})
                </Text>
                <Text style={styles.resultDetails}>{result.details}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Investigation Goal:</Text>
          <Text style={styles.infoText}>
            Find the exact point where expo-constants fails with "Cannot read property 'NativeModule' of undefined" 
            and determine if it's timing, initialization, or configuration related.
          </Text>
        </View>
      </ScrollView>
    </ReduxProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
    color: '#d32f2f',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
    fontStyle: 'italic',
  },
  controlSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  runButton: {
    backgroundColor: '#d32f2f',
    padding: 15,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
  },
  clearButton: {
    backgroundColor: '#757575',
    padding: 15,
    borderRadius: 8,
    flex: 0.48,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  individualTests: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  testButton: {
    backgroundColor: '#1976d2',
    padding: 10,
    borderRadius: 5,
    marginBottom: 5,
    alignItems: 'center',
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  stateSection: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  stateText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
  resultsSection: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  resultItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 3,
    color: '#333',
  },
  resultDetails: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  infoSection: {
    backgroundColor: '#fff3e0',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#e65100',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#555',
  },
});