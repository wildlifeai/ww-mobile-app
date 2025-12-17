import * as Crypto from 'expo-crypto'

// Always returns a string UUID using native crypto
export function generateUUID(): string {
    return Crypto.randomUUID()
}

