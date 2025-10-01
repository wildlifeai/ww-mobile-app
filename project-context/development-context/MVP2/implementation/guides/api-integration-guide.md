# Wildlife Watcher MVP2 - API Integration Guide

**Version**: 1.0  
**Date**: December 6, 2024  
**Context**: Comprehensive API integration patterns for Tasks 9-23 with Supabase backend

---

## 🎯 Overview

This guide provides detailed API integration patterns for the Wildlife Watcher MVP2 implementation. All integrations use the existing Supabase backend (`Dev_Wildlife_Watcher`) with production-ready authentication and type safety.

**Backend Status**: ✅ **READY**
- Supabase project: `nuhwmubvygxyddkycmpa.supabase.co`
- Authentication: Fully integrated with React Native
- TypeScript types: Generated and available
- RLS policies: Need to be implemented (Task 8 backlog)

---

## 🏗️ Base Architecture

### Supabase Client Configuration
```typescript
// src/services/supabase/client.ts
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Database } from '../types/supabase'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
```

### Service Layer Pattern
```typescript
// Base service pattern for all API operations
export abstract class BaseService {
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries = 3
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await operation()
      } catch (error) {
        if (i === retries - 1) throw error
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    }
    throw new Error('Max retries exceeded')
  }

  protected handleError(error: any, operation: string): never {
    console.error(`${operation} failed:`, error)
    
    if (error.code === 'PGRST301') {
      throw new APIError('UNAUTHORIZED', 'Please log in again', error.message)
    } else if (error.code === '23505') {
      throw new APIError('DUPLICATE', 'This item already exists', error.message)
    } else if (!navigator.onLine) {
      throw new APIError('NETWORK_ERROR', 'No internet connection', error.message)
    } else {
      throw new APIError('UNKNOWN', 'Something went wrong', error.message)
    }
  }
}
```

---

## 📋 Task-Specific API Integration

## FOUNDATION LAYER

### Task 9: Authentication API Integration

#### User Authentication Service
```typescript
// src/services/auth/AuthService.ts
import { supabase } from '../supabase/client'
import type { Database } from '../types/supabase'

type User = Database['public']['Tables']['users']['Row']
type Profile = Database['public']['Tables']['profiles']['Row']

export class AuthService extends BaseService {
  async signUp(credentials: {
    email: string
    password: string
    organization?: string
  }): Promise<{ user: User; needsConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          organization: credentials.organization
        }
      }
    })

    if (error) this.handleError(error, 'signUp')

    // Create profile if user was created
    if (data.user && data.session) {
      await this.createUserProfile(data.user.id, {
        email: credentials.email,
        organization: credentials.organization
      })
    }

    return {
      user: data.user as User,
      needsConfirmation: !data.session
    }
  }

  async signIn(credentials: {
    email: string
    password: string
  }): Promise<{ user: User; profile: Profile }> {
    const { data, error } = await supabase.auth.signInWithPassword(credentials)

    if (error) this.handleError(error, 'signIn')

    const profile = await this.getUserProfile(data.user.id)

    return {
      user: data.user as User,
      profile
    }
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) this.handleError(error, 'signOut')
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'wildlifewatcher://reset-password'
    })
    if (error) this.handleError(error, 'resetPassword')
  }

  private async createUserProfile(userId: string, data: {
    email: string
    organization?: string
  }): Promise<Profile> {
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: data.email,
        organization: data.organization,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) this.handleError(error, 'createUserProfile')
    return profile
  }

  private async getUserProfile(userId: string): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) this.handleError(error, 'getUserProfile')
    return data
  }
}
```

#### Redux Integration
```typescript
// src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { AuthService } from '../../services/auth/AuthService'

const authService = new AuthService()

export const signIn = createAsyncThunk(
  'auth/signIn',
  async (credentials: { email: string; password: string }) => {
    return await authService.signIn(credentials)
  }
)

export const signUp = createAsyncThunk(
  'auth/signUp', 
  async (credentials: { email: string; password: string; organization?: string }) => {
    return await authService.signUp(credentials)
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.user = action.payload.user
        state.profile = action.payload.profile
        state.isAuthenticated = true
        state.isLoading = false
      })
      .addCase(signIn.rejected, (state, action) => {
        state.error = action.error.message
        state.isLoading = false
      })
  }
})
```

---

### Task 10: Core Redux Integration

#### Projects Service
```typescript
// src/services/projects/ProjectsService.ts
type Project = Database['public']['Tables']['projects']['Row']
type ProjectInsert = Database['public']['Tables']['projects']['Insert']
type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export class ProjectsService extends BaseService {
  async getUserProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner (
          role,
          user_id
        ),
        deployments (
          id,
          status
        )
      `)
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'getUserProjects')

    // Transform data to include computed fields
    return data.map(project => ({
      ...project,
      memberCount: project.project_members?.length || 0,
      activeDeployments: project.deployments?.filter(d => d.status === 'active').length || 0,
      totalDeployments: project.deployments?.length || 0
    }))
  }

  async createProject(project: ProjectInsert): Promise<Project> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...project,
        owner_id: user.user.id
      })
      .select()
      .single()

    if (error) this.handleError(error, 'createProject')

    // Add creator as admin member
    await this.addProjectMember(data.id, user.user.id, 'admin')

    return data
  }

  async updateProject(id: string, updates: ProjectUpdate): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) this.handleError(error, 'updateProject')
    return data
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)

    if (error) this.handleError(error, 'deleteProject')
  }

  async addProjectMember(
    projectId: string, 
    userId: string, 
    role: 'admin' | 'member'
  ): Promise<void> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('User not authenticated')

    const { error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role,
        added_by: user.user.id
      })

    if (error) this.handleError(error, 'addProjectMember')
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .delete()
      .match({ project_id: projectId, user_id: userId })

    if (error) this.handleError(error, 'removeProjectMember')
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        profiles (
          id,
          email,
          organization
        )
      `)
      .eq('project_id', projectId)

    if (error) this.handleError(error, 'getProjectMembers')
    return data
  }
}
```

---

### Task 11: Offline SQLite Foundation

#### Offline Service Integration
```typescript
// src/services/offline/OfflineService.ts
import * as SQLite from 'expo-sqlite'
import NetInfo from '@react-native-community/netinfo'
import { supabase } from '../supabase/client'

export class OfflineService {
  private db: SQLite.Database
  private syncInProgress = false

  constructor() {
    this.db = SQLite.openDatabase('wildlife_watcher.db')
    this.initializeDatabase()
    this.setupNetworkListener()
  }

  async queueOperation(operation: {
    type: 'CREATE' | 'UPDATE' | 'DELETE'
    table: string
    data: any
    id?: string
  }): Promise<string> {
    const operationId = generateUUID()
    
    await this.db.executeSql(`
      INSERT INTO offline_queue 
      (operation_id, operation_type, table_name, entity_id, payload)
      VALUES (?, ?, ?, ?, ?)
    `, [
      operationId,
      operation.type,
      operation.table,
      operation.id || operation.data.id || generateUUID(),
      JSON.stringify(operation.data)
    ])

    // Try immediate sync if online
    const networkState = await NetInfo.fetch()
    if (networkState.isConnected) {
      this.syncPendingOperations()
    }

    return operationId
  }

  async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress) return

    this.syncInProgress = true
    try {
      const [rows] = await this.db.executeSql(`
        SELECT * FROM offline_queue 
        WHERE synced = 0 
        ORDER BY created_at ASC
      `)

      for (let i = 0; i < rows.length; i++) {
        const operation = rows.item(i)
        try {
          await this.syncSingleOperation(operation)
          
          // Mark as synced
          await this.db.executeSql(
            'UPDATE offline_queue SET synced = 1 WHERE operation_id = ?',
            [operation.operation_id]
          )
        } catch (error) {
          // Update retry count and error
          await this.db.executeSql(`
            UPDATE offline_queue 
            SET retry_count = retry_count + 1, last_error = ?
            WHERE operation_id = ?
          `, [error.message, operation.operation_id])
        }
      }
    } finally {
      this.syncInProgress = false
    }
  }

  private async syncSingleOperation(operation: any): Promise<void> {
    const data = JSON.parse(operation.payload)
    
    switch (operation.table_name) {
      case 'projects':
        await this.syncProject(operation.operation_type, data)
        break
      case 'deployments':
        await this.syncDeployment(operation.operation_type, data)
        break
      default:
        throw new Error(`Unknown table: ${operation.table_name}`)
    }
  }

  private async syncProject(type: string, data: any): Promise<void> {
    switch (type) {
      case 'CREATE':
        const { error: insertError } = await supabase
          .from('projects')
          .insert(data)
        if (insertError) throw insertError
        break
        
      case 'UPDATE':
        const { error: updateError } = await supabase
          .from('projects')
          .update(data)
          .eq('id', data.id)
        if (updateError) throw updateError
        break
        
      case 'DELETE':
        const { error: deleteError } = await supabase
          .from('projects')
          .delete()
          .eq('id', data.id)
        if (deleteError) throw deleteError
        break
    }
  }
}
```

---

## PARALLEL DEVELOPMENT STREAMS

## STREAM A: PROJECT MANAGEMENT

### Task 12: Projects CRUD Operations

#### RTK Query Integration
```typescript
// src/store/api/projectsApi.ts
import { createApi } from '@reduxjs/toolkit/query/react'
import { supabaseBaseQuery } from './supabaseBaseQuery'

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: supabaseBaseQuery,
  tagTypes: ['Project', 'ProjectMember'],
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => ({
        from: 'projects',
        select: `
          *,
          project_members!inner (role, user_id),
          deployments (id, status)
        `,
        order: { column: 'created_at', ascending: false }
      }),
      providesTags: ['Project'],
      transformResponse: (response: any[]) => 
        response.map(project => ({
          ...project,
          memberCount: project.project_members?.length || 0,
          activeDeployments: project.deployments?.filter(d => d.status === 'active').length || 0,
          totalDeployments: project.deployments?.length || 0
        }))
    }),

    createProject: builder.mutation<Project, ProjectInsert>({
      query: (project) => ({
        from: 'projects',
        insert: project,
        select: '*'
      }),
      invalidatesTags: ['Project'],
      async onQueryStarted(project, { dispatch, queryFulfilled }) {
        // Optimistic update
        const patchResult = dispatch(
          projectsApi.util.updateQueryData('getProjects', undefined, (draft) => {
            draft.unshift({ ...project, id: 'temp', memberCount: 1, activeDeployments: 0, totalDeployments: 0 })
          })
        )
        
        try {
          await queryFulfilled
        } catch {
          patchResult.undo()
        }
      }
    }),

    updateProject: builder.mutation<Project, { id: string; updates: ProjectUpdate }>({
      query: ({ id, updates }) => ({
        from: 'projects',
        update: updates,
        match: { id },
        select: '*'
      }),
      invalidatesTags: ['Project']
    }),

    deleteProject: builder.mutation<void, string>({
      query: (id) => ({
        from: 'projects',
        delete: true,
        match: { id }
      }),
      invalidatesTags: ['Project']
    })
  })
})

export const {
  useGetProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation
} = projectsApi
```

---

## STREAM B: DEPLOYMENT WORKFLOWS

### Task 15: Start Deployment Flow

#### Deployment Service
```typescript
// src/services/deployments/DeploymentService.ts
type Deployment = Database['public']['Tables']['deployments']['Row']
type DeploymentInsert = Database['public']['Tables']['deployments']['Insert']

export class DeploymentService extends BaseService {
  async createDeployment(deployment: {
    projectId: string
    deviceId: string
    name: string
    latitude: number
    longitude: number
    address?: string
    locationDescription?: string
    locationPhotoUrl?: string
    captureMethod: 'motion' | 'timelapse'
    timelapseInterval?: number
  }): Promise<Deployment> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('User not authenticated')

    // First, ensure device exists or create it
    await this.ensureDeviceExists(deployment.deviceId)

    const { data, error } = await supabase
      .from('deployments')
      .insert({
        project_id: deployment.projectId,
        device_id: deployment.deviceId,
        name: deployment.name,
        status: 'active',
        latitude: deployment.latitude,
        longitude: deployment.longitude,
        address: deployment.address,
        location_description: deployment.locationDescription,
        location_photo_url: deployment.locationPhotoUrl,
        capture_method: deployment.captureMethod,
        timelapse_interval: deployment.timelapseInterval,
        started_by: user.user.id,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) this.handleError(error, 'createDeployment')
    return data
  }

  async endDeployment(deploymentId: string): Promise<Deployment> {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) throw new Error('User not authenticated')

    const { data, error } = await supabase
      .from('deployments')
      .update({
        status: 'ended',
        ended_by: user.user.id,
        ended_at: new Date().toISOString()
      })
      .eq('id', deploymentId)
      .select()
      .single()

    if (error) this.handleError(error, 'endDeployment')
    return data
  }

  async getActiveDeployments(): Promise<Deployment[]> {
    const { data, error } = await supabase
      .from('deployments')
      .select(`
        *,
        projects (name, id),
        devices (name, bluetooth_id)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) this.handleError(error, 'getActiveDeployments')
    return data
  }

  async updateDeploymentStatus(deploymentId: string, status: {
    batteryLevel?: number
    sdCardUsage?: number
    lastDataReceived?: string
  }): Promise<void> {
    const { error } = await supabase
      .from('deployments')
      .update({
        battery_level: status.batteryLevel,
        sd_card_usage: status.sdCardUsage,
        last_data_received: status.lastDataReceived
      })
      .eq('id', deploymentId)

    if (error) this.handleError(error, 'updateDeploymentStatus')
  }

  private async ensureDeviceExists(bluetoothId: string): Promise<void> {
    const { data, error } = await supabase
      .from('devices')
      .select('id')
      .eq('bluetooth_id', bluetoothId)
      .maybeSingle()

    if (error) this.handleError(error, 'checkDeviceExists')

    if (!data) {
      // Create device
      const { error: insertError } = await supabase
        .from('devices')
        .insert({
          bluetooth_id: bluetoothId,
          name: `Device ${bluetoothId}`,
          last_seen: new Date().toISOString()
        })

      if (insertError) this.handleError(insertError, 'createDevice')
    }
  }
}
```

#### Deployment Wizard State Management
```typescript
// src/store/slices/deploymentWizardSlice.ts
interface DeploymentWizardState {
  currentStep: number
  projectId: string | null
  deviceId: string | null
  deploymentName: string
  location: {
    latitude: number | null
    longitude: number | null
    address: string | null
  }
  configuration: {
    captureMethod: 'motion' | 'timelapse' | null
    timelapseInterval: number | null
  }
  finalSetup: {
    locationPhoto: string | null
    description: string
  }
  isCreating: boolean
  error: string | null
}

const deploymentWizardSlice = createSlice({
  name: 'deploymentWizard',
  initialState,
  reducers: {
    setCurrentStep: (state, action) => {
      state.currentStep = action.payload
    },
    setProjectId: (state, action) => {
      state.projectId = action.payload
    },
    setDeviceId: (state, action) => {
      state.deviceId = action.payload
    },
    setDeploymentName: (state, action) => {
      state.deploymentName = action.payload
    },
    setLocation: (state, action) => {
      state.location = action.payload
    },
    setConfiguration: (state, action) => {
      state.configuration = action.payload
    },
    setFinalSetup: (state, action) => {
      state.finalSetup = action.payload
    },
    resetWizard: (state) => {
      return initialState
    }
  }
})
```

---

## STREAM C: DEVICE & MAPS

### Task 18: Device Management & BLE Integration

#### Device Service
```typescript
// src/services/devices/DeviceService.ts
type Device = Database['public']['Tables']['devices']['Row']

export class DeviceService extends BaseService {
  async getDevices(): Promise<Device[]> {
    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .order('last_seen', { ascending: false })

    if (error) this.handleError(error, 'getDevices')
    return data
  }

  async updateDeviceInfo(bluetoothId: string, info: {
    name?: string
    firmwareVersion?: string
    modelType?: string
    batteryLevel?: number
  }): Promise<Device> {
    const { data, error } = await supabase
      .from('devices')
      .update({
        name: info.name,
        firmware_version: info.firmwareVersion,
        model_type: info.modelType,
        last_seen: new Date().toISOString()
      })
      .eq('bluetooth_id', bluetoothId)
      .select()
      .single()

    if (error) this.handleError(error, 'updateDeviceInfo')
    return data
  }

  async recordDeviceActivity(bluetoothId: string): Promise<void> {
    const { error } = await supabase
      .from('devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('bluetooth_id', bluetoothId)

    if (error) this.handleError(error, 'recordDeviceActivity')
  }
}
```

---

### Task 19: Maps Integration

#### Maps Service
```typescript
// src/services/maps/MapsService.ts
export class MapsService extends BaseService {
  async getDeploymentMarkers(): Promise<DeploymentMarker[]> {
    const { data, error } = await supabase
      .from('deployments')
      .select(`
        id,
        name,
        latitude,
        longitude,
        status,
        battery_level,
        sd_card_usage,
        projects (name),
        devices (name)
      `)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (error) this.handleError(error, 'getDeploymentMarkers')

    return data.map(deployment => ({
      id: deployment.id,
      title: deployment.name,
      description: `${deployment.projects?.name} - ${deployment.devices?.name}`,
      coordinate: {
        latitude: deployment.latitude,
        longitude: deployment.longitude
      },
      status: deployment.status,
      batteryLevel: deployment.battery_level,
      sdCardUsage: deployment.sd_card_usage
    }))
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
      )
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        return data.results[0].formatted_address
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error)
    }
    return null
  }
}
```

---

### Task 20: Offline Synchronization

#### Real-time Subscriptions
```typescript
// src/services/realtime/RealtimeService.ts
export class RealtimeService {
  private subscriptions: Map<string, RealtimeChannel> = new Map()

  subscribeToDeploymentUpdates(callback: (deployment: Deployment) => void): () => void {
    const channel = supabase
      .channel('deployment-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'deployments'
      }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          callback(payload.new as Deployment)
        }
      })
      .subscribe()

    this.subscriptions.set('deployment-updates', channel)

    return () => {
      channel.unsubscribe()
      this.subscriptions.delete('deployment-updates')
    }
  }

  subscribeToProjectUpdates(projectId: string, callback: (project: Project) => void): () => void {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `id=eq.${projectId}`
      }, (payload) => {
        callback(payload.new as Project)
      })
      .subscribe()

    this.subscriptions.set(`project-${projectId}`, channel)

    return () => {
      channel.unsubscribe()
      this.subscriptions.delete(`project-${projectId}`)
    }
  }

  cleanup(): void {
    this.subscriptions.forEach(channel => channel.unsubscribe())
    this.subscriptions.clear()
  }
}
```

---

## 🔧 Error Handling & Retry Logic

### Custom Error Types
```typescript
// src/types/errors.ts
export class APIError extends Error {
  constructor(
    public code: string,
    public userMessage: string,
    public technicalMessage: string,
    public isRetryable: boolean = true
  ) {
    super(technicalMessage)
    this.name = 'APIError'
  }
}

export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE: 'DUPLICATE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN'
} as const
```

### Retry Wrapper
```typescript
// src/utils/retryWrapper.ts
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    exponentialBackoff?: boolean
    retryCondition?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    exponentialBackoff = true,
    retryCondition = (error) => error.code !== 'UNAUTHORIZED'
  } = options

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxRetries || !retryCondition(error)) {
        throw error
      }

      const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw new Error('Unreachable code')
}
```

---

## 📊 Performance Optimization

### Query Optimization
```typescript
// Efficient queries with proper indexing
export const OPTIMIZED_QUERIES = {
  // Use select to limit data transfer
  getUserProjects: () => supabase
    .from('projects')
    .select(`
      id, name, description, created_at,
      project_members!inner(role),
      deployments(id, status)
    `),

  // Use pagination for large datasets
  getProjectsPage: (page: number, limit: number = 20) => supabase
    .from('projects')
    .select('*')
    .range(page * limit, (page + 1) * limit - 1)
    .order('created_at', { ascending: false }),

  // Use RLS policies instead of manual filtering
  getActiveDeployments: () => supabase
    .from('deployments')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
}
```

### Caching Strategy
```typescript
// RTK Query cache configuration
export const cacheConfig = {
  // Keep data for 5 minutes
  keepUnusedDataFor: 300,
  
  // Refetch on focus/reconnect
  refetchOnFocus: true,
  refetchOnReconnect: true,
  
  // Tag-based invalidation
  tagTypes: ['Project', 'Deployment', 'Device', 'User']
}
```

---

## 🔒 Security Best Practices

### Row Level Security (RLS) Policies
```sql
-- Example RLS policies for projects table
CREATE POLICY "Users can view their projects" ON projects
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = projects.id
    ) OR owner_id = auth.uid()
  );

CREATE POLICY "Users can update projects they admin" ON projects
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM project_members 
      WHERE project_id = projects.id AND role = 'admin'
    ) OR owner_id = auth.uid()
  );
```

### Input Validation
```typescript
// Zod schemas for runtime validation
import { z } from 'zod'

export const ProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  samplingDesign: z.string().max(100).optional(),
  website: z.string().url().optional(),
  isPrivate: z.boolean().default(false),
  usingBait: z.boolean().default(false),
  monitoringMarked: z.boolean().default(false)
})

export const DeploymentSchema = z.object({
  name: z.string().min(1).max(100),
  projectId: z.string().uuid(),
  deviceId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  captureMethod: z.enum(['motion', 'timelapse']),
  timelapseInterval: z.number().positive().optional()
})
```

---

## 🎯 Testing Integration

### API Testing Utilities
```typescript
// src/utils/testUtils.ts
export const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
  auth: {
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn()
  }
}

export const createMockProject = (overrides = {}): Project => ({
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test Description',
  owner_id: 'test-user-id',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
})
```

---

**Document Status**: ✅ **COMPLETE** - Comprehensive API integration guide  
**Next Step**: Update TaskMaster with Tasks 9-23 structure  
**Ready for**: Implementation phase with parallel development streams