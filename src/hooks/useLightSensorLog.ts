import { useState, useCallback, useEffect, useRef } from 'react'
import { Alert, Share } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'

import { log, logError } from '../utils/logger'

const LOG_DIR = FileSystem.documentDirectory + 'light-sensor/'
const LOG_FILE = LOG_DIR + 'readings.json'
const CSV_FILE = LOG_DIR + 'light-sensor-readings.csv'

/**
 * One bench measurement: the AE registers, the app's own verdict by each rule,
 * and the device's verdict when it sent one.
 *
 * The registers are the record; the verdicts are interpretations of them. A
 * row carries every rule's answer so a run can be re-scored without going back
 * to the bench, and so two rules can be compared on identical inputs.
 */
export interface LightReading {
    /** ISO 8601, device-local clock */
    timestamp: string
    /** AE mean 0-255, the sensor's own average scene brightness */
    aeMean: number
    integration: string
    analogGain: string
    digitalGain: string
    /** 'Y' once the sensor's auto-exposure has settled; readings before that drift */
    aeConverged: string
    /**
     * The mean-rule threshold this row was scored against. The app's own value,
     * seeded from op23 but not written back, so it can differ from the device's.
     */
    darkThreshold: number
    deviceName: string
    /** Which rule the operator had selected when this row was taken */
    approach?: 'mean' | 'gain' | 'compare'
    /** The mean rule's verdict from these registers, at `darkThreshold` */
    meanRuleDark?: boolean
    /** Hysteresis band the mean rule used, 0 when off */
    hysteresis?: number
    /** The gain rule's verdict from these registers; absent when gain or convergence was not reported */
    gainRuleDark?: boolean
    /**
     * The firmware's own verdict, when it sent one. Absent on a plain capture
     * with the flash and auto-switch both off, because no light check runs.
     */
    dark?: boolean
    /** The decision line as received, so the verdict can be re-read whatever the wording */
    deviceLine?: string
    /**
     * Both gains at their ceiling, from the decision line. Forces DARK whatever
     * the mean says in the mean-based firmware; not sent by the gain-based one.
     */
    gainRailed?: boolean
    /** Local file path of the frame this reading came from, when one was captured */
    imageUri?: string
    /** Free-text label the operator can attach to a run (e.g. "dusk, 30cm, indoor") */
    note?: string
}

// Existing columns keep their names and order, so a CSV from before the rules
// were added still lines up with a new one in the same spreadsheet.
const CSV_COLUMNS: (keyof LightReading)[] = [
    'timestamp', 'aeMean', 'darkThreshold', 'dark', 'gainRailed', 'integration',
    'analogGain', 'digitalGain', 'aeConverged', 'deviceName', 'note', 'imageUri',
    'approach', 'meanRuleDark', 'hysteresis', 'gainRuleDark', 'deviceLine',
]

/** RFC 4180: quote every field, double any embedded quote. Keeps notes with commas safe. */
const csvCell = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`

export const toCsv = (readings: LightReading[]): string => {
    const header = CSV_COLUMNS.join(',')
    const rows = readings.map(r => CSV_COLUMNS.map(c => csvCell(r[c])).join(','))
    return [header, ...rows].join('\n')
}

/**
 * Persistent log of light-sensor measurements, for researchers characterising how
 * the WW500's AE-based light sensing behaves across conditions.
 *
 * Readings survive app restarts (written to documentDirectory as JSON) so a study
 * can span several sessions, and export produces a CSV — via the share sheet, the
 * clipboard, or a file on disk for `adb pull`.
 */
export const useLightSensorLog = () => {
    const [readings, setReadings] = useState<LightReading[]>([])
    const loadedRef = useRef(false)

    // Restore any previous session's readings once on mount.
    useEffect(() => {
        if (loadedRef.current) return
        loadedRef.current = true
        ;(async () => {
            try {
                const info = await FileSystem.getInfoAsync(LOG_FILE)
                if (!info.exists) return
                const raw = await FileSystem.readAsStringAsync(LOG_FILE)
                const parsed = JSON.parse(raw)
                if (Array.isArray(parsed)) setReadings(parsed)
            } catch (e) {
                // A corrupt log must never block measuring — start fresh instead.
                logError('[LightSensorLog] could not restore readings:', e)
            }
        })()
    }, [])

    const persist = useCallback(async (next: LightReading[]) => {
        try {
            await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true }).catch(() => {})
            await FileSystem.writeAsStringAsync(LOG_FILE, JSON.stringify(next))
        } catch (e) {
            logError('[LightSensorLog] persist failed:', e)
        }
    }, [])

    const addReading = useCallback((reading: LightReading) => {
        setReadings(prev => {
            const next = [...prev, reading]
            persist(next)
            log(`[LightSensorLog] reading #${next.length}: aeMean=${reading.aeMean}`)
            return next
        })
    }, [persist])

    /** Attach or replace the note on the most recent reading. */
    const annotateLast = useCallback((note: string) => {
        setReadings(prev => {
            if (prev.length === 0) return prev
            const next = [...prev]
            next[next.length - 1] = { ...next[next.length - 1], note }
            persist(next)
            return next
        })
    }, [persist])

    const clear = useCallback(() => {
        Alert.alert('Clear readings?', `Deletes all ${readings.length} logged readings. This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Clear', style: 'destructive', onPress: () => {
                    setReadings([])
                    persist([])
                },
            },
        ])
    }, [readings.length, persist])

    /** Write the CSV to disk and offer it through the OS share sheet. */
    const exportCsv = useCallback(async () => {
        if (readings.length === 0) {
            Alert.alert('Nothing to export', 'Take at least one measurement first.')
            return
        }
        const csv = toCsv(readings)
        try {
            await FileSystem.makeDirectoryAsync(LOG_DIR, { intermediates: true }).catch(() => {})
            await FileSystem.writeAsStringAsync(CSV_FILE, csv)
            log(`[LightSensorLog] CSV written to ${CSV_FILE}`)
        } catch (e) {
            logError('[LightSensorLog] CSV write failed:', e)
        }
        try {
            // Shared as text rather than a file attachment: expo-sharing is not a
            // dependency and adding it needs a native rebuild. Text reaches email,
            // notes and chat apps, which is enough to get a CSV off the device.
            await Share.share({
                title: 'WW500 light sensor readings',
                message: csv,
            })
        } catch (e) {
            logError('[LightSensorLog] share failed:', e)
            Alert.alert('Share failed', 'The CSV is on the device — copy it to the clipboard instead.')
        }
    }, [readings])

    return { readings, addReading, annotateLast, clear, exportCsv, csvPath: CSV_FILE }
}
