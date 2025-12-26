import React, { useRef, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { Ionicons } from '@expo/vector-icons'

export interface ConsoleEntry {
    id: string
    timestamp: Date
    type: 'command' | 'response' | 'error' | 'info'
    content: string
}

interface Props {
    entries: ConsoleEntry[]
}

export const BleConsoleOutput: React.FC<Props> = ({ entries }) => {
    const scrollViewRef = useRef<ScrollView>(null)

    useEffect(() => {
        // Auto-scroll to bottom when new entries are added
        scrollViewRef.current?.scrollToEnd({ animated: true })
    }, [entries])

    const copyToClipboard = async (text: string) => {
        await Clipboard.setStringAsync(text)
    }

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }

    return (
        <View style={styles.container}>
            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
            >
                {entries.length === 0 ? (
                    <Text style={styles.emptyText}>No commands yet. Type 'help' or send a command.</Text>
                ) : (
                    entries.map((entry) => {
                        if (!entry) return null
                        return (
                            <TouchableOpacity
                                key={entry.id}
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
                        )
                    })
                )}
            </ScrollView>
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
