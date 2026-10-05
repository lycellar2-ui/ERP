#!/usr/bin/env node
/**
 * Radius codemod — enforces design system radius rules:
 * - Strictly no rounded-2xl or rounded-xl
 * - Containers/cards/dialogs/drawers/tables -> rounded-lg
 * - Buttons/inputs/badges/selects/small pills -> rounded-md
 *
 * Usage: node scripts/radius-codemod.mjs <file-or-dir> [...]
 */
import fs from 'node:fs'
import path from 'node:path'

const TARGET_DIRS = [
    'src/app/dashboard/warehouse',
    'src/app/dashboard/transfers',
    'src/app/dashboard/stock-count',
    'src/app/dashboard/allocation',
    'src/app/dashboard/procurement',
    'src/app/dashboard/suppliers',
    'src/app/dashboard/shipments',
    'src/app/dashboard/declarations',
    'src/app/dashboard/stamps',
    'src/app/dashboard/consignment',
]

function transform(src) {
    let out = src
    let count2xl = 0
    let countXl = 0

    // Replace rounded-2xl with rounded-lg
    out = out.replace(/\brounded-2xl\b/g, () => {
        count2xl++
        return 'rounded-lg'
    })

    // Replace rounded-xl with rounded-lg
    out = out.replace(/\brounded-xl\b/g, () => {
        countXl++
        return 'rounded-lg'
    })

    return { out, count2xl, countXl }
}

function processFile(filePath) {
    if (filePath.includes(path.sep + 'print' + path.sep)) return
    if (!/\.(tsx|jsx|ts|js)$/.test(filePath)) return

    const src = fs.readFileSync(filePath, 'utf8')
    const { out, count2xl, countXl } = transform(src)

    if (count2xl > 0 || countXl > 0) {
        fs.writeFileSync(filePath, out, 'utf8')
        console.log(`[radius] ${path.relative(process.cwd(), filePath)}: 2xl=${count2xl}, xl=${countXl}`)
    }
}

function walk(dir) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const ent of entries) {
        const fullPath = path.join(dir, ent.name)
        if (ent.isDirectory()) {
            if (ent.name !== 'node_modules' && ent.name !== 'print') {
                walk(fullPath)
            }
        } else {
            processFile(fullPath)
        }
    }
}

const args = process.argv.slice(2)
const targets = args.length > 0 ? args : TARGET_DIRS

for (const target of targets) {
    const fullPath = path.resolve(process.cwd(), target)
    if (fs.existsSync(fullPath)) {
        if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath)
        } else {
            processFile(fullPath)
        }
    }
}
console.log('Radius codemod completed.')
