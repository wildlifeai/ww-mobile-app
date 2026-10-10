import * as fs from 'fs'
import * as path from 'path'

import schema from '../schema'

/**
 * Every column a model reads with @date must be a number column (#425).
 *
 * @date writes epoch milliseconds, and WatermelonDB fits each value to its
 * column's type: a number in a 'string' column is kept as null, or '' when the
 * column is required, and @date reads anything but a number back as null. No
 * error, the value is just gone. Supabase types every timestamp as a string,
 * so the generator makes each one a number by name (timestampFields in
 * scripts/generate-watermelon-schema.js). user_roles.granted_at and expires_at
 * and deployments.lorawan_last_verified_at were missed, and every role on
 * every phone lost its dates. This reads the models' source, so a new @date
 * over a string column fails here.
 */
describe('@date columns', () => {
    const modelsDir = path.join(__dirname, '..', 'models')
    const dateColumns: [string, string, string][] = []
    for (const file of fs.readdirSync(modelsDir).filter(name => name.endsWith('.ts'))) {
        const source = fs.readFileSync(path.join(modelsDir, file), 'utf8')
        const table = (source.match(/static table = '(\w+)'/) || [])[1]
        const dateRegex = /@date\('(\w+)'\)/g
        let match
        while ((match = dateRegex.exec(source)) !== null) {
            dateColumns.push([file, table, match[1]])
        }
    }

    it('finds the models and their dates', () => {
        expect(dateColumns).toContainEqual(['UserRole.ts', 'user_roles', 'granted_at'])
        expect(dateColumns).toContainEqual(['Deployment.ts', 'deployments', 'lorawan_last_verified_at'])
    })

    it.each(dateColumns)('%s: %s.%s is a number column', (_file, table, column) => {
        expect(schema.tables[table]?.columns[column]?.type).toBe('number')
    })
})
