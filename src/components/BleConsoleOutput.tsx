import React, { useRef, useCallback, memo } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ListRenderItemInfo } from 'react-native'
import * as Clipboard from 'expo-clipboard'

export interface ConsoleEntry {
    id: string
    timestamp: Date
    type: 'command' | 'response' | 'error' | 'info'
    content: string
}

interface Props {
    entries: ConsoleEntry[]
}

const formatTime = (date: Date) =>
    date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

const copyToClipboard = (text: string) => {
    Clipboard.setStringAsync(text).catch(() => {})
}

/**
 * One line of the console, memoised so a new line draws one row and not the
 * history behind it.
 *
 * Until 22 September 2026 every entry was rebuilt on every BLE line, in a
 * plain ScrollView, and by the thousandth line each line cost the JS thread
 * about 1.3 s. The Engineer Console stays mounted under every flow it opens,
 * so that cost landed on every command of a deployment started from it: the
 * nRF answered a `setop` within 0.8 s and the app took 6 s to notice, and a
 * dev deployment start took 90 s.
 */
const Row = memo(({ entry }: { entry: ConsoleEntry }) => (
    <TouchableOpacity
        onLongPress={() => copyToClipboard(entry.content)}
        activeOpacity={0.8}
        style={[styles.entryContainer, styles[entry.type]]}
    >
        <View style={styles.entryHeader}>
            <Text style={styles.timestamp}>{formatTime(entry.timestamp)}</Text>
            <Text style={styles.typeLabel}>{entry.type.toUpperCase()}</Text>
        </View>
        <Text style={styles.content}>{entry.content}</Text>
    </TouchableOpacity>
))
Row.displayName = 'ConsoleRow'

export const BleConsoleOutput: React.FC<Props> = ({ entries }) => {
    const listRef = useRef<FlatList<ConsoleEntry>>(null)

    const renderItem = useCallback(({ item }: ListRenderItemInfo<ConsoleEntry>) => <Row entry={item} />, [])
    const keyExtractor = useCallback((item: ConsoleEntry) => item.id, [])
    // Follow the newest line, as the console always has.
    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: false })
    }, [])

    return (
        <View style={styles.container}>
            <FlatList
                ref={listRef}
                data={entries}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No commands yet. Type 'help' or send a command.</Text>
                }
                onContentSizeChange={scrollToEnd}
                initialNumToRender={40}
                maxToRenderPerBatch={40}
                windowSize={5}
                removeClippedSubviews
            />
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 10,
        paddingBottom: 20,
    },
    emptyText: {
        color: '#666',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 20,
    },
    entryContainer: {
        marginBottom: 8,
        padding: 8,
        borderRadius: 4,
        borderLeftWidth: 3,
    },
    entryHeader: {
        flexDirection: 'row',
        marginBottom: 4,
        opacity: 0.7,
    },
    timestamp: {
        color: '#AAA',
        fontSize: 10,
        marginRight: 8,
        fontFamily: 'monospace',
    },
    typeLabel: {
        color: '#AAA',
        fontSize: 10,
        fontWeight: 'bold',
    },
    content: {
        color: '#FFF',
        fontFamily: 'monospace',
        fontSize: 12,
    },
    command: {
        backgroundColor: '#2A2A2A',
        borderLeftColor: '#4CAF50', // Green
    },
    response: {
        backgroundColor: '#252525',
        borderLeftColor: '#2196F3', // Blue
    },
    error: {
        backgroundColor: '#3A2020',
        borderLeftColor: '#F44336', // Red
    },
    info: {
        backgroundColor: '#2A2A2A',
        borderLeftColor: '#FFC107', // Amber
    }
})
