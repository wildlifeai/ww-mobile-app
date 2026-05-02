# Wildlife Watcher Mobile App: Current Database Implementation Analysis

## Executive Summary

The Wildlife Watcher mobile application **does NOT** currently use Strapi as its backend database solution. Despite some legacy Strapi-related type definitions found in the codebase, the application is actually configured to connect to a **Supabase backend** through REST API endpoints. This analysis provides a comprehensive overview of the current database implementation architecture.

## Current Database Implementation

### Backend Platform: Supabase (Not Strapi)

The mobile app connects to a **Supabase-based backend** that provides:
- PostgreSQL database with PostGIS for spatial data
- Row Level Security (RLS) for data protection
- Real-time capabilities
- Authentication services
- Auto-generated REST APIs

### API Architecture Overview

#### Core API Configuration
**Location**: `src/redux/api/`

The application uses **Redux Toolkit Query (RTK Query)** for state management and API calls:

```typescript
// src/redux/api/index.ts
export const api = createApi({
  reducerPath: "api",
  baseQuery: extendedBaseQuery,
  tagTypes: ["User", "Device", "Media", "Observation", "Project", "SensorRecord", "Deployment", "ApiLog"],
  endpoints: () => ({}),
})
```

#### Base Query Configuration
**Location**: `src/redux/api/fetch.ts`

```typescript
export const extendedBaseQuery = fetchBaseQuery({
  baseUrl: Config.API_BASE,
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).authentication.token
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
    headers.set("Content-type", "application/json")
    return headers
  },
})
```

#### API URL Structure
**Location**: `src/redux/api/urls.ts`

All API endpoints follow a REST pattern prefixed with `/api`:

```typescript
const prefixUrl = (path: string) => `${API_BASE}/api${path}`

export const API_URLS = {
  // Users
  USERS: prefixUrl("/users"),
  USER_BY_ID: (id: string) => prefixUrl(`/users/${id}`),
  
  // Devices
  DEVICES: prefixUrl("/devices"),
  DEVICE_BY_ID: (id: string) => prefixUrl(`/devices/${id}`),
  
  // Projects, Media, Observations, Sensor Records, Deployments, API Logs
  // ... (similar pattern for all resources)
  
  // Auth endpoints
  AUTH_LOGIN: prefixUrl("/auth/local"),
  AUTH_REGISTER: prefixUrl("/auth/local/register"),
  AUTH_ME: prefixUrl("/users/me"),
}
```

## Database Connection Architecture

### 1. Environment Configuration
**Location**: `src/types/react-native-config.d.ts`

The app uses `react-native-config` for environment variables:

```typescript
declare module "react-native-config" {
  export interface NativeConfig {
    API_BASE?: string  // Base URL for backend API
    GOOGLE_MAPS_API_KEY_ANDROID?: string
    GOOGLE_MAPS_API_KEY_IOS?: string
  }
}
```

### 2. API Service Layer Structure

Each major entity has its own API service module:

- **Users**: `src/redux/api/users/index.ts`
- **Devices**: `src/redux/api/devices/index.ts`
- **Projects**: `src/redux/api/projects/index.ts`
- **Deployments**: `src/redux/api/deployments/index.ts`
- **Media**: `src/redux/api/media/index.ts`
- **Observations**: `src/redux/api/observations/index.ts`
- **Sensor Records**: `src/redux/api/sensorRecords/index.ts`
- **Authentication**: `src/redux/api/auth/index.ts`

### 3. Typical API Endpoint Implementation

Example from `src/redux/api/projects/index.ts`:

```typescript
export const projectsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => ({
        url: API_URLS.PROJECTS,
        method: HttpMethod.GET,
      }),
      transformResponse: (response: ApiResponse<Project[]>) => response.data,
      providesTags: [{ type: "Project", id: "LIST" }],
    }),
    
    createProject: builder.mutation<Project, StrapiRequest<ProjectCreate>>({
      query: (body) => ({
        url: API_URLS.PROJECTS,
        method: HttpMethod.POST,
        body,
      }),
      transformResponse: (response: ApiResponse<Project>) => response.data,
      invalidatesTags: [{ type: "Project", id: "LIST" }],
    }),
    // ... other CRUD operations
  }),
})
```

## Data Models and Types

### Core Entities
**Location**: `src/redux/api/types.ts`

The application manages the following main entities:

1. **User** - User accounts and profiles
2. **Project** - Wildlife monitoring projects
3. **Device** - Camera trap devices
4. **Deployment** - Device deployments in field locations
5. **Media** - Photos/videos captured by devices
6. **Observation** - AI-identified wildlife observations
7. **SensorRecord** - Device sensor data and metadata
8. **ApiLog** - API usage logging

### Example Entity Definition

```typescript
export type Project = BaseEntity & {
  title: string
  acronym: string
  description: string
  samplingDesign: string
  captureMethod: string
  individualAnimals: number
  observationLevel: string
  projectTeam: string
  projectPrivacy: string
}
```

## Legacy Strapi References

### Why Strapi Types Still Exist

The codebase contains several references to Strapi that indicate a **previous backend implementation**:

1. **StrapiRequest Type**: Used for API request formatting
   ```typescript
   export type StrapiRequest<T> = {
     data: T
   }
   ```

2. **Usage in API calls**: Some endpoints still use Strapi-style request wrapping
   ```typescript
   createProject: builder.mutation<Project, StrapiRequest<ProjectCreate>>
   ```

3. **Response transformations**: API responses are transformed from Strapi-style format
   ```typescript
   transformResponse: (response: ApiResponse<Project>) => response.data
   ```

### Migration Status

The application appears to be in a **transitional state** where:
- The backend has been migrated from Strapi to Supabase
- The mobile app's API layer still uses some Strapi-compatible request/response patterns
- The actual database and API endpoints are now Supabase-based

## How Database Calls Are Made

### 1. Redux Store Integration
**Location**: `src/redux/index.ts`

The API is integrated into the Redux store:

```typescript
export const store = configureStore({
  reducer: {
    api: api.reducer,
    // other reducers...
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(api.middleware),
})
```

### 2. Component Usage Pattern

Components use generated React hooks for API calls:

```typescript
// In a React component
import { useGetProjectsQuery, useCreateProjectMutation } from '../redux/api/projects'

const MyComponent = () => {
  const { data: projects, isLoading } = useGetProjectsQuery()
  const [createProject] = useCreateProjectMutation()
  
  // Use data and mutations...
}
```

### 3. Authentication Flow
**Location**: `src/redux/api/auth/index.ts`

```typescript
export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: API_URLS.AUTH_LOGIN,
        method: "POST",
        body: credentials,
      }),
    }),
    // ... other auth endpoints
  }),
})
```

## Current Database Technology Stack

### Backend: Supabase
- **Database**: PostgreSQL with PostGIS extensions
- **Authentication**: Supabase Auth
- **Real-time**: Supabase real-time subscriptions
- **Storage**: Supabase Storage for media files
- **Security**: Row Level Security (RLS) policies

### Mobile App API Layer
- **State Management**: Redux Toolkit with RTK Query
- **HTTP Client**: Fetch API (via RTK Query's fetchBaseQuery)
- **Caching**: RTK Query automatic caching with tags
- **Authentication**: Bearer token in Authorization header

## Key Implementation Details

### 1. API Response Format
All API responses follow a consistent structure:
```typescript
export type ApiResponse<T> = {
  data: T
  success: boolean
  error?: BaseResponse
}
```

### 2. Error Handling
RTK Query provides automatic error handling and retry logic.

### 3. Caching Strategy
Uses tag-based cache invalidation:
- `LIST` tags for collection endpoints
- Individual entity IDs for specific resources

### 4. Authentication Token Management
Tokens are stored in Redux state and automatically included in API headers.

## Deployment and Configuration

### Environment Variables Required
- `API_BASE`: Base URL for the Supabase backend API
- `GOOGLE_MAPS_API_KEY_ANDROID`: For Android Maps
- `GOOGLE_MAPS_API_KEY_IOS`: For iOS Maps

### Development Commands
```bash
npm install     # Install dependencies
npm start       # Start Metro bundler
npm run android # Run on Android
npm run ios     # Run on iOS
```

## Conclusion

The Wildlife Watcher mobile application **currently uses Supabase as its backend database**, not Strapi. While there are legacy Strapi type definitions in the codebase, these appear to be remnants from a previous implementation. The app connects to Supabase through a well-structured RTK Query-based API layer that handles authentication, caching, and state management efficiently.

The database calls are made through Redux Toolkit Query, which provides a modern, efficient way to handle API interactions with automatic caching, error handling, and React integration. The backend provides a PostgreSQL database with advanced features like spatial data support and row-level security through the Supabase platform.