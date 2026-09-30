/**
 * Whether the files a field visit needs are on this phone: a project's AI
 * model for the monitoring screens, the firmware images for the update screen.
 * Both re-check when the offline pre-download lands a file (#333).
 */

import { useEffect, useState } from 'react'
import { Q } from '@nozbe/watermelondb'
import database from '../database'
import AiModel from '../database/models/AiModel'
import Firmware from '../database/models/Firmware'
import AiModelService from '../services/AiModelService'
import FirmwareService from '../services/FirmwareService'
import OfflinePrefetchService from '../services/OfflinePrefetchService'
import { logWarn } from '../utils/logger'

/**
 * 'ready' when the model's files are on the phone, 'missing' when they are not
 * (or the model is not in the phone's reference data), null while checking or
 * when there is no model.
 */
export function useModelOnPhone(modelId: string | null | undefined): 'ready' | 'missing' | null {
    const [state, setState] = useState<'ready' | 'missing' | null>(null)

    useEffect(() => {
        setState(null)
        if (!modelId) return
        let cancelled = false

        const check = async () => {
            try {
                const [model] = await database.get<AiModel>('ai_models').query(Q.where('id', modelId)).fetch()
                const ready = !!model && await AiModelService.isDownloaded(model)
                if (!cancelled) setState(ready ? 'ready' : 'missing')
            } catch (e) {
                logWarn('[OfflineCache] Could not check the model on this phone:', e)
            }
        }

        check()
        const unsubscribe = OfflinePrefetchService.subscribe(check)
        return () => {
            cancelled = true
            unsubscribe()
        }
    }, [modelId])

    return state
}

/**
 * How many of the given firmware images are on the phone, or null while
 * checking or when there are none to check.
 */
export function useFirmwareOnPhone(firmwares: Array<Firmware | null | undefined>): { downloaded: number, total: number } | null {
    const [state, setState] = useState<{ downloaded: number, total: number } | null>(null)
    const present = firmwares.filter((fw): fw is Firmware => !!fw)
    const key = present.map(fw => fw.id).join(',')

    useEffect(() => {
        setState(null)
        if (present.length === 0) return
        let cancelled = false

        const check = async () => {
            try {
                const results = await Promise.all(present.map(fw => FirmwareService.isFirmwareDownloaded(fw)))
                if (!cancelled) setState({ downloaded: results.filter(Boolean).length, total: present.length })
            } catch (e) {
                logWarn('[OfflineCache] Could not check the firmware on this phone:', e)
            }
        }

        check()
        const unsubscribe = OfflinePrefetchService.subscribe(check)
        return () => {
            cancelled = true
            unsubscribe()
        }
    // The records are compared by id: a new array of the same records must
    // not re-run the check on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])

    return state
}
