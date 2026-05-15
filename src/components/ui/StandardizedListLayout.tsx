import React from 'react'
import {
    View,
    FlatList,
    StyleSheet,
    RefreshControl,
    ListRenderItemInfo,
    ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
    FAB,
    Searchbar,
    ActivityIndicator,
    Text,
    useTheme,
    Button,
    IconButton,
} from 'react-native-paper'

import { OfflineIndicator } from './OfflineIndicator'
import { useAppDrawer } from '../AppDrawer'

interface StandardizedListLayoutProps<T> {
    // Data & Rendering
    data: T[]
    renderItem: (info: ListRenderItemInfo<T>) => React.ReactElement | null
    keyExtractor: (item: T) => string
    isLoading: boolean
    isFetching?: boolean
    onRefresh?: () => void
    error?: unknown
    onRetry?: () => void

    // Search
    searchQuery: string
    onSearchChange: (query: string) => void
    searchPlaceholder: string

    // Actions
    primaryActionLabel: string
    onPrimaryAction: () => void
    secondaryActionLabel?: string
    onSecondaryAction?: () => void
    secondaryActionIcon?: string
    secondaryActionColor?: string

    // Empty States
    emptyStateTitle: string
    emptyStateMessage: string
    emptySearchMessage?: string

    // Customization
    filterActions?: React.ReactNode
    fabStyle?: ViewStyle
    contentContainerStyle?: ViewStyle
}

export function StandardizedListLayout<T>({
    data,
    renderItem,
    keyExtractor,
    isLoading,
    isFetching = false,
    onRefresh,
    error,
    onRetry,
    searchQuery,
    onSearchChange,
    searchPlaceholder,
    primaryActionLabel,
    onPrimaryAction,
    secondaryActionLabel,
    onSecondaryAction,
    secondaryActionIcon = 'wrench',
    secondaryActionColor,
    emptyStateTitle,
    emptyStateMessage,
    emptySearchMessage,
    filterActions,
    fabStyle,
    contentContainerStyle,
}: StandardizedListLayoutProps<T>) {
    const theme = useTheme()
    const { setIsOpen } = useAppDrawer()

    // Loading State (Initial Load)
    if (isLoading && (!data || data.length === 0)) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <OfflineIndicator />
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" />
                    <Text variant="bodyMedium" style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
                        Loading…
                    </Text>
                </View>
            </SafeAreaView>
        )
    }

    // Error State
    if (error && (!data || data.length === 0)) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <OfflineIndicator />
                <View style={styles.centerContainer}>
                    <Text variant="headlineSmall" style={[styles.errorTitle, { color: theme.colors.error }]}>
                        Something went wrong
                    </Text>
                    <Text variant="bodyMedium" style={[styles.errorMessage, { color: theme.colors.onSurfaceVariant }]}>
                        {typeof error === 'object' && error !== null && 'error' in error
                            ? String((error as any).error)
                            : 'An unexpected error occurred'}
                    </Text>
                    {onRetry && (
                        <Button mode="contained" onPress={onRetry} style={styles.retryButton}>
                            <Text>Retry</Text>
                        </Button>
                    )}
                </View>
            </SafeAreaView>
        )
    }

    const isEmpty = !data || data.length === 0
    const showEmptyState = isEmpty && !searchQuery

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <OfflineIndicator />

            {/* Header / Search Area */}
            <View style={styles.headerContainer}>
                {/* Hamburger Menu Button */}
                <IconButton
                    icon="menu"
                    iconColor={theme.colors.onSurface}
                    size={28}
                    style={styles.menuIcon}
                    onPress={() => setIsOpen(true)}
                />

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Searchbar
                        placeholder={searchPlaceholder}
                        onChangeText={onSearchChange}
                        value={searchQuery}
                        style={styles.searchbar}
                    />
                </View>
            </View>
            
            {/* Filter Actions */}
            {filterActions && (
                <View style={styles.filterContainer}>
                    {filterActions}
                </View>
            )}

            {/* Main Content */}
            {showEmptyState ? (
                <View style={styles.centerContainer}>
                    <Text variant="headlineSmall" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                        {emptyStateTitle}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.emptyMessage, { color: theme.colors.onSurfaceVariant }]}>
                        {emptyStateMessage}
                    </Text>
                    <Button
                        mode="contained"
                        icon="plus"
                        onPress={onPrimaryAction}
                        style={styles.createButton}
                    >
                        <Text>{primaryActionLabel}</Text>
                    </Button>
                </View>
            ) : (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={[styles.listContent, contentContainerStyle]}
                    refreshControl={
                        onRefresh ? (
                            <RefreshControl
                                refreshing={isFetching}
                                onRefresh={onRefresh}
                                colors={[theme.colors.primary]}
                                tintColor={theme.colors.primary}
                            />
                        ) : undefined
                    }
                    ListEmptyComponent={
                        <View style={styles.centerContainer}>
                            <Text variant="bodyLarge" style={[styles.emptySearchText, { color: theme.colors.onSurfaceVariant }]}>
                                {emptySearchMessage || `No items found matching "${searchQuery}"`}
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Floating Action Buttons */}
            {/* Secondary Action (if provided) - Stacked above primary */}
            {onSecondaryAction && secondaryActionLabel && (
                <FAB
                    icon={secondaryActionIcon}
                    label={secondaryActionLabel}
                    style={[styles.secondaryFab, fabStyle, { backgroundColor: secondaryActionColor || theme.colors.secondary }]}
                    onPress={onSecondaryAction}
                />
            )}

            {/* Primary Action */}
            <FAB
                icon="plus"
                label={!showEmptyState ? primaryActionLabel : undefined} // Hide label if empty state button is visible? Actually standard behavior usually keeps it or hides it. 
                // Let's keep the FAB always visible for consistency unless it's strictly the create-first flow. 
                // But the user requested "bottom right action buttons". 
                // The empty state usually has a center button.
                // We'll hide the FAB if we are in the empty state (0 items total) to avoid duplication with the center button.
                visible={!showEmptyState}
                style={[styles.fab, fabStyle, { backgroundColor: theme.colors.primary }]}
                onPress={onPrimaryAction}
            />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    menuIcon: {
        margin: 0,
        marginRight: 4,
    },
    searchContainer: {
        flex: 1,
    },
    searchbar: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100, // Space for FABs
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
    },
    errorTitle: {
        marginBottom: 8,
        textAlign: 'center',
    },
    errorMessage: {
        marginBottom: 24,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 8,
    },
    emptyTitle: {
        marginBottom: 8,
        textAlign: 'center',
        fontWeight: '600',
    },
    emptyMessage: {
        marginBottom: 24,
        textAlign: 'center',
        maxWidth: 280,
    },
    createButton: {
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
    secondaryFab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 70, // Stack above primary FAB
    },
    emptySearchText: {
        textAlign: 'center',
    },
    filterContainer: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
})
