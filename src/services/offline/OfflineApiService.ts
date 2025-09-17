import { store } from '../../redux';
import { projectsApi } from '../../redux/api/projects';
import { deploymentsApi } from '../../redux/api/deployments';
import {
  Project,
  ProjectCreate,
  ProjectUpdate,
  Deployment,
  DeploymentCreate,
  DeploymentUpdate
} from '../../types/api.types';

/**
 * Offline API Service - Handles API calls for offline operations
 * Separated to avoid circular dependencies in testing
 */
export class OfflineApiService {
  /**
   * Create project via API
   */
  static async createProject(projectData: ProjectCreate): Promise<Project> {
    const result = await store.dispatch(
      projectsApi.endpoints.createProject.initiate({
        data: projectData
      })
    ).unwrap();

    return result;
  }

  /**
   * Update project via API
   */
  static async updateProject(id: string, updateData: ProjectUpdate): Promise<Project> {
    const result = await store.dispatch(
      projectsApi.endpoints.updateProject.initiate({
        id,
        body: updateData
      })
    ).unwrap();

    return result;
  }

  /**
   * Delete project via API
   */
  static async deleteProject(id: string): Promise<void> {
    await store.dispatch(
      projectsApi.endpoints.deleteProject.initiate(id)
    ).unwrap();
  }

  /**
   * Create deployment via API
   */
  static async createDeployment(deploymentData: DeploymentCreate): Promise<Deployment> {
    const result = await store.dispatch(
      deploymentsApi.endpoints.createDeployment.initiate({
        data: deploymentData
      })
    ).unwrap();

    return result;
  }

  /**
   * Update deployment via API
   */
  static async updateDeployment(id: string, updateData: DeploymentUpdate): Promise<Deployment> {
    const result = await store.dispatch(
      deploymentsApi.endpoints.updateDeployment.initiate({
        id,
        body: updateData
      })
    ).unwrap();

    return result;
  }

  /**
   * Delete deployment via API
   */
  static async deleteDeployment(id: string): Promise<void> {
    await store.dispatch(
      deploymentsApi.endpoints.deleteDeployment.initiate(id)
    ).unwrap();
  }
}