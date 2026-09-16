import { InvoiceDateWarning } from './types'

/**
 * Kiểm tra chênh lệch ngày giữa ngày lập đơn hàng và ngày phát hành hóa đơn (Quy định NĐ 123/2020/NĐ-CP)
 */
export function checkInvoiceDateDiscrepancy(orderDate: Date | string): InvoiceDateWarning {
    const dOrder = new Date(orderDate)
    const dToday = new Date()

    const orderMidnight = new Date(dOrder.getFullYear(), dOrder.getMonth(), dOrder.getDate())
    const todayMidnight = new Date(dToday.getFullYear(), dToday.getMonth(), dToday.getDate())

    const diffDays = Math.round((todayMidnight.getTime() - orderMidnight.getTime()) / (1000 * 60 * 60 * 24))
    const isDifferentMonth = dOrder.getMonth() !== dToday.getMonth() || dOrder.getFullYear() !== dToday.getFullYear()

    const orderDateFormatted = `${String(dOrder.getDate()).padStart(2, '0')}/${String(dOrder.getMonth() + 1).padStart(2, '0')}/${dOrder.getFullYear()}`
    const invoiceDateFormatted = `${String(dToday.getDate()).padStart(2, '0')}/${String(dToday.getMonth() + 1).padStart(2, '0')}/${dToday.getFullYear()}`

    if (isDifferentMonth) {
        return {
            hasWarning: true,
            isDifferentMonth: true,
            diffDays,
            orderDateFormatted,
            invoiceDateFormatted,
            level: 'DANGER',
            message: `⚠️ CẢNH BÁO LỆCH KỲ THUẾ: Đơn hàng lập ngày ${orderDateFormatted} (Tháng ${dOrder.getMonth() + 1}/${dOrder.getFullYear()}), nhưng ngày xuất hóa đơn là hôm nay ${invoiceDateFormatted} (Tháng ${dToday.getMonth() + 1}/${dToday.getFullYear()}). Việc xuất hóa đơn khác tháng phát sinh có thể vi phạm quy định thời điểm lập hóa đơn theo Nghị định 123/2020/NĐ-CP.`,
        }
    }

    if (diffDays > 2) {
        return {
            hasWarning: true,
            isDifferentMonth: false,
            diffDays,
            orderDateFormatted,
            invoiceDateFormatted,
            level: 'WARNING',
            message: `⚠️ LƯU Ý NGÀY LẬP HÓA ĐƠN: Đơn hàng được lập ngày ${orderDateFormatted} (cách đây ${diffDays} ngày). Hóa đơn điện tử sẽ được lập với ngày hôm nay: ${invoiceDateFormatted}.`,
        }
    }

    return {
        hasWarning: false,
        isDifferentMonth: false,
        diffDays,
        orderDateFormatted,
        invoiceDateFormatted,
        level: 'INFO',
        message: '',
    }
}
