import { useMemo } from 'react';
import { useAppSelector } from '../redux';
import { CommandNames } from '../ble/types';

export interface DeviceCapabilities {
    boardType: string;
    firmwareVersion: string;
    aiVersion: string;
    hasSdCard: boolean;
    batterySystem: '3.3V' | '7.4V' | 'Unknown';
    operationalParams: number[];
    isHighVoltage: boolean;
    model: 'WW500' | 'WW130' | 'Unknown';
}

/**
 * Hook to determine device capabilities based on its type and configuration.
 * 
 * Logic derived from hardware source code:
 * - WW500-A00 (3.3V system, has SPI SD Card)
 * - WW500-C02 (7.4V system, no SPI SD Card)
 */
export const useDeviceCapabilities = (peripheralId: string): DeviceCapabilities => {
    const config = useAppSelector((state) => state.configuration[peripheralId]);

    return useMemo(() => {
        // boardType comes from 'device' command
        const boardType = config?.[CommandNames.device]?.value || 'Unknown';
        // firmwareVersion comes from 'ver' command
        // Format: "WW500-C02 V 1.0.0 12:00:00 Dec 23 2025"
        const verString = config?.[CommandNames.ver]?.value || 'Unknown';
        const aiVersion = config?.[CommandNames.ai_ver]?.value || 'Unknown';

        // Parse operational parameters array from 'getops' command
        const opParamsStr = config?.[CommandNames.getops]?.value;
        const operationalParams = opParamsStr ? opParamsStr.split(' ').filter(s => s !== '').map(Number) : [];

        // Hardware-specific identification
        const isWW500 = boardType.includes('WW500');
        const isWW130 = boardType.includes('WW130');

        const isA00 = boardType.includes('A00');
        const isC01 = boardType.includes('C01');
        const isC02 = boardType.includes('C02');
        const isCSeries = isC01 || isC02;

        const capabilities: DeviceCapabilities = {
            boardType,
            firmwareVersion: verString,
            aiVersion,
            // WW500-A00 has SD card (via SPI), WW500-C02 does not (uses AI module storage via I2C/Serial)
            hasSdCard: isA00 || isWW130,
            batterySystem: isCSeries ? '7.4V' : (isWW500 || isWW130 ? '3.3V' : 'Unknown'),
            isHighVoltage: isCSeries,
            model: isWW500 ? 'WW500' : (isWW130 ? 'WW130' : 'Unknown'),
            operationalParams,
        };

        return capabilities;
    }, [config]);
};
