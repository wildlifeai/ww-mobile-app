#!/usr/bin/env node
/**
 * Compare the app's OP_PARAMETER indices against the firmware's OP_PARAMETERS_E.
 *
 * The two are mirrored by hand in three repositories and AGENTS.md says never
 * to renumber unilaterally, but until now nothing checked. This fetches the
 * firmware header from the Seeed fork's dev branch and diffs the index table.
 *
 * Indices and count are the contract: a mismatch there means a setop from the
 * app lands on the wrong parameter, and that exits non-zero. Names are not the
 * contract, only a convenience, so a name that differs is reported as a
 * warning unless it is in the alias table below, and never fails the run.
 *
 * Advisory in CI by design: the firmware may legitimately lead the app by one
 * pull request, and this must not block that.
 *
 *   node scripts/check-op-indices.js            # fetch from Seeed dev
 *   node scripts/check-op-indices.js <header>   # compare against a local file
 */

const fs = require('fs')
const path = require('path')

const APP_ENUM = path.join(__dirname, '..', 'src', 'hooks', 'useDeviceSettings.ts')
const FIRMWARE_URL =
    'https://raw.githubusercontent.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/dev/' +
    'EPII_CM55M_APP_S/app/ww_projects/ww500_md/fatfs_task.h'

// Firmware name -> app name, where the two repos knowingly call the same index
// different things. Add a row here rather than renaming either side.
const ALIASES = {
    LED_BRIGHTNESS_PERCENT: 'LED_BRIGHTNESS',
    FLASH_EVALUATE_INTERVAL: 'AE_CHECK_INTERVAL',
}

function parseApp(source) {
    const block = source.match(/export const OP_PARAMETER = \{([\s\S]*?)\} as const/)
    if (!block) throw new Error('OP_PARAMETER block not found in ' + APP_ENUM)
    const out = new Map()
    for (const m of block[1].matchAll(/^\s*([A-Z0-9_]+):\s*(\d+),/gm)) out.set(Number(m[2]), m[1])
    return out
}

function parseFirmware(source) {
    const block = source.match(/typedef enum \{([\s\S]*?)\} OP_PARAMETERS_E;/)
    if (!block) throw new Error('OP_PARAMETERS_E enum not found in firmware header')
    const out = new Map()
    for (const m of block[1].matchAll(/^\s*OP_PARAMETER_([A-Z0-9_]+),\s*\/\/\s*(\d+)\b/gm)) {
        out.set(Number(m[2]), m[1])
    }
    return out
}

async function loadFirmware(arg) {
    if (arg) return fs.readFileSync(arg, 'utf8')
    const res = await fetch(FIRMWARE_URL)
    if (!res.ok) throw new Error(`fetch ${FIRMWARE_URL}: ${res.status}`)
    return res.text()
}

async function main() {
    const app = parseApp(fs.readFileSync(APP_ENUM, 'utf8'))
    const fw = parseFirmware(await loadFirmware(process.argv[2]))

    let failures = 0
    let warnings = 0
    const max = Math.max(...app.keys(), ...fw.keys())

    for (let i = 0; i <= max; i++) {
        const a = app.get(i)
        const f = fw.get(i)
        if (a === undefined && f === undefined) continue
        if (a === undefined) { console.log(`FAIL  op${i}: firmware has ${f}, app has nothing`); failures++; continue }
        if (f === undefined) { console.log(`FAIL  op${i}: app has ${a}, firmware has nothing`); failures++; continue }
        const expected = ALIASES[f] ?? f
        if (expected !== a) { console.log(`WARN  op${i}: firmware ${f}, app ${a} (name only)`); warnings++ }
    }

    console.log(`\napp ${app.size} indices, firmware ${fw.size} indices, ` +
        `${failures} index mismatch${failures === 1 ? '' : 'es'}, ${warnings} name warning${warnings === 1 ? '' : 's'}`)
    if (failures) {
        console.log('\nAn index mismatch means a setop from the app lands on the wrong firmware parameter.')
        console.log('This is a three-way contract with the Seeed firmware and ww-hardware. Do not renumber unilaterally.')
        process.exit(1)
    }
}

main().catch((e) => { console.error(e.message); process.exit(2) })
