import { parseLightCheck, lightMargin } from '../lightCheck';

// The line exactly as documented in the firmware's ble_commands.md, and as built
// by lightSensor.c decideDarkBright().
const FULL =
  'AE light check: mean AE = 71 (min 71, max 71) over 16 frames, threshold = 65, ' +
  'analog gain = 4, converged = no, gain railed = yes -> DARK (flash wanted) (changed)';

describe('parseLightCheck', () => {
  it('parses every field of the documented line', () => {
    const r = parseLightCheck(FULL)!;
    expect(r).toMatchObject({
      meanAE: 71,
      threshold: 65,
      dark: true,
      minAE: 71,
      maxAE: 71,
      frames: 16,
      analogGain: 4,
      converged: false,
      gainRailed: true,
      changed: true,
    });
  });

  it('reads BRIGHT, and reports no flip when "(changed)" is absent', () => {
    const r = parseLightCheck(
      'AE light check: mean AE = 80 (min 74, max 88) over 16 frames, threshold = 65, ' +
      'analog gain = 1, converged = yes, gain railed = no -> BRIGHT (no flash)',
    )!;
    expect(r.dark).toBe(false);
    expect(r.changed).toBe(false);
    expect(r.converged).toBe(true);
    expect(r.gainRailed).toBe(false);
    expect(r.minAE).toBe(74);
    expect(r.maxAE).toBe(88);
  });

  // Backward tolerance: `analog gain` and `converged` were added during the
  // light-sensor work, so a device on older firmware omits them.
  it('parses an older line missing analog gain and converged', () => {
    const r = parseLightCheck(
      'AE light check: mean AE = 12 (min 8, max 19) over 16 frames, threshold = 65, ' +
      'gain railed = yes -> DARK (flash wanted)',
    )!;
    expect(r.meanAE).toBe(12);
    expect(r.dark).toBe(true);
    expect(r.gainRailed).toBe(true);
    expect(r.analogGain).toBeNull();
    expect(r.converged).toBeNull();
  });

  // Forward tolerance: this is the property that matters most. Charles is still
  // changing the algorithm, so new fields are expected to appear in this line.
  it('ignores fields it has never seen and keeps the rest', () => {
    const r = parseLightCheck(
      'AE light check: mean AE = 71 (min 71, max 71) over 16 frames, threshold = 65, ' +
      'analog gain = 4, converged = no, gain railed = yes, lux estimate = 3.2, ' +
      'sensor temp = 19 -> DARK (flash wanted) (changed)',
    )!;
    expect(r.meanAE).toBe(71);
    expect(r.gainRailed).toBe(true);
    expect(r.dark).toBe(true);
    expect(r.changed).toBe(true);
  });

  it('tolerates the [LS] console prefix, so bench logs parse too', () => {
    expect(parseLightCheck(`[LS] ${FULL}`)?.meanAE).toBe(71);
  });

  // The exact trap recorded in the firmware thread's method note: a test keyed on
  // the substring "AE light check" alone matches this line, which is printed
  // during the capture phase and carries no reading at all.
  it('does not match the "Skipping NN processing" line', () => {
    expect(parseLightCheck('[LS] Skipping NN processing (AE light check).')).toBeNull();
  });

  it('returns null for unrelated device output', () => {
    expect(parseLightCheck('HM0360 AE regs:')).toBeNull();
    expect(parseLightCheck('  AE Mean = 71')).toBeNull();
    expect(parseLightCheck('Checking light level...')).toBeNull();
    expect(parseLightCheck('')).toBeNull();
  });

  // A half-parsed reading would be logged and charted as though it were real, so
  // the decision-carrying fields are all-or-nothing.
  it('returns null when a decision-carrying field is missing', () => {
    expect(parseLightCheck(
      'AE light check: mean AE = 71 (min 71, max 71) over 16 frames, threshold = 65',
    )).toBeNull();
    expect(parseLightCheck(
      'AE light check: mean AE = 71 over 16 frames -> DARK (flash wanted)',
    )).toBeNull();
  });
});

describe('lightMargin', () => {
  it('is negative below the threshold and positive above it', () => {
    expect(lightMargin(parseLightCheck(FULL)!)).toBe(6);
    expect(lightMargin(parseLightCheck(
      'AE light check: mean AE = 40 (min 40, max 40) over 16 frames, threshold = 65, ' +
      'gain railed = no -> DARK (flash wanted)',
    )!)).toBe(-25);
  });

  // Railed gain forces DARK whatever the mean says. The UI needs this to explain
  // a reading that sits above the threshold and still comes out dark.
  it('can disagree with the verdict when the gain is railed', () => {
    const r = parseLightCheck(FULL)!;
    expect(lightMargin(r)).toBeGreaterThan(0);
    expect(r.dark).toBe(true);
    expect(r.gainRailed).toBe(true);
  });
});
