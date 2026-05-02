import SyncStateService from '../../src/services/SyncStateService';

describe('SyncStateService Import Test', () => {
    it('should import SyncStateService without crashing', () => {
        expect(SyncStateService).toBeDefined();
    });
});
