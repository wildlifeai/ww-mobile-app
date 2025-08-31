import { PayloadAction, createSlice } from "@reduxjs/toolkit";

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
const canModifyProject = (project: Project, currentUser: any): boolean => {
  // WW Admin can modify any project
  if (currentUser?.role === 'ww_admin') return true;
  
  // Project creator can modify
  if (project.created_by === currentUser?.id) return true;
  
  // Project admin member can modify
  const userMember = project.members.find(m => m.user_id === currentUser?.id);
  if (userMember && userMember.role === 'project_admin') return true;
  
  // Organisation admin can modify projects in their org
  if (currentUser?.role === 'project_admin' && 
      project.organisation_id === currentUser?.organisation_id) return true;
  
  return false;
};

export const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    setProjects: (state, action: PayloadAction<Project[]>) => {
      // Filter projects by current organisation for security
      const currentOrgId = (state as any).authentication?.currentOrganisation?.id;
      const userRole = (state as any).authentication?.user?.role;
      
      if (userRole === 'ww_admin') {
        // WW Admin can see all projects
        state.projects = action.payload;
      } else {
        // Filter by current organisation
        state.projects = action.payload.filter(p => p.organisation_id === currentOrgId);
      }
      
      state.loading = false;
      state.error = undefined;
    },
    
    createProject: (state, action: PayloadAction<Project>) => {
      const project = action.payload;
      const validationError = validateProject(project);
      
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      // Check organisation scope
      const currentOrgId = (state as any).authentication?.currentOrganisation?.id;
      const userRole = (state as any).authentication?.user?.role;
      
      if (userRole !== 'ww_admin' && project.organisation_id !== currentOrgId) {
        state.error = 'Cannot create project in different organisation';
        return;
      }
      
      state.projects.push(project);
      state.error = undefined;
    },
    
    updateProject: (state, action: PayloadAction<{id: string, updates: Partial<Project>}>) => {
      const { id, updates } = action.payload;
      const projectIndex = state.projects.findIndex(p => p.id === id);
      
      if (projectIndex === -1) {
        state.error = 'Project not found';
        return;
      }
      
      const project = state.projects[projectIndex];
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyProject(project, currentUser)) {
        state.error = 'Insufficient permissions to update project';
        return;
      }
      
      // Validate updates
      const updatedProject = { ...project, ...updates, updated_at: new Date().toISOString() };
      const validationError = validateProject(updatedProject);
      
      if (validationError) {
        state.error = validationError;
        return;
      }
      
      state.projects[projectIndex] = updatedProject;
      
      // Update current project if it's the one being updated
      if (state.currentProject?.id === id) {
        state.currentProject = updatedProject;
      }
      
      state.error = undefined;
    },
    
    deleteProject: (state, action: PayloadAction<string>) => {
      const projectId = action.payload;
      const project = state.projects.find(p => p.id === projectId);
      
      if (!project) {
        state.error = 'Project not found';
        return;
      }
      
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyProject(project, currentUser)) {
        state.error = 'Insufficient permissions to delete project';
        return;
      }
      
      state.projects = state.projects.filter(p => p.id !== projectId);
      
      // Clear current project if it was deleted
      if (state.currentProject?.id === projectId) {
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
    
    addProjectMember: (state, action: PayloadAction<{projectId: string, member: ProjectMember}>) => {
      const { projectId, member } = action.payload;
      const project = state.projects.find(p => p.id === projectId);
      
      if (!project) {
        state.error = 'Project not found';
        return;
      }
      
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyProject(project, currentUser)) {
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
    
    removeProjectMember: (state, action: PayloadAction<{projectId: string, memberId: string}>) => {
      const { projectId, memberId } = action.payload;
      const project = state.projects.find(p => p.id === projectId);
      
      if (!project) {
        state.error = 'Project not found';
        return;
      }
      
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyProject(project, currentUser)) {
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
    
    updateProjectMember: (state, action: PayloadAction<{
      projectId: string, 
      memberId: string, 
      updates: Partial<ProjectMember>
    }>) => {
      const { projectId, memberId, updates } = action.payload;
      const project = state.projects.find(p => p.id === projectId);
      
      if (!project) {
        state.error = 'Project not found';
        return;
      }
      
      const currentUser = (state as any).authentication?.user;
      
      if (!canModifyProject(project, currentUser)) {
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