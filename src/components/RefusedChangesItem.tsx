import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { List, useTheme } from 'react-native-paper'

import type SyncOutbox from '../database/models/SyncOutbox'
import OutboxService from '../services/OutboxService'
import { describeChange, refusalSentence } from '../services/refusedChanges'
import { log, logWarn } from '../utils/logger'

const AlertIcon = (props: any) => <List.Icon {...props} icon="alert-circle-outline" />
const ChevronIcon = (props: any) => <List.Icon {...props} icon="chevron-right" />

/**
 * The changes the server refused for good (#449), one line under Data in
 * Settings, and nothing when there are none. A tap lists
 * each, naming its record, with why in one plain sentence (#461); the server's
 * own text goes to the log. They stay on the phone and are never sent again.
 */
export const RefusedChangesItem = () => {
    const { colors } = useTheme()
    const [refused, setRefused] = useState<SyncOutbox[]>([])

    useEffect(() => {
        const subscription = OutboxService.observeRefusedOperations().subscribe({
            next: setRefused,
            error: (e: unknown) => logWarn('[Settings] Could not read the refused changes:', e),
        })
        return () => subscription.unsubscribe()
    }, [])

    if (refused.length === 0) return null

    const showReasons = async () => {
        const lines = await Promise.all(refused.map(async op => {
            log(`[Settings] Refused ${op.operationType} ${op.tableName} ${op.recordId}: ${op.errorMessage ?? 'no reason given'}`)
            return `${await describeChange(op)}\n${refusalSentence(op)}`
        }))
        Alert.alert('Refused by the server', lines.join('\n\n'))
    }

    return (
        <List.Item
            title={`${refused.length} ${refused.length === 1 ? 'change' : 'changes'} the server refused`}
            titleStyle={{ color: colors.error }}
            left={AlertIcon}
            right={ChevronIcon}
            onPress={showReasons}
            testID="refused-changes"
        />
    )
}
