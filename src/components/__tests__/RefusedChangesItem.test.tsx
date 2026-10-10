import { Alert } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import { BehaviorSubject } from 'rxjs'

import { RefusedChangesItem } from '../RefusedChangesItem'

const mockRefused = new BehaviorSubject<any[]>([])
jest.mock('../../services/OutboxService', () => ({
    __esModule: true,
    default: { observeRefusedOperations: () => mockRefused },
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

/**
 * #449. A change the server refuses for good is kept and never sent again, so
 * Settings says how many there are, and a tap gives each one's reason.
 */
describe('the refused changes line in Settings', () => {
    beforeEach(() => mockRefused.next([]))

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

    it('gives each change and the server\'s reason on a tap', () => {
        const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
        mockRefused.next([
            {
                tableName: 'deployments',
                operationType: 'CREATE',
                payload: JSON.stringify({ id: 'dep-1', name: 'Ridge 2' }),
                errorMessage: '23P01 conflicting key value violates exclusion constraint "deployments_one_open_per_device"',
            },
            {
                tableName: 'deployments',
                operationType: 'UPDATE',
                payload: JSON.stringify({ id: 'dep-2', deployment_status_id: 3 }),
                errorMessage: 'not_applied: the row is missing on the server, or this account may not change it',
            },
        ])
        const { getByTestId } = render(<RefusedChangesItem />)

        fireEvent.press(getByTestId('refused-changes'))

        expect(alert).toHaveBeenCalledWith('Refused by the server', [
            'New deployment "Ridge 2"\n23P01 conflicting key value violates exclusion constraint "deployments_one_open_per_device"',
            'Change to deployment\nnot_applied: the row is missing on the server, or this account may not change it',
        ].join('\n\n'))
    })
})
