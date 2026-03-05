import { describe, it, expect } from 'vitest'
import { encryptApiKey, decryptApiKey, maskApiKey } from '@/lib/encryption'

// ─── Encrypt → Decrypt Round-trip ─────────────────

describe('encryptApiKey + decryptApiKey', () => {
    it('should encrypt and decrypt back to original value', async () => {
        const original = 'sk-test-api-key-1234567890'
        const { encrypted, iv } = await encryptApiKey(original)
        const decrypted = await decryptApiKey(encrypted, iv)
        expect(decrypted).toBe(original)
    })

    it('should produce different ciphertext for same plaintext (random IV)', async () => {
        const original = 'same-key-same-key'
        const result1 = await encryptApiKey(original)
        const result2 = await encryptApiKey(original)
        expect(result1.encrypted).not.toBe(result2.encrypted)
        expect(result1.iv).not.toBe(result2.iv)
    })

    it('should handle empty string', async () => {
        const { encrypted, iv } = await encryptApiKey('')
        const decrypted = await decryptApiKey(encrypted, iv)
        expect(decrypted).toBe('')
    })

    it('should handle long keys', async () => {
        const longKey = 'a'.repeat(500)
        const { encrypted, iv } = await encryptApiKey(longKey)
        const decrypted = await decryptApiKey(encrypted, iv)
        expect(decrypted).toBe(longKey)
    })

    it('should handle special characters', async () => {
        const special = 'sk-!@#$%^&*()_+{}|:<>?~'
        const { encrypted, iv } = await encryptApiKey(special)
        const decrypted = await decryptApiKey(encrypted, iv)
        expect(decrypted).toBe(special)
    })

    it('should handle Unicode characters', async () => {
        const unicode = 'key-rượu-vang-🍷'
        const { encrypted, iv } = await encryptApiKey(unicode)
        const decrypted = await decryptApiKey(encrypted, iv)
        expect(decrypted).toBe(unicode)
    })
})

// ─── Decryption Failure ───────────────────────────

describe('decryptApiKey - tamper detection', () => {
    it('should throw error with wrong IV', async () => {
        const { encrypted } = await encryptApiKey('test-key')
        const wrongIv = '00'.repeat(16)
        await expect(decryptApiKey(encrypted, wrongIv)).rejects.toThrow()
    })

    it('should throw error with tampered ciphertext', async () => {
        const { encrypted, iv } = await encryptApiKey('test-key')
        const tampered = 'ff' + encrypted.slice(2)
        await expect(decryptApiKey(tampered, iv)).rejects.toThrow()
    })
})

// ─── maskApiKey (encryption module version) ───────

describe('maskApiKey (encryption module)', () => {
    it('should show first 6 and last 4 chars', async () => {
        const { encrypted, iv } = await encryptApiKey('sk-1234567890abcdef')
        const masked = await maskApiKey(encrypted, iv)
        expect(masked).toBe('sk-123••••••••cdef')
    })

    it('should return dots on decryption failure', async () => {
        const masked = await maskApiKey('invalid-data', '00'.repeat(16))
        expect(masked).toBe('••••••••••••')
    })
})
