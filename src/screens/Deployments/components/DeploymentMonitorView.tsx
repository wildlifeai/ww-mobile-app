import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useExtendedTheme } from '../../../theme'
import { useDeploymentMonitor } from '../hooks/useDeploymentMonitor'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { LiveActivityLog } from './LiveActivityLog'

interface Props {
  device: ExtendedPeripheral | null
  captureMethodId?: number | null
  onDisconnect: () => void
}

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

export const DeploymentMonitorView: React.FC<Props> = ({
  device,
  captureMethodId,
  onDisconnect,
}) => {
  const { colors } = useExtendedTheme()
  const { bottom } = useSafeAreaInsets()
  const { stats } = useDeploymentMonitor(device)

  const showMotion = captureMethodId === 1 || captureMethodId === 3
  const showTimelapse = captureMethodId === 2 || captureMethodId === 3

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Stats Bar */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="camera" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.onSurface }]}>{stats.photoCount}</Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Photos</Text>
        </View>
        {showMotion && (
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="run" size={24} color={colors.tertiary || '#FF9800'} />
            <Text style={[styles.statValue, { color: colors.onSurface }]}>{stats.motionCount}</Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Motion</Text>
          </View>
        )}
        {showTimelapse && (
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="timer-sand" size={24} color="#9C27B0" />
            <Text style={[styles.statValue, { color: colors.onSurface }]}>{stats.timelapseCount}</Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Timelapse</Text>
          </View>
        )}
        {stats.deviceImageCount !== null && (
          <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <MaterialCommunityIcons name="image-multiple" size={24} color="#4CAF50" />
            <Text style={[styles.statValue, { color: colors.onSurface }]}>{stats.deviceImageCount}</Text>
            <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Stored</Text>
          </View>
        )}
      </View>

      <View style={[styles.timeContainer, { backgroundColor: colors.surfaceVariant }]}>
        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.onSurfaceVariant} />
        <Text style={[styles.timeText, { color: colors.onSurfaceVariant }]}>
          Monitoring Time: {formatTime(stats.timeActiveMs)}
        </Text>
      </View>

      {/* Activity Log */}
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Live Monitoring Log</Text>
      <View style={styles.logContainer}>
        <LiveActivityLog device={device} />
      </View>

      {/* Spacer to push footer down */}
      <View style={{ flex: 1 }} />

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.surfaceVariant, paddingBottom: bottom + 16 }]}>
        <Text style={[styles.footerNote, { color: colors.onSurfaceVariant }]}>
          Note: The wildlife watcher will continue monitoring after disconnecting.
        </Text>
        <TouchableOpacity
          style={[styles.disconnectBtn, { borderColor: colors.error }]}
          onPress={onDisconnect}
          activeOpacity={0.7}
        >
          <Text style={[styles.disconnectText, { color: colors.error }]}>Disconnect from Wildlife Watcher</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    marginHorizontal: 4,
    borderRadius: 12,
    boxShadow: '0px 1px 1px 0px rgba(0,0,0,0.1)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 16,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  logContainer: {
    paddingHorizontal: 16,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    backgroundColor: 'transparent',
  },
  footerNote: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  disconnectBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
})
