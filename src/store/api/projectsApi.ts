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
 * Phase 1: Mock data via ProjectService
 * Phase 2: Real-time Supabase integration with offline queue
 */

import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import ProjectService from '../../services/ProjectService';
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
    getProjects: builder.query<ProjectWithDetails[], void>({
      queryFn: async () => {
        try {
          const data = await ProjectService.getUserProjects();
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
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Projects' as const, id })),
              { type: 'Projects', id: 'LIST' },
            ]
          : [{ type: 'Projects', id: 'LIST' }],
    }),

    // Get single project by ID
    getProjectById: builder.query<ProjectWithDetails | null, string>({
      queryFn: async (projectId) => {
        try {
          const data = await ProjectService.getProjectById(projectId);
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
      providesTags: (result, error, id) => [{ type: 'Projects', id }],
    }),

    // Create new project
    createProject: builder.mutation<ProjectWithDetails, CreateProjectInput>({
      queryFn: async (input) => {
        try {
          const data = await ProjectService.createProject(input);
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
      invalidatesTags: [{ type: 'Projects', id: 'LIST' }],
    }),

    // Update existing project
    updateProject: builder.mutation<
      ProjectWithDetails,
      { id: string; updates: Partial<ProjectWithDetails> }
    >({
      queryFn: async ({ id, updates }) => {
        try {
          const data = await ProjectService.updateProject(id, updates);
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
      invalidatesTags: (result, error, { id }) => [
        { type: 'Projects', id },
        { type: 'Projects', id: 'LIST' },
      ],
    }),

    // Delete project (soft delete)
    deleteProject: builder.mutation<void, string>({
      queryFn: async (projectId) => {
        try {
          await ProjectService.deleteProject(projectId);
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
