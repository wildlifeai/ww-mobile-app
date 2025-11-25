/**
 * WWAdminOfflineService - Deprecated
 * 
 * This service was part of the legacy custom offline sync mechanism.
 * It is no longer used in the WatermelonDB-native architecture.
 */

import { DatabaseService } from "./DatabaseService"
import { OfflineService } from "./OfflineService"

export class WWAdminOfflineService {
	constructor() {
		// No-op
	}

	async initialize(): Promise<void> {
		// No-op
	}

	async getAllOrganisations(adminUser: any): Promise<any[]> {
		console.warn("⚠️ WWAdminOfflineService is deprecated.")
		return []
	}

	async getProjectsByOrganisation(
		adminUser: any,
		organisationId: string,
	): Promise<any[]> {
		return []
	}

	async getAllProjects(adminUser: any): Promise<any[]> {
		return []
	}

	getWebPortalUrl(): string {
		return "https://admin.wildlifewatcher.com"
	}

	setWebPortalUrl(url: string): void {
		// No-op
	}

	async getProjectStatistics(adminUser: any): Promise<any> {
		return {
			total_organisations: 0,
			total_projects: 0,
			projects_by_status: {},
			recent_projects: [],
		}
	}

	async refreshOrganisationProjects(
		adminUser: any,
		organisationId: string,
	): Promise<void> {
		// No-op
	}

	async refreshAllData(adminUser: any): Promise<void> {
		// No-op
	}

	async destroy(): Promise<void> {
		// No-op
	}
}
