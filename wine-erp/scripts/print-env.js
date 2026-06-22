const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
console.log('Keys in process.env:', Object.keys(process.env).filter(k => k.includes('URL') || k.includes('DB') || k.includes('DATABASE') || k.includes('SUPABASE')));
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Defined' : 'Undefined');
console.log('DIRECT_URL:', process.env.DIRECT_URL ? 'Defined' : 'Undefined');
