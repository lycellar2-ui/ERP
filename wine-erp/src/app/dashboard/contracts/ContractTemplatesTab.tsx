'use client'

import React, { useState } from 'react'
import {
    FileText,
    Download,
    Plus,
    Copy,
    Check,
    Layers,
    Building2,
    FileSpreadsheet,
    Info,
    ArrowRight,
    Search,
    BookOpen,
} from 'lucide-react'
import {
    CONTRACT_TEMPLATES,
    ContractTemplateDefinition,
} from './template-actions'
import { Button, Badge, Card, CardHeader, CardBody } from '@/components/ui'
import { toast } from 'sonner'

interface Props {
    onSelectTemplateToCreate: (templateCode: string) => void
}

export function ContractTemplatesTab({ onSelectTemplateToCreate }: Props) {
    const [copiedTag, setCopiedTag] = useState<string | null>(null)
    const [selectedDetailTemplate, setSelectedDetailTemplate] = useState<ContractTemplateDefinition>(CONTRACT_TEMPLATES[0])
    const [searchQuery, setSearchQuery] = useState('')

    const copyToClipboard = (tag: string) => {
        navigator.clipboard.writeText(tag)
        setCopiedTag(tag)
        toast.success(`Đã sao chép tag: ${tag}`)
        setTimeout(() => setCopiedTag(null), 2000)
    }

    const filteredTemplates = CONTRACT_TEMPLATES.filter(
        t => t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
             t.code.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl border border-lys-border bg-gradient-to-r from-amber-50/60 via-white to-slate-50">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-lys-primary/10 text-lys-primary">
                            <BookOpen className="w-5 h-5" />
                        </span>
                        <h2 className="text-base font-bold text-slate-800">Kho Biểu Mẫu Hợp Đồng Ngành Rượu (.docx)</h2>
                    </div>
                    <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                        Hệ thống cung cấp sẵn các biểu mẫu chuẩn hóa cho hoạt động kinh doanh rượu nhập khẩu (Bán buôn, Ký gửi, Hợp đồng từng đơn). Bạn có thể tải mẫu Word về chỉnh sửa câu chữ hoặc tạo ngay hợp đồng tự động.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onSelectTemplateToCreate('HD_NGUYEN_TAC')}
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Tạo HĐ Từ Mẫu
                    </Button>
                </div>
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {filteredTemplates.map((tpl) => {
                    const isSelected = selectedDetailTemplate.code === tpl.code
                    const Icon = tpl.code === 'HD_NGUYEN_TAC' ? Building2 : tpl.code === 'HD_KY_GUI' ? Layers : FileSpreadsheet

                    return (
                        <div
                            key={tpl.code}
                            className={`rounded-xl border transition-all flex flex-col justify-between ${
                                isSelected
                                    ? 'border-lys-primary bg-amber-50/20 ring-1 ring-lys-primary shadow-sm'
                                    : 'border-lys-border bg-white hover:border-slate-300 hover:shadow-sm'
                            }`}
                        >
                            <div className="p-5 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="w-9 h-9 rounded-lg bg-lys-primary/10 text-lys-primary flex items-center justify-center shrink-0">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <Badge tone={tpl.code === 'HD_NGUYEN_TAC' ? 'brand' : tpl.code === 'HD_KY_GUI' ? 'warning' : 'success'}>
                                        {tpl.badgeText}
                                    </Badge>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">{tpl.name}</h3>
                                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">Mã: {tpl.code}</div>
                                </div>

                                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                                    {tpl.description}
                                </p>
                            </div>

                            <div className="p-5 pt-0 space-y-2 border-t border-slate-100 mt-2">
                                <div className="pt-3 flex items-center gap-2">
                                    <a
                                        href={tpl.sampleDownloadUrl}
                                        download
                                        className="flex-1 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-md border border-lys-border bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                                    >
                                        <Download className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                                        Tải Mẫu .docx
                                    </a>

                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => onSelectTemplateToCreate(tpl.code)}
                                        className="flex-1 text-xs"
                                    >
                                        Tạo HĐ Ngay
                                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </Button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedDetailTemplate(tpl)}
                                    className="w-full text-center text-[11px] text-lys-primary hover:underline pt-1"
                                >
                                    Xem bảng biến thay thế ({tpl.placeholders.length} biến)
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Placeholders Reference Section */}
            <div className="rounded-xl border border-lys-border bg-white p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-lys-border pb-3">
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Info className="w-4 h-4 text-lys-primary" />
                            Bảng Tra Cứu Biến Thay Thế (Placeholder Merge Tags)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Đang xem danh mục biến của mẫu: <strong className="text-slate-700">{selectedDetailTemplate.name}</strong>
                        </p>
                    </div>

                    <div className="text-xs text-slate-400 italic">
                        Bấm vào tag bất kỳ để sao chép vào clipboard
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-lys-border">
                            <tr>
                                <th className="p-2.5 font-semibold w-56">Mã Thẻ (Placeholder Tag)</th>
                                <th className="p-2.5 font-semibold">Tên Trường Dữ Liệu</th>
                                <th className="p-2.5 font-semibold">Ví Dụ Dữ Liệu Sau Khi Merge</th>
                                <th className="p-2.5 font-semibold text-center w-20">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {selectedDetailTemplate.placeholders.map((p, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="p-2.5 font-mono text-[11px] font-semibold text-lys-primary">
                                        <code>{p.tag}</code>
                                    </td>
                                    <td className="p-2.5 font-medium text-slate-700">{p.label}</td>
                                    <td className="p-2.5 text-slate-500">{p.example}</td>
                                    <td className="p-2.5 text-center">
                                        <button
                                            type="button"
                                            onClick={() => copyToClipboard(p.tag)}
                                            className="p-1 rounded hover:bg-slate-200 text-slate-500 transition-colors"
                                            title="Sao chép tag"
                                        >
                                            {copiedTag === p.tag ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Guide for custom docx templates */}
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                    <div className="font-semibold text-slate-800">💡 Hướng dẫn tạo & chỉnh sửa biểu mẫu Word riêng của công ty:</div>
                    <ul className="list-disc pl-5 space-y-1 text-slate-500">
                        <li>Bạn tải file mẫu <code>.docx</code> ở trên về máy, mở bằng Microsoft Word.</li>
                        <li>Chèn các biến <code>{`{ten_ben_b}`}</code>, <code>{`{so_hop_dong}`}</code>, <code>{`{tong_tien}`}</code> vào vị trí mong muốn trong văn bản.</li>
                        <li>Với danh sách sản phẩm lặp lại trong bảng, đặt <code>{`{#san_pham}{stt}`}</code> ở ô đầu tiên và <code>{`{thanh_tien}{/san_pham}`}</code> ở ô cuối cùng của hàng bảng. Hệ thống sẽ tự động nhân bản số dòng tương ứng với danh mục sản phẩm bạn đã chọn.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
