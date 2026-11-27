import { DEFAULT_LORAWAN_PING_MINUTES, resolveLorawanPingMinutes } from '../projectLorawanPing'

// #551: the project's check-in period, set on the website (ww-backend #407)
describe('resolveLorawanPingMinutes', () => {
    it("is the project's period inside the backend's range, 60 to 1440 minutes", () => {
        expect(resolveLorawanPingMinutes({ lorawan_ping_minutes: 360 })).toBe(360)
        expect(resolveLorawanPingMinutes({ lorawan_ping_minutes: 60 })).toBe(60)
        expect(resolveLorawanPingMinutes({ lorawan_ping_minutes: 1440 })).toBe(1440)
    })

    it('is every 4 hours when the project has none, or one the server could not hold', () => {
        expect(DEFAULT_LORAWAN_PING_MINUTES).toBe(240)
        // 0 is what WatermelonDB keeps in a number column nobody wrote
        for (const minutes of [0, 59, 1441, 90.5, null, undefined]) {
            expect(resolveLorawanPingMinutes({ lorawan_ping_minutes: minutes })).toBe(240)
        }
        expect(resolveLorawanPingMinutes(null)).toBe(240)
        expect(resolveLorawanPingMinutes({})).toBe(240)
    })
})
