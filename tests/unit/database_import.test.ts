import database from '../../src/database';

describe('Database Import Test', () => {
    it('should import database without crashing', () => {
        expect(database).toBeDefined();
    });
});
