import SupabaseSyncService from './SupabaseSyncService';
import ReferenceDataService from './ReferenceDataService';
import { log } from '../utils/logger'


/**
 * Service to trigger synchronization tasks after authentication events.
 * Decoupled from auth.ts to resolve circular dependencies and avoid 
 * dynamic import issues in Jest.
 */
export const triggerPostAuthSync = () => {
  log('⏰ Post-auth sync triggered');
  
  // Trigger sync after a short delay to ensure auth is fully set up
  // and database connection is stable
  setTimeout(() => {
    log('🚀 Starting background synchronization...');
    SupabaseSyncService.debouncedSync();
    ReferenceDataService.syncReferenceData();
  }, 1000);
};
