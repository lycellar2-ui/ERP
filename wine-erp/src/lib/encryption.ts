'use server'

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function deriveKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    if (!key) {
        throw new Error('ENCRYPTION_KEY chưa được cấu hình. Vui lòng thêm vào Environment Variables (Vercel Settings hoặc .env.local)')
    }
    const salt = process.env.ENCRYPTION_SALT ?? 'lyscellars-erp-2026'
    return crypto.scryptSync(key, salt, 32)
}

export async function encryptApiKey(plainKey: string): Promise<{ encrypted: string; iv: string }> {
    const key = deriveKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    let encrypted = cipher.update(plainKey, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const authTag = cipher.getAuthTag().toString('hex')
    return {
        encrypted: encrypted + ':' + authTag,
        iv: iv.toString('hex'),
    }
}

export async function decryptApiKey(encryptedData: string, ivHex: string): Promise<string> {
    const key = deriveKey()
    const iv = Buffer.from(ivHex, 'hex')
    const [encrypted, authTag] = encryptedData.split(':')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(Buffer.from(authTag, 'hex'))
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
}

export async function maskApiKey(encryptedData: string, ivHex: string): Promise<string> {
    try {
        const plain = await decryptApiKey(encryptedData, ivHex)
        return plain.slice(0, 6) + '••••••••' + plain.slice(-4)
    } catch {
        return '••••••••••••'
    }
}
