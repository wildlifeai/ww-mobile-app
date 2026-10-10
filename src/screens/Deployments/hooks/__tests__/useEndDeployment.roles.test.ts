import { renderHook, act } from '@testing-library/react-native'
import { Alert } from 'react-native'

import { useEndDeployment } from '../useEndDeployment'
import { DeploymentService } from '../../../../services/DeploymentService'
import { getSupabaseClient } from '../../../../services/supabase'
import { createEndDeploymentSession } from '../../../../ble/session/endDeploymentSession'
import { resetFakeDatabase, seedRows } from '../../../../../tests/setup/helpers/fakeDatabase'

/**
 * #450: Stop Monitoring, the screen the scanner sends a deployed camera to,
 * asks the phone's roles whether this account may end the deployment before
 * the camera is touched, and Force End (Database Only) too. Only its creator
 * while a member, or a project admin, may (ww-backend 52_deployments.sql); the
 * server refused anyone else's end, and the phone showed it ended while the
 * server and the website showed it running.
 */

const mockSession = { execute: jest.fn(async () => Array(37).fill('0')), cameraNotAnswering: jest.fn(() => false) }

jest.mock('../../../../database', () => ({
	__esModule: true,
	default: require('../../../../../tests/setup/helpers/fakeDatabase').fakeDatabase,
}))
jest.mock('../../../../services/DeploymentService', () => ({ DeploymentService: { endDeployment: jest.fn(async () => {}) } }))
jest.mock('../../../../ble/session/endDeploymentSession', () => ({ createEndDeploymentSession: jest.fn(() => mockSession) }))
jest.mock('../../../../ble/protocol/commandRegistry', () => ({
	commandRegistry: { getops: 'getops', setdid: jest.fn(), setgps: jest.fn(), disconnect: 'disconnect' },
}))
jest.mock('../../../../hooks/useMonitoringActions', () => ({
	END_DEPLOYMENT_CAMERA_COPY: { step: '', gaveUp: '', notStopped: '', finalStep: '', endedInApp: '' },
	END_DEPLOYMENT_NOT_ANSWERING_DISMISS_MS: 6000,
}))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const endDeployment = DeploymentService.endDeployment as jest.Mock
const createSession = createEndDeploymentSession as jest.Mock

const TITLE = 'Cannot End This Deployment'
const role = (name: string, scopeType: string, scopeId: string | null) => ({ userId: 'user-1', role: name, scopeType, scopeId, isActive: true })
const deployment = (setupBy: string) => ({ id: 'dep-1', projectId: 'project-1', setupBy })

/** Let the role check on mount settle */
const settle = async () => {
	await act(async () => { for (let i = 0; i < 10; i++) await Promise.resolve() })
}

const mount = async (setupBy: string, connected = true) => {
	const hook = renderHook(() => useEndDeployment({
		deployment: deployment(setupBy),
		user: { id: 'user-1' },
		storeDevice: { id: 'ble-1', connected } as any,
		retrievalNotes: 'Battery low',
		navigation: { reset: jest.fn() },
		quiesceDevice: jest.fn(async () => {}),
		isNavigatingAway: { current: false },
	}))
	await settle()
	return hook
}

const end = async (result: { current: ReturnType<typeof useEndDeployment> }) => {
	await act(async () => { await result.current.handleEndDeployment() })
}

beforeEach(() => {
	jest.spyOn(Alert, 'alert').mockImplementation(() => {})
	resetFakeDatabase()
	seedRows('projects', [{ id: 'project-1', name: 'Sinbad Gully' }])
	seedRows('users', [{ id: 'user-tui', firstname: 'Tui Smith', surname: '' }])
})

describe('Stop Monitoring and the project role (#450)', () => {
	it('stops a viewer before the camera is touched, naming who can end it', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1')])
		const message = 'You are a viewer in "Sinbad Gully", and viewers cannot end deployments. Only Tui Smith, who started it, or a project admin can end it.'
		const { result } = await mount('user-tui')

		expect(result.current.endRefusalReason).toBe(message)
		await end(result)

		expect(Alert.alert).toHaveBeenCalledWith(TITLE, message)
		expect(createSession).not.toHaveBeenCalled()
		expect(endDeployment).not.toHaveBeenCalled()
		expect(result.current.isFinishing).toBe(false)
	})

	it('stops the creator made a viewer since, which is the case #450 saw', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1')])
		const { result } = await mount('user-1')

		await end(result)

		expect(Alert.alert).toHaveBeenCalledWith(TITLE, expect.stringMatching(/^You started this deployment, but you are now a viewer in "Sinbad Gully"/))
		expect(endDeployment).not.toHaveBeenCalled()
	})

	it('does not offer a viewer Force End on a disconnected camera', async () => {
		seedRows('user_roles', [role('project_viewer', 'project', 'project-1')])
		const { result } = await mount('user-tui', false)

		await end(result)

		expect(Alert.alert).toHaveBeenCalledTimes(1)
		expect(Alert.alert).toHaveBeenCalledWith(TITLE, expect.stringMatching(/^You are a viewer/))
		expect(endDeployment).not.toHaveBeenCalled()
	})

	it('stops an organisation manager, as the server does', async () => {
		seedRows('user_roles', [role('organisation_manager', 'organisation', 'org-1')])
		const { result } = await mount('user-tui')

		await end(result)

		expect(Alert.alert).toHaveBeenCalledWith(TITLE, expect.stringMatching(/^You are not a member of "Sinbad Gully"/))
		expect(endDeployment).not.toHaveBeenCalled()
	})

	it('lets the creator end their own while a member, offline from the phone\'s roles', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'project-1')])
		const { result } = await mount('user-1')

		expect(result.current.endRefusalReason).toBeNull()
		await end(result)

		expect(Alert.alert).not.toHaveBeenCalled()
		expect(createSession).toHaveBeenCalled()
		expect(endDeployment).toHaveBeenCalledWith('dep-1', 'user-1', 'Battery low')
		expect(getSupabaseClient).not.toHaveBeenCalled()
	})

	it("lets a project admin or a ww_admin end anyone's", async () => {
		seedRows('user_roles', [role('project_admin', 'project', 'project-1')])
		let { result } = await mount('user-tui')
		await end(result)
		expect(endDeployment).toHaveBeenCalledTimes(1)

		resetFakeDatabase()
		seedRows('user_roles', [role('ww_admin', 'system', null)])
		;({ result } = await mount('user-tui'))
		await end(result)
		expect(endDeployment).toHaveBeenCalledTimes(2)
	})

	it('still offers a member Force End on their own deployment when the camera is gone', async () => {
		seedRows('user_roles', [role('project_member', 'project', 'project-1')])
		const { result } = await mount('user-1', false)

		await end(result)

		const [title, , buttons] = (Alert.alert as jest.Mock).mock.calls[0]
		expect(title).toBe('Connection Lost')
		const forceEnd = buttons.find((b: any) => b.text === 'Force End (Database Only)')
		await act(async () => { await forceEnd.onPress() })
		expect(endDeployment).toHaveBeenCalledWith('dep-1', 'user-1', 'Battery low')
	})
})
