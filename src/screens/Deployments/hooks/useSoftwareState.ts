import { useFirmwareOnPhone } from '../../../hooks/useOfflineFiles'
import { softwarePlan, softwareState, SoftwareState } from '../../../utils/softwareUpdate'
import { UseFirmwareStatusReturn } from '../../Devices/hooks/useFirmwareStatus'

/**
 * Start Monitoring's word on the camera's software (#529), from its firmware
 * check: up to date, an update available or not finished, or not checked yet.
 * An update whose files the offline pre-download has not put on the phone
 * reads up to date until they are there.
 */
export function useSoftwareState({ statuses }: Pick<UseFirmwareStatusReturn, 'statuses'>): SoftwareState {
    const plan = softwarePlan(statuses)
    const needsAi = plan.some(step => step !== 'ble')
    const onPhone = useFirmwareOnPhone([
        plan.includes('ble') ? statuses.ble.latestFirmware : null,
        needsAi ? statuses.himax.variants?.RP3 : null,
        needsAi ? statuses.himax.variants?.HM0360 : null,
    ])
    return softwareState(statuses, !!onPhone && onPhone.downloaded === onPhone.total)
}
