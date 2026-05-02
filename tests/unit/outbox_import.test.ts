import OutboxService from '../../src/services/OutboxService';

describe('OutboxService Import Test', () => {
    it('should import OutboxService without crashing', () => {
        expect(OutboxService).toBeDefined();
    });
});
