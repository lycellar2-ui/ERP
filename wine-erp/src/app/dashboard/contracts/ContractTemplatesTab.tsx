'use client'

import React, { useState } from 'react'
import {
    Download,
    Plus,
    Copy,
    Check,
    Layers,
    Building2,
    FileSpreadsheet,
    Info,
    ArrowRight,
    BookOpen,
} from 'lucide-react'
import {
    CONTRACT_TEMPLATES,
    ContractTemplateDefinition,
} from './template-actions'
import { Button, Badge } from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getContractsDict } from './i18n'
import { toast } from 'sonner'

interface Props {
    onSelectTemplateToCreate: (templateCode: string) => void
}

export function ContractTemplatesTab({ onSelectTemplateToCreate }: Props) {
    const { locale } = useAppLocale()
    const t = getContractsDict(locale)

    const [copiedTag, setCopiedTag] = useState<string | null>(null)
    const [selectedDetailTemplate, setSelectedDetailTemplate] = useState<ContractTemplateDefinition>(CONTRACT_TEMPLATES[0])
    const [searchQuery] = useState('')

    const copyToClipboard = (tag: string) => {
        navigator.clipboard.writeText(tag)
        setCopiedTag(tag)
        toast.success(t.templates.copiedToast(tag))
        setTimeout(() => setCopiedTag(null), 2000)
    }

    const filteredTemplates = CONTRACT_TEMPLATES.filter(tpl => {
        const localized = t.templates.items[tpl.code]
        const name = localized?.name ?? tpl.name
        const desc = localized?.description ?? tpl.description
        return (
            name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
            tpl.code.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })

    const selectedLocalized = t.templates.items[selectedDetailTemplate.code]

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg border border-lys-border bg-gradient-to-r from-amber-50/60 via-white to-slate-50">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-lys-primary/10 text-lys-primary">
                            <BookOpen className="w-5 h-5" />
                        </span>
                        <h2 className="text-base font-bold text-slate-800">{t.templates.bannerTitle}</h2>
                    </div>
                    <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                        {t.templates.bannerDesc}
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => onSelectTemplateToCreate('HD_NGUYEN_TAC')}
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        {t.templates.createFromTemplateBtn}
                    </Button>
                </div>
            </div>

            {/* Template Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {filteredTemplates.map((tpl) => {
                    const isSelected = selectedDetailTemplate.code === tpl.code
                    const Icon = tpl.code === 'HD_NGUYEN_TAC' ? Building2 : tpl.code === 'HD_KY_GUI' ? Layers : FileSpreadsheet
                    const localized = t.templates.items[tpl.code]

                    return (
                        <div
                            key={tpl.code}
                            className={`rounded-lg border transition-all flex flex-col justify-between ${
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
                                        {localized?.badgeText ?? tpl.badgeText}
                                    </Badge>
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-800 text-sm">{localized?.name ?? tpl.name}</h3>
                                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{t.templates.codePrefix} {tpl.code}</div>
                                </div>

                                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                                    {localized?.description ?? tpl.description}
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
                                        {t.templates.downloadDocx}
                                    </a>

                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={() => onSelectTemplateToCreate(tpl.code)}
                                        className="flex-1 text-xs"
                                    >
                                        {t.templates.createNow}
                                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </Button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setSelectedDetailTemplate(tpl)}
                                    className="w-full text-center text-[11px] text-lys-primary hover:underline pt-1"
                                >
                                    {t.templates.viewPlaceholders(tpl.placeholders.length)}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Placeholders Reference Section */}
            <div className="rounded-lg border border-lys-border bg-white p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-lys-border pb-3">
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <Info className="w-4 h-4 text-lys-primary" />
                            {t.templates.placeholderTableTitle}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {t.templates.viewingVarsOf} <strong className="text-slate-700">{selectedLocalized?.name ?? selectedDetailTemplate.name}</strong>
                        </p>
                    </div>

                    <div className="text-xs text-slate-400 italic">
                        {t.templates.clickToCopyHint}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-lys-border">
                            <tr>
                                <th className="p-2.5 font-semibold w-56">{t.templates.thTag}</th>
                                <th className="p-2.5 font-semibold">{t.templates.thFieldName}</th>
                                <th className="p-2.5 font-semibold">{t.templates.thExample}</th>
                                <th className="p-2.5 font-semibold text-center w-20">{t.templates.thAction}</th>
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
                                            title={t.templates.copyTagTitle}
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
                    <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Info size={14} className="text-cyan-700 shrink-0" /> {t.templates.guideTitle}
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-slate-500">
                        <li>{t.templates.guideItem1}</li>
                        <li>{t.templates.guideItem2}</li>
                        <li>{t.templates.guideItem3}</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}
