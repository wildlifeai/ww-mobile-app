
describe('Sanity Check', () => {
    it('should pass', () => {
        expect(true).toBe(true);
    });

    it('should have jest defined', () => {
        expect(jest).toBeDefined();
        expect(typeof jest.mock).toBe('function');
    });
});
