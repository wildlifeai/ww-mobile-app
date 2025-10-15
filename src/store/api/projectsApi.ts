/**
 * Projects RTK Query API
 * Redux Toolkit Query configuration for project management
 *
 * Features:
 * - Automatic caching and invalidation
 * - Optimistic updates support
 * - Type-safe hooks for React components
 * - Tag-based cache management
 *
 * Phase 3: Offline-First Integration
 * - ProjectService now always uses DatabaseService (local-first)
 * - No need for network state branching - works offline automatically
 * - Background sync happens automatically in ProjectService
 */

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import ProjectService from '../../services/ProjectService';
import type { RootState } from '../index';
import type {
  ProjectWithDetails,
  CreateProjectInput,
  ProjectMemberWithProfile,
} from '../../types/project';

export const projectsApi = createApi({
  reducerPath: 'projectsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Projects', 'ProjectMembers'],
  endpoints: (builder) => ({
    // Get all projects for organisation (RLS auto-filters by user's org)
    // PHASE 3: Now reads from local database (works offline automatically)
    getProjects: builder.query<ProjectWithDetails[], void>({
      queryFn: async (_arg, { getState }) => {
        console.log('📂 RTK Query - getProjects (offline-first) - STARTING');

        try {
          // Get current organisation ID from Redux state
          const state = getState() as RootState;
          console.log('🔍 RTK Query - Redux state check:', {
            hasAuth: !!state.authentication,
            hasCurrentOrg: !!state.authentication?.currentOrganisation,
            currentOrgId: state.authentication?.currentOrganisation?.id,
            currentOrgName: state.authentication?.currentOrganisation?.name
          });

          const currentOrgId = state.authentication?.currentOrganisation?.id;

          if (!currentOrgId) {
            console.error('❌ No current organisation ID in state');
            console.error('   Full authentication state:', JSON.stringify(state.authentication, null, 2));
            return {
              error: {
                status: 'CUSTOM_ERROR',
                error: 'No current organisation selected'
              }
            };
          }

          console.log('📂 RTK Query - Calling ProjectService.getUserProjects with orgId:', currentOrgId);
          // ProjectService now ALWAYS reads from local database
          // Background sync happens automatically if online
          const data = await ProjectService.getUserProjects(currentOrgId);
          console.log(`✅ RTK Query - Retrieved ${data.length} projects from local database`);
          console.log('   Project names:', data.map(p => p.name));
          return { data };
        } catch (error) {
          console.error('❌ RTK Query - getProjects failed:', error);
          console.error('   Error details:', {
            message: error instanceof Error ? error.message : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined
          });
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Projects' as const, id })),
              { type: 'Projects', id: 'LIST' },
            ]
          : [{ type: 'Projects', id: 'LIST' }],
    }),

    // Get single project by ID
    // NOTE: This still uses Supabase view - will be migrated to local DB in future
    getProjectById: builder.query<ProjectWithDetails | null, string>({
      queryFn: async (projectId) => {
        console.log('📂 RTK Query - getProjectById:', projectId);

        try {
          // TODO Phase 3.5: Migrate to local database lookup
          const data = await ProjectService.getProjectById(projectId);
          return { data };
        } catch (error) {
          console.error('❌ getProjectById failed:', error);
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),

    // Create new project
    // PHASE 3: Always saves locally first, then syncs (no offline parameter needed)
    createProject: builder.mutation<ProjectWithDetails, CreateProjectInput>({
      queryFn: async (input) => {
        console.log('📤 RTK Query - createProject (offline-first)');
        console.log('  Input:', input);

        try {
          // ProjectService now ALWAYS:
          // 1. Saves to local database
          // 2. Queues for sync
          // 3. Triggers background sync if online
          const data = await ProjectService.createProject(input);

          console.log('✅ RTK Query - createProject succeeded (saved locally)');
          return { data };
        } catch (error) {
          console.error('❌ RTK Query - createProject failed:', error);
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    // Update existing project
    // PHASE 3: Always updates locally first, then syncs
    updateProject: builder.mutation<
      ProjectWithDetails,
      { id: string; updates: Partial<ProjectWithDetails> }
    >({
      queryFn: async ({ id, updates }) => {
        console.log('📤 RTK Query - updateProject (offline-first):', id);

        try {
          // ProjectService now ALWAYS updates local database and queues sync
          const data = await ProjectService.updateProject(id, updates);
          console.log('✅ RTK Query - updateProject succeeded (saved locally)');
          return { data };
        } catch (error) {
          console.error('❌ RTK Query - updateProject failed:', error);
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      invalidatesTags: (result, error, { id }) => [
        { type: 'Projects', id },
        { type: 'Projects', id: 'LIST' },
      ],
    }),

    // Delete project (soft delete)
    // PHASE 3: Always deletes locally first, then syncs
    deleteProject: builder.mutation<void, string>({
      queryFn: async (projectId) => {
        console.log('📤 RTK Query - deleteProject (offline-first):', projectId);

        try {
          // ProjectService now ALWAYS deletes from local database and queues sync
          await ProjectService.deleteProject(projectId);
          console.log('✅ RTK Query - deleteProject succeeded (deleted locally)');
          return { data: undefined };
        } catch (error) {
          console.error('❌ RTK Query - deleteProject failed:', error);
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      invalidatesTags: (result, error, id) => [
        { type: 'Projects', id },
        { type: 'Projects', id: 'LIST' },
      ],
    }),

    // Get project members
    getProjectMembers: builder.query<ProjectMemberWithProfile[], string>({
      queryFn: async (projectId) => {
        try {
          const data = await ProjectService.getProjectMembers(projectId);
          return { data };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      providesTags: (result, error, projectId) => [
        { type: 'ProjectMembers', id: projectId },
      ],
    }),

    // Add project member
    addProjectMember: builder.mutation<
      void,
      { projectId: string; userId: string; roleId: number }
    >({
      queryFn: async ({ projectId, userId, roleId }) => {
        try {
          await ProjectService.addProjectMember(projectId, userId, roleId);
          return { data: undefined };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'ProjectMembers', id: projectId },
      ],
    }),

    // Remove project member
    removeProjectMember: builder.mutation<
      void,
      { projectId: string; userId: string }
    >({
      queryFn: async ({ projectId, userId }) => {
        try {
          await ProjectService.removeProjectMember(projectId, userId);
          return { data: undefined };
        } catch (error) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: error instanceof Error ? error.message : String(error)
            }
          };
        }
      },
      invalidatesTags: (result, error, { projectId }) => [
        { type: 'ProjectMembers', id: projectId },
      ],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetProjectsQuery,
  useGetProjectByIdQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectMembersQuery,
  useAddProjectMemberMutation,
  useRemoveProjectMemberMutation,
} = projectsApi;
