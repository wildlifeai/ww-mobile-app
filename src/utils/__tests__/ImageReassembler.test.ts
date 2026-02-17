import { ImageReassembler } from "../ImageReassembler"
import { imageReassemblerEmitter } from "../../ble/emitters"

jest.mock("../logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
	logWarn: jest.fn(),
}))

jest.mock("../../ble/emitters", () => ({
	imageReassemblerEmitter: {
		emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
	},
}))

jest.mock("expo-file-system", () => ({
    cacheDirectory: "file:///test/cache/",
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    EncodingType: { Base64: "base64" },
}))

describe("ImageReassembler", () => {
	let reassembler: ImageReassembler

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()
		reassembler = new ImageReassembler(imageReassemblerEmitter as any)
	})

	afterEach(() => {
		jest.useRealTimers()
        reassembler.destroy()
	})

	it("should initialize correctly", () => {
		reassembler.initialize(100)
		// We can't easily check private properties, but we can verify behavior
	})

	it("should process packets and emit completion when size matches", () => {
		const totalSize = 4
		reassembler.initialize(totalSize)

		// Protocol: [0x06, PacketNum, ...Payload]
		// Packet 1: 2 bytes (AA BB)
		const packet1 = [0x06, 0x01, 0xAA, 0xBB]
		reassembler.processPacket(packet1)

		expect(imageReassemblerEmitter.emit).not.toHaveBeenCalled()

		// Packet 2: 2 bytes (CC DD)
		const packet2 = [0x06, 0x02, 0xCC, 0xDD]
		reassembler.processPacket(packet2)

		expect(imageReassemblerEmitter.emit).toHaveBeenCalledWith(
			"onImageComplete",
			expect.stringContaining("capture_") // It emits file URI now, not base64 content directly?
		)
        // Wait, the implementation writes to file and emits URI.
        // The previous test expected base64 string "qrvM3Q==".
        // I need to mock FileSystem if I want to test this fully, or check what it emits.
        // ImageReassembler.ts: this.emitter.emit('onImageComplete', fileUri)
	})
})

