const mockImpl = {
	setItem: jest.fn(() => Promise.resolve()),
	getItem: jest.fn(() => Promise.resolve(null)),
	removeItem: jest.fn(() => Promise.resolve()),
	clear: jest.fn(() => Promise.resolve()),
	getAllKeys: jest.fn(() => Promise.resolve([])),
	multiGet: jest.fn(() => Promise.resolve([])),
	multiSet: jest.fn(() => Promise.resolve()),
	multiRemove: jest.fn(() => Promise.resolve()),
}

global.mockAsyncStorage = mockImpl

module.exports = {
	__esModule: true,
	default: mockImpl,
	...mockImpl,
}
