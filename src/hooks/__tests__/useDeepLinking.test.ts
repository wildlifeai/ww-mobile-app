/**
 * Unit tests for useDeepLinking hook
 * These tests verify deep link handling for authentication flows
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { useDeepLinking } from '../useDeepLinking';
import { mockNavigation, resetAllMocks } from '../../test/utils/testUtils';
import { mockDeepLinks } from '../../test/fixtures/auth';

// Mock the useAppNavigation hook
jest.mock('../useAppNavigation', () => ({
  useAppNavigation: () => mockNavigation,
}));

// Mock Linking with more detailed implementation
const mockLinking = {
  getInitialURL: jest.fn(),
  parse: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};

// Override the mock with our detailed implementation
Object.assign(Linking, mockLinking);

describe('useDeepLinking Hook', () => {
  beforeEach(() => {
    resetAllMocks();
    jest.clearAllMocks();
    
    // Default mock implementations
    mockLinking.getInitialURL.mockResolvedValue(null);
    mockLinking.addEventListener.mockReturnValue({ remove: jest.fn() });
    mockLinking.parse.mockImplementation((url: string) => {
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
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving password reset URL
    urlHandler({ url: mockDeepLinks.passwordReset });
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword', {
        token: 'test-token',
        mode: 'reset',
      });
    });
  });

  test('should not navigate for password reset with invalid token', async () => {
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving invalid password reset URL
    urlHandler({ url: mockDeepLinks.passwordResetInvalid });
    
    await waitFor(() => {
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  test('should navigate to Login screen for email confirmation deep link', async () => {
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving email confirmation URL
    urlHandler({ url: mockDeepLinks.emailConfirmation });
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login', {
        confirmed: true,
      });
    });
  });

  test('should not navigate for email confirmation with invalid token', async () => {
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving invalid email confirmation URL
    urlHandler({ url: mockDeepLinks.emailConfirmationInvalid });
    
    await waitFor(() => {
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  test('should handle general auth callback URLs', async () => {
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    mockLinking.parse.mockReturnValue({
      hostname: 'localhost',
      path: '/callback',
      queryParams: {
        token_hash: 'test-token',
        type: 'signup',
      },
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving general callback URL
    urlHandler({ url: mockDeepLinks.generalCallback });
    
    await waitFor(() => {
      expect(mockNavigation.navigate).toHaveBeenCalledWith('Login', {
        confirmed: true,
      });
    });
  });

  test('should not navigate for unrecognized deep links', async () => {
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving unrecognized URL
    urlHandler({ url: mockDeepLinks.invalidUrl });
    
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
    
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving password reset URL
    urlHandler({ url: mockDeepLinks.passwordReset });
    
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('useDeepLinking hook initialized');
      expect(consoleSpy).toHaveBeenCalledWith('Processing deep link:', mockDeepLinks.passwordReset);
      expect(consoleSpy).toHaveBeenCalledWith('Found reset-password in path');
      expect(consoleSpy).toHaveBeenCalledWith('Navigating to ForgotPassword with token');
    });
    
    consoleSpy.mockRestore();
  });

  test('should handle malformed URLs gracefully', async () => {
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    // Mock parse to simulate malformed URL
    mockLinking.parse.mockReturnValue({
      hostname: null,
      path: null,
      queryParams: {},
    });
    
    renderHook(() => useDeepLinking());
    
    // Should not throw error with malformed URL
    expect(() => {
      urlHandler({ url: 'malformed-url' });
    }).not.toThrow();
    
    await waitFor(() => {
      expect(mockNavigation.navigate).not.toHaveBeenCalled();
    });
  });

  test('should handle multiple simultaneous deep links', async () => {
    let urlHandler: any;
    
    mockLinking.addEventListener.mockImplementation((event, handler) => {
      urlHandler = handler;
      return { remove: jest.fn() };
    });
    
    renderHook(() => useDeepLinking());
    
    // Simulate receiving multiple URLs rapidly
    urlHandler({ url: mockDeepLinks.passwordReset });
    urlHandler({ url: mockDeepLinks.emailConfirmation });
    
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