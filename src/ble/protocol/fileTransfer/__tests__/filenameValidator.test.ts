import { isValid83Filename } from '../filenameValidator'

describe('isValid83Filename', () => {
  // ─── Valid filenames ──────────────────────────────────────────
  describe('valid filenames', () => {
    it.each([
      'A.B',
      'OUTPUT.IMG',
      'HX6538V2.IMG',
      'MODEL_01.BIN',
      'FW-V2.IMG',
      'TESTFILE.TXT',
      'CONFIG.TXT',
      '12345678.123',
      'A-B_C.XYZ',
      'README',
      'BOOT',
      'A',
      '12345678',
    ])('accepts "%s"', (name) => {
      expect(isValid83Filename(name)).toBe(true)
    })
  })

  // ─── Invalid filenames ────────────────────────────────────────
  describe('invalid filenames', () => {
    it.each([
      ['output.img',    'lowercase base'],
      ['Output.IMG',    'mixed case base'],
      ['OUTPUT.img',    'lowercase extension'],
      ['.IMG',          'no base name'],
      ['OUTPUT.',       'no extension after dot'],
      ['OUT.PUT.IMG',   'multiple dots'],
      ['TOOLONGNAME.I', 'base > 8 chars'],
      ['FILE.TOOLNG',   'extension > 3 chars'],
      ['',              'empty string'],
      ['FILE NAME.TXT', 'space in name'],
      ['FILE.TX T',     'space in extension'],
      ['LONGNAMED',     'base > 8 chars no ext'],
    ])('rejects "%s" (%s)', (name) => {
      expect(isValid83Filename(name)).toBe(false)
    })
  })
})
