import { describe, it, expect } from 'vitest'
import {
    VISIT_I18N,
    getLocalizedDayName,
    getLocalizedShortDayName,
    getActivityPresetLabel,
    getVisitLocale
} from '../../src/app/dashboard/sales/visits/i18n'

describe('Sales Field Check-in i18n Module', () => {
    it('should have matching key hierarchy in Vietnamese and English dictionaries', () => {
        const viKeys = Object.keys(VISIT_I18N.vi)
        const enKeys = Object.keys(VISIT_I18N.en)
        expect(viKeys.sort()).toEqual(enKeys.sort())

        // Sub-namespaces
        for (const key of viKeys as (keyof typeof VISIT_I18N.vi)[]) {
            const viSub = Object.keys(VISIT_I18N.vi[key])
            const enSub = Object.keys(VISIT_I18N.en[key])
            expect(viSub.sort()).toEqual(enSub.sort())
        }
    })

    it('should localize day names correctly', () => {
        // 2026-09-23 is Wednesday (Thứ Tư)
        expect(getLocalizedDayName('2026-09-23', 'vi')).toBe('Thứ Tư')
        expect(getLocalizedDayName('2026-09-23', 'en')).toBe('Wednesday')

        // 2026-09-21 is Monday (Thứ Hai)
        expect(getLocalizedDayName('2026-09-21', 'vi')).toBe('Thứ Hai')
        expect(getLocalizedDayName('2026-09-21', 'en')).toBe('Monday')

        // 2026-09-27 is Sunday (Chủ Nhật)
        expect(getLocalizedDayName('2026-09-27', 'vi')).toBe('Chủ Nhật')
        expect(getLocalizedDayName('2026-09-27', 'en')).toBe('Sunday')
    })

    it('should localize short day names for 7-day strip', () => {
        // 0: Mon, 1: Tue, 2: Wed, 3: Thu, 4: Fri, 5: Sat, 6: Sun
        expect(getLocalizedShortDayName(0, 'vi')).toBe('T2')
        expect(getLocalizedShortDayName(0, 'en')).toBe('Mon')
        expect(getLocalizedShortDayName(6, 'vi')).toBe('CN')
        expect(getLocalizedShortDayName(6, 'en')).toBe('Sun')
    })

    it('should localize all 7 activity presets', () => {
        expect(getActivityPresetLabel('PERIODIC_CARE', 'vi')).toBe('Chăm sóc khách hàng định kỳ')
        expect(getActivityPresetLabel('PERIODIC_CARE', 'en')).toBe('Periodic Customer Care')

        expect(getActivityPresetLabel('WINE_TASTING', 'vi')).toBe('Thử rượu & Giới thiệu mẫu mới')
        expect(getActivityPresetLabel('WINE_TASTING', 'en')).toBe('Wine Tasting & Sample Intro')

        expect(getActivityPresetLabel('MERCHANDISE_CHECK', 'vi')).toBe('Kiểm tra tồn kho & Trưng bày điểm bán')
        expect(getActivityPresetLabel('MERCHANDISE_CHECK', 'en')).toBe('Inventory & POS Display Audit')

        expect(getActivityPresetLabel('DEBT_COLLECTION', 'vi')).toBe('Thu hồi công nợ / Đối soát hóa đơn')
        expect(getActivityPresetLabel('DEBT_COLLECTION', 'en')).toBe('Debt Collection & Invoice Audit')

        expect(getActivityPresetLabel('CONTRACT_NEGOTIATION', 'vi')).toBe('Ký kết hợp đồng / Đàm phán giá')
        expect(getActivityPresetLabel('CONTRACT_NEGOTIATION', 'en')).toBe('Contract Signing & Price Negotiation')

        expect(getActivityPresetLabel('COMPLAINT_HANDLING', 'vi')).toBe('Xử lý khiếu nại & Hậu mãi')
        expect(getActivityPresetLabel('COMPLAINT_HANDLING', 'en')).toBe('Complaint Handling & After-Sales')

        expect(getActivityPresetLabel('OTHER', 'vi')).toBe('Mục đích khác')
        expect(getActivityPresetLabel('OTHER', 'en')).toBe('Other Purpose')
    })

    it('should safely default getVisitLocale in SSR/node environment', () => {
        expect(getVisitLocale()).toBe('vi')
    })
})
