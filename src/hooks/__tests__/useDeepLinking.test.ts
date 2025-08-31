/**
 * Unit tests for useDeepLinking hook
 * These tests verify deep link handling for authentication flows
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { useDeepLinking } from '../useDeepLinking';
import { mockNavigation, resetAllMocks } from '../../../tests/setup/utils/testUtils';
import { mockDeepLinks } from '../../../tests/setup/fixtures/auth';

// Mock the useAppNavigation hook
jest.mock('../useAppNavigation', () => ({
  useAppNavigation: () => mockNavigation,
}));

// Mock expo-linking properly
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(),
  parse: jest.fn(),
  addEventListener: jest.fn(),
}));

// Type definitions for mocked Linking module
const mockLinking = Linking as jest.Mocked<typeof Linking>;

// URL handler type for better type safety
type URLHandler = (event: { url: string }) => void;

describe('useDeepLinking Hook', () => {
  let capturedURLHandler: URLHandler | null = null;

  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    capturedURLHandler = null;
    
    // Default mock implementations with proper typing
    mockLinking.getInitialURL.mockResolvedValue(null);
    
    mockLinking.addEventListener.mockImplementation((event: string, handler: URLHandler) => {
      if (event === 'url') {
        capturedURLHandler = handler;
      }
      return { remove: jest.fn() };
    });
    
    mockLinking.parse.mockImplementation((url: string) => {
      try {
        // For wildlifewatcher URLs, we need to parse them differently
        if (url.startsWith('wildlifewatcher://')) {
          const withoutScheme = url.replace('wildlifewatcher://', '');
          const [pathPart, queryPart] = withoutScheme.split('?');
          
          const queryParams: Record<string, string> = {};
          if (queryPart) {
            const searchParams = new URLSearchParams(queryPart);
            searchParams.forEach((value, key) => {
              queryParams[key] = value;
            });
          }
          
          return {
            hostname: null, // Not really applicable for deep links
            path: `/${pathPart}`, // This is what the hook checks
            queryParams,
          };
        }
        
        // Fallback for other URLs
        const urlObj = new URL(url.replace('wildlifewatcher://', 'https://'));
        const searchParams = new URLSearchParams(urlObj.search);
        const queryParams: Record<string, string> = {};
        
        searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });
        
        return {
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          queryParams,
        };
      } catch (error) {
        // Handle malformed URLs
        return {
          hostname: null,
          path: null,
          queryParams: {},
        };
      }
    });
  });

  test('should initialize deep linking listener', () => {
    renderHook(() => useDeepLinking());
    
    expect(mockLinking.addEventListener).toHaveBeenCalledWith(
      'url',
      expect.any(Function)
    );
  });

  test('should handle initial URL on mount', async () => {
    mockLinking.getInitialURL.mockResolvedValue(mockDeepLinks.passwordReset);
    
    renderHook(() => useDeepLinking());
    
    await waitFor(() => {
      expect(mockLinking.getInitialURL).toHaveBeenCalledTimes(1);
    });
  });

  test('should navigate to ForgotPassword screen for password reset deep link', async () => {
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving password reset URL
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.passwordReset });
    }
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword', {
        token: 'test-token',
        mode: 'reset',
      });
    });
  });

  test('should not navigate for password reset with invalid token', async () => {
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving invalid password reset URL
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.passwordResetInvalid });
    }
    
    await waitFor(() => {
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  test('should navigate to Login screen for email confirmation deep link', async () => {
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving email confirmation URL
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.emailConfirmation });
    }
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login', {
        confirmed: true,
      });
    });
  });

  test('should not navigate for email confirmation with invalid token', async () => {
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving invalid email confirmation URL
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.emailConfirmationInvalid });
    }
    
    await waitFor(() => {
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  test('should handle general auth callback URLs', async () => {
    // Override parse for this specific test
    mockLinking.parse.mockReturnValue({
      hostname: 'localhost',
      path: '/callback',
      queryParams: {
        token_hash: 'test-token',
        type: 'signup',
      },
    });
    
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving general callback URL
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.generalCallback });
    }
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login', {
        confirmed: true,
      });
    });
  });

  test('should not navigate for unrecognized deep links', async () => {
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving unrecognized URL
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.invalidUrl });
    }
    
    await waitFor(() => {
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  test('should clean up event listener on unmount', () => {
    const mockRemove = jest.fn();
    
    mockLinking.addEventListener.mockReturnValue({ remove: mockRemove });
    
    const { unmount } = renderHook(() => useDeepLinking());
    
    unmount();
    
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  test('should handle initial URL with password reset', async () => {
    mockLinking.getInitialURL.mockResolvedValue(mockDeepLinks.passwordReset);
    
    renderHook(() => useDeepLinking());
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword', {
        token: 'test-token',
        mode: 'reset',
      });
    });
  });

  test('should handle initial URL with email confirmation', async () => {
    mockLinking.getInitialURL.mockResolvedValue(mockDeepLinks.emailConfirmation);
    
    renderHook(() => useDeepLinking());
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login', {
        confirmed: true,
      });
    });
  });

  test('should log appropriate messages for debugging', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving password reset URL
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.passwordReset });
    }
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('useDeepLinking hook initialized');
      expect(consoleSpy).toHaveBeenCalledWith('Processing deep link:', mockDeepLinks.passwordReset);
      expect(consoleSpy).toHaveBeenCalledWith('Found reset-password in path');
      expect(consoleSpy).toHaveBeenCalledWith('Navigating to ForgotPassword with token');
    });
    
    consoleSpy.mockRestore();
  });

  test('should handle malformed URLs gracefully', async () => {
    // Mock parse to simulate malformed URL
    mockLinking.parse.mockReturnValue({
      hostname: null,
      path: null,
      queryParams: {},
    });
    
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Should not throw error with malformed URL
    expect(() => {
      if (capturedURLHandler) {
        capturedURLHandler({ url: 'malformed-url' });
      }
    }).not.toThrow();
    
    await waitFor(() => {
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  test('should handle multiple simultaneous deep links', async () => {
    renderHook(() => useDeepLinking());
    
    // Ensure handler was captured
    expect(capturedURLHandler).toBeDefined();
    
    // Simulate receiving multiple URLs rapidly
    if (capturedURLHandler) {
      capturedURLHandler({ url: mockDeepLinks.passwordReset });
      capturedURLHandler({ url: mockDeepLinks.emailConfirmation });
    }
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledTimes(2);
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword', {
        token: 'test-token',
        mode: 'reset',
      });
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login', {
        confirmed: true,
      });
    });
  });
});