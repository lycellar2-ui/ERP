const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function checkUsers() {
  const users = await pool.query(`
    SELECT u.id, u.email, u.name, u.status, r.name as role_name 
    FROM public.users u
    LEFT JOIN public.user_roles ur ON u.id = ur."userId"
    LEFT JOIN public.roles r ON ur."roleId" = r.id
  `);
  console.log('--- SYSTEM USERS & ROLES ---');
  console.log(users.rows);

  await pool.end();
}
checkUsers().catch(console.error);
