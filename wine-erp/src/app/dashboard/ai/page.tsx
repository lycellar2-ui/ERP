import { Brain, FileText, Wine, BarChart3, MessageSquare, TrendingUp, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { AnomalyWidget, DemandForecastWidget, PricingWidget } from './AIWidgets'
import { OCRUploadWidget } from './OCRWidget'
import { ApiKeyVault, AiUsageCard } from './VaultUI'
import { AiTogglePanel, AiReportsPanel } from './AIManagementUI'
import { ActivePromptEditor } from './ActivePromptEditor'
import { getApiKeys, getAiUsageStats } from './vault-actions'
import { getAiConfig, getAiReports, getPromptTemplates } from './ai-actions'

export const metadata = { title: 'AI Features | Wine ERP' }

const AI_FEATURES = [
    {
        icon: FileText,
        title: 'OCR Tờ Khai PDF',
        desc: 'Google Vision API đọc tờ khai hải quan PDF → Extract dữ liệu tự động',
        model: 'Google Vision API',
        status: 'Sẵn sàng cấu hình',
        active: false,
        color: '#0891B2',
    },
    {
        icon: Wine,
        title: 'Nhận Dạng Nhãn Rượu',
        desc: 'Gemini Vision chụp ảnh chai rượu → Nhận dạng SKU, vintage, producer',
        model: 'Gemini 3.1 Pro',
        status: 'Sẵn sàng cấu hình',
        active: false,
        color: '#B45309',
    },
    {
        icon: BarChart3,
        title: 'Tóm Tắt Báo Cáo',
        desc: 'AI phân tích số liệu bán hàng → Tóm tắt điểm nổi bật bằng tiếng Việt cho CEO',
        model: 'Gemini 3.1 Pro',
        status: 'Sẵn sàng cấu hình',
        active: false,
        color: '#1D4ED8',
    },
    {
        icon: MessageSquare,
        title: 'Mô Tả Sản Phẩm AI',
        desc: 'Tự động tạo mô tả chuyên nghiệp cho từng SKU dựa trên thông số kỹ thuật',
        model: 'Gemini 3.1 Pro',
        status: 'Hoạt động',
        active: true,
        color: '#15803D',
    },
    {
        icon: TrendingUp,
        title: 'Dự Báo Bán Hàng',
        desc: 'Exponential smoothing + Trend detection → Dự báo nhu cầu 3 tháng tới',
        model: 'Built-in ML',
        status: 'Hoạt động',
        active: true,
        color: '#0891B2',
    },
    {
        icon: ShieldCheck,
        title: 'Phát Hiện Bất Thường',
        desc: 'Quét đơn hàng bất thường, hóa đơn trùng, tồn kho âm, chi phí lớn chưa duyệt',
        model: 'Rule-based AI',
        status: 'Hoạt động',
        active: true,
        color: '#B45309',
    },
]

export default async function AIPage() {
    let apiKeys: any[] = []
    let templates: any[] = []
    let usageStats = { totalRuns: 0, monthRuns: 0, failedRuns: 0, monthTokens: 0, monthCostUsd: 0, avgDurationMs: 0 }
    let aiConfig = { aiEnabled: true, allowedModules: ['pipeline', 'crm', 'catalog', 'ceo', 'product-desc'], defaultTemperature: 0.5, defaultMaxTokens: 4096 }
    let reports: any[] = []
    let promptTemplates: any[] = []
    try {
        ;[apiKeys, usageStats, aiConfig, reports, promptTemplates] = await Promise.all([
            getApiKeys(), getAiUsageStats(),
            getAiConfig(),
            getAiReports(undefined, 50),
            getPromptTemplates(),
        ])
    } catch { }
    return (
        <div className="space-y-6 max-w-screen-2xl">
            <PageHeader
                title="AI Features & Phân Tích Thông Minh"
                description="Anomaly Detection • Demand Forecast • Smart Pricing • OCR Ready • Admin Control"
            />

            {/* ═══ AI System Toggle ═══ */}
            <AiTogglePanel initialConfig={aiConfig} />

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {AI_FEATURES.map(f => {
                    const Icon = f.icon
                    return (
                        <div key={f.title} className="p-5 rounded-md"
                            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-10 h-10 rounded-md flex items-center justify-center"
                                    style={{ background: `${f.color}15`, color: f.color }}>
                                    <Icon size={20} />
                                </div>
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0"
                                    style={{
                                        color: f.active ? '#15803D' : '#64748B',
                                        background: f.active ? 'rgba(21,128,61,0.15)' : 'rgba(100,116,139,0.15)',
                                    }}>
                                    {f.active && <CheckCircle2 size={11} />}
                                    {f.status}
                                </span>
                            </div>
                            <h3 className="font-semibold mb-1" style={{ color: '#0F172A' }}>{f.title}</h3>
                            <p className="text-xs mb-3" style={{ color: '#64748B' }}>{f.desc}</p>
                            <div className="flex items-center gap-2 p-2 rounded-md" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                <Brain size={12} style={{ color: f.color }} />
                                <span className="text-xs font-mono" style={{ color: '#475569' }}>{f.model}</span>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* OCR Upload */}
            <OCRUploadWidget />

            {/* Interactive AI Widgets */}
            <AnomalyWidget />

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <DemandForecastWidget />
                <PricingWidget />
            </div>

            {/* ═══ Prompt Editor ═══ */}
            <ActivePromptEditor prompts={promptTemplates} />

            {/* ═══ AI Reports History ═══ */}
            <AiReportsPanel initialReports={reports} />

            {/* AI Infrastructure */}
            <AiUsageCard stats={usageStats} />

            <ApiKeyVault initialKeys={apiKeys} />
        </div>
    )
}

