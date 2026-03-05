// Pure calculation utility — NOT a server action
// Safe to import from both server and client components

export interface PriceSuggestion {
    channel: string
    margin: number
    price: number
    rounded: number
}

const CHANNEL_MARGINS: Record<string, number> = {
    HORECA: 0.55,
    WHOLESALE_DISTRIBUTOR: 0.45,
    VIP_RETAIL: 0.65,
    POS: 0.70,
}

/**
 * Suggest retail prices per channel based on landed cost and target margins.
 * Formula: price = landedCost / (1 - margin)
 * Rounded to nearest 50,000 VND.
 */
export function suggestPrices(unitLandedCost: number): PriceSuggestion[] {
    return Object.entries(CHANNEL_MARGINS).map(([channel, margin]) => {
        const price = unitLandedCost / (1 - margin)
        const rounded = Math.round(price / 50000) * 50000
        return { channel, margin: margin * 100, price: Math.round(price), rounded }
    })
}
