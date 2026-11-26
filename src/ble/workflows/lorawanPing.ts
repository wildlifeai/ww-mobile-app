import { BleSession } from '../session/createBleSession'
import { commandRegistry, LorawanPingReply } from '../protocol/commandRegistry'
import { logWarn } from '../../utils/logger'

/**
 * What a LoRaWAN test found: the nRF's own answer, `off` among them when the
 * camera's op32 says never to join (#407), or `no_answer`.
 */
export type LorawanPingResult = LorawanPingReply | 'no_answer'

/**
 * Ask the camera for a LoRaWAN uplink now, and say what happened. The Signal
 * Test card and Start Monitoring's check both go through here, so the two can
 * never read a reply differently (#348).
 *
 * `off` is the nRF's own answer since BLE 0.30.56, the firmware that made
 * op32 decide the join. The app used to guess it from op32 after `Not joined
 * yet.`, which that firmware never sends with op32 at 0, and which older
 * firmware, ignoring op32, never meant that way (#535).
 */
export async function pingLorawan(session: Pick<BleSession, 'execute'>): Promise<LorawanPingResult> {
    try {
        return await session.execute(commandRegistry.ping)
    } catch (err) {
        logWarn('[LoRaWAN] No answer to ping:', err)
        return 'no_answer'
    }
}

/**
 * The Signal Test card's words for each result. Both places that ping are on
 * Start Monitoring for a project that requires LoRaWAN, which is why `off`
 * can promise the deployment turns it on.
 */
export const LORAWAN_PING_WORDS: Record<LorawanPingResult, { status: string; detail: string }> = {
    sent: {
        status: 'Sent',
        detail: 'The camera is on the LoRaWAN network and is sending a test message now. Check it arrives on your LoRaWAN server.',
    },
    not_joined: {
        status: 'Not joined yet',
        detail: 'The camera has not joined a LoRaWAN network, so nothing was sent. Check a gateway is in range and the camera is registered on your LoRaWAN server, then test again.',
    },
    busy: {
        status: 'Busy',
        detail: 'The camera is on the network, but its radio is already sending, so no test message went out. Test again in a minute.',
    },
    off: {
        status: 'LoRaWAN is off',
        detail: 'LoRaWAN is turned off on this camera, so it has not joined a network. Starting monitoring turns it on, because this project uses LoRaWAN.',
    },
    no_answer: {
        status: 'No answer',
        detail: 'The camera did not answer the test. Check it is still connected, then test again.',
    },
}

/** Every Start Monitoring LoRaWAN warning starts with this, so the screen can clear its own. */
export const LORAWAN_REQUIRED_WARNING = 'LoRaWAN is required'

/**
 * Start Monitoring's warning for a project that requires LoRaWAN, or null when
 * the camera is on the network. `busy` is on the network: the nRF only checks
 * the radio once it has joined.
 */
export function lorawanRequiredWarning(result: LorawanPingResult): string | null {
    switch (result) {
        case 'sent':
        case 'busy':
            return null
        case 'not_joined':
            return `${LORAWAN_REQUIRED_WARNING} but the camera has not joined a network yet.`
        case 'off':
            return `${LORAWAN_REQUIRED_WARNING} but it is off on this camera. Starting monitoring turns it on.`
        case 'no_answer':
            return `${LORAWAN_REQUIRED_WARNING} but the camera did not answer the network test.`
    }
}
