/**
 * TutorialScreen — 5-step onboarding carousel shown after explicit login.
 *
 * Two modes:
 * - Gating mode (pendingTutorial=true): dispatching completeTutorial() causes
 *   the root navigator to declaratively swap to the main app stack.
 * - Sidebar mode (navigated manually): uses navigation.goBack().
 */

import { useRef, useCallback, useState } from 'react'
import {
    View,
    FlatList,
    StyleSheet,
    Dimensions,
    Animated,
    NativeSyntheticEvent,
    NativeScrollEvent,
} from 'react-native'
import { Button, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useAppDispatch, useAppSelector } from '../../../redux'
import { completeTutorial } from '../../../redux/slices/authSlice'
import { useAppNavigation } from '../../../hooks/useAppNavigation'
import { WWText } from '../../../components/ui/WWText'
import { useExtendedTheme } from '../../../theme'

interface TutorialStep {
    id: string
    title: string
    description: string
    icon: keyof typeof MaterialCommunityIcons.glyphMap
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to Wildlife Watcher',
        description:
            'Monitor wildlife with smart camera traps. This quick tutorial will show you how the app works.',
        icon: 'paw',
    },
    {
        id: 'projects',
        title: 'Organise Your Projects',
        description:
            'Create projects for different monitoring locations. Each project groups deployments, devices, and captured data together.',
        icon: 'folder-multiple',
    },
    {
        id: 'connect',
        title: 'Connect Your Device',
        description:
            'Use the Scanner tab to find nearby Wildlife Watcher devices via Bluetooth. Pair once, and the app remembers your device.',
        icon: 'bluetooth-connect',
    },
    {
        id: 'deploy',
        title: 'Start Monitoring',
        description:
            'Configure your device settings — detection sensitivity, timelapse interval, AI model — then deploy to start capturing wildlife data.',
        icon: 'camera-iris',
    },
    {
        id: 'data',
        title: 'Review & Share Data',
        description:
            'View captured images on the Map, review AI detections, and share results with your team. All data syncs automatically.',
        icon: 'chart-bar',
    },
]

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export const TutorialScreen = () => {
    const dispatch = useAppDispatch()
    const navigation = useAppNavigation()
    const { top, bottom } = useSafeAreaInsets()
    const { colors, spacing } = useExtendedTheme()
    const pendingTutorial = useAppSelector(
        (state) => state.authentication.pendingTutorial,
    )

    const flatListRef = useRef<FlatList>(null)
    const scrollX = useRef(new Animated.Value(0)).current
    const [currentIndex, setCurrentIndex] = useState(0)

    const handleExit = useCallback(() => {
        if (pendingTutorial) {
            // Gating mode — declarative swap happens automatically
            dispatch(completeTutorial())
        } else {
            // Sidebar mode — go back to wherever we came from
            navigation.goBack()
        }
    }, [dispatch, navigation, pendingTutorial])

    const handleNext = useCallback(() => {
        if (currentIndex < TUTORIAL_STEPS.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })
        } else {
            handleExit()
        }
    }, [currentIndex, handleExit])

    const onScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false },
    )

    const onMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const index = Math.round(
                e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
            )
            setCurrentIndex(index)
        },
        [],
    )

    const renderItem = useCallback(
        ({ item }: { item: TutorialStep }) => (
            <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
                <View
                    style={[
                        styles.iconContainer,
                        { backgroundColor: colors.primaryContainer },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={item.icon}
                        size={72}
                        color={colors.primary}
                    />
                </View>
                <WWText style={[styles.title, { color: colors.onBackground }]}>
                    <Text>{item.title}</Text>
                </WWText>
                <WWText
                    style={[
                        styles.description,
                        { color: colors.onSurfaceVariant },
                    ]}
                >
                    <Text>{item.description}</Text>
                </WWText>
            </View>
        ),
        [colors],
    )

    const isLastSlide = currentIndex === TUTORIAL_STEPS.length - 1

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.background,
                    paddingTop: top + spacing,
                    paddingBottom: bottom + spacing,
                },
            ]}
        >
            {/* Skip button */}
            <View style={styles.skipRow}>
                <Button
                    mode="text"
                    onPress={handleExit}
                    textColor={colors.onSurfaceVariant}
                    testID="tutorial-skip-button"
                >
                    <Text>Skip</Text>
                </Button>
            </View>

            {/* Carousel */}
            <FlatList
                ref={flatListRef}
                data={TUTORIAL_STEPS}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={onScroll}
                onMomentumScrollEnd={onMomentumScrollEnd}
                scrollEventThrottle={16}
                getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
            />

            {/* Pagination dots */}
            <View style={styles.paginationRow}>
                {TUTORIAL_STEPS.map((step, i) => {
                    const inputRange = [
                        (i - 1) * SCREEN_WIDTH,
                        i * SCREEN_WIDTH,
                        (i + 1) * SCREEN_WIDTH,
                    ]
                    const dotScale = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.8, 1.3, 0.8],
                        extrapolate: 'clamp',
                    })
                    const dotOpacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    })
                    return (
                        <Animated.View
                            key={step.id}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: colors.primary,
                                    opacity: dotOpacity,
                                    transform: [{ scale: dotScale }],
                                },
                            ]}
                        />
                    )
                })}
            </View>

            {/* Next / Get Started button */}
            <View style={[styles.buttonRow, { paddingHorizontal: spacing * 2 }]}>
                <Button
                    mode="contained"
                    onPress={handleNext}
                    style={styles.nextButton}
                    testID="tutorial-next-button"
                >
                    <Text>{isLastSlide ? 'Get Started' : 'Next'}</Text>
                </Button>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    skipRow: {
        alignItems: 'flex-end',
        paddingHorizontal: 8,
    },
    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        width: 140,
        height: 140,
        borderRadius: 70,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    title: {
        fontSize: 26,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
    },
    description: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    paginationRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 24,
        gap: 10,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    nextButton: {
        borderRadius: 24,
        paddingVertical: 4,
    },
    buttonRow: {
        paddingBottom: 8,
    },
})
