/**
 * MockLoRaWANService - Mock implementation for LoRaWAN device status
 *
 * Phase 1: Provides realistic mock data for development
 * Phase 2: Will be replaced with real webhook data integration from backend
 *
 * Simulates:
 * - Device battery levels (60-100%)
 * - SD card usage (20-80%)
 * - Device counts per project
 * - Last update timestamps
 */

import type { LoRaWANDeviceStatus } from '../types/project';

class MockLoRaWANService {
  /**
   * Get device status for project (MOCK)
   * Real implementation will use webhook data from backend
   */
  async getProjectDeviceStatus(projectId: string): Promise<LoRaWANDeviceStatus> {
    // Simulate realistic data with some variation
    const deviceCount = Math.floor(Math.random() * 15) + 1; // 1-15 devices
    const batteryLevel = Math.floor(Math.random() * 40) + 60; // 60-100%
    const sdCardUsage = Math.floor(Math.random() * 60) + 20; // 20-80%

    return {
      project_id: projectId,
      device_count: deviceCount,
      battery_level: batteryLevel,
      sd_card_usage: sdCardUsage,
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Get device statuses for multiple projects (batch)
   * Useful for dashboard/list views showing multiple projects
   */
  async getBatchDeviceStatus(projectIds: string[]): Promise<LoRaWANDeviceStatus[]> {
    return Promise.all(projectIds.map(id => this.getProjectDeviceStatus(id)));
  }

  /**
   * Simulate device status update (mock)
   * In production, this would trigger a webhook or API call to update LoRaWAN status
   */
  async updateDeviceStatus(
    projectId: string,
    batteryLevel: number,
    sdCardUsage: number
  ): Promise<LoRaWANDeviceStatus> {
    // Validate ranges
    const validBattery = Math.max(0, Math.min(100, batteryLevel));
    const validSDCard = Math.max(0, Math.min(100, sdCardUsage));

    return {
      project_id: projectId,
      device_count: Math.floor(Math.random() * 15) + 1,
      battery_level: validBattery,
      sd_card_usage: validSDCard,
      last_updated: new Date().toISOString(),
    };
  }

  /**
   * Get historical device status trend (mock)
   * Returns array of status snapshots over time
   */
  async getDeviceStatusHistory(
    projectId: string,
    daysBack: number = 7
  ): Promise<LoRaWANDeviceStatus[]> {
    const history: LoRaWANDeviceStatus[] = [];
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < daysBack; i++) {
      const timestamp = new Date(now - (i * dayInMs));

      // Simulate degrading battery and increasing SD card usage over time
      const batteryLevel = Math.max(60, 100 - (i * 5));
      const sdCardUsage = Math.min(80, 20 + (i * 8));

      history.push({
        project_id: projectId,
        device_count: Math.floor(Math.random() * 15) + 1,
        battery_level: batteryLevel,
        sd_card_usage: sdCardUsage,
        last_updated: timestamp.toISOString(),
      });
    }

    return history.reverse(); // Return oldest to newest
  }
}

export default new MockLoRaWANService();
