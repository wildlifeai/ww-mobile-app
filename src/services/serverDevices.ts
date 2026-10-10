import database from '../database'
import Device from '../database/models/Device'
import { Database } from '../types/database.types'
import { getSupabaseClient } from './supabase'

/** A devices row as the server sends it */
export type DeviceRow = Database['public']['Tables']['devices']['Row']

/**
 * The server's row for the camera with this Bluetooth id, or null when there
 * is none this account may read. `bluetooth_id` is unique on the server, and
 * row-level security (`can_read_device`) shows a device only to a project role
 * on a live deployment that uses it, or to any role in its organisation, so
 * null does not mean the camera is unregistered. A failed read throws.
 */
export async function fetchDeviceRowByBluetoothId(bluetoothId: string): Promise<DeviceRow | null> {
    const { data, error } = await getSupabaseClient()
        .from('devices')
        .select('*')
        .eq('bluetooth_id', bluetoothId)
    if (error) throw error
    return ((data ?? []) as DeviceRow[]).find(row => !!row?.id) ?? null
}

/**
 * Whether the server shows this account a device with this id. Row-level
 * security limits the answer as above, so false does not mean the server lacks
 * it. A failed read throws.
 */
export async function serverShowsDevice(id: string): Promise<boolean> {
    const { data, error } = await getSupabaseClient()
        .from('devices')
        .select('id')
        .eq('id', id)
    if (error) throw error
    return ((data ?? []) as { id?: string }[]).some(row => row?.id === id)
}

/**
 * A server devices row made ready for the phone, for the caller to batch
 * inside a write: the local record with that id updated, or a new record under
 * the server's id. It queues nothing, since the row is the server's already.
 */
export async function prepareDeviceRow(row: DeviceRow): Promise<Device> {
    const collection = database.get<Device>('devices')
    const existing = await collection.find(row.id).catch(() => undefined)
    if (existing) {
        return existing.prepareUpdate((rec) => {
            rec.bluetoothId = row.bluetooth_id
            rec.name = row.name
            rec.organisationId = row.organisation_id ?? ''
            rec.deviceEui = row.device_eui ?? undefined
            rec.updatedAt = new Date(row.updated_at ?? Date.now())
        })
    }
    return collection.prepareCreate((rec) => {
        rec._raw.id = row.id
        rec.bluetoothId = row.bluetooth_id
        rec.name = row.name
        rec.organisationId = row.organisation_id ?? ''
        rec.deviceEui = row.device_eui ?? undefined;
        // Through _raw, past the @readonly decorator
        (rec._raw as any).created_at = new Date(row.created_at ?? Date.now()).getTime()
        rec.updatedAt = new Date(row.updated_at ?? Date.now())
    })
}
