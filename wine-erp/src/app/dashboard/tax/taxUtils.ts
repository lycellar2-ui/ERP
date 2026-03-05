// Pure calculation utility — NOT a server action
// Can be imported by both server and client components

export interface LandedCostResult {
    cifVnd: number
    importTax: number
    sct: number
    vat: number
    totalTax: number
    totalLandedCost: number
    unitLandedCost: number
    effectiveTaxRate: number
}

export function calculateLandedCost(params: {
    cifUsd: number
    exchangeRate: number
    importTaxRate: number
    sctRate: number
    vatRate: number
    qty: number
}): LandedCostResult {
    const { cifUsd, exchangeRate, importTaxRate, sctRate, vatRate, qty } = params
    const cifVnd = cifUsd * exchangeRate
    const importTax = cifVnd * (importTaxRate / 100)
    const sct = (cifVnd + importTax) * (sctRate / 100)
    const vat = (cifVnd + importTax + sct) * (vatRate / 100)
    const totalTax = importTax + sct + vat
    const totalLandedCost = cifVnd + totalTax
    const unitLandedCost = qty > 0 ? totalLandedCost / qty : 0

    return {
        cifVnd: Math.round(cifVnd),
        importTax: Math.round(importTax),
        sct: Math.round(sct),
        vat: Math.round(vat),
        totalTax: Math.round(totalTax),
        totalLandedCost: Math.round(totalLandedCost),
        unitLandedCost: Math.round(unitLandedCost),
        effectiveTaxRate: cifVnd > 0 ? (totalTax / cifVnd) * 100 : 0,
    }
}
