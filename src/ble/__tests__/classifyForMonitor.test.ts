import { classifyForMonitor } from '../messageClassifier'

/**
 * Lines as the nRF forwards them to the app, taken from the 5 Sep 2026 bench
 * logs. One motion wake arrives as "Wake (MD)", "NN-", "HM0360 motion in N
 * blocks:" and "Captured ...", in that order.
 */
describe('classifyForMonitor', () => {
  it('counts the motion wake but keeps it off the log', () => {
    const event = classifyForMonitor('Wake (MD)')
    expect(event).toMatchObject({ category: 'motion', isHidden: true })
    expect(event?.skipStats).toBeUndefined()
  })

  it('lists the motion blocks line without counting the wake twice', () => {
    const event = classifyForMonitor('HM0360 motion in 74 blocks:')
    expect(event).toMatchObject({ category: 'motion', label: 'Motion detected (74 blocks)', skipStats: true })
    expect(event?.isHidden).toBeUndefined()
  })

  it('drops a zero-block motion line', () => {
    expect(classifyForMonitor('HM0360 motion in 0 blocks:')).toBeNull()
  })

  it('keeps the light check off the log', () => {
    for (const line of [
      'AE light check: AGain = 4, conv=N -> DARK (change)',
      '[LS] AE light check: mean AE=77 (min 75, max 80, 16 frames) thr=65, AGain=0, conv=Y, gain railed = N -> BRIGHT',
    ]) {
      const event = classifyForMonitor(line)
      expect(event).not.toBeNull()
      expect(event?.isHidden).toBe(true)
      expect(event?.label).toMatch(/^Light check:/)
    }
  })

  it('still lists the NN verdict and the timelapse wake', () => {
    expect(classifyForMonitor('NN-')).toMatchObject({ category: 'nn_negative' })
    expect(classifyForMonitor('NN+')).toMatchObject({ category: 'nn_positive' })
    expect(classifyForMonitor('Wake (Timer)')).toMatchObject({ category: 'timelapse' })
    expect(classifyForMonitor('Wake (Timer)')?.isHidden).toBeUndefined()
  })
})
