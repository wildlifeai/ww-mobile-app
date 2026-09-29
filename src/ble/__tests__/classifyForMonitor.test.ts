import { classifyForMonitor } from '../messageClassifier'

/**
 * Lines as the nRF forwards them to the app, taken from the 5 Sep 2026 bench
 * logs. One motion wake arrives as "Wake (MD)", "NN-", "HM0360 motion in N
 * blocks:" and "Captured ...", in that order.
 */
describe('classifyForMonitor', () => {
  it('counts the motion wake and lists it', () => {
    const event = classifyForMonitor('Wake (MD)')
    expect(event).toMatchObject({ category: 'motion', label: 'Motion detected' })
    expect(event?.isHidden).toBeUndefined()
    expect(event?.skipStats).toBeUndefined()
  })

  // Listing the blocks line instead left the log empty on the bench on
  // 29 Sep 2026: with one picture per trigger every wake reported 0 blocks.
  it('neither lists nor counts the blocks line, so a wake is one row', () => {
    const event = classifyForMonitor('HM0360 motion in 74 blocks:')
    expect(event).toMatchObject({ category: 'motion', skipStats: true, isHidden: true })
  })

  it('lists one row for the lines of a real wake', () => {
    const lines = ['Wake (MD)', 'HM0360 motion in 0 blocks:', 'Captured 1 images. Last is ABB354C1.JPG (File write 18ms avg.)']
    const listed = lines.map(line => classifyForMonitor(line)).filter(event => event && !event.isHidden)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ label: 'Motion detected' })
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
