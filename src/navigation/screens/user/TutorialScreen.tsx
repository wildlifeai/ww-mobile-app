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
    Animated,
    NativeSyntheticEvent,
    NativeScrollEvent,
    Image,
    ImageSourcePropType,
    useWindowDimensions,
} from 'react-native'
import { Button, Text } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppDispatch, useAppSelector } from '../../../redux'
import { completeTutorial } from '../../../redux/slices/authSlice'
import { useAppNavigation } from '../../../hooks/useAppNavigation'
import { WWText } from '../../../components/ui/WWText'
import { useExtendedTheme } from '../../../theme'

interface TutorialStep {
    id: string
    title: string
    description: string
    images: ImageSourcePropType[]
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'welcome',
        title: 'Welcome to the Wildlife Watcher app',
        description:
            'This quick tutorial will show you how to use the app. There are three main pages: Scanner, Map, and Projects.',
        images: [require('../../../../assets/tutorial/homepage.png')],
    },
    {
        id: 'projects',
        title: 'Projects',
        description:
            'The app uses projects to help you use multiple cameras to monitoring for the same animal(s) or in a similar area.\n\n⚠️ Note: You need to have at least one project to use the Wildlife Watchers.',
        images: [require('../../../../assets/tutorial/project_page.png')],
    },
    {
        id: 'connect',
        title: 'Scanner',
        description:
            'Use the Scanner tab to find nearby Watchers and connect to them.',
        images: [
            require('../../../../assets/tutorial/homepage.png'),
            require('../../../../assets/tutorial/connect_device_page.png'),
        ],
    },
    {
        id: 'deploy',
        title: 'Start Monitoring',
        description:
            'When you connect to the Wildlife Watcher you need to specify the associated project for the monitoring and record any notes. You can also preview the field of view of the camera, motion detection and other advanced settings.',
        images: [require('../../../../assets/tutorial/start_monitoring_page.png')],
    },
    {
        id: 'data',
        title: 'Live and Stop Monitoring',
        description:
            'When a Wildlife Watcher is monitoring you can connect to it and see in real time the camera activity. You can also stop the monitoring from this page.\n\n🐾 Thanks for choosing the Wildlife Watchers for your conservation work!',
        images: [require('../../../../assets/tutorial/live_monitoring_page.png')],
    },
]

export const TutorialScreen = () => {
    const dispatch = useAppDispatch()
    const navigation = useAppNavigation()
    const { top, bottom } = useSafeAreaInsets()
    const { colors, spacing } = useExtendedTheme()
    const { width: screenWidth, height: screenHeight } = useWindowDimensions()
    const pendingTutorial = useAppSelector(
        (state) => state.authentication.pendingTutorial,
    )

    const flatListRef = useRef<FlatList>(null)
    const scrollX = useRef(new Animated.Value(0)).current
    const [currentIndex, setCurrentIndex] = useState(0)

    const handleExit = useCallback(() => {
        if (pendingTutorial) {
            dispatch(completeTutorial())
        } else if (navigation.canGoBack()) {
            navigation.goBack()
        } else {
            navigation.navigate('Home')
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
        { useNativeDriver: true },
    )

    const onMomentumScrollEnd = useCallback(
        (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            const index = Math.round(
                e.nativeEvent.contentOffset.x / screenWidth,
            )
            setCurrentIndex(index)
        },
        [screenWidth],
    )

    // Phone frame dimensions — fill most of the available vertical space
    // Use screen height (not width) so the frame is substantial on tall phones
    const phoneFrameHeight = screenHeight * 0.52
    const phoneFrameWidth = Math.min(phoneFrameHeight * 0.48, screenWidth * 0.55)
    const hasMultipleImages = (item: TutorialStep) => item.images.length > 1

    const renderPhoneFrame = useCallback(
        (source: ImageSourcePropType, frameWidth: number, frameHeight: number) => (
            <View style={[styles.phoneFrame, { width: frameWidth, height: frameHeight, borderColor: colors.outlineVariant }]}>
                <Image
                    source={source}
                    style={styles.phoneImage}
                    resizeMode="cover"
                />
            </View>
        ),
        [colors],
    )

    const renderItem = useCallback(
        ({ item }: { item: TutorialStep }) => {
            const isMulti = hasMultipleImages(item)
            const singleWidth = phoneFrameWidth
            const singleHeight = phoneFrameHeight
            // For dual images, make each smaller
            const multiWidth = phoneFrameWidth * 0.78
            const multiHeight = phoneFrameHeight * 0.78

            return (
                <View style={[styles.slide, { width: screenWidth }]}>
                    {/* Title above the screenshot */}
                    <WWText style={[styles.title, { color: colors.onBackground }]}>
                        {item.title}
                    </WWText>

                    {/* Phone frame(s) */}
                    <View style={styles.imageContainer}>
                        {isMulti ? (
                            <View style={styles.multiImageRow}>
                                {item.images.map((img, i) => (
                                    <View key={i}>
                                        {renderPhoneFrame(img, multiWidth, multiHeight)}
                                    </View>
                                ))}
                            </View>
                        ) : (
                            renderPhoneFrame(item.images[0], singleWidth, singleHeight)
                        )}
                    </View>

                    {/* Description below the screenshot */}
                    <WWText
                        style={[
                            styles.description,
                            { color: colors.onSurfaceVariant },
                        ]}
                    >
                        {item.description}
                    </WWText>
                </View>
            )
        },
        [colors, screenWidth, phoneFrameWidth, phoneFrameHeight, renderPhoneFrame],
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
            <Animated.FlatList
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
                style={{ flex: 1 }}
                getItemLayout={(_, index) => ({
                    length: screenWidth,
                    offset: screenWidth * index,
                    index,
                })}
            />

            {/* Pagination dots */}
            <View style={styles.paginationRow}>
                {TUTORIAL_STEPS.map((step, i) => {
                    const inputRange = [
                        (i - 1) * screenWidth,
                        i * screenWidth,
                        (i + 1) * screenWidth,
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
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingTop: 8,
    },
    imageContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    multiImageRow: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    // Phone frame — rounded border to convey "mobile screen"
    phoneFrame: {
        borderWidth: 2,
        borderRadius: 14,
        overflow: 'hidden',
    },
    phoneImage: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 6,
    },
    description: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 8,
        marginBottom: 4,
    },
    paginationRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
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
