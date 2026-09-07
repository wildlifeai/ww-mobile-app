import { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SegmentedButtons } from 'react-native-paper'

import { WWText } from '../ui/WWText'
import { WWTextInput } from '../ui/WWTextInput'
import { useExtendedTheme } from '../../theme'
import { FLASH_LED_LABELS } from '../../hooks/useDeviceSettings'

/**
 * Brightness applied when a flash is selected while op9 is 0.
 *
 * A device sitting at 0 makes "flash on" a no-op: the bench run on 2 September
 * showed op13 written and accepted, `ledFlashSelectLED(1)` in the firmware log,
 * and then `Flash brightness: 0%`, so the LED was chosen and told to emit
 * nothing. Nothing in the UI said why the picture came back unlit.
 *
 * 50 rather than the factory default of 5: op22's default carries a note that
 * 5% proved too dim on the bench for night-time work at realistic distances, and
 * the same LEDs are involved here. This is a starting point the operator can
 * change, not a value written behind their back, so the field is on screen
 * showing it the moment the flash is switched on.
 */
const DEFAULT_ON_BRIGHTNESS = 50

interface Props {
    /** op13 FLASH_LED: 0 off, 1 white, 2 infrared. */
    flashLed: number
    onFlashLedChange: (value: number) => void
    /** op9 LED_BRIGHTNESS, 0-100. */
    ledBrightness: number
    onLedBrightnessChange: (value: number) => void
    disabled?: boolean
}

/**
 * The flash controls shared by the Capture Picture and Dev Deployment Test
 * flows: op13 (LED type) and op9 (brightness).
 *
 * Extracted because both screens had grown their own copy, and the copies had
 * already drifted: op13 = 1 was labelled "Visible" in one and "White" in the
 * other, for the same physical LED. "White" won, because the choice an operator
 * is making is between a white LED and an infrared one, and "Visible" only reads
 * as its opposite if you already know IR means invisible.
 *
 * Selecting a flash does not by itself make it fire. Since firmware d9d9d253
 * the LED lights on a capture only when the device's last light decision
 * (op25) was DARK. Capture Picture works around that for now by writing op25
 * before each capture (see useCapturePicture, "INTERIM"); the Dev Deployment
 * Test does not, so there the choice takes effect only in the dark. Both go
 * back to plain selection when the firmware's flash-mode parameter lands.
 * See Light-Sensor.md, "How the decision reaches the flash LED".
 *
 * Renders bare, with no Card of its own, so each caller groups it with whatever
 * else belongs beside it.
 */
export const FlashSelector = ({
    flashLed,
    onFlashLedChange,
    ledBrightness,
    onLedBrightnessChange,
    disabled,
}: Props) => {
    const { spacing } = useExtendedTheme()

    // Local echo of the text field so a half-typed value ("2" on the way to
    // "25") is not clamped mid-keystroke. Committed on blur.
    const [localBrightness, setLocalBrightness] = useState(() => ledBrightness.toString())
    const [prevBrightness, setPrevBrightness] = useState(ledBrightness)
    if (ledBrightness !== prevBrightness) {
        setPrevBrightness(ledBrightness)
        setLocalBrightness(ledBrightness.toString())
    }

    return (
        <View>
            <WWText variant="labelLarge">Flash</WWText>
            <SegmentedButtons
                value={flashLed.toString()}
                onValueChange={(val) => {
                    const next = parseInt(val, 10)
                    onFlashLedChange(next)
                    // Turning a flash on at 0% would select an LED and ask it for
                    // no light. Lift it to something usable, and only when
                    // switching away from Off, so an operator who deliberately
                    // typed 0 while already on keeps their value.
                    if (next !== 0 && flashLed === 0 && ledBrightness === 0) {
                        onLedBrightnessChange(DEFAULT_ON_BRIGHTNESS)
                    }
                }}
                buttons={[
                    ...FLASH_LED_LABELS.map((label, value) => ({
                        value: value.toString(),
                        label,
                        disabled,
                    })),
                ]}
                style={styles.segmented}
            />

            {/* Brightness only matters with a flash selected. Dev Deployment Test
                used to show it unconditionally, which invited setting a value
                that the device would ignore. */}
            {flashLed !== 0 && (
                <View style={{ marginTop: spacing }}>
                    <WWTextInput
                        label="LED Brightness (0-100%)"
                        value={localBrightness}
                        keyboardType="numeric"
                        disabled={disabled}
                        onChange={(t: string) => setLocalBrightness(t)}
                        onBlur={() => {
                            let v = parseInt(localBrightness.replace(/[^0-9]/g, ''), 10)
                            if (isNaN(v) || v < 0) v = 0
                            if (v > 100) v = 100
                            setLocalBrightness(v.toString())
                            onLedBrightnessChange(v)
                        }}
                    />
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    segmented: {
        marginTop: 8,
    },
})
