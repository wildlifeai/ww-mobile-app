import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useExtendedTheme } from '../../../theme'
import { useDeploymentMonitor, ActivityLogEntry } from '../hooks/useDeploymentMonitor'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated'

interface Props {
  deviceName: string
  deploymentName: string
  device: ExtendedPeripheral | null
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

const formatDate = (timestamp: number) => {
  const d = new Date(timestamp)
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const PulseIndicator = () => {
  const { colors } = useExtendedTheme()
  const opacity = useSharedValue(0.4)
  const scale = useSharedValue(0.8)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.ease }),
        withTiming(0.4, { duration: 1000, easing: Easing.ease })
      ),
      -1,
      true
    )
    scale.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 1000, easing: Easing.ease }),
        withTiming(0.8, { duration: 1000, easing: Easing.ease })
      ),
      -1,
      true
    )
  }, [opacity, scale])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={[styles.pulseCircle, { backgroundColor: colors.success }, animatedStyle]} />
  )
}

export const DeploymentMonitorView: React.FC<Props> = ({
  deviceName,
  deploymentName,
  device,
  onDisconnect,
}) => {
  const { colors } = useExtendedTheme()
  const { activityLog, stats } = useDeploymentMonitor(device)
  const flatListRef = useRef<FlatList>(null)

  const getEventColor = (category: string) => {
    switch (category) {
      case 'capture':
      case 'nn_positive':
      case 'selftest_ok':
        return colors.success
      case 'wake':
      case 'info':
        return colors.primary
      case 'sleep':
        return colors.onSurfaceVariant
      case 'selftest_warn':
        return colors.error
      case 'motion':
        return colors.tertiary || '#FF9800' // Using orange if tertiary isn't available
      case 'timelapse':
        return '#9C27B0' // Purple
      default:
        return colors.onSurfaceVariant
    }
  }

  const renderLogItem = ({ item }: { item: ActivityLogEntry }) => {
    const iconColor = getEventColor(item.category)
    
    return (
      <View style={[styles.logItem, { backgroundColor: colors.surfaceVariant }]}>
        <View style={styles.logIconContainer}>
          <MaterialCommunityIcons name={item.icon} size={20} color={iconColor} />
        </View>
        <View style={styles.logContent}>
          <View style={styles.logHeader}>
            <Text style={[styles.logLabel, { color: colors.onSurface }]}>{item.label}</Text>
            <Text style={[styles.logTime, { color: colors.onSurfaceVariant }]}>{formatDate(item.timestamp)}</Text>
          </View>
          {!!item.details && (
            <Text style={[styles.logDetails, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
              {item.details}
            </Text>
          )}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Header Info */}
      <View style={[styles.headerCard, { backgroundColor: colors.surface }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.deviceName, { color: colors.onSurface }]}>{deviceName}</Text>
          <View style={styles.activePill}>
            <PulseIndicator />
            <Text style={[styles.activeText, { color: colors.success }]}>Active</Text>
          </View>
        </View>
        <Text style={[styles.deploymentName, { color: colors.onSurfaceVariant }]}>
          Deployment: {deploymentName}
        </Text>
      </View>

      {/* Stats Bar */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="camera" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.onSurface }]}>{stats.photoCount}</Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Photos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="run" size={24} color={colors.tertiary || '#FF9800'} />
          <Text style={[styles.statValue, { color: colors.onSurface }]}>{stats.motionCount}</Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Motion</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
          <MaterialCommunityIcons name="timer-sand" size={24} color="#9C27B0" />
          <Text style={[styles.statValue, { color: colors.onSurface }]}>{stats.timelapseCount}</Text>
          <Text style={[styles.statLabel, { color: colors.onSurfaceVariant }]}>Timelapse</Text>
        </View>
      </View>

      <View style={[styles.timeContainer, { backgroundColor: colors.surfaceVariant }]}>
        <MaterialCommunityIcons name="clock-outline" size={16} color={colors.onSurfaceVariant} />
        <Text style={[styles.timeText, { color: colors.onSurfaceVariant }]}>
          Monitoring Time: {formatTime(stats.timeActiveMs)}
        </Text>
      </View>

      {/* Activity Log */}
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Live Activity Log</Text>
      <FlatList
        ref={flatListRef}
        data={activityLog}
        keyExtractor={item => item.id}
        renderItem={renderLogItem}
        contentContainerStyle={styles.logListContent}
        showsVerticalScrollIndicator={false}
        inverted // Shows latest items at the top
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="radar" size={48} color={colors.onSurfaceVariant} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: colors.onSurfaceVariant }]}>Waiting for device activity...</Text>
          </View>
        }
      />

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.surfaceVariant }]}>
        <Text style={[styles.footerNote, { color: colors.onSurfaceVariant }]}>
          The device will continue operating normally after disconnecting.
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
  headerCard: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deviceName: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)', // Light success tint
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  pulseCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  activeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  deploymentName: {
    fontSize: 14,
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
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
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
  logListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  logItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  logIconContainer: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logContent: {
    flex: 1,
    justifyContent: 'center',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  logLabel: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  logTime: {
    fontSize: 12,
  },
  logDetails: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    opacity: 0.5,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
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
