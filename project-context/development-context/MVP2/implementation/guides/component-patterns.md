# Wildlife Watcher MVP2 - Component Implementation Patterns

**Version**: 1.0  
**Date**: August 6, 2024  
**Context**: UI/UX implementation patterns and reusable components for Tasks 9-23

---

## 🎯 Overview

This guide provides comprehensive UI/UX implementation patterns for the Wildlife Watcher MVP2 development. All patterns follow React Native Paper design system with custom theming and ensure consistent user experience across the application.

**Design System**: React Native Paper 5.12.3  
**Navigation**: React Navigation 6.x native stack  
**State Management**: Redux Toolkit with typed hooks  
**Form Handling**: React Hook Form 7.54.1  

---

## 🎨 Design System Foundation

### Theme Configuration
```typescript
// src/theme/index.ts
import { MD3LightTheme, configureFonts } from 'react-native-paper'

const fontConfig = {
  default: {
    regular: {
      fontFamily: 'Inter-Regular',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'Inter-Medium', 
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'Inter-Bold',
      fontWeight: '700' as const,
    },
  },
}

export const theme = {
  ...MD3LightTheme,
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2E7D32',      // Forest Green
    secondary: '#4CAF50',    // Light Green  
    tertiary: '#FF9800',     // Amber
    error: '#D32F2F',        // Red
    surface: '#F8F9FA',      // Light Gray
    background: '#FFFFFF',    // White
    onSurface: '#1A1A1A',    // Dark Gray
    outline: '#E0E0E0',      // Border Gray
  },
  roundness: 8,
}

// Custom spacing system
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

// Custom shadows
export const shadows = {
  small: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  medium: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  large: {
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
}
```

### Custom Components

#### Base Screen Layout
```typescript
// src/components/layout/ScreenLayout.tsx
interface ScreenLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  showBackButton?: boolean
  rightAction?: React.ReactNode
  scrollable?: boolean
  padding?: keyof typeof spacing
}

export const ScreenLayout: React.FC<ScreenLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton = false,
  rightAction,
  scrollable = true,
  padding = 'md'
}) => {
  const navigation = useNavigation()
  
  const content = (
    <View style={[styles.content, { padding: spacing[padding] }]}>
      {children}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      {(title || showBackButton || rightAction) && (
        <Appbar.Header style={styles.header}>
          {showBackButton && (
            <Appbar.BackAction onPress={() => navigation.goBack()} />
          )}
          {title && <Appbar.Content title={title} subtitle={subtitle} />}
          {rightAction}
        </Appbar.Header>
      )}
      
      {scrollable ? (
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.surface,
    elevation: 0,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
})
```

#### Loading States Component
```typescript
// src/components/common/LoadingStates.tsx
interface LoadingStatesProps {
  loading?: boolean
  error?: string | null
  empty?: boolean
  emptyMessage?: string
  onRetry?: () => void
  children: React.ReactNode
}

export const LoadingStates: React.FC<LoadingStatesProps> = ({
  loading,
  error,
  empty,
  emptyMessage = "No items found",
  onRetry,
  children
}) => {
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon source="alert-circle" size={48} color={theme.colors.error} />
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        {onRetry && (
          <Button mode="contained" onPress={onRetry} style={styles.retryButton}>
            Try Again
          </Button>
        )}
      </View>
    )
  }

  if (empty) {
    return (
      <View style={styles.centerContainer}>
        <Icon source="file-document-outline" size={48} color={theme.colors.outline} />
        <Text style={styles.emptyMessage}>{emptyMessage}</Text>
      </View>
    )
  }

  return <>{children}</>
}
```

#### Form Input Component
```typescript
// src/components/forms/FormInput.tsx
interface FormInputProps {
  name: string
  control: Control<any>
  label: string
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: KeyboardTypeOptions
  multiline?: boolean
  numberOfLines?: number
  leftIcon?: string
  rightIcon?: string
  onRightIconPress?: () => void
  rules?: RegisterOptions
}

export const FormInput: React.FC<FormInputProps> = ({
  name,
  control,
  label,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  numberOfLines,
  leftIcon,
  rightIcon,
  onRightIconPress,
  rules
}) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={rules}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View style={styles.inputContainer}>
          <TextInput
            mode="outlined"
            label={label}
            placeholder={placeholder}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={!!error}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            multiline={multiline}
            numberOfLines={numberOfLines}
            left={leftIcon ? <TextInput.Icon icon={leftIcon} /> : undefined}
            right={rightIcon ? 
              <TextInput.Icon 
                icon={rightIcon} 
                onPress={onRightIconPress}
              /> : undefined
            }
            style={styles.input}
            contentStyle={styles.inputContent}
          />
          {error && (
            <HelperText type="error" visible={!!error}>
              {error.message}
            </HelperText>
          )}
        </View>
      )}
    />
  )
}
```

---

## 📱 Screen Implementation Patterns

## FOUNDATION LAYER SCREENS

### Task 9: Authentication Screens

#### Login Screen Pattern
```typescript
// src/navigation/screens/auth/LoginScreen.tsx
interface LoginFormData {
  email: string
  password: string
  rememberMe: boolean
}

export const LoginScreen: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigation = useNavigation()
  const { isLoading, error } = useAppSelector(state => state.auth)
  
  const {
    control,
    handleSubmit,
    formState: { isValid }
  } = useForm<LoginFormData>({
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  })

  const onSubmit = useCallback(async (data: LoginFormData) => {
    try {
      await dispatch(signIn({ 
        email: data.email, 
        password: data.password 
      })).unwrap()
      
      if (data.rememberMe) {
        await AsyncStorage.setItem('rememberLogin', 'true')
      }
      
      navigation.navigate('Main')
    } catch (error) {
      // Error handled by Redux slice
    }
  }, [dispatch, navigation])

  return (
    <ScreenLayout padding="lg">
      <View style={styles.logoContainer}>
        <Icon source="camera-outline" size={64} color={theme.colors.primary} />
        <Text variant="headlineMedium" style={styles.title}>
          Wildlife Watcher
        </Text>
        <Text variant="bodyLarge" style={styles.subtitle}>
          Monitor wildlife with ease
        </Text>
      </View>

      <View style={styles.formContainer}>
        <FormInput
          name="email"
          control={control}
          label="Email"
          placeholder="Enter your email"
          keyboardType="email-address"
          leftIcon="email"
          rules={{
            required: 'Email is required',
            pattern: {
              value: /\S+@\S+\.\S+/,
              message: 'Invalid email address'
            }
          }}
        />

        <FormInput
          name="password"
          control={control}
          label="Password"
          placeholder="Enter your password"
          secureTextEntry
          leftIcon="lock"
          rules={{
            required: 'Password is required',
            minLength: {
              value: 6,
              message: 'Password must be at least 6 characters'
            }
          }}
        />

        <Controller
          name="rememberMe"
          control={control}
          render={({ field: { onChange, value } }) => (
            <Checkbox.Item
              label="Remember me"
              status={value ? 'checked' : 'unchecked'}
              onPress={() => onChange(!value)}
              style={styles.checkbox}
            />
          )}
        />

        {error && (
          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>
        )}

        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isLoading}
          disabled={!isValid || isLoading}
          style={styles.loginButton}
        >
          Sign In
        </Button>

        <View style={styles.linkContainer}>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.link}>Forgot Password?</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.link}>Don't have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenLayout>
  )
}
```

#### Sign Up Screen Pattern
```typescript
// src/navigation/screens/auth/SignUpScreen.tsx
interface SignUpFormData {
  email: string
  password: string
  confirmPassword: string
  organization: string
}

export const SignUpScreen: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigation = useNavigation()
  const { isLoading, error } = useAppSelector(state => state.auth)
  
  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid }
  } = useForm<SignUpFormData>()
  
  const password = watch('password')

  const onSubmit = useCallback(async (data: SignUpFormData) => {
    try {
      const result = await dispatch(signUp({
        email: data.email,
        password: data.password,
        organization: data.organization
      })).unwrap()
      
      if (result.needsConfirmation) {
        Alert.alert(
          'Check Your Email',
          'Please check your email for a confirmation link.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
        )
      } else {
        navigation.navigate('Main')
      }
    } catch (error) {
      // Error handled by Redux slice
    }
  }, [dispatch, navigation])

  return (
    <ScreenLayout title="Create Account" showBackButton padding="lg">
      <FormInput
        name="email"
        control={control}
        label="Email Address"
        keyboardType="email-address"
        leftIcon="email"
        rules={{
          required: 'Email is required',
          pattern: {
            value: /\S+@\S+\.\S+/,
            message: 'Invalid email address'
          }
        }}
      />

      <FormInput
        name="organization"
        control={control}
        label="Organization"
        leftIcon="office-building"
        rules={{
          required: 'Organization is required'
        }}
      />

      <FormInput
        name="password"
        control={control}
        label="Password"
        secureTextEntry
        leftIcon="lock"
        rules={{
          required: 'Password is required',
          minLength: {
            value: 8,
            message: 'Password must be at least 8 characters'
          },
          pattern: {
            value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
            message: 'Password must contain uppercase, lowercase, and number'
          }
        }}
      />

      <FormInput
        name="confirmPassword"
        control={control}
        label="Confirm Password"
        secureTextEntry
        leftIcon="lock-check"
        rules={{
          required: 'Please confirm your password',
          validate: (value) =>
            value === password || 'Passwords do not match'
        }}
      />

      <Button
        mode="contained"
        onPress={handleSubmit(onSubmit)}
        loading={isLoading}
        disabled={!isValid || isLoading}
        style={styles.signUpButton}
      >
        Create Account
      </Button>
    </ScreenLayout>
  )
}
```

### Task 10: Navigation Structure

#### Bottom Tab Navigation
```typescript
// src/navigation/BottomTabNavigator.tsx
const TabIcon: React.FC<{ name: string; focused: boolean }> = ({ name, focused }) => {
  const getIconName = (tabName: string) => {
    switch (tabName) {
      case 'Maps': return 'map-marker'
      case 'Projects': return 'folder'
      case 'Deployments': return 'camera'
      case 'Devices': return 'bluetooth'
      default: return 'help-circle'
    }
  }

  return (
    <Icon
      source={getIconName(name)}
      size={24}
      color={focused ? theme.colors.primary : theme.colors.onSurfaceVariant}
    />
  )
}

const Tab = createBottomTabNavigator()

export const BottomTabNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon name={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Maps"
        component={MapsScreen}
        options={{
          tabBarLabel: 'Maps',
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          tabBarLabel: 'Projects',
        }}
      />
      <Tab.Screen
        name="Deployments"
        component={DeploymentsScreen}
        options={{
          tabBarLabel: 'Deployments',
        }}
      />
      <Tab.Screen
        name="Devices"
        component={DevicesScreen}
        options={{
          tabBarLabel: 'Devices',
        }}
      />
    </Tab.Navigator>
  )
}
```

---

## PARALLEL DEVELOPMENT STREAMS

## STREAM A: PROJECT MANAGEMENT

### Task 12: Projects List Screen Pattern

```typescript
// src/navigation/screens/ProjectsScreen.tsx
export const ProjectsScreen: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigation = useNavigation()
  const { projects, isLoading, error } = useAppSelector(state => state.projects)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const filteredProjects = useMemo(() =>
    projects.filter(project =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [projects, searchQuery]
  )

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await dispatch(loadProjects()).unwrap()
    } finally {
      setRefreshing(false)
    }
  }, [dispatch])

  const renderProject = useCallback(({ item }: { item: Project }) => (
    <ProjectCard
      project={item}
      onPress={() => navigation.navigate('ProjectDetails', { projectId: item.id })}
    />
  ), [navigation])

  return (
    <ScreenLayout title="Projects" scrollable={false}>
      <Searchbar
        placeholder="Search projects..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />

      <LoadingStates
        loading={isLoading && projects.length === 0}
        error={error}
        empty={filteredProjects.length === 0}
        emptyMessage="No projects found"
        onRetry={() => dispatch(loadProjects())}
      >
        <FlatList
          data={filteredProjects}
          renderItem={renderProject}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </LoadingStates>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('NewProject')}
      />
    </ScreenLayout>
  )
}
```

#### Project Card Component
```typescript
// src/components/projects/ProjectCard.tsx
interface ProjectCardProps {
  project: Project
  onPress: () => void
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onPress }) => {
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text variant="headlineSmall" numberOfLines={1}>
              {project.name}
            </Text>
            {project.isPrivate && (
              <Chip icon="lock" size="small" style={styles.privateChip}>
                Private
              </Chip>
            )}
          </View>
          <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
        </View>

        {project.description && (
          <Text
            variant="bodyMedium"
            style={styles.description}
            numberOfLines={2}
          >
            {project.description}
          </Text>
        )}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Icon source="account-multiple" size={16} color={theme.colors.primary} />
            <Text variant="bodySmall" style={styles.statText}>
              {project.memberCount} members
            </Text>
          </View>
          
          <View style={styles.stat}>
            <Icon source="camera" size={16} color={theme.colors.secondary} />
            <Text variant="bodySmall" style={styles.statText}>
              {project.activeDeployments} active
            </Text>
          </View>
          
          <View style={styles.stat}>
            <Icon source="history" size={16} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodySmall" style={styles.statText}>
              {project.totalDeployments} total
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  )
}
```

---

## STREAM B: DEPLOYMENT WORKFLOWS

### Task 15: Deployment Wizard Pattern

#### Step Progress Indicator
```typescript
// src/components/deployment/StepProgress.tsx
interface StepProgressProps {
  currentStep: number
  totalSteps: number
  steps: string[]
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps,
  steps
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill,
            { width: `${(currentStep / totalSteps) * 100}%` }
          ]} 
        />
      </View>
      
      <View style={styles.stepInfo}>
        <Text variant="bodySmall" style={styles.stepCounter}>
          Step {currentStep} of {totalSteps}
        </Text>
        <Text variant="bodyMedium" style={styles.stepTitle}>
          {steps[currentStep - 1]}
        </Text>
      </View>
    </View>
  )
}
```

#### Device Discovery Screen Pattern
```typescript
// src/navigation/screens/deployment/start/DeviceDiscoveryScreen.tsx
export const DeviceDiscoveryScreen: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigation = useNavigation()
  const { 
    isScanning,
    devices,
    selectedDevice,
    permissionStatus 
  } = useAppSelector(state => state.ble)

  const [refreshing, setRefreshing] = useState(false)

  const startScanning = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      await requestBluetoothPermission()
    }
    dispatch(startBLEScan())
  }, [dispatch, permissionStatus])

  const selectDevice = useCallback((device: BLEDevice) => {
    dispatch(selectBLEDevice(device))
    navigation.navigate('DeploymentConfig')
  }, [dispatch, navigation])

  const renderDevice = useCallback(({ item }: { item: BLEDevice }) => (
    <DeviceListItem
      device={item}
      onPress={() => selectDevice(item)}
      isSelected={selectedDevice?.id === item.id}
    />
  ), [selectDevice, selectedDevice])

  if (permissionStatus === 'denied') {
    return (
      <ScreenLayout title="Device Discovery" showBackButton>
        <PermissionCard
          icon="bluetooth-off"
          title="Bluetooth Permission Required"
          description="To discover and connect to Wildlife Watcher devices, please enable Bluetooth permissions."
          actionText="Open Settings"
          onAction={openAppSettings}
        />
      </ScreenLayout>
    )
  }

  return (
    <ScreenLayout title="Device Discovery" showBackButton>
      <StepProgress currentStep={3} totalSteps={6} steps={DEPLOYMENT_STEPS} />
      
      <View style={styles.scanningContainer}>
        {isScanning ? (
          <View style={styles.scanningIndicator}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="bodyLarge" style={styles.scanningText}>
              Scanning for devices...
            </Text>
            <Text variant="bodySmall" style={styles.scanningSubtext}>
              Make sure your device is nearby and powered on
            </Text>
          </View>
        ) : (
          <Button
            mode="contained"
            icon="bluetooth-audio"
            onPress={startScanning}
            style={styles.scanButton}
          >
            Start Scanning
          </Button>
        )}
      </View>

      <LoadingStates
        loading={isScanning && devices.length === 0}
        empty={!isScanning && devices.length === 0}
        emptyMessage="No devices found. Make sure your device is powered on and nearby."
      >
        <FlatList
          data={devices}
          renderItem={renderDevice}
          keyExtractor={(item) => item.id}
          style={styles.deviceList}
          showsVerticalScrollIndicator={false}
        />
      </LoadingStates>

      <View style={styles.footer}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          Back
        </Button>
        
        <Button
          mode="text"
          onPress={startScanning}
          disabled={isScanning}
        >
          Refresh
        </Button>
      </View>
    </ScreenLayout>
  )
}
```

#### Device List Item Component
```typescript
// src/components/ble/DeviceListItem.tsx
interface DeviceListItemProps {
  device: BLEDevice
  onPress: () => void
  isSelected?: boolean
}

export const DeviceListItem: React.FC<DeviceListItemProps> = ({
  device,
  onPress,
  isSelected
}) => {
  const getSignalStrengthIcon = (rssi: number) => {
    if (rssi > -50) return 'signal-cellular-3'
    if (rssi > -70) return 'signal-cellular-2'
    if (rssi > -90) return 'signal-cellular-1'
    return 'signal-cellular-outline'
  }

  const getSignalStrengthColor = (rssi: number) => {
    if (rssi > -50) return theme.colors.primary
    if (rssi > -70) return theme.colors.tertiary
    return theme.colors.error
  }

  return (
    <Card
      style={[
        styles.deviceCard,
        isSelected && styles.selectedDevice
      ]}
      onPress={onPress}
    >
      <Card.Content>
        <View style={styles.deviceHeader}>
          <View style={styles.deviceInfo}>
            <View style={styles.deviceNameContainer}>
              <Icon
                source="camera-wireless"
                size={24}
                color={theme.colors.primary}
              />
              <Text variant="titleMedium" style={styles.deviceName}>
                {device.name || 'Wildlife Watcher'}
              </Text>
              {isSelected && (
                <Icon
                  source="check-circle"
                  size={20}
                  color={theme.colors.primary}
                />
              )}
            </View>
            
            <Text variant="bodySmall" style={styles.deviceId}>
              {device.id}
            </Text>
          </View>

          <View style={styles.signalContainer}>
            <Icon
              source={getSignalStrengthIcon(device.rssi)}
              size={20}
              color={getSignalStrengthColor(device.rssi)}
            />
            <Text
              variant="bodySmall"
              style={[styles.rssiText, { color: getSignalStrengthColor(device.rssi) }]}
            >
              {device.rssi} dBm
            </Text>
          </View>
        </View>

        {device.isConnectable && (
          <Chip icon="bluetooth-connect" size="small" style={styles.connectableChip}>
            Connectable
          </Chip>
        )}
      </Card.Content>
    </Card>
  )
}
```

---

## STREAM C: DEVICE & MAPS

### Task 19: Maps Screen Pattern

```typescript
// src/navigation/screens/MapsScreen.tsx
export const MapsScreen: React.FC = () => {
  const dispatch = useAppDispatch()
  const navigation = useNavigation()
  const { deployments, isLoading } = useAppSelector(state => state.deployments)
  const [region, setRegion] = useState<Region | null>(null)
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null)

  const mapRef = useRef<MapView>(null)

  // Get user location on mount
  useEffect(() => {
    getCurrentLocation()
  }, [])

  const getCurrentLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }

      setRegion(newRegion)
      mapRef.current?.animateToRegion(newRegion, 1000)
    } catch (error) {
      console.error('Error getting location:', error)
    }
  }, [])

  const renderDeploymentMarkers = useCallback(() => {
    return deployments.map((deployment) => (
      <Marker
        key={deployment.id}
        coordinate={{
          latitude: deployment.latitude,
          longitude: deployment.longitude,
        }}
        title={deployment.name}
        description={`${deployment.projects?.name} - ${deployment.status}`}
        onPress={() => setSelectedDeployment(deployment)}
      >
        <DeploymentMarker
          status={deployment.status}
          batteryLevel={deployment.batteryLevel}
          hasIssues={deployment.batteryLevel < 20 || deployment.sdCardUsage > 90}
        />
      </Marker>
    ))
  }, [deployments])

  return (
    <ScreenLayout title="Wildlife Monitoring" scrollable={false}>
      <View style={styles.mapContainer}>
        {region ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton={false}
            onRegionChangeComplete={setRegion}
          >
            {renderDeploymentMarkers()}
          </MapView>
        ) : (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text>Loading map...</Text>
          </View>
        )}

        {/* Floating Action Buttons */}
        <View style={styles.fabContainer}>
          <FAB
            icon="crosshairs-gps"
            size="small"
            style={styles.locationFab}
            onPress={getCurrentLocation}
          />
          
          <FAB
            icon="camera-plus"
            style={styles.startDeploymentFab}
            label="Start Deployment"
            onPress={() => navigation.navigate('StartDeployment')}
          />
        </View>

        {/* Bottom Sheet for Deployment Details */}
        {selectedDeployment && (
          <DeploymentBottomSheet
            deployment={selectedDeployment}
            onClose={() => setSelectedDeployment(null)}
            onEndDeployment={(id) => {
              navigation.navigate('EndDeployment', { deploymentId: id })
              setSelectedDeployment(null)
            }}
          />
        )}
      </View>
    </ScreenLayout>
  )
}
```

#### Custom Deployment Marker
```typescript
// src/components/maps/DeploymentMarker.tsx
interface DeploymentMarkerProps {
  status: 'active' | 'ended'
  batteryLevel?: number
  hasIssues?: boolean
  size?: number
}

export const DeploymentMarker: React.FC<DeploymentMarkerProps> = ({
  status,
  batteryLevel,
  hasIssues,
  size = 32
}) => {
  const getMarkerColor = () => {
    if (hasIssues) return theme.colors.error
    if (status === 'active') return theme.colors.primary
    return theme.colors.onSurfaceVariant
  }

  return (
    <View style={[styles.markerContainer, { width: size, height: size }]}>
      <View
        style={[
          styles.markerInner,
          { 
            backgroundColor: getMarkerColor(),
            width: size,
            height: size,
            borderRadius: size / 2
          }
        ]}
      >
        <Icon
          source={status === 'active' ? 'camera' : 'camera-off'}
          size={size * 0.6}
          color="white"
        />
      </View>
      
      {hasIssues && (
        <View style={styles.warningBadge}>
          <Icon source="alert" size={12} color="white" />
        </View>
      )}
      
      {batteryLevel !== undefined && (
        <View style={styles.batteryBadge}>
          <Text style={styles.batteryText}>{batteryLevel}%</Text>
        </View>
      )}
    </View>
  )
}
```

---

## 🎯 Common UI Patterns

### Empty States
```typescript
// src/components/common/EmptyState.tsx
interface EmptyStateProps {
  icon: string
  title: string
  description: string
  actionText?: string
  onAction?: () => void
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction
}) => (
  <View style={styles.emptyContainer}>
    <Icon source={icon} size={64} color={theme.colors.onSurfaceVariant} />
    <Text variant="headlineSmall" style={styles.emptyTitle}>
      {title}
    </Text>
    <Text variant="bodyMedium" style={styles.emptyDescription}>
      {description}
    </Text>
    {actionText && onAction && (
      <Button mode="contained" onPress={onAction} style={styles.emptyAction}>
        {actionText}
      </Button>
    )}
  </View>
)
```

### Confirmation Dialogs
```typescript
// src/components/common/ConfirmationDialog.tsx
interface ConfirmationDialogProps {
  visible: boolean
  title: string
  content: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  visible,
  title,
  content,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false
}) => (
  <Dialog visible={visible} onDismiss={onCancel}>
    <Dialog.Title>{title}</Dialog.Title>
    <Dialog.Content>
      <Text variant="bodyMedium">{content}</Text>
    </Dialog.Content>
    <Dialog.Actions>
      <Button onPress={onCancel}>{cancelText}</Button>
      <Button
        onPress={onConfirm}
        buttonColor={destructive ? theme.colors.error : theme.colors.primary}
        textColor={destructive ? 'white' : undefined}
      >
        {confirmText}
      </Button>
    </Dialog.Actions>
  </Dialog>
)
```

### Status Chips
```typescript
// src/components/common/StatusChip.tsx
interface StatusChipProps {
  status: 'active' | 'ended' | 'pending' | 'error'
  text?: string
}

export const StatusChip: React.FC<StatusChipProps> = ({ status, text }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          backgroundColor: theme.colors.primaryContainer,
          textColor: theme.colors.onPrimaryContainer,
          icon: 'play-circle'
        }
      case 'ended':
        return {
          backgroundColor: theme.colors.outlineVariant,
          textColor: theme.colors.onSurfaceVariant,
          icon: 'stop-circle'
        }
      case 'pending':
        return {
          backgroundColor: theme.colors.tertiaryContainer,
          textColor: theme.colors.onTertiaryContainer,
          icon: 'clock'
        }
      case 'error':
        return {
          backgroundColor: theme.colors.errorContainer,
          textColor: theme.colors.onErrorContainer,
          icon: 'alert-circle'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Chip
      icon={config.icon}
      style={{ backgroundColor: config.backgroundColor }}
      textStyle={{ color: config.textColor }}
    >
      {text || status.charAt(0).toUpperCase() + status.slice(1)}
    </Chip>
  )
}
```

---

## 🔧 Performance Optimization Patterns

### Memoized List Items
```typescript
// Optimize FlatList performance
const renderItem = useCallback(({ item }: { item: T }) => (
  <MemoizedListItem item={item} onPress={handleItemPress} />
), [handleItemPress])

const MemoizedListItem = React.memo<{ item: T; onPress: (item: T) => void }>(
  ({ item, onPress }) => {
    return (
      <Card onPress={() => onPress(item)}>
        {/* Item content */}
      </Card>
    )
  },
  (prevProps, nextProps) => prevProps.item.id === nextProps.item.id
)

// FlatList optimization
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={keyExtractor}
  getItemLayout={getItemLayout}
  initialNumToRender={10}
  maxToRenderPerBatch={5}
  windowSize={5}
  removeClippedSubviews={true}
/>
```

### Image Optimization
```typescript
// src/components/common/OptimizedImage.tsx
interface OptimizedImageProps {
  uri: string
  width: number
  height: number
  placeholder?: string
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  width,
  height,
  placeholder = 'image'
}) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  return (
    <View style={[styles.imageContainer, { width, height }]}>
      {loading && (
        <View style={styles.imagePlaceholder}>
          <ActivityIndicator size="small" />
        </View>
      )}
      
      <Image
        source={{ uri }}
        style={[styles.image, { width, height }]}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
        resizeMode="cover"
      />
      
      {error && (
        <View style={styles.imageError}>
          <Icon source={placeholder} size={24} color={theme.colors.onSurfaceVariant} />
        </View>
      )}
    </View>
  )
}
```

---

## 📱 Responsive Design Patterns

### Adaptive Layouts
```typescript
// src/utils/responsive.ts
export const useResponsiveDimensions = () => {
  const { width, height } = useWindowDimensions()
  
  const isTablet = width >= 768
  const isLandscape = width > height
  
  const cardColumns = useMemo(() => {
    if (isTablet) return isLandscape ? 3 : 2
    return 1
  }, [isTablet, isLandscape])
  
  return {
    width,
    height,
    isTablet,
    isLandscape,
    cardColumns,
    spacing: isTablet ? spacing.lg : spacing.md,
  }
}

// Usage in components
const { cardColumns, spacing: adaptiveSpacing } = useResponsiveDimensions()

<FlatList
  data={items}
  renderItem={renderItem}
  numColumns={cardColumns}
  key={cardColumns} // Force re-render when columns change
  columnWrapperStyle={cardColumns > 1 ? styles.row : undefined}
  contentContainerStyle={{ padding: adaptiveSpacing }}
/>
```

---

**Document Status**: ✅ **COMPLETE** - Comprehensive component implementation guide  
**Next Step**: Create testing requirements and patterns  
**Ready for**: Development team implementation with consistent UI/UX patterns