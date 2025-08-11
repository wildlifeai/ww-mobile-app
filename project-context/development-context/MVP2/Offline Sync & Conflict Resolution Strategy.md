# Offline Sync & Conflict Resolution Strategy

## Pre-Deployment Data Caching Requirements

### Automatic Background Sync
```typescript
// src/services/offline/PreDeploymentCache.ts
export class PreDeploymentCache {
  // Automatically cache essential data when online
  async cacheEssentialData() {
    // Cache all projects user is member of
    await this.cacheUserProjects();
    
    // Cache recent deployments for reference
    await this.cacheRecentDeployments();
    
    // Cache team member lists for projects
    await this.cacheProjectMembers();
    
    // Cache device configurations
    await this.cacheKnownDevices();
  }
  
  // Alert user if data is stale
  async checkDataFreshness() {
    const lastSync = await this.getLastSyncTime();
    const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
    
    if (hoursSinceSync > 24) {
      return {
        isStale: true,
        message: "Data is over 24 hours old. Connect to sync before field work."
      };
    }
    return { isStale: false };
  }
}
```

## Multi-User Offline Conflict Scenarios

### Deployment Conflicts
```typescript
// src/services/offline/ConflictResolver.ts
export class ConflictResolver {
  
  // Scenario: Multiple users deploying to same project offline
  resolveDeploymentConflict(local: Deployment, remote: Deployment): Deployment {
    // Rule 1: Active deployments on same device - first wins
    if (local.device_id === remote.device_id && 
        local.status === 'active' && 
        remote.status === 'active') {
      // Alert user of conflict
      throw new ConflictError(
        'DEVICE_ALREADY_DEPLOYED',
        'This device was already deployed by another user offline',
        { keepLocal: false, alertUser: true }
      );
    }
    
    // Rule 2: End deployment always wins over active
    if (remote.status === 'ended' && local.status === 'active') {
      return remote;
    }
    
    // Rule 3: Most recent deployment for different devices coexist
    if (local.device_id !== remote.device_id) {
      // Both deployments are valid - no conflict
      return null; // Signal to keep both
    }
    
    // Rule 4: For updates to same deployment, merge strategy
    return this.mergeDeployments(local, remote);
  }
  
  // Scenario: Multiple users adding members to project offline
  resolveProjectMemberConflict(local: Project, remote: Project): Project {
    // Union merge - combine all unique members from both
    const mergedMembers = [
      ...new Map([
        ...local.members.map(m => [m.user_id, m]),
        ...remote.members.map(m => [m.user_id, m])
      ]).values()
    ];
    
    // Keep most recent project metadata
    const base = local.updated_at > remote.updated_at ? local : remote;
    
    return {
      ...base,
      members: mergedMembers,
      updated_at: new Date().toISOString()
    };
  }
  
  // Scenario: Project deletion while offline modifications
  resolveProjectDeletion(local: Project, remote: Project): Project {
    // Logical delete always wins
    if (remote.deleted_at && !local.deleted_at) {
      return remote;
    }
    
    // If both deleted, keep earliest deletion
    if (local.deleted_at && remote.deleted_at) {
      return local.deleted_at < remote.deleted_at ? local : remote;
    }
    
    return local;
  }
}
```

## LoRaWAN Partial Connectivity Integration

```typescript
// src/services/offline/LoRaWANSync.ts
export class LoRaWANSync {
  
  // Use LoRaWAN for critical status updates when no internet
  async sendViaLoRaWAN(deployment: Deployment) {
    // Send minimal critical data via LoRaWAN
    const criticalData = {
      deployment_id: deployment.id,
      device_id: deployment.device_id,
      status: deployment.status,
      battery: deployment.battery_level,
      timestamp: Date.now()
    };
    
    // This gets picked up by edge function when received
    await this.lorawan.send(criticalData);
  }
  
  // Validate deployment status via LoRaWAN
  async validateDeploymentStatus(deviceId: string): Promise<boolean> {
    try {
      // Query last known status from LoRaWAN data
      const lastStatus = await this.queryLoRaWANStatus(deviceId);
      
      // Compare with local status
      const localDeployment = await this.getLocalDeployment(deviceId);
      
      if (lastStatus && localDeployment) {
        // LoRaWAN data is source of truth for device status
        if (lastStatus.status !== localDeployment.status) {
          await this.updateLocalStatus(deviceId, lastStatus.status);
          return false; // Conflict detected and resolved
        }
      }
      return true; // No conflict
    } catch (error) {
      // LoRaWAN not available, proceed with local data
      return true;
    }
  }
}
```

## Sync Status Indicators

```typescript
// src/services/offline/SyncStatusManager.ts
export interface SyncStatus {
  overall: 'synced' | 'syncing' | 'pending' | 'error';
  pendingOperations: number;
  lastSyncTime: Date | null;
  projects: Map<string, ProjectSyncStatus>;
}

export interface ProjectSyncStatus {
  projectId: string;
  status: 'synced' | 'pending' | 'conflict';
  pendingChanges: number;
  lastModified: Date;
}

export class SyncStatusManager {
  // Provide real-time sync status for UI
  getSyncStatus(): Observable<SyncStatus> {
    return this.syncStatus$.pipe(
      map(status => ({
        ...status,
        displayText: this.getSyncDisplayText(status),
        icon: this.getSyncIcon(status)
      }))
    );
  }
  
  private getSyncDisplayText(status: SyncStatus): string {
    switch (status.overall) {
      case 'synced':
        return 'All changes saved';
      case 'syncing':
        return `Syncing ${status.pendingOperations} changes...`;
      case 'pending':
        return `${status.pendingOperations} changes pending`;
      case 'error':
        return 'Sync error - tap to retry';
    }
  }
}
```

## Best Practices Summary

1. **Pre-Field Preparation**
   - Auto-cache project data when online
   - Warn users if data is >24 hours old
   - Show sync status prominently

2. **Conflict Resolution Rules**
   - Device can only have one active deployment
   - End deployment status always wins
   - Member lists merge (union)
   - Logical deletes are permanent
   - Most recent metadata wins

3. **LoRaWAN Integration**
   - Send critical status updates via LoRaWAN
   - Use as validation source when available
   - Gracefully fallback to offline-only when unavailable