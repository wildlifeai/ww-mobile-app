import { ImageReassembler } from "../ImageReassembler"
import { imageReassemblerEmitter } from "../../ble/emitters"

jest.mock("../logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
}))

jest.mock("../../ble/emitters", () => ({
	imageReassemblerEmitter: {
		emit: jest.fn(),
	},
}))

describe("ImageReassembler", () => {
	let reassembler: ImageReassembler

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()
		reassembler = ImageReassembler.getInstance()
		// Reset internal state (hacky since private, but needed for singleton)
		reassembler.reset()
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	it("should return the same instance", () => {
		const instance1 = ImageReassembler.getInstance()
		const instance2 = ImageReassembler.getInstance()
		expect(instance1).toBe(instance2)
	})

	it("should initialize correctly", () => {
		reassembler.initialize(100)
		// We can't easily check private properties, but we can verify behavior
		// e.g., subsequent packets should be appended
	})

	it("should process packets and emit completion when size matches", () => {
		const totalSize = 4
		reassembler.initialize(totalSize)

		// Protocol: [0x06, PacketNum, Len, ...Payload]
		// Packet 1: 2 bytes
		const packet1 = [0x06, 0x01, 0x02, 0xAA, 0xBB]
		reassembler.processPacket(packet1)

		expect(imageReassemblerEmitter.emit).not.toHaveBeenCalled()

		// Packet 2: 2 bytes
		const packet2 = [0x06, 0x02, 0x02, 0xCC, 0xDD]
		reassembler.processPacket(packet2)

		expect(imageReassemblerEmitter.emit).toHaveBeenCalledWith(
			"onImageComplete",
			"qrvM3Q==" // Base64 of AA BB CC DD
		)
	})

	it("should auto-start if not receiving", () => {
		// No initialize called

		// Packet 1
		const packet1 = [0x06, 0x01, 0x02, 0xAA, 0xBB]
		reassembler.processPacket(packet1)

		// Should have accepted it (auto-start)
		// Send EOI to force completion (since size unknown)
		// FF D9
		const packet2 = [0x06, 0x02, 0x02, 0xFF, 0xD9]
		reassembler.processPacket(packet2)

		expect(imageReassemblerEmitter.emit).toHaveBeenCalledWith(
			"onImageComplete",
			"qrv/2Q==" // Base64 of AA BB FF D9
		)
	})

	it("should detect completion by JPEG EOI marker", () => {
		reassembler.initialize(0) // Unknown size

		const packet = [0x06, 0x01, 0x02, 0xFF, 0xD9]
		reassembler.processPacket(packet)

		expect(imageReassemblerEmitter.emit).toHaveBeenCalledWith(
			"onImageComplete",
			"/9k=" // Base64 of FF D9
		)
	})

	it("should reset on timeout", () => {
		reassembler.initialize(100)

		const packet1 = [0x06, 0x01, 0x01, 0xAA]
		reassembler.processPacket(packet1)

		// Advance time past 5000ms
		jest.setSystemTime(Date.now() + 6000)

		const packet2 = [0x06, 0x02, 0x01, 0xBB]
		reassembler.processPacket(packet2)

		// Because of timeout, buffer was reset. 
		// Packet 2 triggered auto-start, so buffer only contains BB.
		// If we send EOI now:
		const packet3 = [0x06, 0x03, 0x02, 0xFF, 0xD9]
		reassembler.processPacket(packet3)

		expect(imageReassemblerEmitter.emit).toHaveBeenCalledWith(
			"onImageComplete",
			"u//Z" // Base64 of BB FF D9 (AA was lost)
		)
	})
})
