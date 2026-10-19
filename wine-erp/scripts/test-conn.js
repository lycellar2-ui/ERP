const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    try {
        await prisma.$connect();
        console.log('Connected natively successfully!');
    } catch (e) {
        console.error('Connection error:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
run();
