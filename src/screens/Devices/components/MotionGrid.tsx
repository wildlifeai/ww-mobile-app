/**
 * MotionGrid — Pure React Native 16×16 motion detection grid.
 *
 * Lightweight replacement for SkiaGrid. Uses a flat list of Views
 * with absolute positioning to minimise reconciliation overhead.
 * No native dependencies required.
 */
import React, { useMemo } from 'react'
import { View } from 'react-native'
import { useTheme } from 'react-native-paper'

interface MotionGridProps {
    /** 16×16 boolean grid — true = motion detected */
    grid: boolean[][]
    /** Total width/height in dp */
    size?: number
    /** Gap between cells in dp */
    gap?: number
}

/**
 * Renders a 16×16 boolean grid as colored rectangles.
 * Pre-computes cell styles to avoid per-frame object allocation.
 */
export const MotionGrid = React.memo<MotionGridProps>(({ grid, size = 288, gap = 1 }) => {
    const theme = useTheme()
    const cellSize = (size - gap * 15) / 16
    const activeColor = '#4CAF50'
    const inactiveColor = theme.colors.surfaceVariant

    // Pre-compute cell positions (only recalculated when size/gap change)
    const cells = useMemo(() => {
        const result: { key: number; x: number; y: number }[] = []
        for (let row = 0; row < 16; row++) {
            for (let col = 0; col < 16; col++) {
                result.push({
                    key: row * 16 + col,
                    x: col * (cellSize + gap),
                    y: row * (cellSize + gap),
                })
            }
        }
        return result
    }, [cellSize, gap])

    return (
        <View style={{ width: size, height: size }}>
            {cells.map(cell => {
                const row = Math.floor(cell.key / 16)
                const col = cell.key % 16
                const isActive = grid[row]?.[col] ?? false
                return (
                    <View
                        key={cell.key}
                        style={{
                            position: 'absolute',
                            left: cell.x,
                            top: cell.y,
                            width: cellSize,
                            height: cellSize,
                            backgroundColor: isActive ? activeColor : inactiveColor,
                        }}
                    />
                )
            })}
        </View>
    )
})

/**
 * Compact version for frame history thumbnails.
 */
export const MiniGrid = React.memo<{ grid: boolean[][]; size?: number }>(({ grid, size = 64 }) => {
    return <MotionGrid grid={grid} size={size} gap={0.5} />
})
