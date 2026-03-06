/**
 * Deactivate test users (soft delete — set status INACTIVE)
 * Run: npx tsx prisma/delete-test-users.ts
 */
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 2,
    allowExitOnIdle: true,
})

async function main() {
    const client = await pool.connect()
    const emails = ['john.sales@wine-erp.com', 'admin@wine-erp.com', 'system@wine-erp.vn']

    console.log('🗑️  Deactivating test users...\n')

    for (const email of emails) {
        const res = await client.query(
            `UPDATE users SET status = 'INACTIVE' WHERE email = $1 RETURNING name`,
            [email]
        )
        if (res.rows.length > 0) {
            console.log(`  ✅ ${email} → ${res.rows[0].name} — INACTIVE`)
        } else {
            console.log(`  ⚠️  ${email} — not found`)
        }
    }

    // Also remove their role assignments so they don't show in role dropdowns
    const userIds = await client.query(
        `SELECT id FROM users WHERE email = ANY($1)`, [emails]
    )
    for (const u of userIds.rows) {
        await client.query(`DELETE FROM user_roles WHERE "userId" = $1`, [u.id])
    }

    // Verify
    const remaining = await client.query(
        `SELECT email, name, status FROM users ORDER BY status, name`
    )
    console.log(`\n👤 Tất cả users:`)
    remaining.rows.forEach(u => {
        const badge = u.status === 'ACTIVE' ? '🟢' : '🔴'
        console.log(`  ${badge} ${u.email}: ${u.name} [${u.status}]`)
    })

    client.release()
}

main()
    .catch(e => { console.error('❌ Failed:', e.message); process.exit(1) })
    .finally(async () => { await pool.end() })
