import {
    DEFAULT_DETECTION_THRESHOLD_PCT,
    describeDetectionThreshold,
    op16FromPercent,
    resolveDetectionThresholdPct,
    resolveModelThresholdOp,
} from '../projectDetectionThreshold'
import { FACTORY_DEFAULTS, OP_PARAMETER } from '../../hooks/useDeviceSettings'

/**
 * The project's detection threshold as the device's op16 (#342). The model's
 * int8 softmax output has scale 1/256 and zero point -128, so op16 = q means
 * probability (q + 128) / 256, and a percent maps to ceil(pct * 2.56) - 128
 * (ww-backend #246).
 */
describe('projectDetectionThreshold', () => {
    describe('op16FromPercent', () => {
        it('maps the column default to the factory op16', () => {
            expect(op16FromPercent(57)).toBe(18)
            expect(op16FromPercent(DEFAULT_DETECTION_THRESHOLD_PCT)).toBe(FACTORY_DEFAULTS[OP_PARAMETER.MODEL_THRESHOLD])
        })

        it('maps both ends of the CHECK range', () => {
            expect(op16FromPercent(50)).toBe(0)
            expect(op16FromPercent(99)).toBe(126)
        })

        it('is the smallest op16 whose probability reaches the percent, for every percent allowed', () => {
            for (let pct = 50; pct <= 99; pct++) {
                const op16 = op16FromPercent(pct)
                expect((op16 + 128) / 256).toBeGreaterThanOrEqual(pct / 100)
                expect((op16 + 127) / 256).toBeLessThan(pct / 100)
                expect(op16).toBe(Math.ceil(pct * 2.56) - 128)
            }
        })

        it('keeps a percent outside the range inside 0 to 127', () => {
            expect(op16FromPercent(10)).toBe(0)
            expect(op16FromPercent(100)).toBe(127)
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
            expect(resolveModelThresholdOp({ detection_threshold_pct: 75 })).toBe(64)
            expect(resolveModelThresholdOp(null)).toBe(18)
            expect(resolveModelThresholdOp({ detection_threshold_pct: 0 })).toBe(18)
        })
    })

    describe('describeDetectionThreshold', () => {
        it('names the percent and the op16 written, for the deployment log', () => {
            expect(describeDetectionThreshold({ detection_threshold_pct: 57 })).toBe('Detection threshold: 57% (op16 18)')
            expect(describeDetectionThreshold({ detection_threshold_pct: 90 })).toBe('Detection threshold: 90% (op16 103)')
            expect(describeDetectionThreshold(undefined)).toBe('Detection threshold: 57% (op16 18)')
        })
    })
})
