import fs from 'fs'
import path from 'path'
import { Text } from 'react-native'
import { render } from '@testing-library/react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { PaperProvider } from 'react-native-paper'

import { OfflineAwareRoot } from '../OfflineIndicator'

const netInfo = require('@react-native-community/netinfo')

const metrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
}

const renderApp = () => render(
    <SafeAreaProvider initialMetrics={metrics}>
        <PaperProvider>
            <OfflineAwareRoot>
                <Text>screen</Text>
            </OfflineAwareRoot>
        </PaperProvider>
    </SafeAreaProvider>,
)

/**
 * Offline showed two different signs: a red "Offline Mode" banner that some
 * screens placed by hand, and a small "Offline" chip in the stack header. On
 * the bench one page had one and the next page the other. Now there is one
 * banner, above every screen.
 */
describe('the offline banner', () => {
    afterEach(() => netInfo.__resetNetworkState())

    it('shows once, above the app, when there is no connection', () => {
        netInfo.__setNetworkState({ isConnected: false })
        const { getAllByText, getByText } = renderApp()

        expect(getAllByText('Offline Mode')).toHaveLength(1)
        expect(getByText('screen')).toBeTruthy()
    })

    it('does not show online', () => {
        netInfo.__setNetworkState({ isConnected: true })
        const { queryByText } = renderApp()

        expect(queryByText('Offline Mode')).toBeNull()
    })

    // Nothing else may draw one: a screen or a header that brings its own
    // would put a second, different sign on the page again.
    it('is the only offline sign in the app', () => {
        const srcDir = path.resolve(__dirname, '../../..')
        const offenders: string[] = []
        const walk = (dir: string) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name)
                if (entry.isDirectory()) {
                    if (entry.name !== '__tests__') walk(full)
                } else if (/\.tsx?$/.test(entry.name)) {
                    const source = fs.readFileSync(full, 'utf8')
                    const rel = path.relative(srcDir, full).replace(/\\/g, '/')
                    if (rel !== 'components/ui/OfflineIndicator.tsx' && /<OfflineIndicator\b/.test(source)) offenders.push(rel)
                    if (/useNetInfo\(/.test(source) && rel !== 'components/ui/OfflineIndicator.tsx') offenders.push(`${rel} (useNetInfo)`)
                }
            }
        }
        walk(srcDir)

        expect(offenders).toEqual([])
    })
})
