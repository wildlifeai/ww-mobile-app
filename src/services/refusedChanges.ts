/**
 * How Settings words a change the server refused for good (#449, #461): the
 * change and the record it was to, e.g. `New deployment "Ridge 2"`, and one
 * plain sentence for why. The server's code and message stay in the outbox's
 * `error_message`, for the log; the codes are in 03-DATA-AND-SYNC.md, "Retry
 * Logic". A new code refused for good needs a sentence here, or it reads as
 * the fallback.
 */

import database from '../database'
import type SyncOutbox from '../database/models/SyncOutbox'

type RefusedChange = Pick<SyncOutbox, 'tableName' | 'operationType' | 'recordId' | 'payload' | 'errorMessage'>

const THINGS: Record<string, string> = { projects: 'project', devices: 'camera', deployments: 'deployment' }

/** For a code this file has no sentence for, or no reason at all */
export const UNKNOWN_REFUSAL = 'The server would not accept this change.'

/** The code `error_message` starts with: a SQLSTATE such as `23P01`, or `not_applied` */
const refusalCode = (errorMessage?: string | null): string | undefined =>
    errorMessage?.match(/^(not_applied|[0-9A-Z]{5})\b/)?.[1]

/** Why the server refused the change, in one plain sentence */
export const refusalSentence = (change: Pick<RefusedChange, 'tableName' | 'operationType' | 'errorMessage'>): string => {
    const isCreate = change.operationType.toUpperCase() === 'CREATE'
    switch (refusalCode(change.errorMessage)) {
        case '23P01':
            return 'This camera already had an open deployment on the server. End that one, then start again.'
        case '42501':
            // Row-level security or a trigger. A camera is the demo account's
            // case since ww-backend #346, or an older phone's copy refused when
            // a camera belonged to an organisation; a project is created by a
            // member of its organisation
            if (change.tableName === 'devices') return 'The server would not let this account register this camera.'
            if (change.tableName === 'projects' && isCreate) {
                return 'This account may not create a project in this organisation. It needs a role in the organisation.'
            }
            return 'This account may not make this change. It needs a role in the project that allows it.'
        case '23505':
            // Only a device CREATE is refused 23505, when a camera deleted on
            // the server still holds the Bluetooth id (settleTakenBluetoothId)
            return 'This camera was deleted on the server, which still holds its Bluetooth id, so it cannot be registered again.'
        case 'not_applied':
            return 'The server no longer has this record, or this account may not change it.'
        default:
            return UNKNOWN_REFUSAL
    }
}

/**
 * The record's name: from the change itself, else from the phone's own copy.
 * An update sends only the columns it changed (#411), so it rarely carries one.
 */
const recordName = async (change: RefusedChange): Promise<string | undefined> => {
    try {
        const sent = JSON.parse(change.payload)?.name
        if (typeof sent === 'string' && sent) return sent
    } catch {
        // Not JSON, so no name in it
    }
    if (!THINGS[change.tableName]) return undefined
    try {
        const record = await database.get<any>(change.tableName).find(change.recordId)
        return typeof record.name === 'string' && record.name ? record.name : undefined
    } catch {
        // No longer on the phone
        return undefined
    }
}

/** What the change was, e.g. `New deployment "Ridge 2"` or `Change to project "Sinbad Gully"` */
export const describeChange = async (change: RefusedChange): Promise<string> => {
    const name = await recordName(change)
    const thing = THINGS[change.tableName] ?? change.tableName
    const what = name ? `${thing} "${name}"` : thing
    switch (change.operationType.toUpperCase()) {
        case 'CREATE': return `New ${what}`
        case 'DELETE': return `Removal of ${what}`
        default: return `Change to ${what}`
    }
}
