'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAppLocale } from '@/lib/i18n'
import { getPriceListI18n } from './i18n'
import { getChannelPriceMapping, saveChannelPriceMapping } from './customer-rules-actions'

interface Props {
    currentUser: {
        id: string
        email: string
        name: string
        roles: string[]
        permissions: string[]
    } | null
    onSaved?: () => void
}

export function ChannelMappingTab({ currentUser, onSaved }: Props) {
    const { locale } = useAppLocale()
    const i18n = getPriceListI18n(locale)

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [savedSuccess, setSavedSuccess] = useState(false)

    // Mapping states
    const [mapHoreca, setMapHoreca] = useState('WHOLESALE_DISTRIBUTOR')
    const [mapWholesale, setMapWholesale] = useState('WHOLESALE_DISTRIBUTOR')
    const [mapVip, setMapVip] = useState('DIRECT_INDIVIDUAL')
    const [mapDirect, setMapDirect] = useState('DIRECT_INDIVIDUAL')

    const canApprove = currentUser?.permissions.includes('SLS:APPROVE') || currentUser?.roles.includes('CEO')

    const loadMapping = useCallback(async () => {
        setLoading(true)
        try {
            const mappingData = await getChannelPriceMapping()
            setMapHoreca(mappingData.HORECA ?? 'WHOLESALE_DISTRIBUTOR')
            setMapWholesale(mappingData.WHOLESALE_DISTRIBUTOR ?? 'WHOLESALE_DISTRIBUTOR')
            setMapVip(mappingData.VIP_RETAIL ?? 'DIRECT_INDIVIDUAL')
            setMapDirect(mappingData.DIRECT_INDIVIDUAL ?? 'DIRECT_INDIVIDUAL')
        } catch (e) {
            console.error('Failed to load mapping data', e)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        loadMapping()
    }, [loadMapping])

    const handleSaveMapping = async () => {
        setSaving(true)
        setSavedSuccess(false)
        const res = await saveChannelPriceMapping({
            HORECA: mapHoreca,
            WHOLESALE_DISTRIBUTOR: mapWholesale,
            VIP_RETAIL: mapVip,
            DIRECT_INDIVIDUAL: mapDirect,
        })
        if (res.success) {
            setSavedSuccess(true)
            toast.success(i18n.mapping.toastSaved)
            setTimeout(() => {
                setSavedSuccess(false)
                onSaved?.()
            }, 600)
        } else {
            toast.error(i18n.general.errorPrefix + res.error)
        }
        setSaving(false)
    }

    if (loading) {
        return (
            <div className="py-8 text-center text-slate-600 text-xs">
                <Loader2 size={22} className="animate-spin mx-auto mb-2 text-[#0891B2]" />
                {i18n.mapping.loading}
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
                {i18n.mapping.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* HORECA */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-[#B45309] block">
                        {i18n.mapping.horecaLabel}
                    </label>
                    <p className="text-[11px] text-slate-500">{i18n.mapping.horecaDesc}</p>
                    <select
                        value={mapHoreca}
                        onChange={e => setMapHoreca(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">{i18n.mapping.optWholesale}</option>
                        <option value="DIRECT_INDIVIDUAL">{i18n.mapping.optRetail}</option>
                        <option value="VIP_RETAIL">{i18n.mapping.optVipRetail}</option>
                    </select>
                </div>

                {/* Wholesale / Distributors */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-[#0891B2] block">
                        {i18n.mapping.wholesaleLabel}
                    </label>
                    <p className="text-[11px] text-slate-500">{i18n.mapping.wholesaleDesc}</p>
                    <select
                        value={mapWholesale}
                        onChange={e => setMapWholesale(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">{i18n.mapping.optWholesale}</option>
                        <option value="DIRECT_INDIVIDUAL">{i18n.mapping.optRetail}</option>
                        <option value="VIP_RETAIL">{i18n.mapping.optVipRetail}</option>
                    </select>
                </div>

                {/* VIP Retail */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-[#0D9488] block">
                        {i18n.mapping.vipLabel}
                    </label>
                    <p className="text-[11px] text-slate-500">{i18n.mapping.vipDesc}</p>
                    <select
                        value={mapVip}
                        onChange={e => setMapVip(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">{i18n.mapping.optWholesale}</option>
                        <option value="DIRECT_INDIVIDUAL">{i18n.mapping.optRetail}</option>
                        <option value="VIP_RETAIL">{i18n.mapping.optVipRetail}</option>
                    </select>
                </div>

                {/* Direct Individual */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                        {i18n.mapping.directLabel}
                    </label>
                    <p className="text-[11px] text-slate-500">{i18n.mapping.directDesc}</p>
                    <select
                        value={mapDirect}
                        onChange={e => setMapDirect(e.target.value)}
                        className="w-full px-3 py-2 text-xs outline-none cursor-pointer font-medium bg-white border border-slate-300 rounded-md text-slate-900 focus:border-[#0891B2]"
                    >
                        <option value="WHOLESALE_DISTRIBUTOR">{i18n.mapping.optWholesale}</option>
                        <option value="DIRECT_INDIVIDUAL">{i18n.mapping.optRetail}</option>
                        <option value="VIP_RETAIL">{i18n.mapping.optVipRetail}</option>
                    </select>
                </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <div>
                    {savedSuccess && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
                            <CheckCircle2 size={14} /> {i18n.mapping.savedSuccess}
                        </span>
                    )}
                    {!canApprove && (
                        <p className="text-xs text-rose-600">
                            <AlertCircle size={12} className="inline mr-1" />
                            {i18n.mapping.permissionNote}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleSaveMapping}
                    disabled={saving || !canApprove}
                    className="px-5 py-2 text-xs font-bold rounded-md bg-[#0E7490] text-white hover:bg-[#155E75] transition-all disabled:opacity-40"
                >
                    {saving ? <Loader2 size={14} className="animate-spin mx-auto" /> : i18n.mapping.saveBtn}
                </button>
            </div>
        </div>
    )
}
