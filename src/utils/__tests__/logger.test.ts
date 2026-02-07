import { log, logError, logWarn, logInfo, guard } from "../logger"

describe("src/utils/logger", () => {
	// Spy on console methods
	let logSpy: jest.SpyInstance
	let errorSpy: jest.SpyInstance
	let warnSpy: jest.SpyInstance
	let infoSpy: jest.SpyInstance

	beforeEach(() => {
		logSpy = jest.spyOn(console, "log").mockImplementation()
		errorSpy = jest.spyOn(console, "error").mockImplementation()
		warnSpy = jest.spyOn(console, "warn").mockImplementation()
		infoSpy = jest.spyOn(console, "info").mockImplementation()
		jest.clearAllMocks()
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	describe("Logging functions (in Test environment)", () => {
		// global.__DEV__ is true in setup files usually

		it("should NOT log 'log' messages in test env", () => {
			log("test message")
			expect(logSpy).not.toHaveBeenCalled()
		})

		it("should NOT log 'info' messages in test env", () => {
			logInfo("test info")
			expect(infoSpy).not.toHaveBeenCalled()
		})

		it("should log 'error' messages in test env", () => {
			logError("test error")
			expect(errorSpy).toHaveBeenCalledWith("test error")
		})

		it("should log 'warn' messages in test env", () => {
			logWarn("test warn")
			expect(warnSpy).toHaveBeenCalledWith("test warn")
		})
	})

	describe("guard", () => {
		it("should return function result on success", async () => {
			const mockFunc = jest.fn().mockReturnValue("success")
			const result = await guard(mockFunc)
			expect(result).toBe("success")
			expect(mockFunc).toHaveBeenCalled()
		})

		it("should log error and return error object on failure (default type 'log')", async () => {
			const error = new Error("fail")
			const mockFunc = jest.fn().mockImplementation(() => {
				throw error
			})

			const result = await guard(mockFunc)
			
			expect(result).toBe(error)
			// Guard uses log() by default, which is suppressed in test env
			expect(logSpy).not.toHaveBeenCalled() 
		})

		it("should log error to console.error when type is 'error'", async () => {
			const error = new Error("fail")
			const mockFunc = jest.fn().mockImplementation(() => {
				throw error
			})

			await guard(mockFunc, "error")
			
			expect(errorSpy).toHaveBeenCalledWith(error)
		})
	})
})
