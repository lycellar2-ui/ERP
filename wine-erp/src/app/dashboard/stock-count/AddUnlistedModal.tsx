'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Minus, Search, MapPin, AlertCircle, Save, RefreshCw, X } from 'lucide-react'
import { searchProductsForAddition, addUnlistedProductToStockCountSession, getWarehouseLocationOptions } from './actions'
import { useAppLocale } from '@/lib/i18n'
import { getStockCountDict } from './i18n'

type Props = {
    sessionId: string
    sessionNo: string
    warehouseId?: string
    defaultZone?: string
    zones: string[]
    onClose: () => void
    onSuccess: (newLineId?: string) => void
}

export function AddUnlistedModal({ sessionId, sessionNo, warehouseId, defaultZone, zones, onClose, onSuccess }: Props) {
    const { locale } = useAppLocale()
    const t = getStockCountDict(locale)
    const [searchQuery, setSearchQuery] = useState('')
    const [products, setProducts] = useState<any[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<any>(null)
    const [warehouseLocations, setWarehouseLocations] = useState<Array<{ id: string; locationCode: string; zone: string }>>([])

    // Form inputs
    const [vintage, setVintage] = useState<string>('')
    const initialLoc = (defaultZone && defaultZone !== 'ALL') ? defaultZone : (zones[0] || t.common.generalZone)
    const [locationCode, setLocationCode] = useState<string>(initialLoc)
    const [selectedLocationId, setSelectedLocationId] = useState<string>('')
    const [casesStr, setCasesStr] = useState<string>('0')
    const [looseStr, setLooseStr] = useState<string>('0')
    const [varianceReason, setVarianceReason] = useState<string>('UNRECORDED_GR')
    const [notes, setNotes] = useState<string>(t.addUnlisted.defaultNotes)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMsg, setErrorMsg] = useState('')

    const casesNum = Math.max(0, parseInt(casesStr, 10) || 0)
    const looseNum = Math.max(0, parseInt(looseStr, 10) || 0)
    const upc = selectedProduct?.unitsPerCase || 6
    const totalBottles = casesNum * upc + looseNum

    useEffect(() => {
        handleSearchProducts('')
        if (warehouseId) {
            getWarehouseLocationOptions(warehouseId).then(locs => {
                setWarehouseLocations(locs || [])
                const matched = (locs || []).find((l: any) => l.locationCode === initialLoc || l.zone === initialLoc)
                if (matched) setSelectedLocationId(matched.id)
            }).catch(() => {})
        }
    }, [warehouseId])

    const handleSearchProducts = async (q: string) => {
        setIsSearching(true)
        try {
            const list = await searchProductsForAddition(q)
            setProducts(list)
        } catch (err) {
            console.error(err)
        } finally {
            setIsSearching(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedProduct) {
            setErrorMsg(t.addUnlisted.errNoProduct)
            return
        }

        if (totalBottles <= 0) {
            setErrorMsg(t.addUnlisted.errZeroQty)
            return
        }

        setIsSubmitting(true)
        setErrorMsg('')

        const res = await addUnlistedProductToStockCountSession({
            sessionId,
            productId: selectedProduct.id,
            locationId: selectedLocationId || undefined,
            locationCode: locationCode.trim() || 'CHÈN_THÊM',
            vintage: vintage ? parseInt(vintage, 10) : undefined,
            qtyActual: totalBottles,
            varianceReason,
            notes
        })

        setIsSubmitting(false)

        if (res.success) {
            onSuccess(res.lineId)
            onClose()
        } else {
            setErrorMsg(res.error || t.addUnlisted.errNoProduct)
        }
    }

    // Quick location chips combining session zones + warehouse locations
    const quickLocations = Array.from(
        new Set([
            ...zones.filter(Boolean),
            ...warehouseLocations.map(l => l.zone || l.locationCode).filter(Boolean)
        ])
    ).slice(0, 8)

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-t-xl sm:rounded-lg max-w-lg w-full p-4 sm:p-6 text-slate-900 shadow-2xl space-y-3.5 max-h-[92vh] overflow-y-auto animate-modal-in">
                <div className="flex justify-between items-start pb-2.5 border-b border-slate-200">
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                                {sessionNo}
                            </span>
                            <span className="inline-block text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 whitespace-nowrap shrink-0">
                                {t.addUnlisted.badge}
                            </span>
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900 mt-1">{t.addUnlisted.title}</h3>
                    </div>
                    <button onClick={onClose} className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 active:scale-90 transition-all cursor-pointer">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {errorMsg && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                    {/* Step 1: Product Selector */}
                    <div>
                        <label className="text-slate-700 font-bold block mb-1">{t.addUnlisted.step1Label}</label>
                        <div className="relative mb-2">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                            <input
                                type="text"
                                placeholder={t.addUnlisted.searchPlaceholder}
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value)
                                    handleSearchProducts(e.target.value)
                                }}
                                className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg pl-9 pr-8 py-2.5 text-base sm:text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/20 font-semibold"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('')
                                        handleSearchProducts('')
                                    }}
                                    className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                            {isSearching ? (
                                <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-1.5">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> {t.addUnlisted.searching}
                                </div>
                            ) : products.length === 0 ? (
                                <div className="p-3 text-center text-slate-400">{t.addUnlisted.emptyProducts}</div>
                            ) : (
                                products.map(p => (
                                    <div
                                        key={p.id}
                                        onClick={() => setSelectedProduct(p)}
                                        className={`p-2.5 cursor-pointer transition flex items-center justify-between gap-2 ${selectedProduct?.id === p.id ? 'bg-teal-50 text-slate-900 font-bold border-l-4 border-[#0E7490]' : 'hover:bg-slate-50 text-slate-800'}`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="font-mono text-[11px] font-extrabold text-[#0E7490]">{p.skuCode}</div>
                                            <div className="font-bold text-xs mt-0.5 truncate">{p.productName}</div>
                                        </div>
                                        <span className="inline-block text-[10px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap shrink-0">
                                            {p.unitsPerCase || 6} {t.barcodeModal.bottlesPerCase}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                        {selectedProduct && (
                            <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-bold flex items-center justify-between gap-2 text-xs">
                                <span className="truncate">{t.addUnlisted.selectedPrefix} {selectedProduct.productName} ({selectedProduct.skuCode})</span>
                                <span className="inline-block text-[10px] bg-emerald-200 px-2 py-0.5 rounded text-emerald-900 font-mono whitespace-nowrap shrink-0">
                                    {selectedProduct.unitsPerCase || 6} {t.barcodeModal.bottlesPerCase}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Vintage & Zone/Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                            <label className="text-slate-700 font-bold block mb-1">{t.addUnlisted.step2Label}</label>
                            <input
                                type="number"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder={t.addUnlisted.vintagePlaceholder}
                                value={vintage}
                                onChange={e => setVintage(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2.5 text-base sm:text-xs outline-none focus:border-[#0E7490] font-mono font-bold"
                            />
                        </div>

                        <div>
                            <label className="text-slate-700 font-bold block mb-1">{t.addUnlisted.step3Label}</label>
                            <input
                                type="text"
                                placeholder={t.addUnlisted.locationPlaceholder}
                                value={locationCode}
                                onChange={e => {
                                    const val = e.target.value
                                    setLocationCode(val)
                                    const matched = warehouseLocations.find(l => l.locationCode === val || l.zone === val)
                                    setSelectedLocationId(matched ? matched.id : '')
                                }}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2.5 text-base sm:text-xs outline-none focus:border-[#0E7490] font-bold"
                            />
                        </div>
                    </div>

                    {quickLocations.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#0E7490]" /> {t.addUnlisted.quickPickLoc}
                            </span>
                            {quickLocations.map(z => (
                                <button
                                    key={z}
                                    type="button"
                                    onClick={() => {
                                        setLocationCode(z)
                                        const matched = warehouseLocations.find(l => l.locationCode === z || l.zone === z)
                                        setSelectedLocationId(matched ? matched.id : '')
                                    }}
                                    className={`px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                                        locationCode === z
                                            ? 'bg-[#0E7490] text-white border-[#0E7490]'
                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {z}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 3: Quantity found with Mobile Steppers */}
                    <div>
                        <label className="text-slate-700 font-bold block mb-1">{t.addUnlisted.step4Label}</label>
                        <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <div className="bg-white border border-slate-300 rounded-lg p-2 text-center space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                                    {t.addUnlisted.casesLabel} ({upc}c)
                                </span>
                                <div className="flex items-center justify-between gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setCasesStr(String(Math.max(0, casesNum - 1)))}
                                        className="min-h-[40px] min-w-[40px] rounded bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center active:scale-95 cursor-pointer"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        value={casesStr}
                                        onFocus={e => e.target.select()}
                                        onChange={e => setCasesStr(e.target.value)}
                                        className="w-full text-center text-xl font-bold font-mono text-[#0E7490] outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setCasesStr(String(casesNum + 1))}
                                        className="min-h-[40px] min-w-[40px] rounded bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center active:scale-95 cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white border border-slate-300 rounded-lg p-2 text-center space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                                    {t.addUnlisted.looseLabel}
                                </span>
                                <div className="flex items-center justify-between gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setLooseStr(String(Math.max(0, looseNum - 1)))}
                                        className="min-h-[40px] min-w-[40px] rounded bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center active:scale-95 cursor-pointer"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        min="0"
                                        value={looseStr}
                                        onFocus={e => e.target.select()}
                                        onChange={e => setLooseStr(e.target.value)}
                                        className="w-full text-center text-xl font-bold font-mono text-slate-800 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setLooseStr(String(looseNum + 1))}
                                        className="min-h-[40px] min-w-[40px] rounded bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center active:scale-95 cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono px-1">
                            <span className="text-slate-500">{t.addUnlisted.convertedPrefix} [{casesNum} {t.common.cases} × {upc}] + {looseNum} {t.common.loose}</span>
                            <span className="text-emerald-700 font-extrabold">{t.addUnlisted.totalPrefix} {totalBottles} {t.common.bottles}</span>
                        </div>
                    </div>

                    {/* Step 4: Variance Reason & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                            <label className="text-slate-700 font-bold block mb-1">{t.addUnlisted.step5Label}</label>
                            <select
                                value={varianceReason}
                                onChange={e => setVarianceReason(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2.5 text-base sm:text-xs outline-none font-semibold cursor-pointer"
                            >
                                <option value="UNRECORDED_GR">{t.addUnlisted.reasonUnrecordedGr}</option>
                                <option value="WRONG_LOCATION">{t.addUnlisted.reasonWrongLocation}</option>
                                <option value="WRONG_SKU">{t.addUnlisted.reasonWrongSku}</option>
                                <option value="SAMPLE_STOCK">{t.addUnlisted.reasonSampleStock}</option>
                                <option value="OTHER">{t.addUnlisted.reasonOther}</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-slate-700 font-bold block mb-1">{t.addUnlisted.step6Label}</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-2.5 text-base sm:text-xs outline-none font-semibold"
                            />
                        </div>
                    </div>

                    {/* Submit Bar */}
                    <div className="pt-3 border-t border-slate-200 flex justify-end gap-2 text-xs">
                        <button
                            type="button"
                            onClick={onClose}
                            className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-lg border border-slate-200 transition-all cursor-pointer"
                        >
                            {t.common.cancel}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !selectedProduct}
                            className="min-h-[44px] px-5 py-2 bg-[#0E7490] hover:bg-[#0A738D] active:scale-95 text-white font-black rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    {t.addUnlisted.submitBtn} ({totalBottles} {t.common.bottles})
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
