import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import { EmergencyApp } from './src/EmergencyApp';

console.log("Loading emergency bulletproof app to test touch system...");

AppRegistry.registerComponent(appName, () => EmergencyApp);