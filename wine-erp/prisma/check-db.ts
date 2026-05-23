import { Client } from 'pg'
import * as dotenv from 'dotenv'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

dotenv.config({ path: '.env.local' })

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()
    console.log('Connected to DB')

    // Check tables
    const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `)
    console.log('Tables:', tablesRes.rows.map(r => r.table_name))

    // Check columns of customers
    const custCols = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'customers'
    `)
    console.log('Customer columns:', custCols.rows.map(r => `${r.column_name} (${r.data_type})`))

    // Check columns of legal_entities if exists
    const hasLegalEntities = tablesRes.rows.some(r => r.table_name === 'legal_entities')
    if (hasLegalEntities) {
        const leCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'legal_entities'
        `)
        console.log('LegalEntity columns:', leCols.rows.map(r => `${r.column_name} (${r.data_type})`))
    }

    await client.end()
}

main().catch(console.error)
