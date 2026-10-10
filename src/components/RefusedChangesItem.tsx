import { useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { List, useTheme } from 'react-native-paper'

import type SyncOutbox from '../database/models/SyncOutbox'
import OutboxService from '../services/OutboxService'
import { logWarn } from '../utils/logger'

const AlertIcon = (props: any) => <List.Icon {...props} icon="alert-circle-outline" />
const ChevronIcon = (props: any) => <List.Icon {...props} icon="chevron-right" />

const THINGS: Record<string, string> = { projects: 'project', devices: 'camera', deployments: 'deployment' }

/** What the change was, e.g. `New deployment "Ridge 2"` */
const describeChange = (op: SyncOutbox): string => {
    let name: string | undefined
    try {
        name = JSON.parse(op.payload).name || undefined
    } catch {
        name = undefined
    }
    const thing = THINGS[op.tableName] ?? op.tableName
    const what = name ? `${thing} "${name}"` : thing
    switch (op.operationType.toUpperCase()) {
        case 'CREATE': return `New ${what}`
        case 'DELETE': return `Removal of ${what}`
        default: return `Change to ${what}`
    }
}

/**
 * The changes the server refused for good (#449), one line under Data
 * Synchronization in Settings, and nothing when there are none. A tap lists
 * each with the server's reason. They stay on the phone and are never sent
 * again; what each reason means is in 03-DATA-AND-SYNC.md.
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

    const showReasons = () => Alert.alert(
        'Refused by the server',
        refused.map(op => `${describeChange(op)}\n${op.errorMessage ?? 'No reason given'}`).join('\n\n'),
    )

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
