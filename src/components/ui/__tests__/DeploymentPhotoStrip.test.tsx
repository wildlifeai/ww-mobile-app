import { Modal } from 'react-native'
import { render, screen, fireEvent } from '@testing-library/react-native'

import { DeploymentPhotoStrip } from '../DeploymentPhotoStrip'
import { DeploymentPhotoService } from '../../../services/DeploymentPhotoService'

jest.mock('../../../services/DeploymentPhotoService', () => ({
    DeploymentPhotoService: { getDisplayUrl: jest.fn() },
}))

// The shared paper mock has no Surface, which ImagePreviewModal renders
jest.mock('react-native-paper', () => {
    const { View, Text, TouchableOpacity } = require('react-native')
    return {
        Surface: View,
        Text,
        IconButton: ({ onPress }: { onPress: () => void }) => <TouchableOpacity onPress={onPress} testID="preview-close" />,
        useTheme: () => ({ colors: {} }),
    }
})

const signed = (path: string) => `https://storage.test/object/sign/deployment-photos/${path}?token=abc.def`

const renderStrip = (paths: string[]) =>
    render(<DeploymentPhotoStrip deployment={{ cameraLocationImagePaths: paths } as any} />)

describe('DeploymentPhotoStrip', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ;(DeploymentPhotoService.getDisplayUrl as jest.Mock).mockImplementation(async (path: string) => signed(path))
    })

    it('renders nothing for a deployment without photos', () => {
        renderStrip([])
        expect(screen.toJSON()).toBeNull()
    })

    // #234: the map card's thumbnails were the only place a deployment's photos
    // appeared, and at 72 px they could not be looked at properly.
    it('opens a tapped photo full size, and closes it again', async () => {
        renderStrip(['p1/d1/first.jpg', 'p1/d1/second.jpg'])

        fireEvent.press(await screen.findByTestId('deployment-photo-1'))

        expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(true)
        // The footer names the file, not the signed URL and its token
        expect(screen.getByText('second.jpg')).toBeTruthy()

        fireEvent.press(screen.getByTestId('preview-close'))
        expect(screen.UNSAFE_queryByType(Modal)).toBeNull()
    })

    it('leaves out a photo whose URL cannot be resolved', async () => {
        ;(DeploymentPhotoService.getDisplayUrl as jest.Mock).mockImplementation(async (path: string) =>
            path.includes('offline') ? null : signed(path)
        )
        renderStrip(['p1/d1/offline.jpg', 'p1/d1/online.jpg'])

        expect(await screen.findByTestId('deployment-photo-0')).toBeTruthy()
        expect(screen.queryByTestId('deployment-photo-1')).toBeNull()
    })
})
