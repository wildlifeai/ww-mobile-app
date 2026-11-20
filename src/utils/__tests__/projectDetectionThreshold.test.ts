import {
    DEFAULT_DETECTION_THRESHOLD_PCT,
    describeDetectionThreshold,
    op16FromPercent,
    resolveDetectionThresholdPct,
    resolveModelThresholdOp,
} from '../projectDetectionThreshold'
import { FACTORY_DEFAULTS, OP_PARAMETER } from '../../hooks/useDeviceSettings'

/**
 * The project's detection threshold as the device's op16 (#342). Since Seeed
 * PR #289 op16 is a percent, 0 to 100, default 60, and the app writes the
 * project's percent unchanged (#520). Before it, op16 was the model's raw int8
 * output and the app wrote ceil(pct * 2.56) - 128, so 57% went out as 18,
 * which that firmware now reads as 18%.
 */
describe('projectDetectionThreshold', () => {
    describe('op16FromPercent', () => {
        it('writes the column default as itself, not as the old raw 18', () => {
            expect(op16FromPercent(57)).toBe(57)
            expect(op16FromPercent(DEFAULT_DETECTION_THRESHOLD_PCT)).toBe(DEFAULT_DETECTION_THRESHOLD_PCT)
        })

        it('writes every percent the project allows unchanged', () => {
            for (let pct = 50; pct <= 99; pct++) {
                expect(op16FromPercent(pct)).toBe(pct)
            }
        })

        it('keeps a value inside the firmware range, 0 to 100', () => {
            expect(op16FromPercent(0)).toBe(0)
            expect(op16FromPercent(100)).toBe(100)
            expect(op16FromPercent(-5)).toBe(0)
            expect(op16FromPercent(127)).toBe(100)
        })
    })

    describe('FACTORY_DEFAULTS op16', () => {
        it('is 60, the default of firmware with Seeed PR #289', () => {
            expect(FACTORY_DEFAULTS[OP_PARAMETER.MODEL_THRESHOLD]).toBe(60)
        })
    })

    describe('resolveDetectionThresholdPct', () => {
        it('takes the project value inside the CHECK range', () => {
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: 50 })).toBe(50)
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: 80 })).toBe(80)
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: 99 })).toBe(99)
        })

        it('falls back to 57 for a missing project or a missing value', () => {
            expect(resolveDetectionThresholdPct(undefined)).toBe(57)
            expect(resolveDetectionThresholdPct(null)).toBe(57)
            expect(resolveDetectionThresholdPct({})).toBe(57)
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: null })).toBe(57)
        })

        it('treats a value outside the CHECK range as unset, 0 included', () => {
            // 0 is what WatermelonDB keeps in a number column nobody wrote
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: 0 })).toBe(57)
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: 49 })).toBe(57)
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: 100 })).toBe(57)
            expect(resolveDetectionThresholdPct({ detection_threshold_pct: 60.5 })).toBe(57)
        })
    })

    describe('resolveModelThresholdOp', () => {
        it('is the op16 for the resolved percent', () => {
            expect(resolveModelThresholdOp({ detection_threshold_pct: 75 })).toBe(75)
            expect(resolveModelThresholdOp(null)).toBe(57)
            expect(resolveModelThresholdOp({ detection_threshold_pct: 0 })).toBe(57)
        })
    })

    describe('describeDetectionThreshold', () => {
        it('names the percent and the op16 written, for the deployment log', () => {
            expect(describeDetectionThreshold({ detection_threshold_pct: 57 })).toBe('Detection threshold: 57% (op16 57)')
            expect(describeDetectionThreshold({ detection_threshold_pct: 90 })).toBe('Detection threshold: 90% (op16 90)')
            expect(describeDetectionThreshold(undefined)).toBe('Detection threshold: 57% (op16 57)')
        })
    })
})
