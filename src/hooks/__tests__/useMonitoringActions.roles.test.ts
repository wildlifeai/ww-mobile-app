import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useMonitoringActions } from '../useMonitoringActions'
import { DeploymentService } from '../../services/DeploymentService'
import { createEndDeploymentSession } from '../../ble/session/endDeploymentSession'
import { resetFakeDatabase, seedRows } from '../../../tests/setup/helpers/fakeDatabase'

/**
 * #450: Stop Monitoring on the live monitor that follows a start, in Start
 * Monitoring and the Dev Deployment Test. The deployment is the one just
 * started, so its creator ends it; a sync since may have made them a viewer,
 * and then the server would refuse the end, so the roles are asked first.
 */

const mockSession = { execute: jest.fn(async () => Array(37).fill('0')), cameraNotAnswering: jest.fn(() => false) }

jest.mock('../../database', () => ({
	__esModule: true,
	default: require('../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../../services/DeploymentService', () => ({
	DeploymentService: { getDeploymentById: jest.fn(), endDeployment: jest.fn(async () => {}) },
}))
jest.mock('../../ble/session/createBleSession', () => ({ createBleSession: jest.fn(() => mockSession) }))
jest.mock('../../ble/session/endDeploymentSession', () => ({ createEndDeploymentSession: jest.fn(() => mockSession) }))
jest.mock('../../ble/protocol/commandRegistry', () => ({
	commandRegistry: { getops: 'getops', setdid: jest.fn(), setgps: jest.fn(), disconnect: 'disconnect' },
}))
jest.mock('../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const getDeploymentById = DeploymentService.getDeploymentById as jest.Mock
const endDeployment = DeploymentService.endDeployment as jest.Mock

const role = (name: string) => ({ userId: 'user-1', role: name, scopeType: 'project', scopeId: 'project-1', isActive: true })

const fakeProgress = () => ({
	reset: jest.fn(), addLog: jest.fn(), setFinishStep: jest.fn(), setFinishProgress: jest.fn(),
	setIsSuccess: jest.fn(), setIsFinishing: jest.fn(),
}) as any

const stop = async () => {
	const { result } = renderHook(() => useMonitoringActions({
		bleDevice: { id: 'ble-1', connected: true } as any,
		disconnectDevice: jest.fn(),
		quiesceDevice: jest.fn(async () => {}),
		userId: 'user-1',
		navigation: { navigate: jest.fn(), reset: jest.fn() },
		deploymentIdRef: { current: 'dep-1' },
		isNavigatingAway: { current: false },
		progress: fakeProgress(),
	}))
	await act(async () => { await result.current.handleStopMonitoring('') })
}

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	resetFakeDatabase()
	seedRows('projects', [{ id: 'project-1', name: 'Sinbad Gully' }])
	getDeploymentById.mockResolvedValue({ id: 'dep-1', projectId: 'project-1', setupBy: 'user-1' })
})

describe('Stop Monitoring after a start, and the project role (#450)', () => {
	it('stops a creator made a viewer since, before the camera is touched', async () => {
		seedRows('user_roles', [role('project_viewer')])

		await stop()

		expect(Alert.alert).toHaveBeenCalledWith('Cannot End This Deployment', expect.stringMatching(/^You started this deployment, but you are now a viewer/))
		expect(createEndDeploymentSession).not.toHaveBeenCalled()
		expect(endDeployment).not.toHaveBeenCalled()
	})

	it('lets the creator end it while a member', async () => {
		seedRows('user_roles', [role('project_member')])

		await stop()

		expect(Alert.alert).not.toHaveBeenCalled()
		expect(endDeployment).toHaveBeenCalledWith('dep-1', 'user-1', '')
	})
})
