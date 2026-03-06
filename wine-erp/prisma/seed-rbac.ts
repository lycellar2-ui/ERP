/**
 * Seed — RBAC: Roles, Permissions, Admin User
 * Run: npx tsx prisma/seed-rbac.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ─── Module Permission Definitions ────────────────
const MODULES = [
    { module: 'DSH', actions: ['READ'] },
    { module: 'MDM', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    { module: 'SLS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] },
    { module: 'PRC', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'] },
    { module: 'WMS', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    { module: 'FIN', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'] },
    { module: 'TAX', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    { module: 'CRM', actions: ['READ', 'CREATE', 'UPDATE'] },
    { module: 'CST', actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE'] },
    { module: 'CNT', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'] },
    { module: 'TRS', actions: ['READ', 'CREATE', 'UPDATE'] },
    { module: 'CSG', actions: ['READ', 'CREATE', 'UPDATE'] },
    { module: 'AGN', actions: ['READ', 'CREATE', 'UPDATE'] },
    { module: 'RPT', actions: ['READ', 'EXPORT'] },
    { module: 'KPI', actions: ['READ', 'CREATE', 'UPDATE'] },
    { module: 'STM', actions: ['READ', 'CREATE', 'UPDATE'] },
    { module: 'SYS', actions: ['ADMIN', 'READ'] },
]

// ─── Role → Permission Mapping ───────────────────
const ROLE_PERMISSIONS: Record<string, string[]> = {
    'CEO': MODULES.flatMap(m => m.actions.map(a => `${m.module}:${a}`)),
    'Kế Toán': [
        'DSH:READ',
        'FIN:READ', 'FIN:CREATE', 'FIN:UPDATE', 'FIN:APPROVE', 'FIN:EXPORT',
        'TAX:READ', 'TAX:CREATE', 'TAX:UPDATE', 'TAX:DELETE',
        'PRC:READ',
        'RPT:READ', 'RPT:EXPORT',
        'STM:READ', 'STM:CREATE', 'STM:UPDATE',
        'CST:READ', 'CST:CREATE', 'CST:UPDATE',
    ],
    'Sales Manager': [
        'DSH:READ',
        'SLS:READ', 'SLS:CREATE', 'SLS:UPDATE', 'SLS:APPROVE',
        'CRM:READ', 'CRM:CREATE', 'CRM:UPDATE',
        'RPT:READ', 'RPT:EXPORT',
        'MDM:READ',
        'KPI:READ', 'KPI:CREATE', 'KPI:UPDATE',
        'CSG:READ', 'CSG:CREATE', 'CSG:UPDATE',
    ],
    'Sales Rep': [
        'DSH:READ',
        'SLS:READ', 'SLS:CREATE', 'SLS:UPDATE',
        'CRM:READ', 'CRM:CREATE', 'CRM:UPDATE',
        'MDM:READ',
        'KPI:READ',
    ],
    'Thủ Kho': [
        'DSH:READ',
        'WMS:READ', 'WMS:CREATE', 'WMS:UPDATE', 'WMS:DELETE',
        'TRS:READ', 'TRS:CREATE', 'TRS:UPDATE',
        'STM:READ', 'STM:CREATE', 'STM:UPDATE',
        'MDM:READ',
    ],
    'Thu Mua': [
        'DSH:READ',
        'PRC:READ', 'PRC:CREATE', 'PRC:UPDATE',
        'AGN:READ', 'AGN:CREATE', 'AGN:UPDATE',
        'TAX:READ', 'TAX:CREATE', 'TAX:UPDATE',
        'WMS:READ',
        'CNT:READ', 'CNT:CREATE', 'CNT:UPDATE',
        'MDM:READ',
    ],
}

async function main() {
    console.log('🔐 Seeding RBAC data...')

    // ─── 1. Create Permissions ─────────────────────
    console.log('  → Creating permissions...')
    let permCount = 0
    const permMap: Record<string, string> = {} // "MDM:READ" → permissionId

    for (const m of MODULES) {
        for (const action of m.actions) {
            const code = `${m.module}:${action}`
            const perm = await prisma.permission.upsert({
                where: { code },
                update: {},
                create: { code, module: m.module, action },
            })
            permMap[code] = perm.id
            permCount++
        }
    }
    console.log(`  ✓ ${permCount} permissions seeded`)

    // ─── 2. Create Roles + assign permissions ──────
    console.log('  → Creating roles...')
    for (const [roleName, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
        const role = await prisma.role.upsert({
            where: { id: `role-${roleName.toLowerCase().replace(/\s/g, '-')}` },
            update: { name: roleName },
            create: {
                id: `role-${roleName.toLowerCase().replace(/\s/g, '-')}`,
                name: roleName,
            },
        })

        // Clear existing permissions and reassign
        await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })
        for (const code of permCodes) {
            if (permMap[code]) {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: permMap[code] },
                })
            }
        }
        console.log(`    - Role "${roleName}": ${permCodes.length} permissions`)
    }

    // ─── 3. Create Admin User (CEO) ────────────────
    console.log('  → Creating admin user...')
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@lyscellars.com' },
        update: { name: 'Ly (CEO)' },
        create: {
            id: 'user-admin',
            email: 'admin@lyscellars.com',
            name: 'Ly (CEO)',
            passwordHash: 'supabase-managed', // Auth qua Supabase, không dùng trường này
            status: 'ACTIVE',
        },
    })

    // Assign CEO role
    await prisma.userRole.upsert({
        where: { userId_roleId: { userId: adminUser.id, roleId: 'role-ceo' } },
        update: {},
        create: { userId: adminUser.id, roleId: 'role-ceo' },
    })
    console.log(`  ✓ Admin user: ${adminUser.email} → CEO role`)

    // ─── 4. Create sample users ────────────────────
    console.log('  → Creating sample users...')
    const sampleUsers = [
        { id: 'user-ketoan', email: 'ketoan@lyscellars.com', name: 'Trà (Kế toán)', roleId: 'role-kế-toán' },
        { id: 'user-sales-mgr', email: 'sales.mgr@lyscellars.com', name: 'Jeremy (Sale Manager)', roleId: 'role-sales-manager' },
        { id: 'user-sales-01', email: 'sales01@lyscellars.com', name: 'Khánh (Sale rep)', roleId: 'role-sales-rep' },
        { id: 'user-thukho', email: 'thukho@lyscellars.com', name: 'Phạm Quốc Hùng (Thủ Kho)', roleId: 'role-thủ-kho' },
        { id: 'user-thumua', email: 'thumua@lyscellars.com', name: 'Nga (Mua Hàng)', roleId: 'role-thu-mua' },
    ]

    for (const u of sampleUsers) {
        const user = await prisma.user.upsert({
            where: { email: u.email },
            update: { name: u.name },
            create: {
                id: u.id,
                email: u.email,
                name: u.name,
                passwordHash: 'supabase-managed',
                status: 'ACTIVE',
            },
        })
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: user.id, roleId: u.roleId } },
            update: {},
            create: { userId: user.id, roleId: u.roleId },
        })
        console.log(`    - ${u.name} → ${u.roleId}`)
    }

    // ─── 5. Create Approval Templates ──────────────
    console.log('  → Creating approval templates...')

    const soTemplate = await prisma.approvalTemplate.upsert({
        where: { id: 'tmpl-so-approval' },
        update: {},
        create: {
            id: 'tmpl-so-approval',
            name: 'Phê duyệt Đơn Bán Hàng',
            docType: 'SALES_ORDER',
        },
    })
    await prisma.approvalStep.upsert({
        where: { id: 'step-so-1' },
        update: {},
        create: {
            id: 'step-so-1',
            templateId: soTemplate.id,
            stepOrder: 1,
            approverRole: 'Sales Manager',
            threshold: 50_000_000,
        },
    })
    await prisma.approvalStep.upsert({
        where: { id: 'step-so-2' },
        update: {},
        create: {
            id: 'step-so-2',
            templateId: soTemplate.id,
            stepOrder: 2,
            approverRole: 'CEO',
            threshold: 200_000_000,
        },
    })

    const poTemplate = await prisma.approvalTemplate.upsert({
        where: { id: 'tmpl-po-approval' },
        update: {},
        create: {
            id: 'tmpl-po-approval',
            name: 'Phê duyệt Đơn Mua Hàng',
            docType: 'PURCHASE_ORDER',
        },
    })
    await prisma.approvalStep.upsert({
        where: { id: 'step-po-1' },
        update: {},
        create: {
            id: 'step-po-1',
            templateId: poTemplate.id,
            stepOrder: 1,
            approverRole: 'CEO',
            threshold: 100_000_000,
        },
    })

    console.log('  ✓ Approval templates: SO (2 steps), PO (1 step)')

    console.log('\n✅ RBAC Seed complete!')
    console.log(`   Permissions: ${permCount}`)
    console.log(`   Roles: ${Object.keys(ROLE_PERMISSIONS).length}`)
    console.log(`   Users: ${sampleUsers.length + 1}`)
    console.log(`   Approval Templates: 2`)
}

main()
    .catch((e) => {
        console.error('❌ RBAC Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
