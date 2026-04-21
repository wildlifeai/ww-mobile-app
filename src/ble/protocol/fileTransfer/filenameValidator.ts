/**
 * Filename validation for 8.3 format.
 *
 * Matches the firmware validator in fileTx.c:isValid83Filename().
 * Allowed characters: uppercase letters, digits, hyphen, underscore.
 */

const VALID_CHAR = /^[A-Z0-9_-]+$/

export function isValid83Filename(name: string): boolean {
  const parts = name.split('.')
  if (parts.length !== 2) return false
  const [base, ext] = parts
  return (
    base.length >= 1 &&
    base.length <= 8 &&
    ext.length >= 1 &&
    ext.length <= 3 &&
    VALID_CHAR.test(base) &&
    VALID_CHAR.test(ext)
  )
}
