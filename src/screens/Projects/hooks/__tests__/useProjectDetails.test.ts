import { Alert } from 'react-native'
import { renderHook, act } from '@testing-library/react-native'

import { useProjectDetails, ProjectFormData } from '../useProjectDetails'

const mockUpdateProject = jest.fn()
const mockRefetch = jest.fn()
const mockProject = {
    id: 'project-1',
    name: 'Mega101',
    description: '',
    is_active: true,
    is_archived: false,
    record_gps_in_images: true,
    role: 'project_admin',
}

jest.mock('../../../../redux', () => ({ useAppSelector: jest.fn(() => null) }))
jest.mock('../../../../redux/api/projectsApi', () => ({
    useGetProjectByIdQuery: () => ({ data: mockProject, isLoading: false, error: undefined, refetch: mockRefetch }),
    useUpdateProjectMutation: () => [mockUpdateProject, { isLoading: false }],
    useGetProjectMembersQuery: () => ({ data: [], isLoading: false }),
    useRemoveProjectMemberMutation: () => [jest.fn()],
    useGetCaptureMethodsQuery: () => ({ data: [] }),
    useGetActivitySensitivityQuery: () => ({ data: [] }),
    useGetAiModelsQuery: () => ({ data: [] }),
    useGetSamplingDesignsQuery: () => ({ data: [] }),
}))
jest.mock('../../../../utils/logger', () => ({ log: jest.fn(), logWarn: jest.fn(), logError: jest.fn() }))

const form = (overrides: Partial<ProjectFormData> = {}): ProjectFormData => ({
    name: 'Mega101',
    description: '',
    sampling_design_id: '',
    website: '',
    is_baited: true,
    is_monitoring_marked_individuals: false,
    capture_method_id: '',
    activity_detection_sensitivity_id: '',
    timelapse_interval_seconds: '',
    model_id: '__none__',
    record_gps_in_images: true,
    lorawan_required: false,
    flash_mode: 'off',
    flash_led: 'ir',
    flash_window_start_minutes_utc: '',
    flash_window_minutes: '',
    ...overrides,
})

type AlertButton = { text: string; onPress?: () => void }

/** Press one button of the most recent Alert.alert call. */
const press = (alert: jest.SpyInstance, text: string) => {
    const buttons = alert.mock.calls[alert.mock.calls.length - 1][2] as AlertButton[]
    act(() => buttons.find((b) => b.text === text)!.onPress!())
}

describe('useProjectDetails.handleSave', () => {
    let alert: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
        mockUpdateProject.mockReturnValue({ unwrap: () => Promise.resolve(mockProject) })
    })

    // A refetch that throws once its query has unmounted must not turn a
    // written project into "Update Failed" (#191).
    it('reports a written project as saved even if the query can no longer refetch', async () => {
        mockRefetch.mockImplementation(() => {
            throw new Error('Cannot refetch a query that has not been started yet.')
        })
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        let saved!: boolean
        await act(async () => {
            saved = await result.current.handleSave(form({ is_baited: false }))
        })

        expect(saved).toBe(true)
        expect(alert).not.toHaveBeenCalledWith('Update Failed', expect.anything(), expect.anything())
    })

    it('shows Update Failed and resolves false when the write fails', async () => {
        mockUpdateProject.mockReturnValue({ unwrap: () => Promise.reject(new Error('disk full')) })
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        let saved!: boolean
        await act(async () => {
            saved = await result.current.handleSave(form())
        })

        expect(saved).toBe(false)
        expect(alert).toHaveBeenCalledWith('Update Failed', expect.any(String), expect.any(Array))
    })

    it('saves an ordinary edit without asking', async () => {
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        let saved!: boolean
        await act(async () => {
            saved = await result.current.handleSave(form({ is_baited: false }))
        })

        expect(saved).toBe(true)
        expect(alert).not.toHaveBeenCalled()
        expect(mockUpdateProject).toHaveBeenCalledWith({
            id: 'project-1',
            updates: expect.objectContaining({ is_baited: false }),
        })
        // Saving the settings can never archive the project (#191)
        const { updates } = mockUpdateProject.mock.calls[0][0]
        expect(updates).not.toHaveProperty('is_archived')
        expect(updates).not.toHaveProperty('is_active')
    })
})

// #191: archiving is its own action, not one of the project's settings, and the
// confirmation used to return before the user answered.
describe('useProjectDetails.handleArchive', () => {
    let alert: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
        mockUpdateProject.mockReturnValue({ unwrap: () => Promise.resolve(mockProject) })
    })

    it('waits for the confirmation and archives only after Continue', async () => {
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        let archived!: Promise<boolean>
        act(() => {
            archived = result.current.handleArchive()
        })

        expect(alert).toHaveBeenCalledWith('Archive Project', expect.any(String), expect.any(Array), expect.any(Object))
        expect(mockUpdateProject).not.toHaveBeenCalled()

        press(alert, 'Continue')

        await expect(archived).resolves.toBe(true)
        expect(mockUpdateProject).toHaveBeenCalledWith({
            id: 'project-1',
            updates: { is_active: false, is_archived: true },
        })
    })

    it('writes nothing and resolves false when cancelled', async () => {
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        let archived!: Promise<boolean>
        act(() => {
            archived = result.current.handleArchive()
        })
        press(alert, 'Cancel')

        await expect(archived).resolves.toBe(false)
        expect(mockUpdateProject).not.toHaveBeenCalled()
    })

    it('says so and resolves false when the write fails', async () => {
        mockUpdateProject.mockReturnValue({ unwrap: () => Promise.reject(new Error('offline')) })
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        let archived!: Promise<boolean>
        act(() => {
            archived = result.current.handleArchive()
        })
        press(alert, 'Continue')

        await expect(archived).resolves.toBe(false)
        expect(alert).toHaveBeenCalledWith('Archive Failed', expect.any(String), expect.any(Array))
    })
})

// Edit Project had no record_gps_in_images in its form: the box always showed
// unticked and a change to it never reached the project, which the deployment
// reads when it decides whether to write the real GPS to the camera (#315).
describe('useProjectDetails, Record GPS locations in images', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.spyOn(Alert, 'alert').mockImplementation(() => {})
        mockUpdateProject.mockReturnValue({ unwrap: () => Promise.resolve(mockProject) })
    })

    it('loads the value the project holds into the form', async () => {
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        const submitted = jest.fn()
        await act(async () => {
            await result.current.handleSubmit(submitted)()
        })

        expect(submitted).toHaveBeenCalledWith(
            expect.objectContaining({ record_gps_in_images: true }),
            undefined
        )
    })

    it('sends a changed value with the save', async () => {
        const { result } = renderHook(() => useProjectDetails('project-1', true))

        await act(async () => {
            await result.current.handleSave(form({ record_gps_in_images: false }))
        })

        expect(mockUpdateProject).toHaveBeenCalledWith({
            id: 'project-1',
            updates: expect.objectContaining({ record_gps_in_images: false }),
        })
    })
})
