export type ExpoSettingsModuleEvents = {
  DFUStateChanged: (params: DFUStateChangedPayload) => void
  DFUProgress: (params: DFUProgressPayload) => void
}

export type DFUStateChangedPayload = {
  state: string
  deviceAddress: string
}

export type DFUProgressPayload = {
  deviceAddress: string
  percent: number
  speed: number
  avgSpeed: number
  currentPart: number
  totalParts: number
}

export type StartDFUParams = {
  deviceAddress: string
  fileUri: string
  packetReceiptNotificationParameter?: number
  prepareDataObjectDelay?: number
  android?: {
    deviceName?: string
    keepBond?: boolean
    numberOfRetries?: number
    // See android/src/main/java/com/getquip/nordic/ExpoNordicDfuModule.kt
    // rebootTime?: number;
    // restoreBond?: boolean;
  }
  ios?: {
    connectionTimeout?: number
    disableResume?: boolean
  }
}
