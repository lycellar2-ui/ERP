#!/usr/bin/env node
/**
 * UI palette codemod — normalizes legacy "Oceanic Cellar" dark-theme colors to the Light design system.
 * Value-level only (hex/rgba/class names); never touches logic.
 *
 * Usage: node scripts/ui-palette-codemod.mjs [--dry] <file-or-dir> [...]
 * See docs/architecture/ui-design-system.md §3.
 */
import fs from 'node:fs'
import path from 'node:path'

// Legacy hex → Light token hex (case-insensitive, whole-token match).
const HEX_MAP = {
    '87CBB9': '0E7490', // teal logo → teal-strong (text/links/primary bg)
    'A5DED0': '0891B2', // mint → teal accent
    '5BA88A': '15803D', // teal success → success
    '10B981': '15803D',
    '059669': '15803D',
    'D4A853': 'B45309', // amber warm → warning
    '4A8FAB': '1D4ED8', // ocean info → info
    '8B1A2E': 'B91C1C', // burgundy/reds → danger
    'E05252': 'B91C1C',
    'E85D5D': 'B91C1C',
    'EF4444': 'B91C1C',
    'DC2626': 'B91C1C',
    'F87171': 'B91C1C',
    'FCA5A5': 'B91C1C',
    'C45A2A': 'B45309',
    '8AAEBB': '475569', // steel muted → secondary text
    '6A8A9A': '64748B',
    '4A6A7A': '64748B', // deep muted → muted text
    'E8F1F2': '0F172A', // cool white text → primary text
    'C8D8E4': '0F172A',
}

// Legacy rgb triplets inside rgba(...) → Light rgb triplets (alpha preserved).
const RGB_MAP = {
    '135,203,185': '8,145,178',
    '165,222,208': '8,145,178',
    '91,168,138': '21,128,61',
    '16,185,129': '21,128,61',
    '212,168,83': '180,83,9',
    '139,26,46': '185,28,28',
    '224,82,82': '185,28,28',
    '239,68,68': '185,28,28',
    '220,38,38': '185,28,28',
    '74,143,171': '29,78,216',
    '138,174,187': '100,116,139',
    '74,106,122': '100,116,139',
    '106,138,154': '100,116,139',
}

// Whole rgba(...) values that only make sense on dark backgrounds.
const RGBA_REPLACE = [
    [/rgba\(\s*10\s*,\s*5\s*,\s*2\s*,\s*[\d.]+\s*\)/g, 'rgba(15,23,42,0.4)'], // warm-black overlay → slate overlay
    [/rgba\(\s*27\s*,\s*46\s*,\s*61\s*,\s*[\d.]+\s*\)/g, '#F8FAFC'], // dark card → subtle
    [/rgba\(\s*42\s*,\s*67\s*,\s*85\s*,\s*[\d.]+\s*\)/g, '#E2E8F0'], // dark border → border
]

// Pale text utilities designed for dark backgrounds → readable on white.
const PALE_TEXT = /\btext-(emerald|amber|sky|rose|red|green|blue|cyan|teal|orange|yellow|lime|indigo)-(300|400)\b/g

// Dead dark-mode variants (app is light-only).
const DARK_VARIANT = /[ ]?\bdark:[^\s"'`}]+/g

export function transform(src) {
    let out = src
    const stats = { hex: 0, rgba: 0, paleText: 0, dark: 0 }

    out = out.replace(/#([0-9A-Fa-f]{6})\b/g, (m, hex) => {
        const to = HEX_MAP[hex.toUpperCase()]
        if (!to) return m
        stats.hex++
        return `#${to}`
    })

    out = out.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/g, (m, r, g, b) => {
        const to = RGB_MAP[`${r},${g},${b}`]
        if (!to) return m
        stats.rgba++
        return `rgba(${to},`
    })

    for (const [re, to] of RGBA_REPLACE) {
        out = out.replace(re, () => { stats.rgba++; return to })
    }

    out = out.replace(PALE_TEXT, (_m, color) => { stats.paleText++; return `text-${color}-700` })
    out = out.replace(DARK_VARIANT, () => { stats.dark++; return '' })

    return { out, stats }
}

function collect(target, files = []) {
    const st = fs.statSync(target)
    if (st.isDirectory()) {
        if (path.basename(target) === 'print') return files
        for (const name of fs.readdirSync(target)) {
            if (name === 'print') continue
            collect(path.join(target, name), files)
        }
    } else if (/\.(tsx|jsx)$/.test(target)) {
        if (!target.includes(`${path.sep}print${path.sep}`)) {
            files.push(target)
        }
    }
    return files
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
if (isMain) {
    const args = process.argv.slice(2)
    const dry = args.includes('--dry')
    const targets = args.filter(a => a !== '--dry')
    if (targets.length === 0) {
        console.error('Usage: node scripts/ui-palette-codemod.mjs [--dry] <file-or-dir> [...]')
        process.exit(1)
    }
    const total = { files: 0, hex: 0, rgba: 0, paleText: 0, dark: 0 }
    for (const file of targets.flatMap(t => collect(t))) {
        const src = fs.readFileSync(file, 'utf8')
        const { out, stats } = transform(src)
        if (out === src) continue
        total.files++
        for (const k of ['hex', 'rgba', 'paleText', 'dark']) total[k] += stats[k]
        console.log(`${dry ? '[dry] ' : ''}${file}  hex=${stats.hex} rgba=${stats.rgba} paleText=${stats.paleText} dark=${stats.dark}`)
        if (!dry) fs.writeFileSync(file, out)
    }
    console.log(`\n${dry ? 'Would change' : 'Changed'} ${total.files} files — hex=${total.hex} rgba=${total.rgba} paleText=${total.paleText} dark=${total.dark}`)
}
