import database from '../database'
import Device from '../database/models/Device'
import { Database } from '../types/database.types'
import { getSupabaseClient } from './supabase'

/** A devices row as the server sends it */
export type DeviceRow = Database['public']['Tables']['devices']['Row']

/**
 * The server's row for the camera with this Bluetooth id, or null when it has
 * no live one. `bluetooth_id` is unique on the server, and since ww-backend
 * #346 row-level security (`can_read_device`) shows every live camera to every
 * signed-in account but the demo one (#327, #501). A deleted row is hidden but
 * keeps its Bluetooth id, so null is "unregistered or deleted". A failed read
 * throws.
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
 * security hides a deleted row, so false does not mean the server lacks it. A
 * failed read throws.
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
