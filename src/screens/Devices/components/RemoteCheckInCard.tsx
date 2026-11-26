import { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card, Text, useTheme } from 'react-native-paper'
import { Q } from '@nozbe/watermelondb'
import database from '../../../database'
import type Deployment from '../../../database/models/Deployment'
import type Firmware from '../../../database/models/Firmware'
import { useRemoteCheckIns, remoteState } from '../../../hooks/useRemoteCheckIns'
import { CAMERA_STATE, healthReasonTexts, silenceText } from '../../../utils/cameraHealth'
import { friendlyVersion } from '../../../utils/firmwareWords'

/** "15 min ago", "2 h ago", "3 days ago" */
const agoText = (iso: string, now: number): string => {
    const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
    if (mins < 60) return `${mins} min ago`
    const hours = Math.round(mins / 60)
    if (hours < 48) return `${hours} h ago`
    return `${Math.round(hours / 24)} days ago`
}

/** The firmware the deployment started with, from the phone's catalogue; null when not known. */
const useFirmwareVersion = (id?: string | null): string | null => {
    const [version, setVersion] = useState<string | null>(null)
    useEffect(() => {
        if (!id) return
        let live = true
        // A query, not find(): a firmware missing from the catalogue is an empty list, no row
        database.get<Firmware>('firmware').query(Q.where('id', id)).fetch()
            .then(rows => { if (live) setVersion(friendlyVersion(rows[0]?.version) || null) })
            .catch(() => { /* the catalogue could not be read: no row */ })
        return () => { live = false }
    }, [id])
    return id ? version : null
}

/**
 * A deployed camera's last LoRaWAN check-in (#518), read live: hidden offline, before the first
 * read, and for a camera that has never checked in unless it has gone Silent. The health words
 * are the backend's (`cameraHealth.ts`), the same as on the website and in the alerts.
 */
export const RemoteCheckInCard = ({ deployment }: { deployment: Deployment }) => {
    const theme = useTheme()
    const remote = useRemoteCheckIns([deployment.id])
    const bleVersion = useFirmwareVersion(deployment.bleFirmwareId)
    const aiVersion = useFirmwareVersion(deployment.himaxFirmwareId)

    if (!remote) return null
    const checkIn = remote.checkIns[deployment.id]
    const state = remoteState(deployment, checkIn, remote.readAt)
    if (!checkIn && state !== 'silent') return null

    const reasons = healthReasonTexts(checkIn?.healthReasons)
    const healthLines = state === 'silent'
        ? [CAMERA_STATE.silent.label, silenceText(deployment.lorawanPingMinutes ?? null), ...reasons]
        : reasons.length ? reasons : [CAMERA_STATE[state].label]
    const firmwareLines = [bleVersion && `Bluetooth ${bleVersion}`, aiVersion && `AI ${aiVersion}`]
        .filter((line): line is string => !!line)
    const battery = checkIn?.batteryMv != null ? `${(checkIn.batteryMv / 1000).toFixed(1)} V`
        : checkIn?.batteryPct != null ? `${checkIn.batteryPct}%` : null

    const label = { color: theme.colors.onSurfaceVariant }
    const value = { color: theme.colors.onSurface, fontWeight: '600' as const }
    const row = (name: string, lines: string[], color?: string) => (
        <View style={styles.row} key={name}>
            <Text variant="bodyMedium" style={label}>{name}</Text>
            <View style={styles.values}>
                {lines.map(line => (
                    <Text key={line} variant="bodyMedium" style={[value, styles.valueText, color ? { color } : null]}>
                        {line}
                    </Text>
                ))}
            </View>
        </View>
    )

    return (
        <Card mode="outlined" style={styles.card}>
            <Card.Content>
                <View testID="remote-check-in">
                    <View style={styles.header}>
                        <Text variant="titleSmall" style={value}>Remote check-in</Text>
                        <Text variant="bodyMedium" style={label}>
                            {checkIn ? agoText(checkIn.lastSeen, remote.readAt) : 'None'}
                        </Text>
                    </View>
                    {battery && row('Battery', [battery])}
                    {checkIn?.sdFreePct != null && row('SD card', [`${checkIn.sdFreePct}% free`])}
                    {firmwareLines.length > 0 && row('Firmware', firmwareLines)}
                    {row('Health', healthLines, CAMERA_STATE[state].color)}
                </View>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(0,0,0,0.1)',
        gap: 16,
    },
    values: {
        flexShrink: 1,
        alignItems: 'flex-end',
    },
    valueText: {
        textAlign: 'right',
    },
})
