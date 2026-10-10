#!/usr/bin/env node
/**
 * Compare the app's SelfTestBit numbers against the firmware's selfTest_type_t.
 *
 * The self-test bits are mirrored by hand: Seeed's ww500_md/selfTest.h, a copy
 * in ww-hardware, and SelfTestBit in src/utils/deviceSelfTest.ts. AGENTS.md
 * calls the numbers a cross-repo contract, but nothing compared them, and the
 * firmware's bit 14 (Seeed PR #240, 29 September 2026) reached the app as
 * "Unknown hardware issue" until ww-hardware issue 56.
 *
 * Bit numbers are the contract: a bit on one side only, two names on one bit,
 * or a firmware bit of 16 or more (the nRF sends the mask as a 16-bit %04x)
 * exits 1. Names are not the contract, so a name that differs is a warning
 * unless it is in the alias table below, and never fails the run.
 *
 * The firmware's values are computed the way C computes them, implicit
 * increments after an explicit `= 8`, not read from the comments beside them.
 * An initialiser this cannot evaluate stops the run with exit 2 rather than
 * guessing, and so does a header it cannot fetch or find the enum in.
 *
 * Advisory in CI for the same reason as check-op-indices.js: the firmware may
 * legitimately lead the app by one pull request.
 *
 *   node scripts/check-selftest-bits.js            # fetch from Seeed dev
 *   node scripts/check-selftest-bits.js <header>   # compare against a local file
 */

/* global AbortSignal */
const fs = require('fs')
const path = require('path')

const APP_FILE = path.join(__dirname, '..', 'src', 'utils', 'deviceSelfTest.ts')
const FIRMWARE_URL =
    'https://raw.githubusercontent.com/wildlifeai/Seeed_Grove_Vision_AI_Module_V2/dev/' +
    'EPII_CM55M_APP_S/app/ww_projects/ww500_md/selfTest.h'
const FETCH_TIMEOUT_MS = 15000
/** The nRF prints the mask with %04x, so a bit at 16 or above never reaches the app. */
const WIRE_BITS = 16

// Firmware name (without SELF_TEST_) -> app name, where the two repos knowingly
// call the same bit different things. Add a row here rather than renaming either side.
const ALIASES = {
    AI_PROC: 'AI_PROC_NOT_RESPONDING',
    AI_NO_CAM: 'AI_NO_MAIN_CAMERA',
    AI_NO_MD: 'AI_NO_HM0360',
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

/** An integer literal, decimal or hex, with any C suffix. Anything else is refused. */
function evaluate(expr, name) {
    const m = expr.trim().match(/^(0[xX][0-9a-fA-F]+|\d+)[uUlL]*$/)
    if (!m) throw new Error(`cannot evaluate the initialiser of ${name} (= ${expr.trim()}); teach evaluate() before trusting a comparison`)
    return Number(m[1])
}

/** The members of an enum body, in order, with the values the compiler gives them. */
function enumMembers(body, where) {
    const members = []
    let next = 0
    for (const entry of stripComments(body).split(',')) {
        const text = entry.trim()
        if (!text) continue
        const m = text.match(/^([A-Za-z_]\w*)\s*(?:=\s*([\s\S]+))?$/)
        if (!m) throw new Error(`cannot parse enum member "${text}" in ${where}`)
        const value = m[2] === undefined ? next : evaluate(m[2], m[1])
        members.push({ name: m[1], value })
        next = value + 1
    }
    if (members.length === 0) throw new Error(`no members found in ${where}`)
    return members
}

function parseApp(source) {
    const block = source.match(/export\s+enum\s+SelfTestBit\s*\{([^{}]*)\}/)
    if (!block) throw new Error('SelfTestBit enum not found in ' + APP_FILE)
    return enumMembers(block[1], 'SelfTestBit')
}

function parseFirmware(source) {
    const block = source.match(/typedef\s+enum\s*\w*\s*\{([^{}]*)\}\s*selfTest_type_t\s*;/)
    if (!block) throw new Error('selfTest_type_t enum not found in the firmware header')
    return enumMembers(block[1], 'selfTest_type_t')
        .map(({ name, value }) => ({ name: name.replace(/^SELF_TEST_/, ''), value }))
}

async function loadFirmware(arg) {
    if (arg) return fs.readFileSync(arg, 'utf8')
    const res = await fetch(FIRMWARE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) throw new Error(`fetch ${FIRMWARE_URL}: ${res.status}`)
    return res.text()
}

/** Bit -> name, failing on a bit that carries two names. */
function byBit(members, side, fail) {
    const out = new Map()
    for (const { name, value } of members) {
        if (out.has(value)) fail(`bit ${value}: ${side} names it twice, ${out.get(value)} and ${name}`)
        else out.set(value, name)
    }
    return out
}

async function main() {
    const appMembers = parseApp(fs.readFileSync(APP_FILE, 'utf8'))
    const fwMembers = parseFirmware(await loadFirmware(process.argv[2]))

    let failures = 0
    let warnings = 0
    const fail = (text) => { console.log(`FAIL  ${text}`); failures++ }

    const app = byBit(appMembers, 'the app', fail)
    const fw = byBit(fwMembers, 'the firmware', fail)

    const bits = [...new Set([...app.keys(), ...fw.keys()])].sort((a, b) => a - b)
    for (const bit of bits) {
        if (bit < 0 || bit >= WIRE_BITS) {
            const [side, name] = fw.has(bit) ? ['firmware', fw.get(bit)] : ['app', app.get(bit)]
            fail(`bit ${bit}: ${side} ${name} is outside the ${WIRE_BITS}-bit mask the nRF sends`)
            continue
        }
        const a = app.get(bit)
        const f = fw.get(bit)
        if (a === undefined) { fail(`bit ${bit}: firmware has ${f}, app has nothing`); continue }
        if (f === undefined) { fail(`bit ${bit}: app has ${a}, firmware has nothing`); continue }
        const expected = ALIASES[f] ?? f
        if (expected !== a) { console.log(`WARN  bit ${bit}: firmware ${f}, app ${a} (name only)`); warnings++ }
    }

    console.log(`\napp ${app.size} bits, firmware ${fw.size} bits (${bits.join(', ')}), ` +
        `${failures} bit mismatch${failures === 1 ? '' : 'es'}, ${warnings} name warning${warnings === 1 ? '' : 's'}`)
    if (failures) {
        console.log('\nA bit on one side only is a fault the app shows as "Unknown", or a bit it names that the firmware never sets.')
        console.log('This is a three-way contract with the Seeed firmware and ww-hardware. Do not renumber unilaterally.')
        process.exitCode = 1
    }
}

// exitCode, not exit(): on Windows, process.exit() straight after a fetch can trip
// a libuv assertion and replace the exit code with a crash code.
main().catch((e) => { console.error(e.message); process.exitCode = 2 })
