import { PayloadAction, createSlice } from "@reduxjs/toolkit";

// Auth context for passing authentication state to reducers
export interface AuthContext {
  currentOrgId: string | null;
  userRole: 'ww_admin' | 'project_admin' | 'project_member';
  userId: string;
}

// Action payload types with auth context
export interface SetProjectsPayload {
  projects: Project[];
  authContext: AuthContext;
}

export interface CreateProjectPayload {
  project: Project;
  authContext: AuthContext;
}

export interface UpdateProjectPayload {
  id: string;
  updates: Partial<Project>;
  authContext: AuthContext;
}

export interface DeleteProjectPayload {
  id: string;
  authContext: AuthContext;
}

export interface ProjectMemberPayload {
  projectId: string;
  member?: ProjectMember;
  memberId?: string;
  updates?: Partial<ProjectMember>;
  authContext: AuthContext;
}

// Types for project management with organisation integration
export interface ProjectMember {
  id: string;
  user_id: string;
  role: 'project_admin' | 'project_member';
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  organisation_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'archived' | 'completed';
  members: ProjectMember[];
  deployments_count: number;
}

interface ProjectsState {
  projects: Project[];
  currentProject?: Project;
  loading: boolean;
  error?: string;
}

const initialState: ProjectsState = {
  projects: [],
  loading: false,
};

// Helper function to validate project data
const validateProject = (project: Project): string | null => {
  if (!project.id) return 'Project ID is required';
  if (!project.name || project.name.trim() === '') return 'Project name is required';
  if (!project.organisation_id) return 'Organisation ID is required';
  if (!project.created_by) return 'Creator ID is required';
  return null;
};

// Helper function to check if user has permission to modify project
const canModifyProject = (
  project: Project,
  authContext: AuthContext
): boolean => {
  // WW Admin can modify any project
  if (authContext.userRole === 'ww_admin') return true;

  // Project creator can modify
  if (project.created_by === authContext.userId) return true;

  // Project admin member can modify
  const userMember = project.members.find(m => m.user_id === authContext.userId);
  if (userMember && userMember.role === 'project_admin') return true;

  // Organisation admin can modify projects in their org
  if (authContext.userRole === 'project_admin' &&
      project.organisation_id === authContext.currentOrgId) return true;

  return false;
};

export const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    setProjects: (state, action: PayloadAction<SetProjectsPayload>) => {
      const { projects, authContext } = action.payload;

      // Apply org filtering based on role
      if (authContext.userRole === 'ww_admin') {
        state.projects = projects;
      } else {
        state.projects = projects.filter(
          p => p.organisation_id === authContext.currentOrgId
        );
      }

      state.loading = false;
      state.error = undefined;
    },
    
    createProject: (state, action: PayloadAction<CreateProjectPayload>) => {
      const { project, authContext } = action.payload;
      const validationError = validateProject(project);

      if (validationError) {
        state.error = validationError;
        return;
      }

      // Check organisation scope using passed context
      if (authContext.userRole !== 'ww_admin' &&
          project.organisation_id !== authContext.currentOrgId) {
        state.error = 'Cannot create project in different organisation';
        return;
      }

      state.projects.push(project);
      state.error = undefined;
    },
    
    updateProject: (state, action: PayloadAction<UpdateProjectPayload>) => {
      const { id, updates, authContext } = action.payload;
      const projectIndex = state.projects.findIndex(p => p.id === id);

      if (projectIndex === -1) {
        state.error = 'Project not found';
        return;
      }

      const project = state.projects[projectIndex];

      // Use helper with auth context passed as parameter
      if (!canModifyProject(project, authContext)) {
        state.error = 'Insufficient permissions to update project';
        return;
      }

      const updatedProject = {
        ...project,
        ...updates,
        updated_at: new Date().toISOString()
      };

      const validationError = validateProject(updatedProject);
      if (validationError) {
        state.error = validationError;
        return;
      }

      state.projects[projectIndex] = updatedProject;

      if (state.currentProject?.id === id) {
        state.currentProject = updatedProject;
      }

      state.error = undefined;
    },
    
    deleteProject: (state, action: PayloadAction<DeleteProjectPayload>) => {
      const { id, authContext } = action.payload;
      const project = state.projects.find(p => p.id === id);

      if (!project) {
        state.error = 'Project not found';
        return;
      }

      if (!canModifyProject(project, authContext)) {
        state.error = 'Insufficient permissions to delete project';
        return;
      }

      state.projects = state.projects.filter(p => p.id !== id);

      if (state.currentProject?.id === id) {
        state.currentProject = undefined;
      }

      state.error = undefined;
    },
    
    setCurrentProject: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      const project = state.projects.find(p => p.id === projectId);
      
      if (project) {
        state.currentProject = project;
        state.error = undefined;
      } else {
        state.error = 'Project not found';
      }
    },
    
    addProjectMember: (state, action: PayloadAction<ProjectMemberPayload>) => {
      const { projectId, member, authContext } = action.payload;

      if (!member) {
        state.error = 'Member data is required';
        return;
      }

      const project = state.projects.find(p => p.id === projectId);

      if (!project) {
        state.error = 'Project not found';
        return;
      }

      if (!canModifyProject(project, authContext)) {
        state.error = 'Insufficient permissions to add member';
        return;
      }

      // Check if member already exists
      const existingMember = project.members.find(m => m.user_id === member.user_id);
      if (existingMember) {
        state.error = 'User is already a member of this project';
        return;
      }

      project.members.push(member);

      // Update current project if it's the one being modified
      if (state.currentProject?.id === projectId) {
        state.currentProject.members = project.members;
      }

      state.error = undefined;
    },
    
    removeProjectMember: (state, action: PayloadAction<ProjectMemberPayload>) => {
      const { projectId, memberId, authContext } = action.payload;

      if (!memberId) {
        state.error = 'Member ID is required';
        return;
      }

      const project = state.projects.find(p => p.id === projectId);

      if (!project) {
        state.error = 'Project not found';
        return;
      }

      if (!canModifyProject(project, authContext)) {
        state.error = 'Insufficient permissions to remove member';
        return;
      }

      project.members = project.members.filter(m => m.id !== memberId);

      // Update current project if it's the one being modified
      if (state.currentProject?.id === projectId) {
        state.currentProject.members = project.members;
      }

      state.error = undefined;
    },
    
    updateProjectMember: (state, action: PayloadAction<ProjectMemberPayload>) => {
      const { projectId, memberId, updates, authContext } = action.payload;

      if (!memberId || !updates) {
        state.error = 'Member ID and updates are required';
        return;
      }

      const project = state.projects.find(p => p.id === projectId);

      if (!project) {
        state.error = 'Project not found';
        return;
      }

      if (!canModifyProject(project, authContext)) {
        state.error = 'Insufficient permissions to update member';
        return;
      }

      const memberIndex = project.members.findIndex(m => m.id === memberId);
      if (memberIndex === -1) {
        state.error = 'Member not found';
        return;
      }

      project.members[memberIndex] = { ...project.members[memberIndex], ...updates };

      // Update current project if it's the one being modified
      if (state.currentProject?.id === projectId) {
        state.currentProject.members = project.members;
      }

      state.error = undefined;
    },
    
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    clearError: (state) => {
      state.error = undefined;
    }
  },
});

export const {
  setProjects,
  createProject,
  updateProject,
  deleteProject,
  setCurrentProject,
  addProjectMember,
  removeProjectMember,
  updateProjectMember,
  setLoading,
  setError,
  clearError
} = projectsSlice.actions;

// Selectors for easy access to projects state
export const selectProjects = (state: { projects: ProjectsState }) => state.projects.projects;
export const selectCurrentProject = (state: { projects: ProjectsState }) => state.projects.currentProject;
export const selectProjectsLoading = (state: { projects: ProjectsState }) => state.projects.loading;
export const selectProjectsError = (state: { projects: ProjectsState }) => state.projects.error;

// Organisation-scoped selectors
export const selectProjectsByOrganisation = (organisationId: string) => 
  (state: { projects: ProjectsState }) => 
    state.projects.projects.filter(p => p.organisation_id === organisationId);

export const selectUserProjects = (userId: string) =>
  (state: { projects: ProjectsState }) =>
    state.projects.projects.filter(p => 
      p.created_by === userId || p.members.some(m => m.user_id === userId)
    );

export default projectsSlice.reducer;