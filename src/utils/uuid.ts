let expoCrypto = null
try {
    expoCrypto = require('expo-crypto')
} catch (_) {
    expoCrypto = null
}

let rnUuid = null
try {
    rnUuid = require('react-native-uuid')
} catch (_) {
    rnUuid = null
}

// Always returns a string UUID
export function generateUUID(): string {
    // Expo
    if (expoCrypto && typeof expoCrypto.randomUUID === 'function') {
        return expoCrypto.randomUUID()
    }

    // React Native CLI
    if (rnUuid && typeof rnUuid.v4 === 'function') {
        return rnUuid.v4() as string
    }

    console.warn('[UUID] No native library found, using fallback')
    return `fallback-${Math.random().toString(36).substring(2)}-${Date.now()}`
}
