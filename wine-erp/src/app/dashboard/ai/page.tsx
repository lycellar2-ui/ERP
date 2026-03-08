import { Brain } from 'lucide-react'
import { AnomalyWidget, DemandForecastWidget, PricingWidget } from './AIWidgets'
import { OCRUploadWidget } from './OCRWidget'
import { ApiKeyVault, PromptLibrary, AiUsageCard } from './VaultUI'
import { AiTogglePanel, AiReportsPanel } from './AIManagementUI'
import { getApiKeys, getPromptTemplates, getAiUsageStats } from './vault-actions'
import { getAiConfig, getAiReports, getAiUsageStats as getUsageStatsV2 } from './ai-actions'

export const metadata = { title: 'AI Features | Wine ERP' }

const AI_FEATURES = [
    {
        icon: '📄',
        title: 'OCR Tờ Khai PDF',
        desc: 'Google Vision API đọc tờ khai hải quan PDF → Extract dữ liệu tự động',
        model: 'Google Vision API',
        status: 'Sẵn sàng cấu hình',
        color: '#87CBB9',
    },
    {
        icon: '🍷',
        title: 'Nhận Dạng Nhãn Rượu',
        desc: 'Gemini Vision chụp ảnh chai rượu → Nhận dạng SKU, vintage, producer',
        model: 'Gemini 3.1 Pro',
        status: 'Sẵn sàng cấu hình',
        color: '#D4A853',
    },
    {
        icon: '📊',
        title: 'Tóm Tắt Báo Cáo',
        desc: 'AI phân tích số liệu bán hàng → Tóm tắt điểm nổi bật bằng tiếng Việt cho CEO',
        model: 'Gemini 3.1 Pro',
        status: 'Sẵn sàng cấu hình',
        color: '#4A8FAB',
    },
    {
        icon: '💬',
        title: 'Mô Tả Sản Phẩm AI',
        desc: 'Tự động tạo mô tả chuyên nghiệp cho từng SKU dựa trên thông số kỹ thuật',
        model: 'Gemini 3.1 Pro',
        status: 'Hoạt động ✓',
        color: '#5BA88A',
    },
    {
        icon: '🔮',
        title: 'Dự Báo Bán Hàng',
        desc: 'Exponential smoothing + Trend detection → Dự báo nhu cầu 3 tháng tới',
        model: 'Built-in ML',
        status: 'Hoạt động ✓',
        color: '#A5DED0',
    },
    {
        icon: '🛡️',
        title: 'Phát Hiện Bất Thường',
        desc: 'Quét đơn hàng bất thường, hóa đơn trùng, tồn kho âm, chi phí lớn chưa duyệt',
        model: 'Rule-based AI',
        status: 'Hoạt động ✓',
        color: '#D4A853',
    },
]

export default async function AIPage() {
    let apiKeys: any[] = []
    let templates: any[] = []
    let usageStats = { totalRuns: 0, monthRuns: 0, failedRuns: 0, monthTokens: 0, monthCostUsd: 0, avgDurationMs: 0 }
    let aiConfig = { aiEnabled: true, allowedModules: ['pipeline', 'crm', 'catalog', 'ceo', 'product-desc'], defaultTemperature: 0.5, defaultMaxTokens: 4096 }
    let reports: any[] = []
    try {
        ;[apiKeys, templates, usageStats, aiConfig, reports] = await Promise.all([
            getApiKeys(), getPromptTemplates(), getAiUsageStats(),
            getAiConfig(),
            getAiReports(undefined, 50),
        ])
    } catch { }
    return (
        <div className="space-y-6 max-w-screen-2xl">
            <div>
                <h2 className="text-2xl font-bold"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                    AI Features & Phân Tích Thông Minh
                </h2>
                <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                    Anomaly Detection • Demand Forecast • Smart Pricing • OCR Ready • Admin Control
                </p>
            </div>

            {/* ═══ AI System Toggle ═══ */}
            <AiTogglePanel initialConfig={aiConfig} />

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {AI_FEATURES.map(f => (
                    <div key={f.title} className="p-5 rounded-md"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="flex items-start justify-between mb-3">
                            <span className="text-3xl">{f.icon}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{
                                    color: f.status.includes('✓') ? '#5BA88A' : '#4A6A7A',
                                    background: f.status.includes('✓') ? 'rgba(91,168,138,0.15)' : 'rgba(74,106,122,0.15)',
                                }}>
                                {f.status}
                            </span>
                        </div>
                        <h3 className="font-semibold mb-1" style={{ color: '#E8F1F2' }}>{f.title}</h3>
                        <p className="text-xs mb-3" style={{ color: '#4A6A7A' }}>{f.desc}</p>
                        <div className="flex items-center gap-2 p-2 rounded-md" style={{ background: '#142433' }}>
                            <Brain size={12} style={{ color: f.color }} />
                            <span className="text-xs font-mono" style={{ color: '#8AAEBB' }}>{f.model}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* OCR Upload */}
            <OCRUploadWidget />

            {/* Interactive AI Widgets */}
            <AnomalyWidget />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <DemandForecastWidget />
                <PricingWidget />
            </div>

            {/* ═══ AI Reports History ═══ */}
            <AiReportsPanel initialReports={reports} />

            {/* AI Infrastructure */}
            <AiUsageCard stats={usageStats} />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <ApiKeyVault initialKeys={apiKeys} />
                <PromptLibrary initialTemplates={templates} />
            </div>
        </div>
    )
}

