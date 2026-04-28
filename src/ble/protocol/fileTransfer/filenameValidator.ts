/**
 * Filename validation for 8.3 format.
 *
 * Matches the firmware validator in fileTx.c:isValid83Filename().
 * Allowed characters: uppercase letters, digits, hyphen, underscore.
 * Extension is optional (e.g. "README" is valid).
 * Directory names additionally allow dots and forward slashes.
 */

const VALID_FILENAME_CHARS = /^[A-Z0-9_-]+$/
const VALID_DIRNAME_CHARS = /^[A-Z0-9_./-]+$/

export function isValid83Filename(name: string): boolean {
  if (name.length === 0 || name.endsWith('.')) return false
  
  // Extract just the basename for 8.3 validation if a path is provided
  const basename = name.includes('/') ? name.split('/').pop() || '' : name
  
  const parts = basename.split('.')
  if (parts.length > 2) return false
  const [base, ext = ''] = parts
  const dirname = name.includes('/') ? name.substring(0, name.lastIndexOf('/')) : ''

  return (
    base.length >= 1 &&
    base.length <= 8 &&
    (ext === '' || (ext.length >= 1 && ext.length <= 3)) &&
    VALID_FILENAME_CHARS.test(base) &&
    (ext === '' || VALID_FILENAME_CHARS.test(ext)) &&
    (dirname === '' || VALID_DIRNAME_CHARS.test(dirname))
  )
}
