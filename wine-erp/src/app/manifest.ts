import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "LY's Cellars — Wine ERP",
        short_name: "LY's ERP",
        description: 'Hệ thống quản lý nhập khẩu và phân phối rượu vang',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#0A1926',
        theme_color: '#87CBB9',
        icons: [
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
        ],
    }
}
