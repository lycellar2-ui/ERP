import { z } from 'zod'

// ═══════════════════════════════════════════════════
// Environment Variable Validation
// Crashes early at build/start if critical vars are missing
// ═══════════════════════════════════════════════════

const serverSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    TELEGRAM_CEO_CHAT_ID: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    ENCRYPTION_SECRET: z.string().optional(),
    IMGBB_API_KEY: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const clientSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
})

// Validate once at module load
function validateEnv() {
    const serverResult = serverSchema.safeParse(process.env)
    const clientResult = clientSchema.safeParse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    })

    if (!serverResult.success) {
        console.error('❌ Server env validation failed:', serverResult.error.flatten().fieldErrors)
    }
    if (!clientResult.success) {
        console.error('❌ Client env validation failed:', clientResult.error.flatten().fieldErrors)
    }

    return {
        server: serverResult.success ? serverResult.data : (process.env as any),
        client: clientResult.success ? clientResult.data : (process.env as any),
    }
}

export const env = validateEnv()
