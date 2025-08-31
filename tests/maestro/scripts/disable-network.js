// Disable network connectivity for offline testing
// This script simulates network disconnection

function disableNetwork() {
  console.log('Disabling network connectivity for offline testing...');
  
  // For Android testing
  if (typeof Android !== 'undefined') {
    try {
      // Simulate airplane mode
      Android.shell('cmd connectivity airplane-mode enable');
      Android.shell('cmd wifi set-wifi-enabled false');
      Android.shell('cmd telephony data disable');
      console.log('Network disabled successfully');
      return true;
    } catch (error) {
      console.error('Failed to disable network on Android:', error);
    }
  }
  
  // For iOS testing
  if (typeof iOS !== 'undefined') {
    try {
      // iOS network simulation
      iOS.networkConditioner('offline');
      console.log('Network disabled successfully (iOS)');
      return true;
    } catch (error) {
      console.error('Failed to disable network on iOS:', error);
    }
  }
  
  // Fallback: Mock network status in app
  try {
    maestro.inject({
      event: 'mock-network-status',
      data: {
        isConnected: false,
        type: 'none'
      }
    });
    console.log('Network status mocked as offline');
    return true;
  } catch (error) {
    console.error('Failed to mock network status:', error);
    return false;
  }
}

// Execute network disable
const success = disableNetwork();
if (!success) {
  throw new Error('Failed to disable network connectivity');
}

console.log('Network connectivity disabled for offline testing');
return { networkDisabled: true };