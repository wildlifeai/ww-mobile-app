/**
 * #461: Settings words each change the server refused (#449) as the change and
 * its record's name, and one plain sentence for why, instead of the server's
 * SQLSTATE and message. The codes are 03-DATA-AND-SYNC.md's, "Retry Logic".
 */
import { describeChange, refusalSentence, UNKNOWN_REFUSAL } from '../refusedChanges'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

jest.mock('../../database', () => ({
    __esModule: true,
    default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))

const change = (tableName: string, operationType: string, errorMessage?: string, payload: object | string = {}) => ({
    tableName,
    operationType,
    recordId: 'rec-1',
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    errorMessage,
})

describe('refusalSentence', () => {
    it('says a camera already had an open deployment for 23P01', () => {
        expect(refusalSentence(change('deployments', 'CREATE',
            '23P01 conflicting key value violates exclusion constraint "deployments_one_open_per_device"')))
            .toBe('This camera already had an open deployment on the server. End that one, then start again.')
    })

    it('says the account needs a role for 42501, the project\'s for a deployment or a project change', () => {
        const projectRole = 'This account may not make this change. It needs a role in the project that allows it.'
        const refusal = '42501 new row violates row-level security policy for table "deployments"'

        expect(refusalSentence(change('deployments', 'CREATE', refusal))).toBe(projectRole)
        expect(refusalSentence(change('deployments', 'UPDATE', refusal))).toBe(projectRole)
        expect(refusalSentence(change('projects', 'UPDATE', refusal))).toBe(projectRole)
    })

    it('says a new project needs a role in the organisation for 42501', () => {
        expect(refusalSentence(change('projects', 'create', '42501 new row violates row-level security policy for table "projects"')))
            .toBe('This account may not create a project in this organisation. It needs a role in the organisation.')
    })

    it('says the server would not let this account register a camera for 42501 on a camera', () => {
        expect(refusalSentence(change('devices', 'CREATE', '42501 new row violates row-level security policy for table "devices"')))
            .toBe('The server would not let this account register this camera.')
    })

    it('says a camera deleted on the server keeps its Bluetooth id for 23505', () => {
        expect(refusalSentence(change('devices', 'CREATE',
            '23505 This camera was deleted on the server, which still holds its Bluetooth id, so it cannot be registered again')))
            .toBe('This camera was deleted on the server, which still holds its Bluetooth id, so it cannot be registered again.')
    })

    it('says the record is gone or not this account\'s to change for not_applied', () => {
        expect(refusalSentence(change('deployments', 'UPDATE',
            'not_applied: the row is missing on the server, or this account may not change it')))
            .toBe('The server no longer has this record, or this account may not change it.')
    })

    it('falls back to a plain sentence for a code it does not know, or no reason at all', () => {
        expect(refusalSentence(change('deployments', 'CREATE', '23514 new row violates check constraint'))).toBe(UNKNOWN_REFUSAL)
        expect(refusalSentence(change('deployments', 'CREATE', 'something the server said'))).toBe(UNKNOWN_REFUSAL)
        expect(refusalSentence(change('deployments', 'CREATE', undefined))).toBe(UNKNOWN_REFUSAL)
        expect(UNKNOWN_REFUSAL).toBe('The server would not accept this change.')
    })
})

describe('describeChange', () => {
    beforeEach(() => resetFakeDatabase())

    it('names the record from the change when it carries a name', async () => {
        seedRows('deployments', [{ id: 'rec-1', name: 'Renamed since' }])

        expect(await describeChange(change('deployments', 'CREATE', undefined, { name: 'Ridge 2' })))
            .toBe('New deployment "Ridge 2"')
    })

    it('names the record from the phone\'s own database when the change has no name', async () => {
        seedRows('deployments', [{ id: 'rec-1', name: 'Whakapapanui Stream' }])
        seedRows('projects', [{ id: 'rec-1', name: 'Sinbad Gully' }])
        seedRows('devices', [{ id: 'rec-1', name: 'WW500-A1B2' }])

        expect(await describeChange(change('deployments', 'UPDATE', undefined, { deployment_status_id: 3 })))
            .toBe('Change to deployment "Whakapapanui Stream"')
        expect(await describeChange(change('projects', 'DELETE', undefined, { id: 'rec-1' })))
            .toBe('Removal of project "Sinbad Gully"')
        expect(await describeChange(change('devices', 'UPDATE', undefined, 'not json')))
            .toBe('Change to camera "WW500-A1B2"')
    })

    it('says what kind of record it was when neither the change nor the phone has a name', async () => {
        expect(await describeChange(change('deployments', 'UPDATE', undefined, { deployment_status_id: 3 })))
            .toBe('Change to deployment')
        expect(await describeChange(change('sync_state', 'UPDATE'))).toBe('Change to sync_state')
    })
})
