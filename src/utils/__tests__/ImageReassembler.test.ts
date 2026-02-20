import { ImageReassembler } from "../ImageReassembler"


jest.mock("../logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
	logWarn: jest.fn(),
}))

const mockEmitter = {
	emit: jest.fn(),
	on: jest.fn(),
	off: jest.fn(),
}

jest.mock("expo-file-system/legacy", () => ({
	cacheDirectory: "file:///test/cache/",
	writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
	EncodingType: { Base64: "base64" },
}))

describe("ImageReassembler", () => {
	let reassembler: ImageReassembler

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()
		reassembler = new ImageReassembler(mockEmitter as any)
	})

	afterEach(() => {
		jest.useRealTimers()
		reassembler.destroy()
	})

	describe("initialize", () => {
		it("should initialize transfer with expected byte count", () => {
			reassembler.initialize(1000)
			// Verify by processing a packet — it should be accepted (not ignored)
			const packet = [0x06, 0x01, 0x02, 0xFF, 0xD8]
			reassembler.processPacket(packet)
			expect(mockEmitter.emit).toHaveBeenCalledWith("onImageProgress", expect.any(Number))
		})
	})

	describe("processPacket - 3-byte header parsing", () => {
		it("should skip the 3-byte header [0x06, packetNum, payloadLength] and use only payload as data", async () => {
			// Total: 4 bytes of payload across 2 packets
			const totalSize = 4
			reassembler.initialize(totalSize)

			// Packet 1: header=[0x06, 0x01, 0x02] payload=[0xFF, 0xD8] (JPEG magic)
			const packet1 = [0x06, 0x01, 0x02, 0xFF, 0xD8]
			reassembler.processPacket(packet1)

			// Progress should reflect 2/4 bytes
			expect(mockEmitter.emit).toHaveBeenCalledWith("onImageProgress", 0.5)

			// Packet 2: header=[0x06, 0x02, 0x02] payload=[0xCC, 0xDD]
			const packet2 = [0x06, 0x02, 0x02, 0xCC, 0xDD]
			reassembler.processPacket(packet2)

			// Allow async finalize (FileSystem.writeAsStringAsync) to complete
			await Promise.resolve()

			// Should emit onImageComplete since 4/4 bytes received
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				"onImageComplete",
				expect.stringContaining("capture_")
			)
		})

		it("should reject packets smaller than 3 bytes", () => {
			reassembler.initialize(100)
			const tinyPacket = [0x06, 0x01] // Only 2 bytes, no payloadLength
			reassembler.processPacket(tinyPacket)
			// No progress should be emitted
			expect(mockEmitter.emit).not.toHaveBeenCalledWith("onImageProgress", expect.anything())
		})

		it("should reject packets with wrong marker byte", () => {
			reassembler.initialize(100)
			const badPacket = [0x07, 0x01, 0x02, 0xAA, 0xBB]
			reassembler.processPacket(badPacket)
			expect(mockEmitter.emit).not.toHaveBeenCalledWith("onImageProgress", expect.anything())
		})

		it("should handle empty payload after header", () => {
			reassembler.initialize(100)
			const emptyPayload = [0x06, 0x01, 0x00] // Header only, zero payload
			reassembler.processPacket(emptyPayload)
			expect(mockEmitter.emit).not.toHaveBeenCalledWith("onImageProgress", expect.anything())
		})

		it("should process packet even when declared length mismatches actual length", () => {
			reassembler.initialize(3)
			// Header says 5 bytes payload but actual is 3
			const mismatchPacket = [0x06, 0x01, 0x05, 0xFF, 0xD8, 0xAA]
			reassembler.processPacket(mismatchPacket)
			// Should still process the actual payload (3 bytes)
			expect(mockEmitter.emit).toHaveBeenCalledWith("onImageProgress", 1)
		})
	})

	describe("processPacket - sequence tracking", () => {
		it("should not flag gaps for sequential packets", () => {
			const { logWarn } = require("../logger")
			reassembler.initialize(100)

			// Send sequential packets 1, 2, 3
			reassembler.processPacket([0x06, 0x01, 0x01, 0xAA])
			reassembler.processPacket([0x06, 0x02, 0x01, 0xBB])
			reassembler.processPacket([0x06, 0x03, 0x01, 0xCC])

			// logWarn should NOT have been called with sequence gap message
			const gapCalls = (logWarn as jest.Mock).mock.calls.filter(
				(call: any[]) => call[0]?.includes("Sequence gap")
			)
			expect(gapCalls.length).toBe(0)
		})

		it("should detect sequence gaps", () => {
			const { logWarn } = require("../logger")
			reassembler.initialize(100)

			// Packet 1, then skip to packet 4 (gap of 2)
			reassembler.processPacket([0x06, 0x01, 0x01, 0xAA])
			reassembler.processPacket([0x06, 0x04, 0x01, 0xBB])

			const gapCalls = (logWarn as jest.Mock).mock.calls.filter(
				(call: any[]) => call[0]?.includes("Sequence gap")
			)
			expect(gapCalls.length).toBe(1)
		})
	})

	describe("processPacket - state checks", () => {
		it("should ignore packets when not initialized", () => {
			// Do NOT call initialize
			const packet = [0x06, 0x01, 0x02, 0xAA, 0xBB]
			reassembler.processPacket(packet)
			expect(mockEmitter.emit).not.toHaveBeenCalled()
		})

		it("should ignore packets after reset", () => {
			reassembler.initialize(100)
			reassembler.reset()
			const packet = [0x06, 0x01, 0x02, 0xAA, 0xBB]
			reassembler.processPacket(packet)
			expect(mockEmitter.emit).not.toHaveBeenCalledWith("onImageProgress", expect.anything())
		})
	})

	describe("finalize - integrity checks", () => {
		it("should emit onImageError when data lacks JPEG magic bytes", async () => {
			reassembler.initialize(2)

			// Payload that does NOT start with 0xFF 0xD8
			const packet = [0x06, 0x01, 0x02, 0x00, 0x00]
			reassembler.processPacket(packet)

			// Allow async finalize to complete
			await Promise.resolve()

			expect(mockEmitter.emit).toHaveBeenCalledWith(
				"onImageError",
				expect.stringContaining("not a JPEG")
			)
		})

		it("should emit onImageError when image is too incomplete", async () => {
			reassembler.initialize(100) // Expect 100 bytes

			// Only send 10 bytes (10% completeness, below 90% threshold)
			const packet = [0x06, 0x01, 0x0A, 0xFF, 0xD8, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]
			reassembler.processPacket(packet)

			// Force finalize (simulating watchdog or force_finalize event)
			reassembler.finalizePartial()
			await Promise.resolve()

			expect(mockEmitter.emit).toHaveBeenCalledWith(
				"onImageError",
				expect.stringContaining("incomplete")
			)
		})

		it("should save valid JPEG image with sufficient completeness", async () => {
			const FileSystem = require("expo-file-system/legacy")
			// 4 bytes expected, send 4 bytes starting with JPEG magic
			reassembler.initialize(4)

			const packet = [0x06, 0x01, 0x04, 0xFF, 0xD8, 0xAA, 0xBB]
			reassembler.processPacket(packet)

			await Promise.resolve()

			expect(FileSystem.writeAsStringAsync).toHaveBeenCalled()
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				"onImageComplete",
				expect.stringContaining("capture_")
			)
		})
	})

	describe("watchdog", () => {
		it("should trigger finalizePartial after timeout with no packets", () => {
			reassembler.initialize(100)

			// Send one packet to accumulate some data
			reassembler.processPacket([0x06, 0x01, 0x02, 0xFF, 0xD8])

			// Advance time past the 3-second timeout + 1-second check interval
			jest.advanceTimersByTime(4000)

			// The watchdog should have fired — since we have <90% data, it should emit error
			expect(mockEmitter.emit).toHaveBeenCalledWith(
				"onImageError",
				expect.stringContaining("incomplete")
			)
		})
	})

	describe("force_finalize", () => {
		it("should register force_finalize listener on construction", () => {
			expect(mockEmitter.on).toHaveBeenCalledWith("force_finalize", expect.any(Function))
		})

		it("should unregister force_finalize listener on destroy", () => {
			reassembler.destroy()
			expect(mockEmitter.off).toHaveBeenCalledWith("force_finalize", expect.any(Function))
		})
	})

	describe("reset", () => {
		it("should clear all state", () => {
			reassembler.initialize(100)
			reassembler.processPacket([0x06, 0x01, 0x02, 0xAA, 0xBB])
			reassembler.reset()

			// After reset, packets should be ignored
			reassembler.processPacket([0x06, 0x02, 0x02, 0xCC, 0xDD])
			// Only the first onImageProgress should have been emitted (before reset)
			const progressCalls = (mockEmitter.emit as jest.Mock).mock.calls.filter(
				(call: any[]) => call[0] === "onImageProgress"
			)
			expect(progressCalls.length).toBe(1) // only the one before reset
		})
	})
})
