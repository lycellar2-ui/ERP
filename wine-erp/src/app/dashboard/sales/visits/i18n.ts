'use client'

import { useState, useEffect, useCallback } from 'react'

export type VisitLocale = 'vi' | 'en'

export const VISIT_LOCALE_STORAGE_KEY = 'sales_visits_locale'
export const VISIT_LOCALE_CHANGE_EVENT = 'sales_visits_locale_change'

export const VISIT_I18N = {
    vi: {
        header: {
            title: 'Quản Lý Check-in Thị Trường',
            managerBadge: 'Báo Cáo Tuần',
            salespersonSubtitle: 'Hệ thống chấm công định vị & tác nghiệp thực địa',
            prevWeek: 'Tuần trước',
            nextWeek: 'Tuần sau',
            currentWeek: 'Tuần hiện tại',
            weekLabel: 'Tuần',
            refresh: 'Làm mới',
            refreshing: 'Đang tải...',
            quickCreateCustomer: 'Tạo Khách',
        },
        tabs: {
            today: 'Check-in Hôm Nay',
            planning: 'Kế Hoạch Tuần',
            summary: 'Tổng Kết Tuần',
            photos: 'Hình Ảnh',
        },
        kpis: {
            totalSalesReps: 'Số Nhân Sự',
            repsUnit: 'nhân sự',
            repsDesc: 'Đội ngũ Sales thực địa',
            totalTargetVisits: 'Tổng Kế Hoạch',
            targetUnit: 'điểm',
            targetDesc: 'Kế hoạch đã phân công',
            actualCheckins: 'Đã Check-in',
            checkinUnit: 'lượt',
            actualCheckinsDesc: 'Thực địa có ảnh & GPS',
            completionRate: 'Tỷ Lệ Đạt',
            completionDesc: 'Tiến độ hoàn thành tuần',
            pendingReports: 'Chờ Quản Lý Duyệt',
            pendingReportsUnit: 'báo cáo',
            pendingReportsDesc: 'Cần nhận xét & đánh giá',
        },
        presets: {
            PERIODIC_CARE: 'Chăm sóc khách hàng định kỳ',
            WINE_TASTING: 'Thử rượu & Giới thiệu mẫu mới',
            MERCHANDISE_CHECK: 'Kiểm tra tồn kho & Trưng bày điểm bán',
            DEBT_COLLECTION: 'Thu hồi công nợ / Đối soát hóa đơn',
            CONTRACT_NEGOTIATION: 'Ký kết hợp đồng / Đàm phán giá',
            COMPLAINT_HANDLING: 'Xử lý khiếu nại & Hậu mãi',
            OTHER: 'Mục đích khác',
        },
        days: {
            sunday: 'Chủ Nhật',
            monday: 'Thứ Hai',
            tuesday: 'Thứ Ba',
            wednesday: 'Thứ Tư',
            thursday: 'Thứ Năm',
            friday: 'Thứ Sáu',
            saturday: 'Thứ Bảy',
            sunShort: 'CN',
            monShort: 'T2',
            tueShort: 'T3',
            wedShort: 'T4',
            thuShort: 'T5',
            friShort: 'T6',
            satShort: 'T7',
        },
        status: {
            completed: 'Đã check-in',
            notCompleted: 'Chưa check-in',
            inProgress: 'Đang thực hiện',
            pendingApproval: 'Chờ duyệt',
            approved: 'Đã duyệt',
            rejected: 'Cần chỉnh sửa',
            draft: 'Bản nháp',
            offline: 'Chờ đồng bộ ngoại tuyến',
        },
        today: {
            selectCustomer: 'Chọn khách hàng / điểm đến...',
            searchCustomerPlaceholder: 'Tìm theo tên, mã khách, số điện thoại...',
            purpose: 'Mục đích chuyến thăm',
            selectPurpose: 'Chọn mục đích viếng thăm...',
            notes: 'Ghi chú công việc / Phản hồi của điểm bán',
            notesPlaceholder: 'Nhập ghi chú phản hồi của khách, nhu cầu lấy hàng, số lượng tồn kho...',
            takePhoto: 'Chụp ảnh check-in thực tế',
            retakePhoto: 'Chụp lại ảnh',
            photoCaptured: 'Đã chụp ảnh xác thực',
            checkinButton: 'Xác nhận Check-in ngay',
            checkingIn: 'Đang xử lý check-in...',
            adHocCheckin: 'Check-in đột xuất',
            todayTargetList: 'Danh sách điểm cần đi hôm nay',
            noVisitsToday: 'Chưa có điểm nào được lên lịch hôm nay.',
            addTodayPoint: '+ Thêm điểm vào hôm nay',
            gpsAcquiring: 'Đang định vị GPS...',
            gpsReady: 'Tọa độ GPS sẵn sàng',
            gpsError: 'Chưa lấy được tọa độ GPS',
            gpsGuideBtn: 'Xem hướng dẫn bật GPS',
            callCustomer: 'Gọi điện',
            openMap: 'Chỉ đường Google Maps',
            distanceMeters: 'cách khoảng',
            accuracy: 'độ chính xác',
            offlineBannerTitle: 'Bạn đang có bản ghi check-in ngoại tuyến',
            syncNow: 'Đồng bộ ngay',
            syncing: 'Đang đồng bộ...',
            adHocBadge: 'Đột xuất',
            scheduledBadge: 'Theo lịch',
        },
        planning: {
            title: 'Kế Hoạch Thăm Điểm Bán Trong Tuần',
            subtitle: 'Lên lịch trình di chuyển để tối ưu hóa tuyến đường',
            saveDraft: 'Lưu Kế Hoạch Tuần',
            saving: 'Đang lưu...',
            addPointModalTitle: 'Thêm Điểm Vào Kế Hoạch',
            selectDay: 'Chọn ngày trong tuần',
            selectTime: 'Khung giờ dự kiến',
            customerLabel: 'Khách hàng',
            purposeLabel: 'Mục đích chính',
            notesLabel: 'Ghi chú kế hoạch',
            addButton: 'Thêm vào lịch',
            cancelButton: 'Hủy bỏ',
            emptyDay: 'Chưa có điểm viếng thăm',
            totalPoints: 'Tổng điểm trong tuần',
            targetGoal: 'Mục tiêu hoàn thành',
            copyLastWeek: 'Sao chép tuần trước',
        },
        summary: {
            title: 'Báo Cáo & Tổng Kết Tuần',
            subtitle: 'Đánh giá kết quả tuần và gửi quản lý thẩm định',
            summaryStats: 'Chỉ số tuần này',
            completedPoints: 'Điểm đã hoàn thành',
            missedPoints: 'Điểm chưa thực hiện',
            reportContent: 'Nội dung báo cáo tổng kết tuần',
            reportPlaceholder: 'Tóm tắt các kết quả đạt được, doanh số ghi nhận, các vấn đề phát sinh từ thị trường...',
            submitReport: 'Gửi Báo Cáo Tuần',
            submitting: 'Đang gửi...',
            managerEvaluation: 'Nhận xét & Đánh giá từ Quản lý',
            noFeedbackYet: 'Quản lý chưa có nhận xét cho tuần này.',
            kpiScore: 'Điểm KPI đánh giá',
            statusLabel: 'Trạng thái báo cáo',
        },
        photos: {
            title: 'Thư Viện Ảnh Check-in Thị Trường',
            subtitle: 'Kho ảnh thực tế kèm watermark định vị GPS và thời gian',
            filterByCustomer: 'Lọc theo khách hàng',
            allCustomers: 'Tất cả khách hàng',
            noPhotos: 'Chưa có hình ảnh check-in nào được ghi nhận trong tuần này.',
            viewDetail: 'Xem chi tiết',
        },
        manager: {
            boardTitle: 'Bảng Giám Sát & Báo Cáo Check-in Thị Trường Toàn Đội',
            boardSubtitle: 'Dữ liệu đối soát Kế hoạch vs Thực tế của toàn bộ Sales Reps',
            staffMatrixTitle: 'Bảng Đối Soát Chi Tiết Từng Nhân Viên',
            colStaff: 'Nhân viên',
            colPlan: 'Kế hoạch',
            colActual: 'Thực tế',
            colRate: 'Tỷ lệ %',
            colReport: 'Báo cáo',
            colAction: 'Thao tác',
            btnAudit: 'Thẩm định',
            modalAuditTitle: 'Thẩm Định Báo Cáo & Kết Quả Check-in',
            feedbackLabel: 'Nhận xét của Quản lý / CEO',
            feedbackPlaceholder: 'Nhập ý kiến đánh giá, động viên hoặc nhắc nhở nhân viên...',
            kpiGradeLabel: 'Đánh giá KPI',
            saveFeedbackBtn: 'Lưu Nhận Xét & Phê Duyệt',
            savingFeedback: 'Đang lưu...',
            filterAll: 'Toàn bộ nhân sự',
        },
        camera: {
            modalTitle: 'Chụp Ảnh Check-in Thực Địa',
            takePhoto: 'Chụp ảnh',
            retake: 'Chụp lại',
            confirmPhoto: 'Sử dụng ảnh này',
            switchCamera: 'Đổi camera',
            openDeviceCamera: 'Mở camera thiết bị',
            close: 'Đóng',
            watermarkGPS: 'XÁC THỰC GPS THỰC ĐỊA',
            watermarkStaff: 'Nhân viên',
            watermarkCustomer: 'Khách hàng',
            watermarkTime: 'Thời gian',
            watermarkCoords: 'Tọa độ GPS',
            permDenied: 'Chưa được cấp quyền truy cập camera. Vui lòng cấp quyền hoặc mở camera thiết bị.',
            browserNotSupported: 'Trình duyệt không hỗ trợ mở camera trực tiếp. Vui lòng bấm bên dưới để mở camera thiết bị.',
            notFound: 'Không tìm thấy camera. Vui lòng mở camera thiết bị.',
            unknownError: 'Không thể mở camera trực tiếp. Vui lòng mở camera thiết bị.',
        },
        gpsGuide: {
            title: 'Hướng Dẫn Cấp Quyền Định Vị GPS',
            iosTab: 'iPhone / iPad (Safari)',
            androidTab: 'Android (Chrome)',
            close: 'Đã hiểu & Đóng',
            step1Ios: 'Vào Cài đặt (Settings) trên máy > Chọn Safari.',
            step2Ios: 'Cuộn xuống mục Vị trí (Location) > Chọn Cho phép (Allow).',
            step3Ios: 'Quay lại trình duyệt và tải lại trang.',
            step1Android: 'Bấm biểu tượng Cài đặt trang web (biểu tượng ổ khóa hoặc thanh gạt) trên thanh địa chỉ.',
            step2Android: 'Chọn Quyền (Permissions) > Vị trí (Location) > Chọn Cho phép.',
            step3Android: 'Tải lại trang để kích hoạt GPS chính xác cao.',
        },
        common: {
            loading: 'Đang tải...',
            close: 'Đóng',
            save: 'Lưu',
            cancel: 'Hủy',
            confirm: 'Xác nhận',
            all: 'Tất cả',
            search: 'Tìm kiếm',
            filter: 'Bộ lọc',
            success: 'Thành công',
            error: 'Đã xảy ra lỗi',
            language: 'Ngôn ngữ',
            vietnamese: 'Tiếng Việt',
            english: 'English',
        }
    },
    en: {
        header: {
            title: 'Field Check-in Management',
            managerBadge: 'Weekly Report',
            salespersonSubtitle: 'GPS attendance verification & field operations system',
            prevWeek: 'Previous week',
            nextWeek: 'Next week',
            currentWeek: 'Current week',
            weekLabel: 'Week',
            refresh: 'Refresh',
            refreshing: 'Loading...',
            quickCreateCustomer: 'New Client',
        },
        tabs: {
            today: "Today's Check-in",
            planning: 'Weekly Plan',
            summary: 'Weekly Summary',
            photos: 'Photos',
        },
        kpis: {
            totalSalesReps: 'Sales Personnel',
            repsUnit: 'reps',
            repsDesc: 'Field sales team force',
            totalTargetVisits: 'Target Visits',
            targetUnit: 'visits',
            targetDesc: 'Assigned weekly plan',
            actualCheckins: 'Actual Check-ins',
            checkinUnit: 'visits',
            actualCheckinsDesc: 'Verified with GPS & photos',
            completionRate: 'Completion Rate',
            completionDesc: 'Weekly execution progress',
            pendingReports: 'Pending Approval',
            pendingReportsUnit: 'reports',
            pendingReportsDesc: 'Awaiting manager evaluation',
        },
        presets: {
            PERIODIC_CARE: 'Periodic Customer Care',
            WINE_TASTING: 'Wine Tasting & Sample Intro',
            MERCHANDISE_CHECK: 'Inventory & POS Display Audit',
            DEBT_COLLECTION: 'Debt Collection & Invoice Audit',
            CONTRACT_NEGOTIATION: 'Contract Signing & Price Negotiation',
            COMPLAINT_HANDLING: 'Complaint Handling & After-Sales',
            OTHER: 'Other Purpose',
        },
        days: {
            sunday: 'Sunday',
            monday: 'Monday',
            tuesday: 'Tuesday',
            wednesday: 'Wednesday',
            thursday: 'Thursday',
            friday: 'Friday',
            saturday: 'Saturday',
            sunShort: 'Sun',
            monShort: 'Mon',
            tueShort: 'Tue',
            wedShort: 'Wed',
            thuShort: 'Thu',
            friShort: 'Fri',
            satShort: 'Sat',
        },
        status: {
            completed: 'Checked-in',
            notCompleted: 'Pending check-in',
            inProgress: 'In progress',
            pendingApproval: 'Pending approval',
            approved: 'Approved',
            rejected: 'Needs revision',
            draft: 'Draft',
            offline: 'Waiting for offline sync',
        },
        today: {
            selectCustomer: 'Select customer / destination...',
            searchCustomerPlaceholder: 'Search by name, customer code, phone...',
            purpose: 'Visit Purpose',
            selectPurpose: 'Choose visit purpose...',
            notes: 'Field Notes & Customer Feedback',
            notesPlaceholder: 'Enter customer feedback, order requests, on-shelf stock levels...',
            takePhoto: 'Take verified field photo',
            retakePhoto: 'Retake photo',
            photoCaptured: 'Verified photo attached',
            checkinButton: 'Confirm Check-in Now',
            checkingIn: 'Processing check-in...',
            adHocCheckin: 'Ad-hoc Check-in',
            todayTargetList: "Today's Visit Target List",
            noVisitsToday: 'No visits scheduled for today.',
            addTodayPoint: '+ Add destination to today',
            gpsAcquiring: 'Acquiring GPS coordinates...',
            gpsReady: 'GPS coordinates acquired',
            gpsError: 'GPS coordinates not available',
            gpsGuideBtn: 'View GPS setup guide',
            callCustomer: 'Call',
            openMap: 'Google Maps Directions',
            distanceMeters: 'approx. distance',
            accuracy: 'accuracy',
            offlineBannerTitle: 'You have offline check-in drafts pending',
            syncNow: 'Sync Now',
            syncing: 'Syncing...',
            adHocBadge: 'Ad-hoc',
            scheduledBadge: 'Scheduled',
        },
        planning: {
            title: 'Weekly Store Visit Schedule',
            subtitle: 'Plan store itinerary ahead to optimize route and time',
            saveDraft: 'Save Weekly Plan',
            saving: 'Saving...',
            addPointModalTitle: 'Add Target to Weekly Plan',
            selectDay: 'Select day of week',
            selectTime: 'Estimated time window',
            customerLabel: 'Customer / Outlet',
            purposeLabel: 'Primary Purpose',
            notesLabel: 'Plan Notes',
            addButton: 'Add to Schedule',
            cancelButton: 'Cancel',
            emptyDay: 'No visits scheduled',
            totalPoints: 'Total weekly visits',
            targetGoal: 'Target completion',
            copyLastWeek: 'Copy previous week',
        },
        summary: {
            title: 'Weekly Summary & Self-Evaluation',
            subtitle: 'Review week execution and submit for executive review',
            summaryStats: 'This Week Metrics',
            completedPoints: 'Completed Visits',
            missedPoints: 'Unvisited Visits',
            reportContent: 'Weekly Executive Summary Report',
            reportPlaceholder: 'Summarize achieved results, recorded sales, market issues, competitor activities...',
            submitReport: 'Submit Weekly Report',
            submitting: 'Submitting...',
            managerEvaluation: 'Executive Review & Feedback',
            noFeedbackYet: 'Manager has not left feedback for this week yet.',
            kpiScore: 'KPI Rating',
            statusLabel: 'Report Status',
        },
        photos: {
            title: 'Field Check-in Photo Gallery',
            subtitle: 'Real-time field photos watermarked with verified GPS and timestamp',
            filterByCustomer: 'Filter by customer',
            allCustomers: 'All customers',
            noPhotos: 'No field check-in photos recorded this week.',
            viewDetail: 'View Detail',
        },
        manager: {
            boardTitle: 'Field Team Check-in Operations Executive Board',
            boardSubtitle: 'Weekly Target vs Actual execution data across all field sales representatives',
            staffMatrixTitle: 'Individual Sales Rep Execution Matrix',
            colStaff: 'Sales Rep',
            colPlan: 'Plan',
            colActual: 'Actual',
            colRate: 'Rate %',
            colReport: 'Report',
            colAction: 'Action',
            btnAudit: 'Audit',
            modalAuditTitle: 'Audit Check-in & Weekly Performance Report',
            feedbackLabel: 'Executive / Management Feedback',
            feedbackPlaceholder: 'Enter feedback, motivation, or guidance for this sales rep...',
            kpiGradeLabel: 'KPI Performance Grade',
            saveFeedbackBtn: 'Save Review & Approve',
            savingFeedback: 'Saving...',
            filterAll: 'All personnel',
        },
        camera: {
            modalTitle: 'Field Check-in Camera',
            takePhoto: 'Capture Photo',
            retake: 'Retake',
            confirmPhoto: 'Use this photo',
            switchCamera: 'Switch Camera',
            openDeviceCamera: 'Open Device Camera',
            close: 'Close',
            watermarkGPS: 'FIELD GPS VERIFIED',
            watermarkStaff: 'Staff',
            watermarkCustomer: 'Customer',
            watermarkTime: 'Timestamp',
            watermarkCoords: 'GPS Coords',
            permDenied: 'Camera access denied. Please grant camera permission or use device camera.',
            browserNotSupported: 'Direct camera preview not supported. Please click below to open device camera.',
            notFound: 'No camera found. Please open device camera.',
            unknownError: 'Unable to start camera. Please open device camera.',
        },
        gpsGuide: {
            title: 'How to Enable GPS Location Permissions',
            iosTab: 'iPhone / iPad (Safari)',
            androidTab: 'Android (Chrome)',
            close: 'Got it & Close',
            step1Ios: 'Go to Settings > Safari.',
            step2Ios: 'Scroll down to Location > Select Allow.',
            step3Ios: 'Return to browser and refresh the page.',
            step1Android: 'Tap the page settings icon (padlock/tune icon) on the address bar.',
            step2Android: 'Select Permissions > Location > Choose Allow.',
            step3Android: 'Refresh page to enable high-accuracy GPS.',
        },
        common: {
            loading: 'Loading...',
            close: 'Close',
            save: 'Save',
            cancel: 'Cancel',
            confirm: 'Confirm',
            all: 'All',
            search: 'Search',
            filter: 'Filter',
            success: 'Success',
            error: 'An error occurred',
            language: 'Language',
            vietnamese: 'Tiếng Việt',
            english: 'English',
        }
    }
}

/**
 * Get the current locale from localStorage or default to 'vi'
 */
export function getVisitLocale(): VisitLocale {
    if (typeof window === 'undefined') return 'vi'
    try {
        const saved = localStorage.getItem(VISIT_LOCALE_STORAGE_KEY)
        if (saved === 'en' || saved === 'vi') return saved
    } catch {}
    return 'vi'
}

/**
 * Set the locale in localStorage and dispatch custom event
 */
export function setVisitLocale(locale: VisitLocale) {
    if (typeof window === 'undefined') return
    try {
        localStorage.setItem(VISIT_LOCALE_STORAGE_KEY, locale)
        window.dispatchEvent(new CustomEvent(VISIT_LOCALE_CHANGE_EVENT, { detail: locale }))
    } catch {}
}

/**
 * React hook to access and toggle visit locale
 */
export function useVisitLocale() {
    const [locale, setLocaleState] = useState<VisitLocale>('vi')

    useEffect(() => {
        setLocaleState(getVisitLocale())

        const handleLocaleChange = (e: Event) => {
            const customEvent = e as CustomEvent<VisitLocale>
            if (customEvent.detail && (customEvent.detail === 'vi' || customEvent.detail === 'en')) {
                setLocaleState(customEvent.detail)
            } else {
                setLocaleState(getVisitLocale())
            }
        }

        const handleStorage = (e: StorageEvent) => {
            if (e.key === VISIT_LOCALE_STORAGE_KEY && (e.newValue === 'vi' || e.newValue === 'en')) {
                setLocaleState(e.newValue as VisitLocale)
            }
        }

        window.addEventListener(VISIT_LOCALE_CHANGE_EVENT, handleLocaleChange)
        window.addEventListener('storage', handleStorage)

        return () => {
            window.removeEventListener(VISIT_LOCALE_CHANGE_EVENT, handleLocaleChange)
            window.removeEventListener('storage', handleStorage)
        }
    }, [])

    const setLocale = useCallback((newLocale: VisitLocale) => {
        setLocaleState(newLocale)
        setVisitLocale(newLocale)
    }, [])

    const toggleLocale = useCallback(() => {
        const next = locale === 'vi' ? 'en' : 'vi'
        setLocale(next)
    }, [locale, setLocale])

    return {
        locale,
        setLocale,
        toggleLocale,
        t: VISIT_I18N[locale]
    }
}

/**
 * Format day name according to locale
 */
export function getLocalizedDayName(date: Date | string, locale: VisitLocale = 'vi'): string {
    const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00+07:00`) : new Date(date)
    const day = d.getDay() // 0 = Sunday, 1 = Monday, ...
    const t = VISIT_I18N[locale].days
    const names = [t.sunday, t.monday, t.tuesday, t.wednesday, t.thursday, t.friday, t.saturday]
    return names[day] || names[0]
}

/**
 * Format short day name according to locale
 */
export function getLocalizedShortDayName(dayIndex: number, locale: VisitLocale = 'vi'): string {
    const t = VISIT_I18N[locale].days
    // dayIndex: 0 = Mon, ..., 6 = Sun
    const shortNames = [t.monShort, t.tueShort, t.wedShort, t.thuShort, t.friShort, t.satShort, t.sunShort]
    return shortNames[dayIndex] || ''
}

/**
 * Get localized label for an activity preset
 */
export function getActivityPresetLabel(value: string, locale: VisitLocale = 'vi'): string {
    const t = VISIT_I18N[locale].presets
    const map: Record<string, string> = {
        PERIODIC_CARE: t.PERIODIC_CARE,
        WINE_TASTING: t.WINE_TASTING,
        MERCHANDISE_CHECK: t.MERCHANDISE_CHECK,
        DEBT_COLLECTION: t.DEBT_COLLECTION,
        CONTRACT_NEGOTIATION: t.CONTRACT_NEGOTIATION,
        COMPLAINT_HANDLING: t.COMPLAINT_HANDLING,
        OTHER: t.OTHER,
    }
    return map[value] || value
}
