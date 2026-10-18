'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    Package, Handshake, TrendingUp, CheckCircle2, Plus, X,
    ChevronRight, FileText, MapPin, AlertTriangle, Printer,
    ArrowRightLeft, ShoppingCart, Warehouse as WarehouseIcon, Building2,
    Check
} from 'lucide-react'
import { toast } from 'sonner'
import {
    PageHeader, StatGrid, StatCard, Button, SearchInput, StatusTabs,
    Table, THead, TBody, Tr, Th, Td, TableMessageRow
} from '@/components/ui'
import { useAppLocale } from '@/lib/i18n'
import { getConsignmentI18n, ConsignmentI18n } from './i18n'
import PrintableConsignmentCount, { ConsignmentCountHeader } from './PrintableConsignmentCount'
import PrintableConsignmentDispatch, { ConsignmentDispatchData } from './PrintableConsignmentDispatch'
import type {
    ConsignmentRow, ConsignmentStockRow, ConsignedStockMapRow,
    ReplenishmentAlert, ConsignmentWarehouseRow
} from './actions'
import {
    getConsignmentAgreements, getConsignmentStats, createConsignmentAgreement,
    getConsignmentStocks,
    getCustomerOptionsForCSG,
    getConsignedStockMap, getReplenishmentAlerts,
    getConsignmentWarehouses, createConsignmentWarehouse,
    getInternalWarehouses, getWarehouseStockForTransfer,
    createConsignmentTransfer, getConsignmentInventoryForCount,
    getConsignmentTransferPrintData, getConsignmentTransfers,
    sellFromConsignmentWarehouse
} from './actions'

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    ACTIVE: { color: '#15803D', bg: 'rgba(21,128,61,0.12)' },
    EXPIRED: { color: '#B45309', bg: 'rgba(180,83,9,0.12)' },
    TERMINATED: { color: '#B91C1C', bg: 'rgba(185,28,28,0.12)' },
    RECEIVED: { color: '#15803D', bg: 'rgba(21,128,61,0.12)' },
    IN_TRANSIT: { color: '#B45309', bg: 'rgba(180,83,9,0.12)' },
    CONFIRMED: { color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    DRAFT: { color: '#475569', bg: 'rgba(100,116,139,0.12)' },
}

export function ConsignmentClient({ initialRows, stats: initialStats }: { initialRows?: ConsignmentRow[]; stats?: any } = {}) {
    const { locale, formatCurrency, formatDate, formatNumber } = useAppLocale()
    const i18n = getConsignmentI18n(locale)

    const [mainTab, setMainTab] = useState<'warehouses' | 'transfers' | 'sales' | 'stockCount' | 'agreements' | 'stockMap'>('warehouses')

    // Data States
    const [warehouses, setWarehouses] = useState<ConsignmentWarehouseRow[]>([])
    const [transfers, setTransfers] = useState<any[]>([])
    const [agreements, setAgreements] = useState<ConsignmentRow[]>(initialRows || [])
    const [stats, setStats] = useState(initialStats || { total: 0, active: 0, totalStockSent: 0, totalSold: 0 })
    const [stockMap, setStockMap] = useState<ConsignedStockMapRow[]>([])
    const [alerts, setAlerts] = useState<ReplenishmentAlert[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Modals
    const [createWHOpen, setCreateWHOpen] = useState(false)
    const [createTransferOpen, setCreateTransferOpen] = useState(false)
    const [createSaleOpen, setCreateSaleOpen] = useState(false)
    const [createAgreementOpen, setCreateAgreementOpen] = useState(false)
    const [selectedAgreement, setSelectedAgreement] = useState<ConsignmentRow | null>(null)
    const [preselectedWarehouseId, setPreselectedWarehouseId] = useState<string>('')

    // Print Data Modals
    const [printCountData, setPrintCountData] = useState<ConsignmentCountHeader | null>(null)
    const [printDispatchData, setPrintDispatchData] = useState<ConsignmentDispatchData | null>(null)

    // Load initial data
    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const [whList, trfList, agList, st] = await Promise.all([
                getConsignmentWarehouses(),
                getConsignmentTransfers(),
                getConsignmentAgreements(),
                getConsignmentStats(),
            ])
            setWarehouses(whList)
            setTransfers(trfList)
            setAgreements(agList)
            setStats(st)
        } catch (err: any) {
            toast.error(i18n.toasts.loadErrorPrefix + err.message)
        } finally {
            setLoading(false)
        }
    }, [i18n.toasts.loadErrorPrefix])

    useEffect(() => {
        loadAll()
    }, [loadAll])

    const loadStockMapData = async () => {
        try {
            const [map, repAlerts] = await Promise.all([getConsignedStockMap(), getReplenishmentAlerts()])
            setStockMap(map)
            setAlerts(repAlerts)
        } catch (err: any) {
            console.error(err)
        }
    }

    const handleTabChange = (nextTab: 'warehouses' | 'transfers' | 'sales' | 'stockCount' | 'agreements' | 'stockMap') => {
        setMainTab(nextTab)
        if (nextTab === 'stockMap') {
            loadStockMapData()
        }
    }

    // Trigger Print Consignment Count Sheet
    const handleOpenPrintCount = async (warehouseId: string) => {
        toast.loading(i18n.toasts.preparingCountSheet, { id: 'count-sheet' })
        const res = await getConsignmentInventoryForCount(warehouseId)
        toast.dismiss('count-sheet')
        if (!res.success || !res.data) {
            toast.error(res.error || i18n.toasts.errCountSheet)
            return
        }
        setPrintCountData(res.data)
    }

    // Trigger Print Consignment Dispatch Voucher
    const handleOpenPrintDispatch = async (transferNoOrId: string) => {
        toast.loading(i18n.toasts.preparingDispatchSheet, { id: 'dispatch-sheet' })
        const res = await getConsignmentTransferPrintData(transferNoOrId)
        toast.dismiss('dispatch-sheet')
        if (!res.success || !res.data) {
            toast.error(res.error || i18n.toasts.errDispatchSheet)
            return
        }
        setPrintDispatchData(res.data)
    }

    const filteredWarehouses = warehouses.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.code.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Page Header */}
            <PageHeader
                title={i18n.header.title}
                description={i18n.header.description}
                actions={
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="primary" size="sm" onClick={() => setCreateWHOpen(true)}>
                            <Plus size={14} /> {i18n.header.createWarehouseBtn}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => { setPreselectedWarehouseId(''); setCreateTransferOpen(true); }}>
                            <ArrowRightLeft size={14} /> {i18n.header.createTransferBtn}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => { setPreselectedWarehouseId(''); setCreateSaleOpen(true); }}>
                            <ShoppingCart size={14} /> {i18n.header.createSaleBtn}
                        </Button>
                    </div>
                }
            />

            {/* Statistics Cards */}
            <StatGrid>
                <StatCard label={i18n.stats.agreementsTotal} value={stats.total} icon={FileText} />
                <StatCard label={i18n.stats.agreementsActive} value={stats.active} icon={CheckCircle2} />
                <StatCard label={i18n.stats.stockSent} value={`${formatNumber(stats.totalStockSent || 0)} ${i18n.stats.bottlesUnit}`} icon={Package} />
                <StatCard label={i18n.stats.stockSold} value={`${formatNumber(stats.totalSold || 0)} ${i18n.stats.bottlesUnit}`} icon={TrendingUp} />
            </StatGrid>

            {/* Main Tabs Navigation */}
            <StatusTabs
                value={mainTab}
                onChange={handleTabChange}
                items={[
                    { value: 'warehouses', label: i18n.tabs.warehouses, count: warehouses.length },
                    { value: 'transfers', label: i18n.tabs.transfers, count: transfers.length },
                    { value: 'sales', label: i18n.tabs.sales },
                    { value: 'stockCount', label: i18n.tabs.stockCount },
                    { value: 'agreements', label: i18n.tabs.agreements, count: agreements.length },
                    { value: 'stockMap', label: i18n.tabs.stockMap },
                ]}
            />

            {/* TAB 1: CUSTOMER CONSIGNMENT WAREHOUSES */}
            {mainTab === 'warehouses' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <SearchInput
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={i18n.warehousesTab.searchPlaceholder}
                            className="w-full sm:w-72"
                        />
                        <div className="text-xs text-slate-500">
                            {i18n.warehousesTab.showingPrefix} <span className="font-bold text-slate-900">{filteredWarehouses.length}</span> {i18n.warehousesTab.showingSuffix}
                        </div>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-lg overflow-hidden border border-slate-200 bg-white shadow-xs">
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{i18n.warehousesTab.colCode}</Th>
                                    <Th>{i18n.warehousesTab.colName}</Th>
                                    <Th>{i18n.warehousesTab.colCustomer}</Th>
                                    <Th>{i18n.warehousesTab.colSkuCount}</Th>
                                    <Th>{i18n.warehousesTab.colStockBottles}</Th>
                                    <Th>{i18n.warehousesTab.colStockValue}</Th>
                                    <Th>{i18n.warehousesTab.colActions}</Th>
                                </tr>
                            </THead>
                            <TBody>
                                {loading ? (
                                    <TableMessageRow colSpan={7}>{i18n.warehousesTab.loading}</TableMessageRow>
                                ) : filteredWarehouses.length === 0 ? (
                                    <TableMessageRow colSpan={7}>{i18n.warehousesTab.empty}</TableMessageRow>
                                ) : (
                                    filteredWarehouses.map(wh => (
                                        <Tr key={wh.id}>
                                            <Td className="font-bold font-mono text-[#0891B2]">{wh.code}</Td>
                                            <Td className="font-semibold text-slate-900">
                                                <div>{wh.name}</div>
                                                {wh.address && <div className="text-[11px] text-slate-400 mt-0.5 font-normal">{wh.address}</div>}
                                            </Td>
                                            <Td className="text-slate-900">
                                                <div className="font-semibold">{wh.customerName}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    {i18n.warehousesTab.custCodeLabel} {wh.customerCode} {wh.customerPhone ? `| ${i18n.warehousesTab.phoneLabel} ${wh.customerPhone}` : ''}
                                                </div>
                                            </Td>
                                            <Td className="font-bold font-mono text-[#B45309]">{wh.skuCount} SKU</Td>
                                            <Td className="font-bold font-mono" style={{ color: wh.totalBottles > 0 ? '#15803D' : '#475569' }}>
                                                {formatNumber(wh.totalBottles)} {i18n.stats.bottlesUnit}
                                            </Td>
                                            <Td className="font-bold font-mono text-[#0891B2]">
                                                {formatCurrency(wh.totalStockValue)}
                                            </Td>
                                            <Td>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => { setPreselectedWarehouseId(wh.id); setCreateTransferOpen(true); }}
                                                        title={i18n.warehousesTab.dispatchTitle}
                                                        className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition bg-white border border-slate-200 hover:bg-slate-50 text-[#B45309]"
                                                    >
                                                        <ArrowRightLeft size={12} /> {i18n.warehousesTab.dispatchBtn}
                                                    </button>
                                                    <button
                                                        onClick={() => { setPreselectedWarehouseId(wh.id); setCreateSaleOpen(true); }}
                                                        title={i18n.warehousesTab.sellTitle}
                                                        className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition bg-white border border-slate-200 hover:bg-slate-50 text-[#15803D]"
                                                    >
                                                        <ShoppingCart size={12} /> {i18n.warehousesTab.sellBtn}
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenPrintCount(wh.id)}
                                                        title={i18n.warehousesTab.printCountTitle}
                                                        className="px-2.5 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer transition bg-white border border-slate-200 hover:bg-slate-50 text-[#0891B2]"
                                                    >
                                                        <Printer size={12} /> {i18n.warehousesTab.printCountBtn}
                                                    </button>
                                                </div>
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile Cards (<768px) */}
                    <div className="block md:hidden space-y-3">
                        {loading ? (
                            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                                {i18n.warehousesTab.loading}
                            </div>
                        ) : filteredWarehouses.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                                {i18n.warehousesTab.empty}
                            </div>
                        ) : filteredWarehouses.map(wh => (
                            <div key={wh.id} className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <span className="font-mono text-xs font-bold text-[#0891B2] block">{wh.code}</span>
                                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{wh.name}</h4>
                                        <p className="text-xs text-slate-600 mt-0.5">{wh.customerName}</p>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                        {formatNumber(wh.totalBottles)} {i18n.stats.bottlesUnit}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                    <span className="font-mono font-semibold text-[#B45309]">{wh.skuCount} SKU</span>
                                    <span className="font-mono font-bold text-[#0891B2]">{formatCurrency(wh.totalStockValue)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5 pt-1">
                                    <button
                                        onClick={() => { setPreselectedWarehouseId(wh.id); setCreateTransferOpen(true); }}
                                        className="py-1.5 px-2 text-[11px] font-bold rounded flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 text-[#B45309]"
                                    >
                                        <ArrowRightLeft size={12} /> {i18n.warehousesTab.dispatchBtn}
                                    </button>
                                    <button
                                        onClick={() => { setPreselectedWarehouseId(wh.id); setCreateSaleOpen(true); }}
                                        className="py-1.5 px-2 text-[11px] font-bold rounded flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 text-[#15803D]"
                                    >
                                        <ShoppingCart size={12} /> {i18n.warehousesTab.sellBtn}
                                    </button>
                                    <button
                                        onClick={() => handleOpenPrintCount(wh.id)}
                                        className="py-1.5 px-2 text-[11px] font-bold rounded flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 text-[#0891B2]"
                                    >
                                        <Printer size={12} /> {i18n.warehousesTab.printCountBtn}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: CONSIGNMENT TRANSFERS */}
            {mainTab === 'transfers' && (
                <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                        <p className="text-xs text-slate-500">
                            {i18n.transfersTab.description}
                        </p>
                        <button
                            onClick={() => { setPreselectedWarehouseId(''); setCreateTransferOpen(true); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer transition bg-[#D97706] hover:bg-[#B45309] text-white"
                        >
                            <Plus size={14} /> {i18n.transfersTab.createBtn}
                        </button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-lg overflow-hidden border border-slate-200 bg-white shadow-xs">
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{i18n.transfersTab.colTransferNo}</Th>
                                    <Th>{i18n.transfersTab.colType}</Th>
                                    <Th>{i18n.transfersTab.colFromWh}</Th>
                                    <Th>{i18n.transfersTab.colToWh}</Th>
                                    <Th>{i18n.transfersTab.colCustomer}</Th>
                                    <Th>{i18n.transfersTab.colTotalBottles}</Th>
                                    <Th>{i18n.transfersTab.colDate}</Th>
                                    <Th>{i18n.transfersTab.colStatus}</Th>
                                    <Th>{i18n.transfersTab.colPrint}</Th>
                                </tr>
                            </THead>
                            <TBody>
                                {transfers.length === 0 ? (
                                    <TableMessageRow colSpan={9}>{i18n.transfersTab.empty}</TableMessageRow>
                                ) : transfers.map(trf => {
                                    const stStyle = STATUS_STYLE[trf.status] ?? STATUS_STYLE.RECEIVED
                                    const stLabel = i18n.statuses[trf.status] ?? trf.status
                                    return (
                                        <Tr key={trf.id}>
                                            <Td className="font-bold font-mono text-[#0891B2]">{trf.transferNo}</Td>
                                            <Td>
                                                <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${trf.type === 'XUẤT_KÝ_GỬI' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
                                                    {trf.type === 'XUẤT_KÝ_GỬI' ? i18n.transfersTab.typeDispatch : i18n.transfersTab.typeReturn}
                                                </span>
                                            </Td>
                                            <Td className="text-slate-900">{trf.fromWarehouseName}</Td>
                                            <Td className="font-semibold text-slate-900">{trf.toWarehouseName}</Td>
                                            <Td className="text-slate-600">{trf.customerName}</Td>
                                            <Td className="font-bold font-mono text-[#B45309]">
                                                {formatNumber(trf.totalQty)} {i18n.stats.bottlesUnit} ({trf.itemCount} SKU)
                                            </Td>
                                            <Td className="text-slate-500">{formatDate(trf.transferDate)}</Td>
                                            <Td>
                                                <span className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0" style={{ background: stStyle.bg, color: stStyle.color }}>
                                                    {stLabel}
                                                </span>
                                            </Td>
                                            <Td>
                                                <button
                                                    onClick={() => handleOpenPrintDispatch(trf.id)}
                                                    className="px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 cursor-pointer transition bg-white border border-slate-200 hover:bg-slate-50 text-[#B45309]"
                                                >
                                                    <Printer size={12} /> {i18n.transfersTab.printA4Btn}
                                                </button>
                                            </Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile Cards (<768px) */}
                    <div className="block md:hidden space-y-3">
                        {transfers.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                                {i18n.transfersTab.empty}
                            </div>
                        ) : transfers.map(trf => {
                            const stStyle = STATUS_STYLE[trf.status] ?? STATUS_STYLE.RECEIVED
                            const stLabel = i18n.statuses[trf.status] ?? trf.status
                            return (
                                <div key={trf.id} className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-[#0891B2]">{trf.transferNo}</span>
                                            <p className="text-sm font-bold text-slate-900 mt-0.5">{trf.toWarehouseName}</p>
                                            <p className="text-xs text-slate-500">{trf.customerName}</p>
                                        </div>
                                        <span className="inline-block text-[11px] px-2 py-0.5 rounded font-bold shrink-0" style={{ background: stStyle.bg, color: stStyle.color }}>
                                            {stLabel}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                        <span className="font-mono font-bold text-[#B45309]">
                                            {formatNumber(trf.totalQty)} {i18n.stats.bottlesUnit} ({trf.itemCount} SKU)
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500">{formatDate(trf.transferDate)}</span>
                                            <button
                                                onClick={() => handleOpenPrintDispatch(trf.id)}
                                                className="px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 bg-slate-50 border border-slate-200 text-[#B45309]"
                                            >
                                                <Printer size={12} /> {i18n.transfersTab.printA4Btn}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: CONSIGNMENT SALES */}
            {mainTab === 'sales' && (
                <div className="space-y-4">
                    <div className="p-5 rounded-lg border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 mb-1">{i18n.salesTab.title}</h3>
                            <p className="text-xs text-slate-500">
                                {i18n.salesTab.description}
                            </p>
                        </div>
                        <button
                            onClick={() => { setPreselectedWarehouseId(''); setCreateSaleOpen(true); }}
                            className="px-4 py-2.5 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs bg-[#15803D] hover:bg-[#166534] text-white"
                        >
                            <ShoppingCart size={15} /> {i18n.salesTab.createSaleBtn}
                        </button>
                    </div>

                    <div className="rounded-lg p-5 border border-slate-200 bg-white">
                        <h4 className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-3">
                            {i18n.salesTab.quickSelectTitle}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {warehouses.map(wh => (
                                <div
                                    key={wh.id}
                                    onClick={() => { setPreselectedWarehouseId(wh.id); setCreateSaleOpen(true); }}
                                    className="p-3.5 rounded-lg border border-slate-200 hover:border-[#15803D] cursor-pointer transition-all bg-white"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-sm text-slate-900">{wh.name}</div>
                                        <span className="inline-block text-[11px] px-2 py-0.5 rounded font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 whitespace-nowrap shrink-0">
                                            {formatNumber(wh.totalBottles)} {i18n.stats.bottlesUnit}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1">
                                        {i18n.salesTab.customerLabel} <span className="text-slate-800 font-semibold">{wh.customerName}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                        {i18n.salesTab.whCodeLabel} {wh.code} | {wh.skuCount} {i18n.salesTab.itemsUnit}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: STOCK COUNT SHEET (A4) */}
            {mainTab === 'stockCount' && (
                <div className="space-y-4">
                    <div className="p-5 rounded-lg border border-slate-200 bg-white">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 mb-1">{i18n.stockCountTab.title}</h3>
                                <p className="text-xs text-slate-500">
                                    {i18n.stockCountTab.description}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {warehouses.map(wh => (
                            <div key={wh.id} className="p-4 rounded-lg border border-slate-200 bg-white flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="font-bold text-sm text-slate-900">{wh.name}</div>
                                        <span className="inline-block text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-slate-50 border border-slate-200 text-[#0891B2] whitespace-nowrap shrink-0">
                                            {wh.code}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-800 font-medium">{wh.customerName}</p>
                                    <p className="text-[11px] text-slate-400 mt-1">{wh.address || i18n.stockCountTab.defaultAddress}</p>

                                    <div className="grid grid-cols-2 gap-2 my-3 p-2.5 rounded bg-slate-50 border border-slate-100">
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500">{i18n.stockCountTab.itemsLabel}</div>
                                            <div className="text-sm font-bold font-mono text-amber-700">{wh.skuCount} SKU</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] uppercase text-slate-500">{i18n.stockCountTab.bookStockLabel}</div>
                                            <div className="text-sm font-bold font-mono text-emerald-700">{formatNumber(wh.totalBottles)} {i18n.stats.bottlesUnit}</div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpenPrintCount(wh.id)}
                                    className="w-full py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs bg-[#0E7490] hover:bg-[#155E75] text-white"
                                >
                                    <Printer size={14} /> {i18n.stockCountTab.openPrintBtn}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 5: AGREEMENTS */}
            {mainTab === 'agreements' && (
                <div className="rounded-lg overflow-hidden shadow-xs border border-slate-200 bg-white">
                    <div className="p-3.5 bg-white border-b border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{i18n.agreementsTab.title}</span>
                        <button
                            onClick={() => setCreateAgreementOpen(true)}
                            className="px-3 py-1.5 text-xs font-bold rounded cursor-pointer transition flex items-center gap-1 bg-[#0E7490] hover:bg-[#155E75] text-white"
                        >
                            <Plus size={14} /> {i18n.agreementsTab.addBtn}
                        </button>
                    </div>

                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{i18n.agreementsTab.colCode}</Th>
                                    <Th>{i18n.agreementsTab.colCustomer}</Th>
                                    <Th>{i18n.agreementsTab.colStatus}</Th>
                                    <Th>{i18n.agreementsTab.colFreq}</Th>
                                    <Th>{i18n.agreementsTab.colSkus}</Th>
                                    <Th>{i18n.agreementsTab.colTotalBottles}</Th>
                                    <Th>{i18n.agreementsTab.colValidity}</Th>
                                    <Th></Th>
                                </tr>
                            </THead>
                            <TBody>
                                {agreements.length === 0 ? (
                                    <TableMessageRow colSpan={8}>{i18n.agreementsTab.empty}</TableMessageRow>
                                ) : agreements.map(row => {
                                    const stStyle = STATUS_STYLE[row.status] ?? STATUS_STYLE.ACTIVE
                                    const stLabel = i18n.statuses[row.status] ?? row.status
                                    return (
                                        <Tr
                                            key={row.id}
                                            className="cursor-pointer"
                                            onClick={() => setSelectedAgreement(row)}
                                        >
                                            <Td className="font-bold font-mono text-[#0891B2]">
                                                CSG-{row.id.slice(-6).toUpperCase()}
                                            </Td>
                                            <Td className="font-semibold text-slate-900">{row.customerName}</Td>
                                            <Td>
                                                <span className="inline-block text-xs px-2 py-0.5 rounded font-bold whitespace-nowrap shrink-0" style={{ background: stStyle.bg, color: stStyle.color }}>
                                                    {stLabel}
                                                </span>
                                            </Td>
                                            <Td className="text-slate-600">
                                                {i18n.frequencies[row.reportFrequency] ?? row.reportFrequency}
                                            </Td>
                                            <Td className="font-bold font-mono text-[#B45309]">{row.stockCount}</Td>
                                            <Td className="font-bold font-mono text-slate-900">{formatNumber(row.totalQty)}</Td>
                                            <Td className="text-slate-500">
                                                {formatDate(row.startDate)} — {formatDate(row.endDate)}
                                            </Td>
                                            <Td>
                                                <ChevronRight size={14} className="text-slate-400" />
                                            </Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile Cards (<768px) */}
                    <div className="block md:hidden divide-y divide-slate-200">
                        {agreements.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-500">{i18n.agreementsTab.empty}</div>
                        ) : agreements.map(row => {
                            const stStyle = STATUS_STYLE[row.status] ?? STATUS_STYLE.ACTIVE
                            const stLabel = i18n.statuses[row.status] ?? row.status
                            return (
                                <div
                                    key={row.id}
                                    onClick={() => setSelectedAgreement(row)}
                                    className="p-3.5 space-y-2 hover:bg-slate-50 cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <span className="font-mono text-xs font-bold text-[#0891B2]">CSG-{row.id.slice(-6).toUpperCase()}</span>
                                            <p className="text-sm font-bold text-slate-900 mt-0.5">{row.customerName}</p>
                                        </div>
                                        <span className="inline-block text-[11px] px-2 py-0.5 rounded font-bold shrink-0" style={{ background: stStyle.bg, color: stStyle.color }}>
                                            {stLabel}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 text-slate-600">
                                        <span>{row.stockCount} SKU · {formatNumber(row.totalQty)} {i18n.stats.bottlesUnit}</span>
                                        <span>{formatDate(row.startDate)} — {formatDate(row.endDate)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* TAB 6: CONSIGNED STOCK MAP */}
            {mainTab === 'stockMap' && (
                <div className="space-y-4">
                    {alerts.length > 0 && (
                        <div className="p-4 rounded-lg bg-amber-50/70 border border-amber-200">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle size={15} className="text-[#B45309]" />
                                <span className="text-xs font-bold uppercase tracking-wide text-[#B45309]">
                                    {i18n.stockMapTab.alertBannerTitle} ({alerts.length} {i18n.stockMapTab.itemsCountUnit})
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {alerts.map((a, i) => (
                                    <div key={i} className="inline-flex items-center justify-between py-2 px-3 rounded-lg text-xs bg-white border border-slate-200">
                                        <div className="min-w-0 pr-2">
                                            <div className="font-semibold text-slate-900 truncate">{a.customerName}</div>
                                            <div className="text-[11px] text-[#0891B2] font-mono">{a.skuCode}</div>
                                        </div>
                                        <span className="font-bold font-mono text-rose-700 shrink-0">
                                            {i18n.stockMapTab.remainingPrefix} {a.qtyRemaining} {i18n.stats.bottlesUnit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-lg overflow-hidden border border-slate-200 bg-white shadow-xs">
                        <Table>
                            <THead>
                                <tr>
                                    <Th>{i18n.stockMapTab.colOutlet}</Th>
                                    <Th>{i18n.stockMapTab.colSku}</Th>
                                    <Th>{i18n.stockMapTab.colProduct}</Th>
                                    <Th>{i18n.stockMapTab.colConsigned}</Th>
                                    <Th>{i18n.stockMapTab.colSold}</Th>
                                    <Th>{i18n.stockMapTab.colRemaining}</Th>
                                    <Th>{i18n.stockMapTab.colPctSold}</Th>
                                </tr>
                            </THead>
                            <TBody>
                                {stockMap.length === 0 ? (
                                    <TableMessageRow colSpan={7}>{i18n.stockMapTab.empty}</TableMessageRow>
                                ) : stockMap.map((row, i) => {
                                    const barColor = row.pctSold >= 80 ? '#15803D' : row.pctSold >= 50 ? '#B45309' : '#0E7490'
                                    const isLow = row.qtyRemaining <= 10
                                    return (
                                        <Tr key={i} className={isLow ? 'bg-rose-50/40' : ''}>
                                            <Td className="font-semibold text-slate-900">{row.customerName}</Td>
                                            <Td className="font-bold font-mono text-[#0891B2]">{row.skuCode}</Td>
                                            <Td className="text-slate-700">{row.productName}</Td>
                                            <Td className="font-bold font-mono text-[#B45309]">{row.qtyConsigned}</Td>
                                            <Td className="font-bold font-mono text-[#15803D]">{row.qtySold}</Td>
                                            <Td className="font-bold font-mono" style={{ color: isLow ? '#E11D48' : '#0F172A' }}>
                                                {row.qtyRemaining}
                                                {isLow && (
                                                    <span className="inline-block ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-sans font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                                                        {i18n.stockMapTab.lowBadge}
                                                    </span>
                                                )}
                                            </Td>
                                            <Td>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(row.pctSold, 100)}%`, background: barColor }} />
                                                    </div>
                                                    <span className="text-xs font-bold font-mono text-slate-700">{row.pctSold.toFixed(0)}%</span>
                                                </div>
                                            </Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>

                    {/* Mobile Cards (<768px) */}
                    <div className="block md:hidden space-y-3">
                        {stockMap.length === 0 ? (
                            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                                {i18n.stockMapTab.empty}
                            </div>
                        ) : stockMap.map((row, i) => {
                            const barColor = row.pctSold >= 80 ? '#15803D' : row.pctSold >= 50 ? '#B45309' : '#0E7490'
                            const isLow = row.qtyRemaining <= 10
                            return (
                                <div key={i} className={`p-3.5 rounded-lg border space-y-2 ${isLow ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <span className="font-mono text-xs font-bold text-[#0891B2]">{row.skuCode}</span>
                                            <p className="text-sm font-bold text-slate-900 leading-snug">{row.productName}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">{row.customerName}</p>
                                        </div>
                                        {isLow && (
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                                                {i18n.stockMapTab.lowBadge}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-100 text-center">
                                        <div>
                                            <span className="text-[10px] text-slate-500 block">{i18n.stockMapTab.colConsigned}</span>
                                            <span className="font-mono font-bold text-[#B45309]">{row.qtyConsigned}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 block">{i18n.stockMapTab.colSold}</span>
                                            <span className="font-mono font-bold text-[#15803D]">{row.qtySold}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 block">{i18n.stockMapTab.colRemaining}</span>
                                            <span className="font-mono font-bold text-slate-900">{row.qtyRemaining}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                                            <div className="h-full rounded-full" style={{ width: `${Math.min(row.pctSold, 100)}%`, background: barColor }} />
                                        </div>
                                        <span className="text-xs font-bold font-mono text-slate-700">{row.pctSold.toFixed(0)}%</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* MODAL: CREATE CONSIGNMENT WAREHOUSE */}
            {createWHOpen && (
                <CreateConsignmentWarehouseModal
                    open={createWHOpen}
                    i18n={i18n}
                    onClose={() => setCreateWHOpen(false)}
                    onSuccess={() => { setCreateWHOpen(false); loadAll(); }}
                />
            )}

            {/* MODAL: CONSIGNMENT TRANSFER */}
            {createTransferOpen && (
                <CreateConsignmentTransferModal
                    open={createTransferOpen}
                    i18n={i18n}
                    preselectedWarehouseId={preselectedWarehouseId}
                    warehouses={warehouses}
                    onClose={() => setCreateTransferOpen(false)}
                    onSuccess={(transferNo) => {
                        setCreateTransferOpen(false)
                        loadAll()
                        if (transferNo) handleOpenPrintDispatch(transferNo)
                    }}
                />
            )}

            {/* MODAL: CONSIGNMENT SALE */}
            {createSaleOpen && (
                <CreateConsignmentSaleModal
                    open={createSaleOpen}
                    i18n={i18n}
                    formatCurrency={formatCurrency}
                    preselectedWarehouseId={preselectedWarehouseId}
                    warehouses={warehouses}
                    onClose={() => setCreateSaleOpen(false)}
                    onSuccess={() => { setCreateSaleOpen(false); loadAll(); }}
                />
            )}

            {/* MODAL: PRINT COUNT SHEET (A4) */}
            {printCountData && (
                <PrintableConsignmentCount
                    data={printCountData}
                    onClose={() => setPrintCountData(null)}
                />
            )}

            {/* MODAL: PRINT DISPATCH VOUCHER (A4) */}
            {printDispatchData && (
                <PrintableConsignmentDispatch
                    data={printDispatchData}
                    onClose={() => setPrintDispatchData(null)}
                />
            )}

            {/* MODAL / DRAWER: CREATE & INSPECT AGREEMENT */}
            <CreateDrawer open={createAgreementOpen} i18n={i18n} onClose={() => setCreateAgreementOpen(false)} onCreated={loadAll} />
            <DetailDrawer agreement={selectedAgreement} i18n={i18n} onClose={() => setSelectedAgreement(null)} />
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: CREATE CONSIGNMENT WAREHOUSE MODAL
// ═══════════════════════════════════════════════════
function CreateConsignmentWarehouseModal({ open, i18n, onClose, onSuccess }: {
    open: boolean
    i18n: ConsignmentI18n
    onClose: () => void
    onSuccess: () => void
}) {
    const m = i18n.modals.createWh
    const [customers, setCustomers] = useState<any[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState('')
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            getCustomerOptionsForCSG().then(setCustomers)
        }
    }, [open])

    const handleSelectCustomer = (cId: string) => {
        setSelectedCustomerId(cId)
        const c = customers.find(item => item.id === cId)
        if (c) {
            setName(`${m.whNamePrefix} ${c.name}`)
        }
    }

    const handleSubmit = async () => {
        if (!selectedCustomerId) {
            toast.error(m.errSelectCustomer)
            return
        }
        setLoading(true)
        try {
            const res = await createConsignmentWarehouse({
                customerId: selectedCustomerId,
                name: name.trim() || undefined,
                address: address.trim() || undefined,
            })
            if (!res.success) {
                toast.error(res.error || m.errCreate)
            } else {
                toast.success(m.toastCreated)
                onSuccess()
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-lg overflow-hidden shadow-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-[#0891B2]" />
                        <h3 className="text-base font-bold text-slate-900">{m.title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.customerLabel}</label>
                        <select
                            value={selectedCustomerId}
                            onChange={e => handleSelectCustomer(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        >
                            <option value="">{m.selectCustomerOpt}</option>
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.code} — {c.name} {c.customerType ? `(${c.customerType})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.whNameLabel}</label>
                        <input
                            type="text"
                            placeholder={m.whNamePlaceholder}
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">{m.autoCodeHint}</p>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.addressLabel}</label>
                        <input
                            type="text"
                            placeholder={m.addressPlaceholder}
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-500 space-y-1">
                        <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-700 shrink-0" /><span>{m.note1}</span></div>
                        <div className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-cyan-700 shrink-0" /><span>{m.note2}</span></div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                        >
                            {i18n.modals.cancelBtn}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-lg font-bold text-white cursor-pointer transition shadow-xs bg-[#0E7490] hover:bg-[#155E75]"
                        >
                            {loading ? m.creatingBtn : m.submitBtn}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: CONSIGNMENT TRANSFER MODAL
// ═══════════════════════════════════════════════════
function CreateConsignmentTransferModal({
    open, i18n, preselectedWarehouseId, warehouses, onClose, onSuccess
}: {
    open: boolean
    i18n: ConsignmentI18n
    preselectedWarehouseId?: string
    warehouses: ConsignmentWarehouseRow[]
    onClose: () => void
    onSuccess: (transferNo?: string) => void
}) {
    const m = i18n.modals.transfer
    const [internalWarehouses, setInternalWarehouses] = useState<{ id: string; code: string; name: string }[]>([])
    const [fromWarehouseId, setFromWarehouseId] = useState('')
    const [toWarehouseId, setToWarehouseId] = useState(preselectedWarehouseId || '')
    const [availableStock, setAvailableStock] = useState<any[]>([])
    const [notes, setNotes] = useState(m.defaultNotes)
    const [loading, setLoading] = useState(false)

    // Lines to transfer
    const [lines, setLines] = useState<{ productId: string; qtyTransferred: number; vintage?: number | null }[]>([])

    useEffect(() => {
        if (open) {
            getInternalWarehouses().then(whs => {
                setInternalWarehouses(whs)
                if (whs.length > 0) setFromWarehouseId(whs[0].id)
            })
            if (preselectedWarehouseId) setToWarehouseId(preselectedWarehouseId)
            else if (warehouses.length > 0) setToWarehouseId(warehouses[0].id)
        }
    }, [open, preselectedWarehouseId, warehouses])

    useEffect(() => {
        if (fromWarehouseId) {
            getWarehouseStockForTransfer(fromWarehouseId).then(setAvailableStock)
            setLines([])
        }
    }, [fromWarehouseId])

    const handleAddLine = (productId: string, vintage: number | null) => {
        const existingIdx = lines.findIndex(l => l.productId === productId && (l.vintage ?? null) === (vintage ?? null))
        if (existingIdx >= 0) return
        setLines(prev => [...prev, { productId, qtyTransferred: 6, vintage }])
    }

    const handleRemoveLine = (idx: number) => {
        setLines(prev => prev.filter((_, i) => i !== idx))
    }

    const handleQtyChange = (idx: number, qty: number) => {
        setLines(prev => {
            const next = [...prev]
            next[idx].qtyTransferred = Math.max(1, qty)
            return next
        })
    }

    const handleSubmit = async () => {
        if (!fromWarehouseId || !toWarehouseId) {
            toast.error(m.errSelectWarehouses)
            return
        }
        if (lines.length === 0) {
            toast.error(m.errSelectProduct)
            return
        }

        setLoading(true)
        try {
            const res = await createConsignmentTransfer({
                fromWarehouseId,
                toWarehouseId,
                notes,
                lines,
                instantReceive: true,
            })
            if (!res.success) {
                toast.error(res.error || m.errTransfer)
            } else {
                toast.success(`${m.toastSuccessPrefix} ${res.transferNo}`)
                onSuccess(res.transferNo)
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-lg overflow-hidden shadow-2xl bg-slate-50 border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5 text-[#B45309]" />
                        <h3 className="text-base font-bold text-slate-900">{m.title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-semibold mb-1 text-slate-700">{m.fromWhLabel}</label>
                            <select
                                value={fromWarehouseId}
                                onChange={e => setFromWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                            >
                                {internalWarehouses.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.code} — {wh.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block font-semibold mb-1 text-slate-700">{m.toWhLabel}</label>
                            <select
                                value={toWarehouseId}
                                onChange={e => setToWarehouseId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                            >
                                {warehouses.map(wh => (
                                    <option key={wh.id} value={wh.id}>{wh.code} — {wh.name} ({wh.customerName})</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.notesLabel}</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                    </div>

                    {/* Selected Items List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="font-bold text-slate-900">{m.itemsListTitle}</label>
                            <span className="text-slate-500">{m.selectedCountPrefix} {lines.length} {i18n.salesTab.itemsUnit}</span>
                        </div>

                        {lines.length === 0 ? (
                            <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center text-slate-400">
                                {m.emptyLines}
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {lines.map((line, idx) => {
                                    const prod = availableStock.find(s => s.productId === line.productId && (s.vintage ?? null) === (line.vintage ?? null))
                                    return (
                                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <div className="font-semibold text-slate-900 truncate">{prod?.productName || line.productId}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    SKU: <span className="font-mono text-[#0891B2]">{prod?.skuCode}</span> | {m.vintageLabel} {line.vintage || 'NV'} | {m.availableLabel} {prod?.qtyAvailable || 0} {i18n.stats.bottlesUnit}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={prod?.qtyAvailable || 9999}
                                                    value={line.qtyTransferred}
                                                    onChange={e => handleQtyChange(idx, Number(e.target.value))}
                                                    className="w-20 px-2 py-1 text-center font-bold font-mono rounded bg-white border border-slate-200 text-slate-900"
                                                />
                                                <button
                                                    onClick={() => handleRemoveLine(idx)}
                                                    className="p-1 hover:bg-rose-50 text-rose-700 rounded cursor-pointer"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Source Warehouse Product Picker */}
                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">
                            {m.pickProductLabelPrefix} ({availableStock.length} {m.pickProductLabelSuffix}):
                        </label>
                        <div className="max-h-36 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-lg bg-white border border-slate-200">
                            {availableStock.map(item => (
                                <button
                                    key={item.productId + (item.vintage || '')}
                                    type="button"
                                    onClick={() => handleAddLine(item.productId, item.vintage)}
                                    className="p-2 rounded bg-white hover:bg-slate-100 text-left border border-slate-200 cursor-pointer flex justify-between items-center"
                                >
                                    <div className="truncate pr-1">
                                        <div className="font-medium text-slate-900 truncate">{item.productName}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{item.skuCode} {item.vintage ? `(${item.vintage})` : ''}</div>
                                    </div>
                                    <span className="text-[11px] font-bold font-mono text-emerald-600 whitespace-nowrap">
                                        {item.qtyAvailable} {i18n.stats.bottlesUnit}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                        >
                            {i18n.modals.cancelBtn}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-lg font-bold text-white cursor-pointer transition shadow-xs bg-[#B45309] hover:bg-[#92400E]"
                        >
                            {loading ? m.submittingBtn : m.submitBtn}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: CONSIGNMENT SALE MODAL
// ═══════════════════════════════════════════════════
function CreateConsignmentSaleModal({
    open, i18n, formatCurrency, preselectedWarehouseId, warehouses, onClose, onSuccess
}: {
    open: boolean
    i18n: ConsignmentI18n
    formatCurrency: (val: number) => string
    preselectedWarehouseId?: string
    warehouses: ConsignmentWarehouseRow[]
    onClose: () => void
    onSuccess: () => void
}) {
    const m = i18n.modals.sale
    const [warehouseId, setWarehouseId] = useState(preselectedWarehouseId || '')
    const [stockItems, setStockItems] = useState<any[]>([])
    const [saleItems, setSaleItems] = useState<{ productId: string; qty: number; vintage?: number | null; unitPrice: number }[]>([])
    const [notes, setNotes] = useState(m.defaultNotes)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            if (preselectedWarehouseId) setWarehouseId(preselectedWarehouseId)
            else if (warehouses.length > 0) setWarehouseId(warehouses[0].id)
        }
    }, [open, preselectedWarehouseId, warehouses])

    useEffect(() => {
        if (warehouseId) {
            getWarehouseStockForTransfer(warehouseId).then(items => {
                setStockItems(items)
                setSaleItems([])
            })
        }
    }, [warehouseId])

    const handleAddSaleItem = (item: any) => {
        const existing = saleItems.find(s => s.productId === item.productId && (s.vintage ?? null) === (item.vintage ?? null))
        if (existing) return
        setSaleItems(prev => [...prev, {
            productId: item.productId,
            qty: 1,
            vintage: item.vintage,
            unitPrice: 500000,
        }])
    }

    const handleRemoveSaleItem = (idx: number) => {
        setSaleItems(prev => prev.filter((_, i) => i !== idx))
    }

    const handleQtyChange = (idx: number, qty: number) => {
        setSaleItems(prev => {
            const next = [...prev]
            next[idx].qty = Math.max(1, qty)
            return next
        })
    }

    const handlePriceChange = (idx: number, price: number) => {
        setSaleItems(prev => {
            const next = [...prev]
            next[idx].unitPrice = Math.max(0, price)
            return next
        })
    }

    const totalAmount = saleItems.reduce((s, item) => s + (item.qty * item.unitPrice), 0)

    const handleSubmit = async () => {
        if (!warehouseId) {
            toast.error(m.errSelectWh)
            return
        }
        if (saleItems.length === 0) {
            toast.error(m.errSelectItems)
            return
        }

        setLoading(true)
        try {
            const res = await sellFromConsignmentWarehouse({
                warehouseId,
                notes,
                items: saleItems,
            })
            if (!res.success) {
                toast.error(res.error || m.errSale)
            } else {
                toast.success(m.toastSuccess(res.soNo ?? '', res.invoiceNo ?? ''))
                onSuccess()
            }
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-lg overflow-hidden shadow-2xl bg-slate-50 border border-slate-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-[#15803D]" />
                        <h3 className="text-base font-bold text-slate-900">{m.title}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.whLabel}</label>
                        <select
                            value={warehouseId}
                            onChange={e => setWarehouseId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-900"
                        >
                            {warehouses.map(wh => (
                                <option key={wh.id} value={wh.id}>
                                    {wh.name} — {m.customerPrefix} {wh.customerName} ({wh.totalBottles} {m.inStockSuffix})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.notesLabel}</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900"
                        />
                    </div>

                    {/* Selected Sale Items */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="font-bold text-slate-900">{m.itemsTitle}</label>
                            <span className="text-slate-500">{m.selectedSkusPrefix} {saleItems.length} {m.skusUnit}</span>
                        </div>

                        {saleItems.length === 0 ? (
                            <div className="p-4 rounded-lg bg-white border border-dashed border-slate-200 text-center text-slate-400">
                                {m.emptyItems}
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {saleItems.map((item, idx) => {
                                    const stock = stockItems.find(s => s.productId === item.productId && (s.vintage ?? null) === (item.vintage ?? null))
                                    return (
                                        <div key={idx} className="flex flex-wrap items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 gap-2">
                                            <div className="flex-1 min-w-[160px]">
                                                <div className="font-semibold text-slate-900 truncate">{stock?.productName || item.productId}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    SKU: <span className="font-mono text-[#0891B2]">{stock?.skuCode}</span> | {i18n.modals.transfer.vintageLabel} {item.vintage || 'NV'} | {m.stockLabel} {stock?.qtyAvailable || 0} {i18n.stats.bottlesUnit}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div>
                                                    <div className="text-[10px] text-slate-400 mb-0.5 text-center">{m.qtyLabel}</div>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={stock?.qtyAvailable || 9999}
                                                        value={item.qty}
                                                        onChange={e => handleQtyChange(idx, Number(e.target.value))}
                                                        className="w-16 px-1.5 py-1 text-center font-bold font-mono rounded bg-white border border-slate-200 text-slate-900"
                                                    />
                                                </div>

                                                <div>
                                                    <div className="text-[10px] text-slate-400 mb-0.5 text-center">{m.unitPriceLabel}</div>
                                                    <input
                                                        type="number"
                                                        step={10000}
                                                        value={item.unitPrice}
                                                        onChange={e => handlePriceChange(idx, Number(e.target.value))}
                                                        className="w-28 px-2 py-1 text-right font-mono rounded bg-white border border-slate-200 text-slate-900 font-bold"
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => handleRemoveSaleItem(idx)}
                                                    className="p-1 mt-3 hover:bg-rose-50 text-rose-700 rounded cursor-pointer"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Pick from Consignment Stock */}
                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">
                            {m.pickFromStockPrefix} ({stockItems.length} SKU):
                        </label>
                        {stockItems.length === 0 ? (
                            <div className="p-3 rounded bg-white border border-slate-200 text-center text-slate-400">
                                {m.emptyWarehouseStock}
                            </div>
                        ) : (
                            <div className="max-h-32 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 rounded-lg bg-white border border-slate-200">
                                {stockItems.map(item => (
                                    <button
                                        key={item.productId + (item.vintage || '')}
                                        type="button"
                                        onClick={() => handleAddSaleItem(item)}
                                        className="p-2 rounded bg-white hover:bg-slate-100 text-left border border-slate-200 cursor-pointer flex justify-between items-center"
                                    >
                                        <div className="truncate pr-1">
                                            <div className="font-medium text-slate-900 truncate">{item.productName}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{item.skuCode} {item.vintage ? `(${item.vintage})` : ''}</div>
                                        </div>
                                        <span className="text-[11px] font-bold font-mono text-emerald-600 whitespace-nowrap">
                                            {item.qtyAvailable} {i18n.stats.bottlesUnit}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Total Summary */}
                    <div className="p-3 rounded-lg bg-white border border-slate-200 flex justify-between items-center">
                        <span className="text-slate-500 font-semibold uppercase text-[11px]">{m.totalSaleValueLabel}</span>
                        <div className="text-right">
                            <div className="text-base font-bold font-mono text-[#15803D]">{formatCurrency(totalAmount)}</div>
                            <div className="text-[10px] text-slate-400">+ VAT 10%: {formatCurrency(totalAmount * 0.1)}</div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold cursor-pointer"
                        >
                            {i18n.modals.cancelBtn}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleSubmit}
                            className="px-5 py-2 rounded-lg font-bold text-white cursor-pointer transition shadow-xs bg-[#15803D] hover:bg-[#166534]"
                        >
                            {loading ? m.submittingBtn : m.submitBtn}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: CREATE AGREEMENT DRAWER
// ═══════════════════════════════════════════════════
function CreateDrawer({ open, i18n, onClose, onCreated }: {
    open: boolean; i18n: ConsignmentI18n; onClose: () => void; onCreated: () => void
}) {
    const m = i18n.modals.agreement
    const [customers, setCustomers] = useState<any[]>([])
    const [form, setForm] = useState<{ customerId: string; reportFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'AS_NEEDED'; startDate: string; endDate: string }>({ customerId: '', reportFrequency: 'MONTHLY', startDate: '', endDate: '' })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) getCustomerOptionsForCSG().then(setCustomers)
    }, [open])

    const handleSubmit = async () => {
        if (!form.customerId || !form.startDate || !form.endDate) {
            toast.error(m.errFillAll)
            return
        }
        setLoading(true)
        try {
            const res = await createConsignmentAgreement(form)
            if (!res.success) throw new Error(res.error || m.errCreate)
            toast.success(m.toastCreated)
            onCreated()
            onClose()
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
            <div className="w-full max-w-[480px] h-full overflow-y-auto bg-slate-50 border-l border-slate-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white">
                    <h3 className="text-lg font-bold text-slate-900">{m.createTitle}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4 text-xs">
                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.customerLabel}</label>
                        <select
                            value={form.customerId}
                            onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                        >
                            <option value="">{m.selectCustOpt}</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block font-semibold mb-1 text-slate-700">{m.freqLabel}</label>
                        <select
                            value={form.reportFrequency}
                            onChange={e => setForm(f => ({ ...f, reportFrequency: e.target.value as any }))}
                            className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                        >
                            {Object.entries(i18n.frequencies).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block font-semibold mb-1 text-slate-700">{m.startDateLabel}</label>
                            <input
                                type="date"
                                value={form.startDate}
                                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                            />
                        </div>
                        <div>
                            <label className="block font-semibold mb-1 text-slate-700">{m.endDateLabel}</label>
                            <input
                                type="date"
                                value={form.endDate}
                                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                                className="w-full px-3 py-2 rounded bg-white border border-slate-200 text-slate-900"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-2.5 font-bold rounded cursor-pointer transition-all mt-4 text-white bg-[#0E7490] hover:bg-[#155E75] disabled:opacity-50"
                    >
                        {loading ? m.creatingBtn : m.submitBtn}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════
// SUB-COMPONENT: DETAIL DRAWER (Agreement)
// ═══════════════════════════════════════════════════
function DetailDrawer({ agreement, i18n, onClose }: {
    agreement: ConsignmentRow | null; i18n: ConsignmentI18n; onClose: () => void
}) {
    const m = i18n.modals.agreement
    const [stocks, setStocks] = useState<ConsignmentStockRow[]>([])

    const loadData = useCallback(async () => {
        if (!agreement) return
        const s = await getConsignmentStocks(agreement.id)
        setStocks(s)
    }, [agreement])

    useEffect(() => { loadData() }, [loadData])

    if (!agreement) return null
    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
            <div className="w-full max-w-[540px] h-full overflow-y-auto bg-slate-50 border-l border-slate-200 flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-white">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">{agreement.customerName}</h3>
                        <p className="text-xs text-slate-400">{m.detailSubtitlePrefix} CSG-{agreement.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X size={18} /></button>
                </div>

                <div className="p-5 flex-1 overflow-y-auto space-y-4 text-xs">
                    <div className="rounded-lg overflow-x-auto border border-slate-200 bg-white">
                        <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-slate-900">{m.detailTableTitle}</div>
                        <table className="w-full text-left min-w-[420px]">
                            <thead>
                                <tr className="bg-white text-slate-500 text-[11px] border-b border-slate-200">
                                    <th className="p-2">{i18n.stockMapTab.colSku}</th>
                                    <th className="p-2">{i18n.stockMapTab.colProduct}</th>
                                    <th className="p-2 text-right">{i18n.stockMapTab.colConsigned}</th>
                                    <th className="p-2 text-right">{i18n.stockMapTab.colSold}</th>
                                    <th className="p-2 text-right">{i18n.stockMapTab.colRemaining}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stocks.length === 0 ? (
                                    <tr><td colSpan={5} className="p-4 text-center text-slate-500">{m.emptyStocks}</td></tr>
                                ) : stocks.map(st => (
                                    <tr key={st.id} className="border-b border-slate-200">
                                        <td className="p-2 font-mono text-[#0891B2]">{st.skuCode}</td>
                                        <td className="p-2 text-slate-900">{st.productName}</td>
                                        <td className="p-2 text-right font-mono text-amber-600">{st.qtyConsigned}</td>
                                        <td className="p-2 text-right font-mono text-emerald-600">{st.qtySold}</td>
                                        <td className="p-2 text-right font-mono font-bold text-slate-900">{st.qtyRemaining}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ConsignmentClient
