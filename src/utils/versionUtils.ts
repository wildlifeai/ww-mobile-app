/**
 * Converts MM.mm.bb format (from BLE) to semantic version M.m.b
 * Examples:
 * - "00.21.23" → "0.21.23"
 * - "01.05.01" → "1.5.1"
 */
export const convertBleToSemanticVersion = (bleVersion: string): string => {
    const parts = bleVersion.split('.')
    if (parts.length === 1 && parts[0] === '0') return '0.0.0' // Handle "0" case
    if (parts.length !== 3) return bleVersion

    // Remove leading zeros from each part
    const parsedMajor = parseInt(parts[0], 10)
    const parsedMinor = parseInt(parts[1], 10)
    const parsedBuild = parseInt(parts[2], 10)

    const major = isNaN(parsedMajor) ? 0 : parsedMajor
    const minor = isNaN(parsedMinor) ? 0 : parsedMinor
    const build = isNaN(parsedBuild) ? 0 : parsedBuild

    return `${major}.${minor}.${build}`
}

