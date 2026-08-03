import { revalidateCache } from '../src/lib/cache'

async function main() {
    console.log("🧹 Clearing in-memory user session cache...");
    revalidateCache('user:session:thukho@lyscellars.com');
    revalidateCache('user:session:*');
    console.log("✅ Cleared user session cache!");
}

main().catch(console.error);
