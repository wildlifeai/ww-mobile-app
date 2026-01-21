// Enable network connectivity after offline testing

function enableNetwork() {
  console.log('Enabling network connectivity...');
  
  // For Android testing
  if (typeof Android !== 'undefined') {
    try {
      Android.shell('cmd connectivity airplane-mode disable');
      Android.shell('cmd wifi set-wifi-enabled true');
      Android.shell('cmd telephony data enable');
      console.log('Network enabled successfully');
      return true;
    } catch (error) {
      console.error('Failed to enable network on Android:', error);
    }
  }
  
  // For iOS testing
  if (typeof iOS !== 'undefined') {
    try {
      iOS.networkConditioner('online');
      console.log('Network enabled successfully (iOS)');
      return true;
    } catch (error) {
      console.error('Failed to enable network on iOS:', error);
    }
  }
  
  // Fallback: Mock network status in app
  try {
    maestro.inject({
      event: 'mock-network-status',
      data: {
        isConnected: true,
        type: 'wifi'
      }
    });
    console.log('Network status mocked as online');
    return true;
  } catch (error) {
    console.error('Failed to mock network status:', error);
    return false;
  }
}

// Execute in IIFE to allow return
(function() {
  const success = enableNetwork();
  if (!success) {
    throw new Error('Failed to enable network connectivity');
  }
  
  // Wait for network stabilization
  setTimeout(() => {
    console.log('Network connectivity restored');
  }, 2000);
  
  return { networkEnabled: true };
})();