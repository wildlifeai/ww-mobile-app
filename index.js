import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import { SimpleApp } from './src/SimpleApp';

console.log("Loading simplified Wildlife Watcher app with working Redux store...");

AppRegistry.registerComponent(appName, () => SimpleApp);