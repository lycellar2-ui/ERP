import { Client } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

async function main() {
    console.log('--- Supabase Auth Users ---')
    const client = new Client({
        connectionString: connectionString.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()

    const res = await client.query('SELECT id, email, created_at FROM auth.users')
    console.log('Auth Users count:', res.rows.length)
    res.rows.forEach(r => {
        console.log(`- Email: ${r.email}, ID: ${r.id}, Created At: ${r.created_at}`)
    })

    await client.end()
}

main().catch(console.error)
