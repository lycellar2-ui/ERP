/**
 * Chuyển đổi mã vị trí kho (locationCode) và zone thành Tên Vị Trí tiếng Việt thân thiện,
 * dễ hiểu, dễ xem cho nhân viên kho và showroom (không hiển thị mã khô khan như LOC-GVM-A1).
 */

const THUONG_TIN_MAP: Record<string, string> = {
    'LOC-TT-PALLET-1': 'Zone A - Pallet 1',
    'LOC-TT-PALLET-2': 'Zone A - Pallet 2',
    'LOC-TT-PALLET-3': 'Zone A - Pallet 3',
    'LOC-TT-PALLET-4': 'Zone A - Pallet 4',
    'LOC-TT-PALLET-5': 'Zone A - Pallet 5',
    'LOC-TT-PALLET-6': 'Zone A - Pallet 6',
    'LOC-TT-PALLET-7': 'Zone A - Pallet 7',
    'LOC-TT-PALLET-8': 'Zone A - Pallet 8',
    'LOC-TT-PALLET-9': 'Zone A - Pallet 9',
    'LOC-TT-PALLET-10': 'Zone A - Pallet 10',
    'LOC-TT-PALLET-11': 'Zone A - Pallet 11',
    'LOC-TT-PALLET-12': 'Zone A - Pallet 12',
    'LOC-TT-PALLET-CUA': 'Zone A - Pallet Cạnh Cửa',
    'LOC-TT-KHO-CU-KE-SAT': 'Zone B - Kệ Sắt Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-1': 'Zone B - Pallet 1 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-2': 'Zone B - Pallet 2 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-3': 'Zone B - Pallet 3 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-4': 'Zone B - Pallet 4 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-5': 'Zone B - Pallet 5 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-6': 'Zone B - Pallet 6 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-7': 'Zone B - Pallet 7 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-8': 'Zone B - Pallet 8 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-9': 'Zone B - Pallet 9 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-10': 'Zone B - Pallet 10 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-11': 'Zone B - Pallet 11 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-12': 'Zone B - Pallet 12 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-13': 'Zone B - Pallet 13 Kho Cũ',
    'LOC-TT-KHO-CU-PALLET-14': 'Zone B - Pallet 14 Kho Cũ',
}

const GVM_MAP: Record<string, string> = {
    'A1': 'Kệ hàng lẻ',
    'A2': 'Kệ cạnh hàng lẻ',
    'A3': 'Khu vực cạnh bồn rửa',
    'A4': 'Khu vực sát cửa phụ',
    'A5': 'Khu vực cửa chính',
    'A6': 'Khu vực sát tường',
    'A7': 'Kệ hàng mẫu',
    'A8': 'Khu vực cửa sổ',
    'LOC-GVM-A1': 'Kệ hàng lẻ',
    'LOC-GVM-A2': 'Kệ cạnh hàng lẻ',
    'LOC-GVM-A3': 'Khu vực cạnh bồn rửa',
    'LOC-GVM-A4': 'Khu vực sát cửa phụ',
    'LOC-GVM-A5': 'Khu vực cửa chính',
    'LOC-GVM-A6': 'Khu vực sát tường',
    'LOC-GVM-A7': 'Kệ hàng mẫu',
    'LOC-GVM-A8': 'Khu vực cửa sổ',
    'LOC-GVM-KE-HANG-LE': 'Kệ hàng lẻ',
    'LOC-GVM-KE-CANH-LE': 'Kệ cạnh hàng lẻ',
    'LOC-GVM-BON-RUA': 'Khu vực cạnh bồn rửa',
    'LOC-GVM-CUA-PHU': 'Khu vực sát cửa phụ',
    'LOC-GVM-CUA-CHINH': 'Khu vực cửa chính',
    'LOC-GVM-SAT-TUONG': 'Khu vực sát tường',
    'LOC-GVM-KE-MAU': 'Kệ hàng mẫu',
    'LOC-GVM-CUA-SO': 'Khu vực cửa sổ',
    'LOC-GVM-KHO-TANG-1': 'Khu vực kho tầng 1',
}

const SHOWROOM_MAP: Record<string, string> = {
    'LOC-LYS-SR-KE-NGOAI-T1': 'Phòng ngoài T1 - Kệ to',
    'LOC-LYS-SR-KE-NGANG': 'Phòng trong T1 - Kệ rượu ngang',
    'LOC-LYS-SR-KE-TRONG-T1': 'Phòng trong T1 - Kệ to',
    'LOC-LYS-SR-TU-LANH': 'Phòng trong T1 - Tủ lạnh',
}

export function formatFriendlyLocationName(loc?: {
    locationCode?: string | null
    zone?: string | null
    rack?: string | null
    bin?: string | null
    name?: string | null
} | null): string {
    if (!loc) return 'Chưa phân vị trí'
    if (loc.name && loc.name.trim()) return loc.name.trim()

    const code = (loc.locationCode || '').trim().toUpperCase()
    const zone = (loc.zone || '').trim()

    if (THUONG_TIN_MAP[code]) return THUONG_TIN_MAP[code]
    if (GVM_MAP[code]) return GVM_MAP[code]
    if (SHOWROOM_MAP[code]) return SHOWROOM_MAP[code]

    if (code.startsWith('LOC-GVM-')) {
        const sub = code.replace('LOC-GVM-', '')
        if (GVM_MAP[sub]) return GVM_MAP[sub]
    }

    if (code.startsWith('LOC-TT-')) {
        const sub = code.replace('LOC-TT-', '')
        if (sub.startsWith('PALLET-')) return `Zone A - Pallet ${sub.replace('PALLET-', '')}`
        if (sub.startsWith('KHO-CU-PALLET-')) return `Zone B - Pallet ${sub.replace('KHO-CU-PALLET-', '')} Kho Cũ`
        if (sub.includes('KE-SAT')) return 'Zone B - Kệ Sắt Kho Cũ'
    }

    if (zone && zone !== 'A' && zone !== 'B' && zone !== 'C' && zone !== 'STORAGE') {
        return zone
    }

    return code || 'Vị trí kho'
}
