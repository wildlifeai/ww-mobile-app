/**
 * MotionGrid: Text-based 16×16 motion detection grid.
 *
 * Renders the precomputed grid string as a single <Text> node.
 * Uses block characters (█ for motion, · for none) with a monospace font.
 *
 * Performance: 1 Text node instead of 256 Views.
 * Zero reconciliation overhead: just a string swap.
 */
import React from 'react'
import { Text, Platform, StyleSheet } from 'react-native'

interface MotionGridProps {
    /** Precomputed display string (16 lines of 16 chars). */
    gridString: string
    /** Font size in dp: controls the overall grid size */
    fontSize?: number
}

/**
 * Renders a 16×16 grid as a single monospace <Text> node.
 * The gridString is precomputed at parse time: this component
 * does ZERO computation. Just renders the string.
 */
export const MotionGrid = React.memo<MotionGridProps>(({ gridString, fontSize = 16 }) => (
    <Text style={[styles.grid, { fontSize, lineHeight: fontSize * 1.1 }]}>
        {gridString}
    </Text>
))

/**
 * Compact version for frame history thumbnails.
 */
export const MiniGrid = React.memo<{ gridString: string }>(({ gridString }) => (
    <Text style={[styles.grid, styles.miniGrid]}>
        {gridString}
    </Text>
))

const styles = StyleSheet.create({
    grid: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 16,
        lineHeight: 16 * 1.1,
        letterSpacing: 1,
        color: '#4CAF50',
    },
    miniGrid: {
        fontSize: 3.5,
        lineHeight: 3.5 * 1.1,
        letterSpacing: 0,
    },
})
