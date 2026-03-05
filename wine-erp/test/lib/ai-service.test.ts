import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Setup Mocks ──────────────────────────────────

const mockPrisma = {
    product: { findUnique: vi.fn() },
    salesOrder: { aggregate: vi.fn(), count: vi.fn() },
    customer: { count: vi.fn() },
    aRInvoice: { aggregate: vi.fn() },
    stockLot: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({
    prisma: mockPrisma,
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { callGemini, generateProductDescription } = await import('@/lib/ai-service')

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GEMINI_API_KEY', 'test-api-key-123')
})

afterEach(() => {
    vi.unstubAllEnvs()
})

// ─── callGemini ───────────────────────────────────

describe('callGemini', () => {
    it('should return error when API key is not set', async () => {
        vi.stubEnv('GEMINI_API_KEY', '')

        const result = await callGemini({ prompt: 'test' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('GEMINI_API_KEY not configured')
    })

    it('should call Gemini API with correct payload (no system prompt)', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: 'AI response' }] } }],
                usageMetadata: { totalTokenCount: 42 },
            }),
        })

        const result = await callGemini({ prompt: 'Hello AI' })

        expect(result.success).toBe(true)
        expect(result.text).toBe('AI response')
        expect(result.tokensUsed).toBe(42)

        const fetchCall = mockFetch.mock.calls[0]
        expect(fetchCall[0]).toContain('key=test-api-key-123')

        const body = JSON.parse(fetchCall[1].body)
        expect(body.contents[0].parts[0].text).toBe('Hello AI')
    })

    it('should prepend system prompt when provided', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: 'response' }] } }],
                usageMetadata: { totalTokenCount: 10 },
            }),
        })

        await callGemini({
            prompt: 'User query',
            systemPrompt: 'You are a wine expert',
        })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.contents[0].parts[0].text).toContain('System: You are a wine expert')
        expect(body.contents[0].parts[0].text).toContain('User: User query')
    })

    it('should use custom temperature and maxTokens', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: 'ok' }] } }],
                usageMetadata: {},
            }),
        })

        await callGemini({ prompt: 'test', temperature: 0.3, maxTokens: 500 })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.generationConfig.temperature).toBe(0.3)
        expect(body.generationConfig.maxOutputTokens).toBe(500)
    })

    it('should use default temperature (0.7) and maxTokens (2048)', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: 'ok' }] } }],
                usageMetadata: {},
            }),
        })

        await callGemini({ prompt: 'test' })

        const body = JSON.parse(mockFetch.mock.calls[0][1].body)
        expect(body.generationConfig.temperature).toBe(0.7)
        expect(body.generationConfig.maxOutputTokens).toBe(2048)
    })

    it('should handle API error response', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 429,
            text: () => Promise.resolve('Rate limit exceeded'),
        })

        const result = await callGemini({ prompt: 'test' })

        expect(result.success).toBe(false)
        expect(result.error).toContain('429')
        expect(result.error).toContain('Rate limit exceeded')
    })

    it('should handle network error', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        const result = await callGemini({ prompt: 'test' })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Network error')
    })

    it('should handle empty response gracefully', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [],
                usageMetadata: {},
            }),
        })

        const result = await callGemini({ prompt: 'test' })

        expect(result.success).toBe(true)
        expect(result.text).toBe('')
        expect(result.tokensUsed).toBe(0)
    })
})

// ─── generateProductDescription ───────────────────

describe('generateProductDescription', () => {
    it('should return error when product not found', async () => {
        mockPrisma.product.findUnique.mockResolvedValue(null)

        const result = await generateProductDescription('nonexist-id')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Product not found')
    })

    it('should generate description with VI/EN split', async () => {
        mockPrisma.product.findUnique.mockResolvedValue({
            productName: 'Château Margaux 2018',
            skuCode: 'CM-2018',
            wineType: 'RED',
            country: 'France',
            vintage: 2018,
            abvPercent: 13.5,
            volumeMl: 750,
            classification: 'Grand Cru',
            appellation: { name: 'Margaux' },
        })

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{
                    content: {
                        parts: [{
                            text: '## Tiếng Việt\nMô tả tiếng Việt rượu vang\n## English\nEnglish wine description',
                        }],
                    },
                }],
                usageMetadata: { totalTokenCount: 100 },
            }),
        })

        const result = await generateProductDescription('product-001')

        expect(result.success).toBe(true)
        expect(result.descriptionVI).toBe('Mô tả tiếng Việt rượu vang')
        expect(result.descriptionEN).toBe('English wine description')
    })

    it('should handle missing appellation', async () => {
        mockPrisma.product.findUnique.mockResolvedValue({
            productName: 'Test Wine',
            skuCode: 'TW-001',
            wineType: null,
            country: 'Italy',
            vintage: null,
            abvPercent: null,
            volumeMl: null,
            classification: null,
            appellation: null,
        })

        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: 'No sections response' }] } }],
                usageMetadata: { totalTokenCount: 50 },
            }),
        })

        const result = await generateProductDescription('product-002')

        expect(result.success).toBe(true)
        // Falls back to full text when no ## sections found
        expect(result.descriptionVI).toBe('No sections response')
    })
})
