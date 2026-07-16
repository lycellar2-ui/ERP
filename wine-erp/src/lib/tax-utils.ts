export function cleanHSCode(code: string): string {
    return code.replace(/\./g, '').trim()
}

export function findHierarchicalTaxRate(
    taxRates: Array<any>,
    inputHsCode: string,
    country?: string | null
) {
    const target = cleanHSCode(inputHsCode)
    if (!target) return undefined

    const getBestRateForHS = (prefix: string) => {
        if (country) {
            const withCountry = taxRates.find(t => cleanHSCode(t.hsCode).startsWith(prefix) && t.countryOfOrigin?.toLowerCase() === country.toLowerCase())
            if (withCountry) return withCountry
        }
        return taxRates.find(t => cleanHSCode(t.hsCode).startsWith(prefix))
    }

    const match8 = getBestRateForHS(target)
    if (match8) return match8

    if (target.length >= 6) {
        const match6 = getBestRateForHS(target.substring(0, 6))
        if (match6) return match6
    }

    if (target.length >= 4) {
        const match4 = getBestRateForHS(target.substring(0, 4))
        if (match4) return match4
    }

    return undefined
}
