/**
 * Type declarations for expo-updates module
 *
 * This provides minimal type coverage for the expo-updates API
 * used in the DeveloperSettingsScreen for app restart functionality.
 */

declare module 'expo-updates' {
  /**
   * Reload the app immediately
   *
   * @returns Promise that resolves when the app has reloaded
   */
  export function reloadAsync(): Promise<void>;

  export default {
    reloadAsync,
  };
}
