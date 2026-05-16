import React, { useState, useCallback } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, TextInput } from 'react-native'
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useExtendedTheme } from '../../../theme'
import { useDeploymentMonitor } from '../hooks/useDeploymentMonitor'
import { ExtendedPeripheral } from '../../../redux/slices/devicesSlice'
import { LiveActivityLog } from './LiveActivityLog'

interface Props {
  device: ExtendedPeripheral | null
  captureMethodId?: number | null
  deploymentStartTime?: Date | string | null
  onContinueMonitoring: () => void
  onStopMonitoring: (notes: string) => void
  isStoppingMonitoring?: boolean
}

const formatTime = (ms: number) => {
  if (ms < 0) ms = 0
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
  deploymentStartTime,
  onContinueMonitoring,
  onStopMonitoring,
  isStoppingMonitoring,
}) => {
  const { colors } = useExtendedTheme()
  const { bottom } = useSafeAreaInsets()
  const { stats } = useDeploymentMonitor(device, deploymentStartTime)

  const [isEnteringNotes, setIsEnteringNotes] = useState(false)
  const [endNotes, setEndNotes] = useState('')

  const showMotion = captureMethodId === 1 || captureMethodId === 3
  const showTimelapse = captureMethodId === 2 || captureMethodId === 3

  const handleStopPress = useCallback(() => {
    setIsEnteringNotes(true)
  }, [])

  const handleStopCancel = useCallback(() => {
    setIsEnteringNotes(false)
    setEndNotes('')
  }, [])

  const handleStopConfirm = useCallback(() => {
    setIsEnteringNotes(false)
    onStopMonitoring(endNotes)
    setEndNotes('')
  }, [endNotes, onStopMonitoring])

  if (isEnteringNotes) {
    return (
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.notesScrollContainer}>
          <Text style={[styles.notesPageTitle, { color: colors.onSurface }]}>Stop Monitoring</Text>
          <Text style={[styles.notesPageSubtitle, { color: colors.onSurfaceVariant }]}>
            Please provide any notes about this deployment before stopping it.
          </Text>

          <Text style={[styles.notesPageLabel, { color: colors.onSurface }]}>Deployment Notes</Text>
          <TextInput
            placeholder="e.g. SD card full, Battery low, Device damaged..."
            placeholderTextColor={colors.onSurfaceVariant}
            multiline
            textAlignVertical="top"
            value={endNotes}
            onChangeText={setEndNotes}
            style={[styles.notesPageInput, { color: colors.onSurface, borderColor: colors.outline, backgroundColor: colors.surface }]}
          />
        </View>
        <View style={[styles.notesPageFooter, { paddingBottom: bottom + 16, borderTopColor: colors.surfaceVariant }]}>
          <TouchableOpacity
            style={[styles.notesCancelBtn, { borderColor: colors.outline }]}
            onPress={handleStopCancel}
            activeOpacity={0.7}
          >
            <Text style={[styles.notesCancelText, { color: colors.onSurface }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.notesStopBtn, { backgroundColor: colors.error, borderColor: colors.error }]}
            onPress={handleStopConfirm}
            activeOpacity={0.7}
          >
            <Text style={[styles.notesStopText, { color: '#FFFFFF' }]}>Confirm Stop</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    )
  }

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

      {/* Footer: Two Buttons */}
      <View style={[styles.footer, { borderTopColor: colors.surfaceVariant, paddingBottom: bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: '#4CAF50' }]}
          onPress={onContinueMonitoring}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.continueBtnText}>Disconnect & Continue Monitoring</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.stopBtn, { borderColor: colors.error }]}
          onPress={handleStopPress}
          activeOpacity={0.7}
          disabled={isStoppingMonitoring}
        >
          <MaterialCommunityIcons name="stop-circle-outline" size={20} color={colors.error} style={{ marginRight: 8 }} />
          <Text style={[styles.stopBtnText, { color: colors.error }]}>
            {isStoppingMonitoring ? 'Stopping…' : 'Stop Monitoring'}
          </Text>
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
    gap: 12,
  },
  continueBtn: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stopBtn: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Notes Page Styles
  notesScrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  notesPageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  notesPageSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 24,
  },
  notesPageLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  notesPageInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  notesPageFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  notesCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  notesStopBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesStopText: {
    fontSize: 16,
    fontWeight: '600',
  },
})
