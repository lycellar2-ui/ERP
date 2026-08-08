const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function checkPermissions() {
  const res = await pool.query(`
    SELECT r.name as role_name, p.module, p.action 
    FROM public.roles r
    JOIN public.role_permissions rp ON r.id = rp."roleId"
    JOIN public.permissions p ON rp."permissionId" = p.id
    WHERE p.module = 'MDM'
    ORDER BY r.name, p.action
  `);
  console.log('--- MDM PERMISSIONS BY ROLE ---');
  console.log(res.rows);

  await pool.end();
}
checkPermissions().catch(console.error);
