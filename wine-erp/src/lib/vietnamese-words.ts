/**
 * Utility to convert numbers to Vietnamese text for financial documents & contracts.
 * Chuẩn kế toán & hành chính Việt Nam.
 */

const DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
const TIERS = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']

function readThreeDigits(n: number, isHighestTier: boolean): string {
    const hundreds = Math.floor(n / 100)
    const remainder = n % 100
    const tens = Math.floor(remainder / 10)
    const units = remainder % 10

    const words: string[] = []

    if (hundreds > 0 || !isHighestTier) {
        words.push(`${DIGITS[hundreds]} trăm`)
    }

    if (tens > 1) {
        words.push(`${DIGITS[tens]} mươi`)
        if (units === 1) words.push('mốt')
        else if (units === 4) words.push('tư')
        else if (units === 5) words.push('lăm')
        else if (units > 0) words.push(DIGITS[units])
    } else if (tens === 1) {
        words.push('mười')
        if (units === 5) words.push('lăm')
        else if (units > 0) words.push(DIGITS[units])
    } else {
        // tens === 0
        if (hundreds > 0 || !isHighestTier) {
            if (units > 0) {
                words.push('lẻ')
                words.push(DIGITS[units])
            }
        } else if (units > 0) {
            words.push(DIGITS[units])
        }
    }

    return words.join(' ')
}

export function numberToVietnameseWords(amount: number | bigint | string, currency: string = 'VND'): string {
    const num = Math.round(Number(amount))

    if (isNaN(num) || num === 0) {
        return currency.toUpperCase() === 'USD' ? 'Không đô la Mỹ' : 'Không đồng'
    }

    const isNegative = num < 0
    let absNum = Math.abs(num)

    // Split into 3-digit groups
    const groups: number[] = []
    while (absNum > 0) {
        groups.push(absNum % 1000)
        absNum = Math.floor(absNum / 1000)
    }

    const parts: string[] = []
    for (let i = groups.length - 1; i >= 0; i--) {
        const group = groups[i]
        if (group === 0) continue

        const isHighest = i === groups.length - 1
        const groupWords = readThreeDigits(group, isHighest)
        const tierName = TIERS[i] ? ` ${TIERS[i]}` : ''

        parts.push(`${groupWords}${tierName}`)
    }

    let result = parts.join(' ').replace(/\s+/g, ' ').trim()

    // Add currency suffix
    const currUpper = currency.toUpperCase()
    if (currUpper === 'USD') {
        result += ' đô la Mỹ'
    } else {
        result += ' đồng chẵn'
    }

    if (isNegative) {
        result = `Âm ${result}`
    } else {
        // Capitalize first letter
        result = result.charAt(0).toUpperCase() + result.slice(1)
    }

    return result
}
