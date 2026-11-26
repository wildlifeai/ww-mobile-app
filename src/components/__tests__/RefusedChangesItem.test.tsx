import { Alert } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { BehaviorSubject } from 'rxjs'

import { RefusedChangesItem } from '../RefusedChangesItem'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

const mockRefused = new BehaviorSubject<any[]>([])
jest.mock('../../services/OutboxService', () => ({
    __esModule: true,
    default: { observeRefusedOperations: () => mockRefused },
}))
jest.mock('../../database', () => ({
    __esModule: true,
    default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/**
 * #449. A change the server refuses for good is kept and never sent again, so
 * Settings says how many there are, and a tap names each one's record and
 * says why in plain words (#461). The wording is refusedChanges.ts's.
 */
describe('the refused changes line in Settings', () => {
    beforeEach(() => {
        mockRefused.next([])
        resetFakeDatabase()
    })

    it('shows nothing when the server has refused nothing', () => {
        const { queryByTestId } = render(<RefusedChangesItem />)

        expect(queryByTestId('refused-changes')).toBeNull()
    })

    it('counts the refused changes, and follows the outbox as it changes', () => {
        const { getByText, queryByTestId } = render(<RefusedChangesItem />)

        act(() => mockRefused.next([
            { tableName: 'deployments', operationType: 'CREATE', payload: '{}', errorMessage: '23P01 conflicting key value' },
            { tableName: 'projects', operationType: 'UPDATE', payload: '{}', errorMessage: 'not_applied: the row is missing' },
        ]))
        expect(getByText('2 changes the server refused')).toBeTruthy()

        act(() => mockRefused.next([
            { tableName: 'projects', operationType: 'UPDATE', payload: '{}', errorMessage: 'not_applied: the row is missing' },
        ]))
        expect(getByText('1 change the server refused')).toBeTruthy()

        act(() => mockRefused.next([]))
        expect(queryByTestId('refused-changes')).toBeNull()
    })

    it('names each change and says why in plain words on a tap, the server\'s text to the log only', async () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
        const { log } = jest.requireMock('../../utils/logger')
        // An update sends only the columns it changed (#411), so its name comes from the phone
        seedRows('deployments', [{ id: 'dep-2', name: 'Whakapapanui Stream' }])
        mockRefused.next([
            {
                tableName: 'deployments',
                operationType: 'CREATE',
                recordId: 'dep-1',
                payload: JSON.stringify({ id: 'dep-1', name: 'Ridge 2' }),
                errorMessage: '23P01 conflicting key value violates exclusion constraint "deployments_one_open_per_device"',
            },
            {
                tableName: 'deployments',
                operationType: 'UPDATE',
                recordId: 'dep-2',
                payload: JSON.stringify({ id: 'dep-2', deployment_status_id: 3 }),
                errorMessage: 'not_applied: the row is missing on the server, or this account may not change it',
            },
        ])
        const { getByTestId } = render(<RefusedChangesItem />)

        fireEvent.press(getByTestId('refused-changes'))

        await waitFor(() => expect(alert).toHaveBeenCalledWith('Refused by the server', [
            'New deployment "Ridge 2"\nThis camera already had an open deployment on the server. End that one, then start again.',
            'Change to deployment "Whakapapanui Stream"\nThe server no longer has this record, or this account may not change it.',
        ].join('\n\n')))
        expect(log).toHaveBeenCalledWith(expect.stringContaining('deployments_one_open_per_device'))
        expect(log).toHaveBeenCalledWith(expect.stringContaining('not_applied: the row is missing on the server'))
    })
})
