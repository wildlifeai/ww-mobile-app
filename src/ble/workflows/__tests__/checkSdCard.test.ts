import { checkSdCard } from '../checkSdCard'

/**
 * `AI info` prints the card in kilobytes, and every consumer stores and
 * divides the figures as kilobytes. The fields were named `...Mb` until #327,
 * which led a review to recommend multiplying by 1024: 30,000 GB on screen and
 * nonsense in the `sdCard...KbAtStart` columns.
 */
describe('checkSdCard', () => {
    /** A session that feeds the device's reply lines through the real `aiinfo` command. */
    const sessionReplying = (lines: string[]) => ({
        execute: jest.fn(async (factory: any) => {
            const command = factory()
            lines.forEach(line => command.collect(line))
            return command.parser()
        }),
    })

    it('returns the kilobytes the device prints, unconverted', async () => {
        // CLI-FATFS-commands.c prvInfoCommand, a 32 GB card
        const session = sessionReplying([
            'Label: WW500',
            '  31154688 K total drive space.',
            '  31150080 K available.',
        ])

        const sd = await checkSdCard(session as any)

        expect(sd).toEqual({ totalSpaceKb: 31154688, freeSpaceKb: 31150080 })
        // What SdCardStatusCard shows: KB / 1024 / 1024
        expect(Math.round(sd.totalSpaceKb / 1024 / 1024)).toBe(30)
    })

    it('throws when the Himax sleeps before printing the figures', async () => {
        const session = sessionReplying(['Label: WW500', 'Sleep'])

        await expect(checkSdCard(session as any)).rejects.toThrow('SD Card Check Failed')
    })
})
