/**
 * Converts MM.mm.bb format (from BLE) to semantic version M.m.b
 * Examples:
 * - "00.21.23" → "0.21.23"
 * - "01.05.01" → "1.5.1"
 */
export const convertBleToSemanticVersion = (bleVersion: string): string => {
    // Attempt to match the first pattern that looks like a version number (e.g., 00.30.03 or 1.2.3)
    const match = bleVersion.match(/(\d+)\.(\d+)\.(\d+)/)
    
    if (match) {
        const major = parseInt(match[1], 10)
        const minor = parseInt(match[2], 10)
        const build = parseInt(match[3], 10)
        return `${major}.${minor}.${build}`
    }

    // Handle "0" case or other fallback
    if (bleVersion === '0') return '0.0.0'

    return bleVersion
}

