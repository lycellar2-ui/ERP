const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function checkAll() {
  const tablesRes = await pool.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND (data_type LIKE '%char%' OR data_type LIKE '%text%' OR data_type LIKE '%json%');
  `);
  
  console.log('Searching across text columns in all public tables...');
  let totalFound = 0;

  for (const row of tablesRes.rows) {
    try {
      const query = `SELECT * FROM public."${row.table_name}" WHERE "${row.column_name}"::text ILIKE '%60005%'`;
      const res = await pool.query(query);
      if (res.rows.length > 0) {
        console.log(`[MATCH FOUND] Table: ${row.table_name}, Column: ${row.column_name}, Count: ${res.rows.length}`);
        console.log(JSON.stringify(res.rows, null, 2));
        totalFound += res.rows.length;
      }
    } catch (e) {
      // ignore table column errors
    }
  }
  if (totalFound === 0) {
    console.log('No matches for 60005 in any text column in the entire database.');
  }

  // Also check audit logs
  console.log('\n--- Checking recent Audit Logs ---');
  try {
    const auditRes = await pool.query(`
      SELECT * FROM public."audit_logs" ORDER BY "createdAt" DESC LIMIT 15
    `);
    console.log(JSON.stringify(auditRes.rows, null, 2));
  } catch(e) {
    console.log('Audit logs check failed:', e.message);
  }

  await pool.end();
}

checkAll().catch(console.error);
