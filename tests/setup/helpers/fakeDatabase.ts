/**
 * A small in-memory stand-in for the WatermelonDB database, for service tests
 * that need a query to answer from rows the test (or the code under test)
 * wrote, rather than from a canned mock.
 *
 * It understands Q.where with eq, oneOf and gt, matched against the record's
 * camelCase property, Q.or and Q.and, and the write paths the services use:
 * create, update, prepareCreate / prepareUpdate / prepareDestroyPermanently
 * with batch, and markAsDeleted. Nothing else. Extend it when a test needs more.
 *
 * Use it from a jest.mock factory:
 *   jest.mock('../../database', () => ({
 *     __esModule: true,
 *     default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
 *   }))
 */

type AnyRecord = Record<string, any>

const tables = new Map<string, AnyRecord[]>()
let nextId = 1

const rowsOf = (table: string): AnyRecord[] => {
	if (!tables.has(table)) tables.set(table, [])
	return tables.get(table)!
}

const camel = (column: string) => column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

const matches = (record: AnyRecord, clause: any): boolean => {
	if (clause?.type === 'or') return clause.conditions.some((c: any) => matches(record, c))
	if (clause?.type === 'and') return clause.conditions.every((c: any) => matches(record, c))
	if (!clause || clause.type !== 'where') return true
	const value = record[camel(clause.left)]
	const { operator, right } = clause.comparison
	switch (operator) {
		case 'eq':
			return value === right.value
		case 'oneOf':
			return right.values.includes(value)
		case 'gt':
			return value > right.value
		default:
			return true
	}
}

const remove = (table: string, record: AnyRecord) => {
	const rows = rowsOf(table)
	const index = rows.indexOf(record)
	if (index >= 0) rows.splice(index, 1)
}

const makeRecord = (table: string, fields: AnyRecord = {}): AnyRecord => {
	const { id, ...rest } = fields
	const record: AnyRecord = { ...rest, _raw: { id: id ?? `fake-${nextId++}` } }
	Object.defineProperty(record, 'id', { get: () => record._raw.id, enumerable: true })
	record.update = async (fn: (r: AnyRecord) => void) => { fn(record) }
	record.markAsDeleted = async () => remove(table, record)
	record.destroyPermanently = async () => remove(table, record)
	record.prepareUpdate = (fn: (r: AnyRecord) => void) => ({ __apply: () => fn(record) })
	record.prepareMarkAsDeleted = () => ({ __apply: () => remove(table, record) })
	record.prepareDestroyPermanently = () => ({ __apply: () => remove(table, record) })
	return record
}

const collection = (table: string) => ({
	query: (...clauses: any[]) => {
		const run = () => rowsOf(table).filter((r) => clauses.every((c) => matches(r, c)))
		return {
			fetch: async () => run(),
			fetchCount: async () => run().length,
		}
	},
	find: async (id: string) => {
		const found = rowsOf(table).find((r) => r.id === id)
		if (!found) throw new Error(`Record ${table}#${id} not found`)
		return found
	},
	// Like WatermelonDB, a new record is stamped with created_at and updated_at
	create: async (fn: (r: AnyRecord) => void) => {
		const record = makeRecord(table, { createdAt: Date.now(), updatedAt: Date.now() })
		fn(record)
		rowsOf(table).push(record)
		return record
	},
	prepareCreate: (fn: (r: AnyRecord) => void) => {
		const record = makeRecord(table, { createdAt: Date.now(), updatedAt: Date.now() })
		fn(record)
		record.__apply = () => rowsOf(table).push(record)
		return record
	},
})

export const fakeDatabase = {
	get: (table: string) => collection(table),
	collections: { get: (table: string) => collection(table) },
	write: async <T>(fn: () => Promise<T> | T): Promise<T> => fn(),
	batch: async (...ops: any[]) => {
		for (const op of ops.flat()) {
			if (op && typeof op.__apply === 'function') op.__apply()
		}
	},
}

/** Empty every table */
export const resetFakeDatabase = () => {
	tables.clear()
	nextId = 1
}

/** Put rows straight into a table, returning the records */
export const seedRows = (table: string, rows: AnyRecord[]): AnyRecord[] => {
	const records = rows.map((fields) => makeRecord(table, fields))
	rowsOf(table).push(...records)
	return records
}

/** The records currently in a table */
export const rowsIn = (table: string): AnyRecord[] => [...rowsOf(table)]
