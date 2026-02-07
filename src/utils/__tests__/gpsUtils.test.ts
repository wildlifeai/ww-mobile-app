import { decimalToDMS, formatGPSString, parseGPSResponse } from "../gpsUtils"

jest.mock("../logger", () => ({
	log: jest.fn(),
	logError: jest.fn(),
}))

describe("src/utils/gpsUtils", () => {
	describe("decimalToDMS", () => {
		it("should convert positive latitude correctly (N)", () => {
			// 37.7749° N (San Francisco approx)
			// 37 deg
			// 0.7749 * 60 = 46.494 min -> 46 min
			// 0.494 * 60 = 29.64 sec
			// Expected: 37°46'29.64"_N
			expect(decimalToDMS(37.7749, true)).toBe('37°46\'29.64"_N')
		})

		it("should convert negative latitude correctly (S)", () => {
			// -33.8688° S (Sydney approx)
			// 33 deg
			// 0.8688 * 60 = 52.128 min -> 52 min
			// 0.128 * 60 = 7.68 sec
			// Expected: 33°52'7.68"_S
			expect(decimalToDMS(-33.8688, true)).toBe('33°52\'7.68"_S')
		})

		it("should convert positive longitude correctly (E)", () => {
			// 151.2093° E (Sydney approx)
			expect(decimalToDMS(151.2093, false)).toBe('151°12\'33.48"_E')
		})

		it("should convert negative longitude correctly (W)", () => {
			// -122.4194° W (San Francisco approx)
			expect(decimalToDMS(-122.4194, false)).toBe('122°25\'9.84"_W')
		})
		
		it("should handle zero coordinates", () => {
			expect(decimalToDMS(0, true)).toBe('0°0\'0.00"_N')
			expect(decimalToDMS(0, false)).toBe('0°0\'0.00"_E')
		})
	})

	describe("formatGPSString", () => {
		it("should format string correctly with positive altitude", () => {
			// Lat: 10.5, Lon: -20.5, Alt: 100
			// Lat: 10°30'0.00"_N
			// Lon: 20°30'0.00"_W
			// Alt: 100.00_Above
			const result = formatGPSString(10.5, -20.5, 100)
			expect(result).toBe('10°30\'0.00"_N_20°30\'0.00"_W_100.00_Above')
		})

		it("should format string correctly with negative altitude", () => {
			// Lat: -5.25, Lon: 15.75, Alt: -50.5
			// Lat: 5°15'0.00"_S
			// Lon: 15°45'0.00"_E
			// Alt: 50.50_Below
			const result = formatGPSString(-5.25, 15.75, -50.5)
			expect(result).toBe('5°15\'0.00"_S_15°45\'0.00"_E_50.50_Below')
		})
	})

	describe("parseGPSResponse", () => {
		it("should return null (not implemented)", () => {
			expect(parseGPSResponse("some_data")).toBeNull()
		})
	})
})
