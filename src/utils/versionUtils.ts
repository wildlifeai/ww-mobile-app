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

/**
 * Strips build number from database version format
 * Examples:
 * - "0.21.4-23" → "0.21.4"
 * - "0.21.4" → "0.21.4"
 */
export const stripBuildNumber = (version: string): string => {
    return version.split('-')[0]
}

/**
 * Simple semantic version comparison
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export const compareSemanticVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(p => parseInt(p, 10))
    const parts2 = v2.split('.').map(p => parseInt(p, 10))

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0
        const p2 = parts2[i] || 0

        if (p1 < p2) return -1
        if (p1 > p2) return 1
    }

    return 0
}
