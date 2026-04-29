/**
 * Filename validation for 8.3 format.
 *
 * Matches the firmware validator in fileTx.c:isValid83Filename().
 * Allowed characters: uppercase letters, digits, hyphen, underscore.
 * Extension is optional (e.g. "README" is valid).
 * Directory names additionally allow dots and forward slashes.
 */

const VALID_FILENAME_CHARS = /^[A-Z0-9_-]+$/

export function isValid83Filename(name: string): boolean {
  if (name.length === 0 || name.endsWith('.')) return false
  
  const pathComponents = name.split('/')
  
  // Validate every component (directories and filename) conforms to 8.3
  for (const component of pathComponents) {
      if (component.length === 0) continue // Allow leading/trailing slashes loosely, or empty parts

      const parts = component.split('.')
      if (parts.length > 2) return false
      
      const [base, ext = ''] = parts
      
      if (base.length < 1 || base.length > 8) return false
      if (ext !== '' && (ext.length < 1 || ext.length > 3)) return false
      if (!VALID_FILENAME_CHARS.test(base)) return false
      if (ext !== '' && !VALID_FILENAME_CHARS.test(ext)) return false
  }

  return true
}
