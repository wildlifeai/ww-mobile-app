/**
 * Maps Navigation Screen
 *
 * Integration wrapper for foundational MapScreen component
 * NOTE: Deployment markers will be added in Task 19 (requires Tasks 15-17 data)
 */

import { MapScreen } from "../../features/maps"

/**
 * Export foundational map screen for bottom navigation
 * Zero dependencies - ready to test immediately
 *
 * FUTURE (Task 19):
 * - Add deployment markers from Task 15-17 data
 * - Add device status indicators from Task 18
 * - Add organization boundaries from Task 12-14
 * - Add marker clustering for high-density areas
 */
export const Maps = MapScreen
