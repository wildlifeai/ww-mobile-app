import * as SQLite from 'expo-sqlite';

// Types for database operations
export interface DatabaseOrganisation {
  id: string;
  name: string;
  settings: {
    timezone: string;
    currency: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseUserRole {
  user_id: string;
  organisation_id: string;
  role: 'ww_admin' | 'project_admin' | 'project_member';
  permissions: string[];
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseProject {
  id: string;
  organisation_id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'completed';
  members: string[];
  created_at?: string;
  updated_at?: string;
}

export interface LoRaWANStatus {
  battery_level: number;
  sd_card_usage: number;
  device_status: 'online' | 'offline' | 'error';
  last_seen?: string;
}

export interface DatabaseDeployment {
  id: string;
  project_id: string;
  organisation_id: string;
  device_id: string;
  location: {
    lat: number;
    lng: number;
  };
  status: 'active' | 'inactive' | 'completed';
  lorawan_status: LoRaWANStatus;
  created_at?: string;
  updated_at?: string;
}

export interface DatabaseDevice {
  id: string;
  organisation_id: string;
  name: string;
  model: string;
  firmware_version: string;
  last_sync: string;
  battery_level?: number;
  storage_usage?: number;
  created_at?: string;
  updated_at?: string;
}

export interface OfflineQueueItem {
  id?: string;
  operation_type: string;
  data: any;
  organisation_id: string;
  user_id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at?: string;
  updated_at?: string;
}

export class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private readonly DATABASE_NAME = 'wildlife_watcher.db';
  private readonly DATABASE_VERSION = 1;

  /**
   * Initialize SQLite database with multi-tenancy support
   */
  async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync(this.DATABASE_NAME, {
        enableChangeListener: true
      });

      // Enable foreign key constraints
      await this.db.execAsync('PRAGMA foreign_keys = ON;');
      
      // Set journal mode to WAL for better performance
      await this.db.execAsync('PRAGMA journal_mode = WAL;');

      // Run migrations
      await this.runMigrations();

    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.closeAsync();
      this.db = null;
    }
  }

  /**
   * Get current database version
   */
  async getDatabaseVersion(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync('PRAGMA user_version') as { user_version: number };
    return result.user_version;
  }

  /**
   * Set database version
   */
  async setDatabaseVersion(version: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(`PRAGMA user_version = ${version}`);
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    const currentVersion = await this.getDatabaseVersion();
    
    if (currentVersion < this.DATABASE_VERSION) {
      await this.createTables();
      await this.setDatabaseVersion(this.DATABASE_VERSION);
    }
  }

  /**
   * Create all required tables
   */
  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Organisations table
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_organisations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        settings TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User roles table with organisation scoping
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_user_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        organisation_id TEXT NOT NULL,
        role TEXT CHECK(role IN ('ww_admin', 'project_admin', 'project_member')) NOT NULL,
        permissions TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organisation_id) REFERENCES local_organisations (id),
        UNIQUE(user_id, organisation_id)
      );
    `);

    // Projects table with organisation scoping
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_projects (
        id TEXT PRIMARY KEY,
        organisation_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT CHECK(status IN ('active', 'inactive', 'completed')) DEFAULT 'active',
        members TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organisation_id) REFERENCES local_organisations (id)
      );
    `);

    // Devices table with organisation scoping
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_devices (
        id TEXT PRIMARY KEY,
        organisation_id TEXT NOT NULL,
        name TEXT NOT NULL,
        model TEXT NOT NULL,
        firmware_version TEXT,
        last_sync DATETIME,
        battery_level INTEGER,
        storage_usage INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organisation_id) REFERENCES local_organisations (id)
      );
    `);

    // Deployments table with LoRaWAN integration
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS local_deployments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        organisation_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT CHECK(status IN ('active', 'inactive', 'completed')) DEFAULT 'active',
        lorawan_status TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES local_projects (id),
        FOREIGN KEY (organisation_id) REFERENCES local_organisations (id),
        FOREIGN KEY (device_id) REFERENCES local_devices (id)
      );
    `);

    // Offline queue table for sync operations
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS offline_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_type TEXT NOT NULL,
        data TEXT NOT NULL,
        organisation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3,
        status TEXT CHECK(status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organisation_id) REFERENCES local_organisations (id)
      );
    `);

    // Create indexes for better query performance
    await this.db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_user_roles_org ON local_user_roles (organisation_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_user ON local_user_roles (user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_org ON local_projects (organisation_id);
      CREATE INDEX IF NOT EXISTS idx_devices_org ON local_devices (organisation_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_org ON local_deployments (organisation_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_project ON local_deployments (project_id);
      CREATE INDEX IF NOT EXISTS idx_queue_status ON offline_queue (status);
      CREATE INDEX IF NOT EXISTS idx_queue_priority ON offline_queue (priority);
      CREATE INDEX IF NOT EXISTS idx_queue_org ON offline_queue (organisation_id);
    `);
  }

  // Organisation Management Methods
  async insertOrganisation(organisation: DatabaseOrganisation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!organisation.id) throw new Error('Organisation ID is required');

    await this.db.runAsync(
      'INSERT INTO local_organisations (id, name, settings) VALUES (?, ?, ?)',
      [organisation.id, organisation.name, JSON.stringify(organisation.settings)]
    );
  }

  async getOrganisationById(id: string): Promise<DatabaseOrganisation | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      'SELECT * FROM local_organisations WHERE id = ?',
      [id]
    ) as any;

    if (!result) return null;

    return {
      id: result.id,
      name: result.name,
      settings: JSON.parse(result.settings),
      created_at: result.created_at,
      updated_at: result.updated_at
    };
  }

  // User Role Management Methods
  async insertUserRole(userRole: DatabaseUserRole): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'INSERT INTO local_user_roles (user_id, organisation_id, role, permissions) VALUES (?, ?, ?, ?)',
      [
        userRole.user_id,
        userRole.organisation_id,
        userRole.role,
        JSON.stringify(userRole.permissions)
      ]
    );
  }

  async getUserRolesByOrganisation(userId: string, organisationId: string): Promise<DatabaseUserRole[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync(
      'SELECT * FROM local_user_roles WHERE user_id = ? AND organisation_id = ?',
      [userId, organisationId]
    ) as any[];

    return results.map(result => ({
      user_id: result.user_id,
      organisation_id: result.organisation_id,
      role: result.role,
      permissions: JSON.parse(result.permissions),
      created_at: result.created_at,
      updated_at: result.updated_at
    }));
  }

  async validateWWAdminAccess(userId: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync(
      "SELECT * FROM local_user_roles WHERE user_id = ? AND role = 'ww_admin'",
      [userId]
    );

    return !!result;
  }

  // Project Management Methods
  async insertProject(project: DatabaseProject): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    if (!project.organisation_id) throw new Error('Organisation ID is required');

    await this.db.runAsync(
      'INSERT INTO local_projects (id, organisation_id, name, description, status, members) VALUES (?, ?, ?, ?, ?, ?)',
      [
        project.id,
        project.organisation_id,
        project.name,
        project.description,
        project.status,
        JSON.stringify(project.members)
      ]
    );
  }

  async getProjectsByOrganisation(organisationId: string): Promise<DatabaseProject[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync(
      'SELECT * FROM local_projects WHERE organisation_id = ?',
      [organisationId]
    ) as any[];

    return results.map(result => ({
      id: result.id,
      organisation_id: result.organisation_id,
      name: result.name,
      description: result.description,
      status: result.status,
      members: JSON.parse(result.members),
      created_at: result.created_at,
      updated_at: result.updated_at
    }));
  }

  async updateProject(id: string, project: Partial<DatabaseProject>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (project.name !== undefined) {
      updates.push('name = ?');
      values.push(project.name);
    }
    if (project.description !== undefined) {
      updates.push('description = ?');
      values.push(project.description);
    }
    if (project.status !== undefined) {
      updates.push('status = ?');
      values.push(project.status);
    }
    if (project.members !== undefined) {
      updates.push('members = ?');
      values.push(JSON.stringify(project.members));
    }

    if (updates.length === 0) return; // No updates

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await this.db.runAsync(
      `UPDATE local_projects SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteProject(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'DELETE FROM local_projects WHERE id = ?',
      [id]
    );
  }

  // Deployment Management with LoRaWAN Integration
  async insertDeployment(deployment: DatabaseDeployment): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'INSERT INTO local_deployments (id, project_id, organisation_id, device_id, location, status, lorawan_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        deployment.id,
        deployment.project_id,
        deployment.organisation_id,
        deployment.device_id,
        JSON.stringify(deployment.location),
        deployment.status,
        JSON.stringify(deployment.lorawan_status)
      ]
    );
  }

  async updateDeploymentLoRaWANStatus(deploymentId: string, lorawanStatus: LoRaWANStatus): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE local_deployments SET lorawan_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(lorawanStatus), deploymentId]
    );
  }

  async getDeploymentsByOrganisation(organisationId: string): Promise<DatabaseDeployment[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync(
      'SELECT * FROM local_deployments WHERE organisation_id = ?',
      [organisationId]
    ) as any[];

    return results.map(result => ({
      id: result.id,
      project_id: result.project_id,
      organisation_id: result.organisation_id,
      device_id: result.device_id,
      location: JSON.parse(result.location),
      status: result.status,
      lorawan_status: JSON.parse(result.lorawan_status),
      created_at: result.created_at,
      updated_at: result.updated_at
    }));
  }

  async updateDeployment(id: string, deployment: Partial<DatabaseDeployment>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const updates: string[] = [];
    const values: any[] = [];

    if (deployment.project_id !== undefined) {
      updates.push('project_id = ?');
      values.push(deployment.project_id);
    }
    if (deployment.device_id !== undefined) {
      updates.push('device_id = ?');
      values.push(deployment.device_id);
    }
    if (deployment.location !== undefined) {
      updates.push('location = ?');
      values.push(JSON.stringify(deployment.location));
    }
    if (deployment.status !== undefined) {
      updates.push('status = ?');
      values.push(deployment.status);
    }
    if (deployment.lorawan_status !== undefined) {
      updates.push('lorawan_status = ?');
      values.push(JSON.stringify(deployment.lorawan_status));
    }

    if (updates.length === 0) return; // No updates

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await this.db.runAsync(
      `UPDATE local_deployments SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }

  async deleteDeployment(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'DELETE FROM local_deployments WHERE id = ?',
      [id]
    );
  }

  // Offline Queue Management
  async addToOfflineQueue(item: OfflineQueueItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'INSERT INTO offline_queue (operation_type, data, organisation_id, user_id, priority, retry_count, max_retries, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        item.operation_type,
        JSON.stringify(item.data),
        item.organisation_id,
        item.user_id,
        item.priority,
        item.retry_count,
        item.max_retries,
        item.status
      ]
    );
  }

  async getPendingQueueItems(): Promise<OfflineQueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync(
      "SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC"
    ) as any[];

    return results.map(result => ({
      id: result.id.toString(),
      operation_type: result.operation_type,
      data: JSON.parse(result.data),
      organisation_id: result.organisation_id,
      user_id: result.user_id,
      priority: result.priority,
      retry_count: result.retry_count,
      max_retries: result.max_retries,
      status: result.status,
      created_at: result.created_at,
      updated_at: result.updated_at
    }));
  }

  async updateQueueItemRetry(itemId: string, retryCount: number, status: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE offline_queue SET retry_count = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [retryCount, status, itemId]
    );
  }

  async markQueueItemCompleted(itemId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      "UPDATE offline_queue SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [itemId]
    );
  }

  async getQueueItemsByOrganisation(organisationId: string): Promise<OfflineQueueItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync(
      'SELECT * FROM offline_queue WHERE organisation_id = ? ORDER BY created_at DESC',
      [organisationId]
    ) as any[];

    return results.map(result => ({
      id: result.id.toString(),
      operation_type: result.operation_type,
      data: JSON.parse(result.data),
      organisation_id: result.organisation_id,
      user_id: result.user_id,
      priority: result.priority,
      retry_count: result.retry_count,
      max_retries: result.max_retries,
      status: result.status,
      created_at: result.created_at,
      updated_at: result.updated_at
    }));
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

export const getDatabaseService = (): DatabaseService => {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
};