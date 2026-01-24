import SupabaseSyncService from './SupabaseSyncService';
import ReferenceDataService from './ReferenceDataService';

/**
 * Service to trigger synchronization tasks after authentication events.
 * Decoupled from auth.ts to resolve circular dependencies and avoid 
 * dynamic import issues in Jest.
 */
export const triggerPostAuthSync = () => {
  console.log('⏰ Post-auth sync triggered');
  
  // Trigger sync after a short delay to ensure auth is fully set up
  // and database connection is stable
  setTimeout(() => {
    console.log('🚀 Starting background synchronization...');
    SupabaseSyncService.debouncedSync();
    ReferenceDataService.syncReferenceData();
  }, 1000);
};
